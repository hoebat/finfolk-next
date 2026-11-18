// A local app with mocked operational records and the real dataset-service basemap.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mockMapTools} from './fixtures/nextjs-map.mjs';
import {DATASET_ORIGIN} from '../js/finfolk-next/site/web-main/src/map-data.js';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3032';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({serviceWorkers:'block'}),external=[],providers=new Set(),errors=[];
 await mockMapTools(page,base);
 await page.route(DATASET_ORIGIN+'/v1/map/providers/**',route=>route.continue());
 await page.route('**/data/explore-contours/manifest.json',route=>route.fulfill({json:{version:1,sources:[]}}));
 page.on('request',request=>{const url=new URL(request.url());if(!['http:','https:'].includes(url.protocol))return;if(!['localhost','127.0.0.1'].includes(url.hostname)&&url.origin!==DATASET_ORIGIN)external.push(url.href);});
 page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/v1/map/providers/')&&response.ok())providers.add(url.pathname.split('/')[4]);});
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/map',{waitUntil:'domcontentloaded'});await page.locator('.maplibregl-canvas').waitFor();
 for(let i=0;i<80&&providers.size<2;i++)await page.waitForTimeout(250);
 assert.ok(providers.has('openfreemap'),'Live basemap must load through dataset service');
 assert.ok(providers.has('terrain'),'Live global depth tiles must load through dataset service');
 assert.deepEqual(external,[],'Geographic resources must never bypass datasets.finfolk.com.au');assert.deepEqual(errors,[]);
 console.log('MAP_DATA_NETWORK_PASS: real basemap and terrain load through datasets.finfolk.com.au; no direct provider requests.');
}finally{await browser.close();}
