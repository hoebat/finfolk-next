import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {accountModule} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3218';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const item={id:'11111111-1111-4111-8111-111111111111',title:'Coffee after a swim',outlet:'Coastal cafe',description:'A coffee from your local outlet.',instructions:'Show this code at the counter.',cost:30,stock:2,revision:1,active:true};
const mock=accountModule.replace('let user=',`let balance=100,claims=[];window.shopWrites=[];let user=`).replace('async request(path,options={}){',`async request(path,options={}){
 if(path==='/v1/me/finnies')return {balance,redemptions:structuredClone(claims)};
 if(path==='/v1/me/finnies/redeem'){window.shopWrites.push(options.body);if(window.delayClaim)await new Promise(resolve=>window.releaseClaim=resolve);balance-=30;const claim={id:'claim-1',code:'22222222-2222-4222-8222-222222222222',cost:30,item:${JSON.stringify(item)},status:'claimed',created_at:new Date().toISOString()};claims.push(claim);return claim;}
 if(path==='/v1/admin/finnies')return {items:[${JSON.stringify(item)}]};
 if(path==='/v1/admin/finnies/items'){window.shopWrites.push(options.body);return options.body;}
 `);
const browser=await chromium.launch();
try{
 const page=await browser.newPage({serviceWorkers:'block'});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/neon-config.json*',r=>r.fulfill({json:{enabled:true,backbone:true,apiUrl:base+'/',authUrl:'https://auth.invalid'}}));
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:mock}));
 let catalogue=[item];await page.route('**/shop/items',r=>r.fulfill({json:{items:catalogue}}));
 await page.goto(base+'/shop');await page.getByRole('heading',{name:'Coffee after a swim',exact:true}).waitFor();
 await page.getByRole('button',{name:'Redeem reward',exact:true}).click();await page.getByRole('region',{name:'Confirm reward'}).waitFor();
 await page.evaluate(()=>window.delayClaim=true);await page.getByRole('button',{name:'Confirm redemption',exact:true}).dblclick();
 await page.waitForFunction(()=>typeof window.releaseClaim==='function');assert.equal(await page.evaluate(()=>window.shopWrites.length),1);
 await page.evaluate(()=>window.releaseClaim());await page.getByText('22222222-2222-4222-8222-222222222222',{exact:true}).waitFor();
 assert.match(await page.getByRole('region',{name:'Your Finnies'}).innerText(),/70 Finnies/);assert.ok(await page.getByRole('button',{name:'Redeem reward',exact:true}).evaluate(el=>getComputedStyle(el).color!==getComputedStyle(el).backgroundColor),'Purchase button text must contrast with its background');assert.equal(await page.locator('main').count(),1);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'.cache/finnies-mobile.png',fullPage:true});
 await page.setViewportSize({width:1360,height:900});await page.screenshot({path:'.cache/finnies-desktop.png',fullPage:true});
 await page.evaluate(()=>window.signOutAccountFixture());await page.getByRole('link',{name:'Sign in to redeem',exact:true}).waitFor();assert.equal(await page.getByText('22222222-2222-4222-8222-222222222222',{exact:true}).count(),0);
 catalogue=[];await page.reload();await page.getByRole('heading',{name:'Good things are on their way'}).waitFor();
 await page.goto(base+'/shop/manage');await page.getByLabel('Reward title',{exact:true}).fill('Swim cap');await page.getByLabel('Outlet',{exact:true}).fill('Coastal cafe');await page.getByLabel('Price in Finnies',{exact:true}).fill('50');await page.getByLabel('How to claim the reward',{exact:true}).fill('Collect from the outlet');await page.getByRole('button',{name:'Save reward',exact:true}).click();await page.waitForFunction(()=>window.shopWrites.some(x=>x.title==='Swim cap'&&x.cost===50));
 assert.deepEqual(errors,[]);console.log('FINNIES_UI_PASS: catalogue, balance, confirmed purchase, double-click guard, receipt, sign-out privacy, empty shop, admin reward creation and mobile layout.');
}finally{await browser.close();}
