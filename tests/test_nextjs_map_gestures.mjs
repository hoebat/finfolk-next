import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {chromium} from '@playwright/test';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),browser=await chromium.launch();
try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const records=[];
 for(const original of [true,false]){
  const context=await browser.newContext({serviceWorkers:'block',viewport,hasTouch:true}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');});await mockMapTools(page,base);await page.route('**/__original-gestures*',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto(base+(original?'/__original-gestures?view=maps':'/map'));
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.getByText('1 raster source available',{exact:true}).waitFor();
  await page.evaluate(async()=>{const {DepthMap}=await import('/map.js'),draw=DepthMap.prototype.draw;DepthMap.prototype.draw=function(...args){window.gestureMap=this;return draw.apply(this,args);};});await settings.locator('#basemap-layer').uncheck();await settings.locator('#contour-layer').uncheck();await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  const canvas=page.locator('#map'),box=await canvas.boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.45,cdp=await context.newCDPSession(page),states=[];
  async function snapshot(){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.evaluate(()=>({center:[...window.gestureMap.center],zoom:window.gestureMap.zoom,drag:!!window.gestureMap.drag,pinch:!!window.gestureMap.pinch,touches:window.gestureMap.touchPoints.size}));}
  states.push(await snapshot());await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+65,y+35,{steps:5});await page.mouse.up();states.push(await snapshot());assert.notDeepEqual(states[1].center,states[0].center);
  await page.mouse.move(x-30,y-20);await page.mouse.wheel(0,-80);await page.waitForFunction(zoom=>window.gestureMap.zoom===zoom+1,states[1].zoom);states.push(await snapshot());
  await canvas.focus();await canvas.press('ArrowRight');await canvas.press('ArrowDown');await canvas.press('-');states.push(await snapshot());assert.equal(states[3].zoom,states[1].zoom);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-25,y,id:1},{x:x+25,y,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-65,y:y-5,id:1},{x:x+65,y:y+5,id:2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});states.push(await snapshot());assert.ok(states[4].zoom>states[3].zoom);assert.equal(states[4].touches,0);assert.equal(states[4].drag,false);assert.equal(states[4].pinch,false);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y+15,id:3}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});states.push(await snapshot());assert.equal(states[5].touches,0);assert.equal(states[5].drag,false);
  records.push(states);
  if(!original){
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:4}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+15,y:y+5,id:4}]});
   await page.getByRole('link',{name:'Discover',exact:true}).focus();await page.keyboard.press('Enter');await page.getByRole('heading',{name:'Discover',exact:true}).waitFor();
   const hidden=await snapshot();assert.equal(hidden.touches,0,'leaving the native map cancels touch capture');assert.equal(hidden.drag,false);assert.equal(hidden.pinch,false);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   await page.goBack();await page.locator('#explorer:not([hidden])[aria-busy=false]').waitFor();assert.equal((await snapshot()).touches,0);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 assert.deepEqual(records[1],records[0],'native mouse/wheel/keyboard/pinch/cancel camera results must match the original');
}
console.log('MAP_GESTURES_PASS: actual mouse drag, wheel anchor, keyboard pan/zoom, CDP two-finger pinch and touch cancellation match original camera state on desktop/mobile; native navigation releases active gestures.');
}finally{await browser.close();}
