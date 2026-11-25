import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/openfreemap/styles/liberty',r=>r.fulfill({json:{version:8,sources:{},layers:[{id:'background',type:'background',paint:{'background-color':'#b7dce5'}}]}}));
 await page.route('**/terrain/**',r=>r.abort());
 await page.goto(base+'/map?site=bondi');const canvas=page.locator('.maplibregl-canvas').first();await canvas.waitFor();await page.locator('.fm-detail').waitFor();
 const box=await canvas.boundingBox();let found=false;
 for(let attempt=0;attempt<8&&!found;attempt++){
  for(const dy of [42,30,54,0]){await page.mouse.move(box.x+box.width/2,box.y+box.height/2+dy);if(await page.locator('.fm-site-tooltip').count()){found=true;break;}}
  if(!found)await page.waitForTimeout(400);
 }
 assert.equal(found,true,'A site pin displays a hover tooltip');assert.match(await page.locator('.fm-site-tooltip').innerText(),/Bondi/);assert.equal(await page.locator('.fm-site-tooltip .maplibregl-popup-close-button').count(),0);
 await page.keyboard.press('Escape');await page.locator('.fm-site-tooltip').waitFor({state:'detached'});
 await page.mouse.move(box.x+20,box.y+200);assert.deepEqual(errors,[]);
 console.log('SITE_TOOLTIPS_PASS: site name overlay, no duplicate close control, Escape dismissal.');
}finally{await browser.close();}
