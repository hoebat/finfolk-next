import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {atlasContours} from './fixtures/nextjs-atlas.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),out='.cache/design-parity/contour-loading';await mkdir(out,{recursive:true});
const themes=process.env.CONTOUR_THEME?[process.env.CONTOUR_THEME]:['yellow','cobalt','navy-light','navy'],report=[],browser=await chromium.launch();
try{for(const stage of ['pending','error'])for(const theme of themes)for(const [size,viewport]of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const texts={};
 for(const original of [true,false]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>{localStorage.setItem('finfolk-theme',theme);localStorage.setItem('finfolk:welcome','1');sessionStorage.setItem('fixture:guest','yes');},theme);
  await mockMapTools(page,base);await page.route('**/__original-contours*',route=>route.fulfill({contentType:'text/html',body:html}));
  let release,started,failed=stage==='error';const pending=new Promise(resolve=>{release=resolve;}),requestStarted=new Promise(resolve=>{started=resolve;});
  await page.route('**/data/example-bay-contours.json*',async route=>{started();if(stage==='pending')await pending;await route.fulfill(failed?{status:503,json:{error:'Synthetic unavailable contours'}}:{json:atlasContours});});
  try{
   await page.goto(base+(original?'/__original-contours?view=maps':'/map'));await requestStarted;
   if(stage==='error')await page.locator('#notice').filter({hasText:'503'}).waitFor();
   else await page.waitForFunction(async()=>{const {activity}=await import('/activity.js'),s=activity.snapshot();return s.active===1&&!s.queued;});
   const settings=page.getByRole('dialog',{name:'Settings',exact:true}),open=async()=>{await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();await settings.waitFor();};
   texts[original?'reference':'react']={};
   const capture=async screen=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));texts[original?'reference':'react'][screen]=await page.evaluate(()=>({notice:document.getElementById('notice').textContent,status:document.getElementById('data-status').textContent,source:document.getElementById('source-summary').textContent,measurementAvailable:!document.getElementById('measure-start').disabled,depths:document.getElementById('measure-start').disabled?[]:[...document.getElementById('measure-depth').options].map(option=>option.textContent)}));await page.screenshot({path:`${out}/${stage}-${theme}-${size}-${screen}-${original?'reference':'react'}.png`});};
   await capture('map');await open();await settings.getByText('1 raster source available',{exact:true}).waitFor();await capture('settings');
   if(stage==='pending')release();else{failed=false;await settings.getByRole('combobox',{name:'Published depth map',exact:true}).selectOption('second-bay');await settings.getByText('2 published contours',{exact:true}).waitFor();await settings.getByRole('combobox',{name:'Published depth map',exact:true}).selectOption('example-bay');}
   await page.waitForFunction(()=>document.getElementById('measure-depth').options.length===2&&document.getElementById('data-status').textContent==='1 raster source available'&&document.getElementById('notice').hidden);
   await page.waitForFunction(async()=>{const {activity}=await import('/activity.js'),s=activity.snapshot();return !s.active&&!s.queued;});
   await capture('recovered-settings');await settings.getByRole('button',{name:'Close settings',exact:true}).click();await capture('recovered-map');assert.deepEqual(errors,[]);
  }finally{release();await context.close();}
 }
 for(const screen of ['map','settings','recovered-settings','recovered-map']){
  const prefix=`${out}/${stage}-${theme}-${size}-${screen}`,reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));assert.equal(reference.width,actual.width);assert.equal(reference.height,actual.height);
  const diff=new PNG({width:actual.width,height:actual.height}),ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height),textEqual=JSON.stringify(texts.reference[screen])===JSON.stringify(texts.react[screen]);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));if(!textEqual)await writeFile(prefix+'-text.json',JSON.stringify({reference:texts.reference[screen],actual:texts.react[screen]},null,2));report.push({stage,theme,size,screen,ratio,textEqual});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 }
}
 assert.ok(report.every(row=>row.ratio<=.005&&row.textEqual),'Contour-loading comparison failed: '+out+'/report.json');console.log(`CONTOUR_LOADING_DESIGN_PASS: ${report.length} original/native pending, failed and recovered contour states; map/settings copy and controls, ${themes.length} themes and desktop/mobile.`);
}finally{await browser.close();}
