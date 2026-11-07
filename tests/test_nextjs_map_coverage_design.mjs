import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';import pixelmatch from 'pixelmatch';
import {mockMapCoverage,coverageSites} from './fixtures/nextjs-map-coverage.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8')).replace('<head>','<head><base href="/">'),out='.cache/design-parity/map-coverage';await mkdir(out,{recursive:true});
const cases=process.env.MAP_COVERAGE_CASES?.split(',')||['boat','quarry','unsurveyed','context','context-settings','far','no-data-inspection'];
const themes=process.env.MAP_COVERAGE_THEMES?.split(',')||['yellow','cobalt','navy-light','navy'];
const sizes=process.env.MAP_COVERAGE_SIZES?.split(',')||['desktop','mobile'];
const report=[],browser=await chromium.launch();
try{for(const screen of cases)for(const theme of themes)for(const size of sizes){
 const viewport=size==='desktop'?{width:1440,height:1000}:{width:390,height:844},context=await browser.newContext({serviceWorkers:'block',viewport,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
 await context.addInitScript(theme=>{localStorage.setItem('finfolk-theme',theme);localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');},theme);
 await mockMapCoverage(page,base);await page.route('**/__original-coverage*',route=>route.fulfill({contentType:'text/html',body:html}));
 const id=screen==='no-data-inspection'?'quarry':screen==='context-settings'?'context':screen,name=coverageSites.find(site=>site.id===id).name;
 async function ready(){
  await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();
  const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.getByText('1 raster source available',{exact:true}).waitFor();await settings.locator('#basemap-layer').uncheck();await settings.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.evaluate(async()=>{const {StaticData}=await import('/data-client.js'),original=StaticData.prototype.derivedContours;window.coverageDerived=0;StaticData.prototype.derivedContours=async function(...args){const value=await original.apply(this,args);window.coverageDerived++;return value;};});
  const search=page.getByRole('combobox',{name:'Search dive sites and regions',exact:true});await search.fill(name);await page.locator('#map-match-beach-'+id).click();
  await page.getByRole('heading',{name,exact:true,level:2}).waitFor();
  if(screen==='context-settings'){await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();}
  if(screen==='context-settings'){await settings.getByText('No local survey · broad-scale context visible',{exact:true}).waitFor();}
  else{
   if(['boat','far'].includes(screen)){
    await page.locator('#map').focus();await page.locator('#map').press('+');await page.locator('#map').press('-');await page.waitForFunction(()=>window.coverageDerived>0);
    await page.getByText('Map measurements',{exact:true}).click();await page.locator('#measure-panel').scrollIntoViewIfNeeded();
   }
   if(screen==='no-data-inspection'){await page.getByRole('button',{name:'Close map details',exact:true}).click();
    const width=await page.locator('#map').evaluate(node=>node.clientWidth);await page.locator('#map').click({position:{x:Math.round(width/2)+80,y:400}});
    await page.locator('#inspection-value').filter({hasText:'No depth data'}).waitFor();
   }
  }
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 }
 const prefix=out+'/'+screen+'-'+theme+'-'+size;
 await page.goto(base+'/__original-coverage?view=maps');await ready();await page.screenshot({path:prefix+'-reference.png'});
 await page.goto(base+'/map');await ready();await page.screenshot({path:prefix+'-react.png'});
 const reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));assert.equal(reference.width,actual.width);assert.equal(reference.height,actual.height);
 const diff=new PNG({width:actual.width,height:actual.height}),ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));
 report.push({screen,theme,size,ratio});await writeFile(out+'/report.json',JSON.stringify(report,null,2));assert.deepEqual(errors,[]);await context.close();
}
 assert.ok(report.every(row=>row.ratio<=.005),'Coverage designs differ; see '+out+'/report.json');console.log('MAP_COVERAGE_DESIGN_PASS: original/native boat, inland, unsurveyed, regional context, unavailable automatic measurement and no-data inspection across all selected themes/sizes.');
}finally{await browser.close();}
