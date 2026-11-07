import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {atlasContours} from './fixtures/nextjs-atlas.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try {
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 page.setDefaultTimeout(30000);
 await context.addInitScript(()=>{localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');});
 await mockMapTools(page,base);
 await page.route(/\/data\/(?:example|second)-bay-contours\.json/,r=>r.fulfill({json:atlasContours}));
 await page.goto(base+'/map?mode=survey');
 await page.locator('#explorer[aria-busy=false]').waitFor();
 await page.evaluate(()=>document.dispatchEvent(new Event('finfolk:map-settings')));
 await page.getByRole('dialog',{name:'Settings',exact:true}).getByText('1 raster source available',{exact:true}).waitFor();
 await page.evaluate(()=>dispatchEvent(new CustomEvent('finfolk:cache-status',{detail:{cached:true,savedAt:100}})));
 const notice=page.getByText(/^Offline · showing saved application data/);
 await notice.first().waitFor();
 await page.evaluate(()=>dispatchEvent(new CustomEvent('finfolk:cache-status',{detail:{cached:false}})));
 await notice.first().waitFor({state:'detached'});
 assert.equal(await notice.count(),0);
 console.log('MAP_CACHE_NOTICE_PASS: map warning appears for fallback and clears on recovery.');
} finally {await browser.close();}
