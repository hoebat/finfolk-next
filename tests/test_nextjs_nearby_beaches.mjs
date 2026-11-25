import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
// Live local preview smoke test using its published geography catalogue.
// Deterministic threshold/radius/filter edge cases are in test_nearby_beaches.mjs.
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/openfreemap/styles/liberty',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#b7dce5'}}]}}));
 await page.goto(base+'/map?site=bondi&q=Bondi');await page.locator('.fm-detail h2').filter({hasText:'Bondi Beach'}).waitFor();
 const nearby=page.getByRole('region',{name:'Nearby beaches',exact:true});await nearby.waitFor();const cards=nearby.locator('.fm-card');assert.ok(await cards.count()>0&&await cards.count()<=5);assert.equal(await nearby.getByRole('button',{name:/^Bondi Beach/}).count(),0);
 const name=await cards.first().locator('strong').innerText();await cards.first().click();await page.locator('.fm-detail h2').filter({hasText:name}).waitFor();assert.notEqual(new URL(page.url()).searchParams.get('site'),'bondi');assert.equal(await page.locator('.fm-detail-close').count(),0);assert.equal(await page.locator('.fm-accordion-item>.fm-card[aria-expanded=true]').count(),1);await page.locator('.fm-accordion-item>.fm-card[aria-expanded=true]').click();await page.locator('.fm-detail').waitFor({state:'detached'});assert.equal(await page.getByRole('complementary',{name:'Map results'}).isVisible(),true);assert.deepEqual(errors,[]);await page.close();
}console.log('NEARBY_BEACHES_BROWSER_PASS: nearby alternatives, duplicate exclusion and normal detail selection on desktop/mobile.');}finally{await browser.close();}
