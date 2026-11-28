import assert from 'node:assert/strict';
import {chromium,expect as playwrightExpect} from '@playwright/test';
const expect=playwrightExpect.configure({timeout:30000});
import {mockAccount,accountModule} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3347',url=new URL(base);
assert(['localhost','127.0.0.1'].includes(url.hostname)||url.protocol==='https:'&&(url.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname)));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});await mockAccount(page,base);
 const held=accountModule.replace('queueMicrotask(()=>fn(user))','window.fixtureResumeSession=()=>fn(user)');assert.notEqual(held,accountModule);
 await page.route('**/account-client.js',r=>r.fulfill({contentType:'text/javascript',body:held}));await page.goto(base+'/account/settings',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof window.fixtureResumeSession==='function');await expect(page.locator('#settings-title')).toBeFocused();
 const host=page.locator('.ff-mobile-navigation');await host.getByRole('button',{name:'Open menu',exact:true}).click();const menu=host.locator('#mobile-menu-panel');await expect(menu.getByRole('link',{name:'Explore',exact:true})).toBeFocused();
 await page.evaluate(()=>window.fixtureResumeSession());await expect(page.locator('.settings-groups')).toBeVisible();await expect(host.locator('.ff-account-mobile-link')).toHaveCount(1);
 await expect(menu).toBeVisible();await expect(menu.getByRole('link',{name:'Explore',exact:true})).toBeFocused();await expect(menu.getByRole('radio')).toHaveCount(0);await page.keyboard.press('Escape');await host.getByRole('button',{name:'Open page options',exact:true}).click();await menu.getByRole('button',{name:'Appearance',exact:true}).click();const theme=menu.getByRole('radio',{name:'Night Swim',exact:true});await expect(theme).toBeVisible();await menu.locator('.ff-action-fan>.ff-fan-action').evaluateAll(elements=>Promise.all(elements.flatMap(element=>element.getAnimations().map(animation=>animation.finished))));await theme.check();await expect(page.locator('html')).toHaveAttribute('data-theme','navy');await page.keyboard.press('Escape');await expect(host.getByRole('button',{name:'Open page options',exact:true})).toBeFocused();
 console.log('MOBILE_FAB_RESTORE_PASS: menu stays open and retains focus when a delayed account session finishes restoring on settings.');
}finally{await browser.close();}
