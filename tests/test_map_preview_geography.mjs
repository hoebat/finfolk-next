import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {DATASET_RELEASE_BASE} from '../js/finfolk-next/site/web-main/src/map-data.js';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const catalogue=await(await fetch(DATASET_RELEASE_BASE+'beaches.json')).json(),expected=new Map();
for(const site of catalogue.beaches)expected.set(site.state_id,(expected.get(site.state_id)||0)+1);
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/map?category=spot');
 await page.locator('.fm-geography[data-group=VIC]').waitFor({timeout:30000});
 for(const [id,count]of expected)assert.equal(await page.locator(`.fm-geography[data-group="${id}"] strong`).innerText(),count.toLocaleString('en-AU'));
 assert.equal(await page.getByRole('complementary',{name:'Map results'}).isVisible(),false,'A category deep link starts with an unobstructed map');
 await page.waitForFunction(()=>Number(document.querySelector('.fm-map-canvas')?.dataset.stateBoundaryFeatures)>0,{},{timeout:30000});
 await page.locator('.fm-geography[data-group=VIC]').click();await page.locator('.fm-geography[data-level=region]').first().waitFor();
 assert.deepEqual(errors,[]);
 console.log('LIVE_PREVIEW_GEOGRAPHY_PASS: exact local URL, published state totals, rendered national borders, region drill-down, no initial results sidebar.');
}finally{await browser.close();}
