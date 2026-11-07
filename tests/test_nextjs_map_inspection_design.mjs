import assert from 'node:assert/strict';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {chromium} from '@playwright/test';import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockMapInspection,inspectionCases} from './fixtures/nextjs-map-inspection.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),out='.cache/design-parity/map-inspection';await mkdir(out,{recursive:true});
const cases=process.env.MAP_INSPECTION_CASES?.split(',')||inspectionCases,themes=process.env.MAP_INSPECTION_THEMES?.split(',')||['yellow','cobalt','navy-light','navy'],sizes=process.env.MAP_INSPECTION_SIZES?.split(',')||['desktop','mobile'],report=[],browser=await chromium.launch();
try{for(const screen of cases)for(const theme of themes)for(const size of sizes){
 const viewport=size==='desktop'?{width:1440,height:1000}:{width:390,height:844},prefix=out+'/'+screen+'-'+theme+'-'+size,content=[];
 for(const original of [true,false]){
  const context=await browser.newContext({serviceWorkers:'block',viewport,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>{localStorage.setItem('finfolk-theme',theme);localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');},theme);
  const fixture=await mockMapInspection(page,base,screen);await page.route('**/__original-inspection*',r=>r.fulfill({contentType:'text/html',body:html}));
  try{
   await page.goto(base+(original?'/__original-inspection?view=maps':'/map'));
   await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();const settings=page.getByRole('dialog',{name:'Settings',exact:true});
   await settings.getByText(fixture.status,{exact:true}).waitFor();
   await page.evaluate(async()=>{const {DepthMap}=await import('/map.js'),draw=DepthMap.prototype.draw;DepthMap.prototype.draw=function(...args){window.inspectionMap=this;return draw.apply(this,args);};});
   await settings.locator('#basemap-layer').uncheck();if(fixture.pins){await settings.locator('#pin-layer').check();}
   await settings.getByRole('button',{name:'Close settings',exact:true}).click();await page.locator('.ff-primary-nav').getByText('People',{exact:true}).waitFor();
   await page.waitForFunction(()=>window.inspectionMap?.ready);
   if(fixture.selection){await page.locator('#map-search').fill(fixture.selection.name);await page.locator('#map-match-beach-'+fixture.selection.id).click();await page.getByRole('heading',{name:fixture.selection.name,exact:true,level:2}).waitFor();await page.getByRole('button',{name:'Close map details',exact:true}).click();}
   if(fixture.pins)await page.waitForFunction(()=>window.inspectionMap.pinHits.length>0);
   const position=await page.evaluate(({point,pins})=>{const [x,y]=pins?[window.inspectionMap.pinHits[0].x,window.inspectionMap.pinHits[0].y-17]:window.inspectionMap.toScreen(point);return{x,y};},{point:fixture.point,pins:fixture.pins});await page.locator('#map').click({position});
   const expected=screen==='loading'?'Inspecting…':screen==='error'?'Unavailable':screen==='above'?'3 m':screen==='no-data'?'No depth data':screen==='estimate'?'≈ 15 m':screen==='footprint'?'Synthetic survey':screen==='regional'?'25 m regional contour':screen==='group-raster'?'13 records':screen.startsWith('group')?'12 records':'10 m';
   await page.locator('#inspection-value').filter({hasText:expected}).waitFor().catch(async error=>{console.error({screen,original,expected,actual:await page.locator('#inspection').innerText(),map:await page.evaluate(()=>({zoom:window.inspectionMap.zoom,pins:window.inspectionMap.pinHits.map(p=>p.members.length)}))});throw error;});
   if(screen==='group-next'||screen==='group-record'||screen==='group-raster'){await page.locator('#inspection').getByRole('button',{name:'Next',exact:true}).click();await page.locator('#inspection .pin-pages').getByText('2 / 2',{exact:true}).waitFor();}
   if(screen==='group-record'){await page.locator('#inspection .pin-record').first().click();await page.locator('#inspection-kind').filter({hasText:'PUBLISHED CONTOUR'}).waitFor();}
   if(screen==='group-raster'){await page.locator('#inspection').getByRole('button',{name:'Raster cell',exact:true}).click();await page.locator('#inspection-kind').filter({hasText:'SURVEYED REFERENCE DEPTH'}).waitFor();}
   if(screen==='group-spread')assert.ok(await page.evaluate(()=>window.inspectionMap.zoom>10));
   if(screen==='above')assert.equal(await page.locator('#inspection-kind').textContent(),'ELEVATION ABOVE DATUM');
   if(screen==='estimate')assert.match(await page.locator('#inspection-details').textContent(),/original DATUM code 12/);
   if(screen==='loading'){await fixture.requestStarted;assert.equal(fixture.requested(),true);}
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   content.push(await page.locator('#inspection').innerText());await page.screenshot({path:prefix+(original?'-reference.png':'-react.png')});assert.deepEqual(errors,[]);
  }finally{fixture.release();await context.close();}
 }
 assert.equal(content[1],content[0],'Inspection text differs for '+screen);
 const reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));assert.equal(reference.width,actual.width);assert.equal(reference.height,actual.height);const diff=new PNG({width:actual.width,height:actual.height}),ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));report.push({screen,theme,size,ratio});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
}
 assert.ok(report.every(row=>row.ratio<=.005),'Inspection designs differ: '+out+'/report.json');console.log('MAP_INSPECTION_DESIGN_PASS: independent original/native elevation, gaps/errors/loading, interpolation, contour labels/source records, grouped pagination/member selection and raster footprint, with exact inspector text.');
}finally{await browser.close();}
