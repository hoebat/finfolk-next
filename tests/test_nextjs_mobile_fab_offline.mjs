import {openMenuBranch,checkMenuFocus,checkSingleFab} from './fixtures/fan-out-navigation.mjs';
import {checkFanOut} from './fixtures/fan-out-navigation.mjs';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,expect as playwrightExpect} from '@playwright/test';
const expect=playwrightExpect.configure({timeout:30000});
import {offlineTemplates,offlineStaticRoutes} from '../js/finfolk-next/site/web-main/lib/offline-documents.js';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3357',url=new URL(base);
assert(['localhost','127.0.0.1'].includes(url.hostname)||url.protocol==='https:'&&(url.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname)));
const out=process.env.FAB_REPORT_DIR||'.cache/mobile-fab-release';await mkdir(out,{recursive:true});
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',reducedMotion:'reduce'});
try{
 const warm=await context.newPage();await warm.goto(base+'/',{waitUntil:'domcontentloaded'});await warm.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:240000});
 const cache=await warm.evaluate(async()=>{const keys=(await caches.keys()).filter(x=>x.startsWith('finfolk-next-shell-'));const c=await caches.open(keys.at(-1));return (await c.keys()).map(x=>new URL(x.url).pathname);});assert(cache.includes('/account-config.json'));assert(cache.some(x=>x.startsWith('/_next/static/')));
 const cdp=await context.newCDPSession(warm);await cdp.send('Network.clearBrowserCache');await context.setOffline(true);
 const cases=[];
 for(const path of [...new Set([...Object.keys(offlineTemplates),...offlineStaticRoutes])]){
  console.log('Checking offline '+path);const page=await context.newPage();page.setDefaultTimeout(30000);const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});assert.equal(response.headers()['x-finfolk-offline'],'1',path+' uses the offline document');
  const host=page.locator('.ff-mobile-navigation'),toggle=host.getByRole('button',{name:'Open menu',exact:true});await expect(toggle).toBeEnabled();
  if(path.startsWith('/account'))await page.getByRole('button',{name:'Close sign in',exact:true}).click();
  const dialog=page.locator('dialog[open]').first();if(await dialog.isVisible()){await page.keyboard.press('Escape');await expect(dialog).toBeHidden();}
  await toggle.click();const menu=host.locator('#mobile-menu-panel');await expect(menu).toBeVisible();await expect(menu.getByRole('link',{name:'Explore',exact:true})).toBeVisible();await expect(menu.getByRole('link',{name:'Community',exact:true})).toBeVisible();const b=await host.locator('.ff-menu-toggle').boundingBox();assert.equal(b.x,318);assert.equal(b.y,772);await checkFanOut(page,host);
  await page.keyboard.press('Escape');await openMenuBranch(host,'Open page options');await menu.getByRole('button',{name:'Appearance',exact:true}).click();const theme=menu.getByRole('radio',{name:'Night Swim',exact:true});await theme.check();await expect(theme).toBeChecked();await expect(page.locator('html')).toHaveAttribute('data-theme','navy');await page.keyboard.press('Escape');await checkMenuFocus(host,'Open page options');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  cases.push(path);await page.close();
 }
 await writeFile(out+'/offline-consistency.json',JSON.stringify({passed:true,url:base,routes:cases.length,httpCacheCleared:true,networkOffline:true,serviceWorkerDocuments:true,sameFloatingMenu:true,localThemeChoices:true,keyboardFocus:true,paths:cases},null,2));console.log('MOBILE_FAB_OFFLINE_PASS: '+cases.length+' offline routes, empty HTTP cache, shared FAB and working theme controls.');
}finally{await context.close();await browser.close();}
