import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const html=await readFile('js/finfolk-next/site/web-main/src/landing.html','utf8'),out='.cache/design-parity/landing';await mkdir(out,{recursive:true});
const report=[],browser=await chromium.launch();
const themes=process.env.LANDING_THEME?[process.env.LANDING_THEME]:['yellow','cobalt','navy-light','navy'];
const states=['completed','first-step','in-progress','forecast-prompt','forecast-pending','forecast-loaded','forecast-partial','forecast-error','forecast-retry'];
const now=Date.parse('2026-11-03T00:00:00Z');
const weather={timezone:'Australia/Sydney',current:{time:now/1000,temperature_2m:20,wind_speed_10m:18,wind_direction_10m:90,weather_code:2},current_units:{temperature_2m:'°C',wind_speed_10m:'km/h'}};
const hours=Array.from({length:26},(_,i)=>i-1),marine={timezone:'Australia/Sydney',hourly:{time:hours.map(i=>now/1000+i*3600),wave_height:hours.map(()=>.8),sea_level_height_msl:hours.map(i=>.6+Math.sin(i/2)*.4)},hourly_units:{wave_height:'m',sea_level_height_msl:'m'}};
try{for(const theme of themes)for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const texts={};
 for(const original of [true,false]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(theme=>localStorage.setItem('finfolk-theme',theme),theme);
  await context.addInitScript(now=>{Date.now=()=>now;},now);
  let mode='pending',requests=0,release;const pending=new Promise(resolve=>{release=resolve;});
  await page.route(/^https:\/\/(?:marine-)?api\.open-meteo\.com\//,async route=>{requests++;if(mode==='pending')await pending;const isMarine=new URL(route.request().url()).hostname.startsWith('marine-');await route.fulfill(mode==='error'||(mode==='partial'&&!isMarine)?{status:503,json:{error:true}}:{json:isMarine?marine:weather});});
  await page.route('**/__original-landing*',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto(base+(original?'/__original-landing':'/'));await page.waitForFunction(()=>document.querySelectorAll('.feature-demo-phone').length===8&&!!document.querySelector('.landing-illustration')?.style.getPropertyValue('--landing-illustration'));
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  for(const figure of await page.locator('[data-feature-demo]').all())await figure.scrollIntoViewIfNeeded();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(image=>image.decode().catch(()=>{})));const url=document.querySelector('.landing-illustration').style.getPropertyValue('--landing-illustration').match(/url\("(.+)"\)/)?.[1];if(url){const image=new Image();image.src=url;await image.decode();}});
  texts[original?'reference':'react']={};
  const capture=async(state,selector,fullPage=false)=>{texts[original?'reference':'react'][state]=await page.locator(selector).innerText();const options={path:`${out}/${theme}-${size}-${state}-${original?'reference':'react'}.png`,animations:'disabled'};if(fullPage)await page.screenshot({...options,fullPage:true});else await page.locator(selector).screenshot(options);};
  for(const state of states.slice(0,3)){
   if(state!=='completed')await page.evaluate(async state=>{const {setDemoStep}=await import('/feature-demos.js');for(const figure of document.querySelectorAll('[data-feature-demo]'))setDemoStep(figure,state==='first-step'?0:1,state==='first-step'?1:.6);},state);
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await capture(state,'.finfolk-landing',true);
  }
  assert.equal(requests,0,'Forecasts require an explicit request.');await page.getByLabel('Choose a location').selectOption('portsea');await page.locator('.conditions-status').filter({hasText:'Portsea Beach'}).waitFor();assert.equal(requests,0);await capture('forecast-prompt','.landing-conditions');
  await page.getByRole('button',{name:'Load forecast',exact:true}).click();await page.locator('.coastal-conditions[aria-busy=true]').waitFor();await capture('forecast-pending','.landing-conditions');mode='success';release();await page.locator('.conditions-status').filter({hasText:/^Retrieved/}).waitFor();await capture('forecast-loaded','.landing-conditions');
  for(const [state,nextMode,expected] of [['forecast-partial','partial',/^Some forecast data is unavailable/],['forecast-error','error',/^Forecast unavailable/],['forecast-retry','success',/^Retrieved/]]){mode=nextMode;await page.getByRole('button',{name:'Refresh forecast',exact:true}).click();await page.locator('.conditions-status').filter({hasText:expected}).waitFor();await capture(state,'.landing-conditions');}
  assert.equal(requests,8);assert.match(await page.locator('#landing-coast-open').getAttribute('href'),/site=portsea/);
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const state of states){
  const prefix=`${out}/${theme}-${size}-${state}`,reference=PNG.sync.read(await readFile(prefix+'-reference.png')),actual=PNG.sync.read(await readFile(prefix+'-react.png'));
  let ratio=1;
  if(reference.width===actual.width&&reference.height===actual.height){const diff=new PNG({width:actual.width,height:actual.height});ratio=pixelmatch(reference.data,actual.data,diff.data,actual.width,actual.height,{threshold:.1})/(actual.width*actual.height);await writeFile(prefix+'-diff.png',PNG.sync.write(diff));}
  const textEqual=texts.reference[state]===texts.react[state];if(!textEqual)await writeFile(prefix+'-text.json',JSON.stringify({reference:texts.reference[state],actual:texts.react[state]},null,2));
  report.push({theme,size,state,ratio,textEqual,reference:[reference.width,reference.height],actual:[actual.width,actual.height]});await writeFile(out+'/report.json',JSON.stringify(report,null,2));
 }
}
 assert.ok(report.every(item=>item.ratio<=.005&&item.textEqual),'Landing original-design comparison failed: '+out+'/report.json');
 console.log(`LANDING_DESIGN_PASS: ${report.length} original/native comparisons of all eight walkthroughs and opt-in forecast prompt/pending/loaded/partial/error/retry; ${themes.length} themes and desktop/mobile, matching copy, no masks.`);
}finally{await browser.close();}
