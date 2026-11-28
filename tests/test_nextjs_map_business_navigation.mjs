import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import batch from '../config/directory-businesses-australia.json' with {type:'json'};
const business=batch.records[0].document;
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
await mkdir('.cache/map-page-link',{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [1440,390])for(const actor of ['guest','alice']){
  const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(({actor})=>{sessionStorage.setItem('finfolk:preview:actor',actor);localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done')},{actor});
  await page.goto(base+'/map?previewActor='+actor);
  await page.waitForFunction(()=>document.body.classList.contains('finfolk-explore-map'));
  // The development-only role switcher otherwise covers the mobile detail link.
  await page.addStyleTag({content:'aside[aria-label="Mock preview controls"]{display:none!important}'});
  await page.locator('#explore-query').fill(business.name);
  await page.getByRole('option').filter({hasText:business.name}).click();
  await expect(page.getByRole('heading',{name:business.name,level:2,exact:true})).toBeVisible();
  const link=page.getByRole('link',{name:'View page ↗',exact:true}),href=await link.getAttribute('href');
  await link.click();await page.waitForURL(url=>url.pathname===href);
  const heading=page.getByRole('heading',{name:business.name,level:1,exact:true});
  await expect(heading).toBeVisible();
  assert((await heading.boundingBox()).width>140,'Business heading must not inherit the map’s narrow layout');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('finfolk-explore-map')),false);
  assert.equal(await page.getByRole('link',{name:/Visit website/}).getAttribute('href'),business.website);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:`.cache/map-page-link/business-${actor}-${width}.png`});
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('MAP_BUSINESS_NAVIGATION_PASS: actual map search → selection → View page, guest/member, desktop/mobile, readable business layout and official website.');
}finally{await browser.close()}
