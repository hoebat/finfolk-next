import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockMapTools,mapDataset} from './fixtures/nextjs-map.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),out='.cache/design-parity/map-startup';await mkdir(out,{recursive:true});
const themes=process.env.MAP_STARTUP_THEME?[process.env.MAP_STARTUP_THEME]:['yellow','cobalt','navy-light','navy'],report=[],browser=await chromium.launch();
try{for(const stage of ['pending','error'])for(const theme of themes)for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const texts={};
 for(const original of [true,false]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>{localStorage.setItem('finfolk-theme',theme);localStorage.setItem('finfolk:welcome','1');sessionStorage.setItem('fixture:guest','yes');},theme);
  await mockMapTools(page,base);await page.route('**/__original-startup*',route=>route.fulfill({contentType:'text/html',body:html}));
  let release,started,failed=stage==='error';const pending=new Promise(resolve=>{release=resolve;}),requestStarted=new Promise(resolve=>{started=resolve;});
  await page.route('**/data/catalog.json*',async route=>{started();if(stage==='pending')await pending;try{await route.fulfill(failed?{status:503,json:{error:'Synthetic unavailable catalogue'}}:{json:mapDataset.catalog});}catch(error){if(!page.isClosed())throw error;}});
  try{
   await page.goto(base+(original?'/__original-startup?view=maps':'/map'));await requestStarted;
   if(stage==='error')await page.locator('#notice').filter({hasText:'Cannot load published data:'}).waitFor();
   await page.locator('#map-search').waitFor();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
   texts[original?'reference':'react']={};
   for(const screen of ['map','settings']){
    if(screen==='settings'){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();await page.getByRole('dialog',{name:'Settings',exact:true}).waitFor();}
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    texts[original?'reference':'react'][screen]=await page.locator('#notice').textContent();await page.screenshot({path:`${out}/${stage}-${theme}-${size}-${screen}-${original?'reference':'react'}.png`});
   }
   // A completed read or reconnect/reload must remove the initial prompt once
   // published survey coverage has actually been established.
   if(stage==='pending'){release();await page.getByText('1 raster source available',{exact:true}).waitFor();}else{failed=false;await page.reload();}
   await page.locator('#empty-state').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);
  }finally{release();await context.close();}
 }
 for(const screen of ['map','settings']){
  const prefix=`${out}/${stage}-${theme}-${size}-${screen}`,reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));assert.equal(reference.width,actual.width);assert.equal(reference.height,actual.height);
  const diff=new PNG({width:actual.width,height:actual.height}),ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));report.push({stage,theme,size,screen,ratio,textEqual:texts.react[screen]===texts.reference[screen]});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 }
}
 assert.ok(report.every(row=>row.ratio<=.005&&row.textEqual),'Map startup original comparison failed: '+out+'/report.json');console.log(`MAP_STARTUP_DESIGN_PASS: ${report.length} original/native initial-catalogue loading/failure map and settings states, identical error copy, ${themes.length} themes and desktop/mobile.`);
}finally{await browser.close();}
