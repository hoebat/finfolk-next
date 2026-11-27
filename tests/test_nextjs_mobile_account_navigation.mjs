import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {mockAccount} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010';
const targetURL=new URL(base);
assert(['localhost','127.0.0.1'].includes(targetURL.hostname)||targetURL.protocol==='https:'&&(targetURL.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(targetURL.hostname)));
await mkdir('.cache/mobile-account',{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [320,390,1440])for(const guest of [false,true]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));await mockAccount(page,base);
  if(guest)await page.addInitScript(()=>sessionStorage.setItem('fixture:guest','yes'));
  for(const path of ['/map','/community','/']){
   console.log(`Checking ${width}px ${guest?'guest':'member'} ${path}`);await page.goto(base+path,{waitUntil:'domcontentloaded'});const rail=page.locator('.app-rail,.profile-rail'),landing=path==='/',mobile=width<=900;
   const host=landing?page.locator('.landing-account'):rail;
   const widget=host.locator('.ff-account-widget');await widget.waitFor();
   const target=host.getByRole('link',{name:guest?'Sign in':landing?'My Account':mobile?'Account':'View profile',exact:true});
   await expect(target).toBeVisible();assert.equal(await target.getAttribute('href'),guest?'/account':landing||mobile?'/account/settings':'/profile');
   const toggle=host.getByRole('button',{name:'Open menu',exact:true});
   const linkBox=await target.boundingBox(),toggleBox=await toggle.boundingBox(),widgetBox=await widget.boundingBox();
   assert(linkBox.width>=44&&linkBox.height>=44,'Account/sign-in tap target');assert(toggleBox.width>=36&&toggleBox.height>=44,'Menu tap target');
   assert(linkBox.x+linkBox.width<=toggleBox.x+1,'Split targets never overlap');
   assert(toggleBox.x+toggleBox.width<=widgetBox.x+widgetBox.width+1,'Arrow stays inside split outline');
   if(mobile&&!landing){
    assert(widgetBox.y>=900-80,'Account sits in the bottom navigation');assert.equal(await rail.locator('.brand,.profile-home').isVisible(),false,'Bottom logo removed');
    const nav=page.getByRole('navigation',{name:'Main navigation',exact:true});const navBox=await nav.boundingBox();assert.equal(navBox.y,828);
    const first=await nav.getByRole('link').first().boundingBox();assert(first.x>=widgetBox.x+widgetBox.width,'Account does not overlap navigation');
   }
   await toggle.click();const menu=host.locator('#local-menu-panel');await expect(menu).toBeVisible();
   if(!guest)await expect(menu.getByRole('link',{name:'Settings',exact:true})).toHaveAttribute('href','/account/settings');
   for(const [id,name]of [['yellow','Acid Club'],['cobalt','Blue Hour'],['navy-light','Salt Paper'],['navy','Night Swim']]){
    await menu.getByRole('radio',{name,exact:true}).check().catch(async error=>{await page.screenshot({path:'.cache/mobile-account/failed.png'});throw Error(`${width}px ${guest?'guest':'member'} ${path} ${name}: ${error.message}`)});await expect(page.locator('html')).toHaveAttribute('data-theme',id);
    const box=await menu.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=900,`Menu stays in viewport: ${width}px ${guest?'guest':'member'} ${path} ${JSON.stringify(box)}`);
    if(mobile&&!landing)assert(box.y+box.height<=widgetBox.y,'Bottom menu opens upward');
    if(landing)assert(box.y>=toggleBox.y+toggleBox.height,'Header menu opens downward');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
   }
   if(width===390)await page.screenshot({path:`.cache/mobile-account/${landing?'landing':path.slice(1)}-${guest?'guest':'member'}.png`,fullPage:false});
   await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(host.locator('#local-menu-toggle')).toBeFocused();
   if(mobile||landing){await target.click();if(guest){await expect.poll(async()=>new URL(page.url()).pathname==='/account'||await page.locator('dialog.ff-signin-dialog').isVisible()).toBeTruthy();if(await page.locator('dialog.ff-signin-dialog').isVisible())await page.getByRole('button',{name:'Close sign in',exact:true}).click();}else await page.waitForURL(url=>url.pathname==='/account/settings',{waitUntil:'domcontentloaded'});}
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('MOBILE_ACCOUNT_NAV_PASS: guest/member split buttons, Settings destination, bottom account control, upward menus, landing header, four themes, 320/390/1440px, keyboard focus and no overflow.');
}finally{await browser.close();}
