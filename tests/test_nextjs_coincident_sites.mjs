import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockCoincidentSites} from './fixtures/nextjs-coincident-sites.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),out='.cache/design-parity/coincident-sites';await mkdir(out,{recursive:true});
const themes=process.env.COINCIDENT_THEME?[process.env.COINCIDENT_THEME]:['yellow','cobalt','navy-light','navy'],report=[],browser=await chromium.launch();
try{for(const theme of themes)for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const texts={};
 for(const original of [true,false]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>{localStorage.setItem('finfolk-theme',theme);localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');},theme);await mockCoincidentSites(page,base);await page.route('**/__original-coincident*',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto(base+(original?'/__original-coincident?view=maps':'/map'));
  const settings=page.getByRole('dialog',{name:'Settings',exact:true}),map=page.locator('#map');
  const openSettings=async()=>{await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();};
  await openSettings();await settings.getByText('1 raster source available',{exact:true}).waitFor();await settings.locator('#basemap-layer').uncheck();await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.evaluate(async()=>{const {DepthMap}=await import('/map.js'),draw=DepthMap.prototype.draw;DepthMap.prototype.draw=function(...args){window.coincidentMap=this;return draw.apply(this,args);};const {StaticData}=await import('/data-client.js'),derived=StaticData.prototype.derivedContours;window.coincidentDerived=0;StaticData.prototype.derivedContours=async function(...args){const result=await derived.apply(this,args);window.coincidentDerived++;return result;};});
  const choose=async id=>{await page.locator('#map-search').fill(id);await page.locator('#map-match-beach-'+id).click();await page.getByRole('heading',{name:id==='bondi'?'Bondi Beach':'Portsea Beach',exact:true,level:2}).waitFor();await page.waitForFunction(()=>window.coincidentMap?.beachHits.length===2);await page.locator('#regulars-panel .buddy-card').filter({hasText:'Maya'}).waitFor({state:'attached'});};
  const capture=async state=>{await page.waitForFunction(()=>window.coincidentDerived>0);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));texts[original?'reference':'react'][state]=await page.locator('#place-title').textContent();await page.screenshot({path:`${out}/${theme}-${size}-${state}-${original?'reference':'react'}.png`});};
  texts[original?'reference':'react']={};await choose('bondi');await page.getByRole('button',{name:'Close map details',exact:true}).click();
  const hit=await page.evaluate(()=>{const hits=window.coincidentMap.beachHits;return hits.map(hit=>({id:hit.beach.id,x:hit.x,y:hit.y}));});assert.deepEqual(hit.map(hit=>hit.id),['bondi','portsea']);assert.equal(hit[0].x,hit[1].x);assert.equal(hit[0].y,hit[1].y);
  const position={x:hit[1].x,y:hit[1].y};await map.hover({position});assert.match(await map.getAttribute('title'),/^Portsea Beach/);await map.click({position});await page.getByRole('heading',{name:'Portsea Beach',exact:true,level:2}).waitFor();assert.equal(new URL(page.url()).searchParams.get('site'),'portsea');await capture('top-marker');
  await choose('bondi');assert.equal(new URL(page.url()).searchParams.get('site'),'bondi');await capture('alternate-search');
  await page.getByRole('button',{name:'Close map details',exact:true}).click();await openSettings();await settings.getByRole('button',{name:'⌁ Draw depth profile',exact:true}).click();await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  await map.hover({position});assert.equal(await map.getAttribute('title'),'');await map.click({position});assert.equal(await page.getByRole('button',{name:'Finish profile',exact:true}).isEnabled(),false);assert.equal(new URL(page.url()).searchParams.get('site'),'bondi');assert.equal(await page.evaluate(()=>window.coincidentMap.selectedBeach),'bondi');await capture('profile-point');
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const state of ['top-marker','alternate-search','profile-point']){
  assert.equal(texts.react[state],texts.reference[state]);const prefix=`${out}/${theme}-${size}-${state}`,reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));assert.equal(actual.width,reference.width);assert.equal(actual.height,reference.height);
  const diff=new PNG({width:actual.width,height:actual.height}),ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));report.push({theme,size,state,ratio});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 }
}
 assert.ok(report.every(row=>row.ratio<=.005),'Coincident-site original comparison failed: '+out+'/report.json');console.log(`COINCIDENT_SITES_PASS: ${report.length} original/native comparisons; topmost coincident marker selection, alternate search and profile-point priority match across themes and sizes.`);
}finally{await browser.close();}
