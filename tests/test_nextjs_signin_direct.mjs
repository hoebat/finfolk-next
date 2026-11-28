import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mockAccount} from './fixtures/nextjs-account.mjs';
import {checkDirectSignIn} from './fixtures/fan-out-navigation.mjs';
const base=process.env.NEXTJS_TEST_URL||process.argv[2]||'http://127.0.0.1:3355',url=new URL(base);
assert(['localhost','127.0.0.1'].includes(url.hostname)||url.protocol==='https:'&&(url.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname)));
const browser=await chromium.launch();try{for(const path of ['/buddies','/events','/shop']){
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});page.setDefaultTimeout(30000);await mockAccount(page,base);await page.addInitScript(()=>sessionStorage.setItem('fixture:guest','yes'));await page.route('**/v1/features',route=>route.fulfill({json:{flags:{},revision:1}}));const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+path,{waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Feature unavailable',exact:true})).toBeVisible();const host=page.locator('.ff-mobile-navigation');await expect(host.locator('.ff-account-widget')).not.toHaveAttribute('aria-busy','true');await checkDirectSignIn(page,host);assert.equal(new URL(page.url()).pathname,path);assert.deepEqual(errors,[]);await page.close();
}console.log('DIRECT_SIGNIN_PASS: global overlay stays available on disabled feature routes; no intermediate account page or navigation.');}finally{await browser.close();}
