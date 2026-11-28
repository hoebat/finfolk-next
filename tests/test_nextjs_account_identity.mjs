import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mockMembers,memberModule} from './fixtures/nextjs-members.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3335';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=4;canvas.getContext('2d').fillRect(0,0,4,4);window.fixturePortrait=canvas.toDataURL('image/jpeg');localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done')});
 await mockMembers(page,base);
 const fixture=memberModule.replace("const profile={displayName:'Alice',", "const profile={portrait:window.fixturePortrait,displayName:'Alice',")
  .replace("if(action==='me'){", "if(action==='me'){if(sessionStorage.getItem('delay-identity'))await new Promise(resolve=>window.releaseIdentity=resolve);")
  .replace('export async function createLogbookClient(){return api;}', 'export async function createLogbookClient(){if(sessionStorage.getItem("delay-client"))await new Promise(resolve=>window.releaseClient=resolve);return api;}');
 await page.route('**/account-client.js',r=>r.fulfill({contentType:'text/javascript',body:fixture}));
 await page.goto(base+'/profile');await page.getByRole('heading',{name:'Alice',exact:true}).waitFor();
 const account=page.locator('.ff-account-widget');await expect(account.locator('.ff-account-desktop-link strong')).toHaveText('Alice');
 await expect(account.locator('.ff-account-profile:visible img')).toHaveAttribute('src',/^blob:/);
 assert.equal(await page.locator('img[src^="data:"]').count(),0);
 await page.evaluate(()=>{sessionStorage.setItem('delay-client','1');sessionStorage.setItem('delay-identity','1')});
 await page.reload();await page.waitForFunction(()=>typeof window.releaseClient==='function');
 await expect(account.locator('.ff-account-desktop-link strong')).toHaveText('Alice');await expect(account.locator('.ff-account-profile:visible img')).toHaveAttribute('src',/^blob:/);
 const before=await account.boundingBox();await page.evaluate(()=>window.releaseClient());await page.waitForFunction(()=>typeof window.releaseIdentity==='function');
 await expect(account.locator('.ff-account-desktop-link strong')).toHaveText('Alice');await expect(account.locator('.ff-account-profile:visible img')).toHaveAttribute('src',/^blob:/);
 await page.evaluate(()=>window.releaseIdentity());await page.getByRole('heading',{name:'Alice',exact:true}).waitFor();
 const after=await account.boundingBox();assert.equal(before.width,after.width);assert.equal(before.height,after.height);
 await page.evaluate(()=>window.signOutMemberFixture());await expect(account.getByRole('link',{name:'Sign in',exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>localStorage.getItem('finfolk:account-presentation:1')),null);
 assert.deepEqual(errors,[]);await page.close();
}console.log('ACCOUNT_IDENTITY_BROWSER_PASS: name/portrait survive delayed auth and profile restoration, compact blob image URLs, stable dimensions, sign-out clearing, desktop/mobile.');}finally{await browser.close()}
