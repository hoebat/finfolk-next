import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,expect} from '@playwright/test';
import {mockAccount} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3010',targetURL=new URL(base);
assert(['localhost','127.0.0.1'].includes(targetURL.hostname)||targetURL.protocol==='https:'&&(targetURL.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(targetURL.hostname)));
const out='.cache/mobile-account';await mkdir(out,{recursive:true});
const browser=await chromium.launch();
try{
 for(const width of [320,390,1440])for(const guest of [false,true]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),errors=[];
  page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));await mockAccount(page,base);
  if(guest)await page.addInitScript(()=>sessionStorage.setItem('fixture:guest','yes'));
  for(const path of ['/map','/community','/']){
   console.log(`Checking ${width}px ${guest?'guest':'member'} ${path}`);
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   const landing=path==='/',floating=width<=900,host=floating?page.locator('.ff-mobile-navigation'):landing?page.locator('.landing-account'):page.locator('.app-rail,.profile-rail');
   const widget=host.locator('.ff-account-widget'),toggle=host.getByRole('button',{name:'Open menu',exact:true});await widget.waitFor();await expect(widget.locator(guest?'.ff-signin':'.ff-account-mobile-link')).toHaveCount(1);
   const widgetBox=await widget.boundingBox(),toggleBox=await toggle.boundingBox();
   assert(toggleBox.width>=(floating?44:36)&&toggleBox.height>=44,'Menu has a full-size tap target');
   let target;
   if(floating){
    assert.equal(widgetBox.width,56);assert.equal(widgetBox.height,56);
    assert.equal(widgetBox.x,width-72);assert.equal(widgetBox.y,828,'FAB respects the bottom viewport inset');
    await expect(page.locator('.app-rail>nav.ff-primary-nav,.profile-rail>nav.ff-primary-nav')).toBeHidden();
    assert.equal(await page.getByRole('navigation',{name:'Main navigation',exact:true}).count(),0,'No bottom navigation remains visible');
    if(!landing)await expect(page.locator('.app-rail>.brand,.profile-rail>.profile-home')).toBeHidden();
    if(path==='/map')assert.equal(await page.locator('body').evaluate(e=>getComputedStyle(e).getPropertyValue('--nav-height').trim()),'0px','Map reclaims bottom bar space');
   }else{
    target=host.getByRole('link',{name:guest?'Sign in':landing?'My Account':'View profile',exact:true});await expect(target).toBeVisible();
    const box=await target.boundingBox();assert(box.width>=44&&box.height>=44);assert(box.x+box.width<=toggleBox.x+1,'Desktop and landing split targets do not overlap');
   }
   await toggle.click();const menu=host.locator(floating?'#mobile-menu-panel':'#local-menu-panel');await expect(menu).toBeVisible();
   if(floating){
    const nav=menu.getByRole('navigation',{name:'Main navigation',exact:true});await expect(nav).toBeVisible();const navBox=await nav.boundingBox(),firstBox=await nav.getByRole('link').first().boundingBox();assert(firstBox.x<=navBox.x+16,'Menu destinations use the full width without former bottom-bar padding');await expect(nav.getByRole('link',{name:'Explore',exact:true})).toHaveAttribute('href','/map');await expect(nav.getByRole('link',{name:'Community',exact:true})).toHaveAttribute('href','/community');
    await expect(nav.getByRole('link',{name:'Sessions',exact:true})).toHaveCount(guest?0:1);
    await expect(nav.getByRole('link',{name:'Events',exact:true})).toHaveCount(0,'Disabled destinations stay hidden');
    if(!landing)await expect(nav.getByRole('link',{name:path==='/map'?'Explore':'Community',exact:true})).toHaveAttribute('aria-current','page');
    target=guest?menu.getByRole('link',{name:'Sign in',exact:true}):menu.getByRole('link',{name:'Settings',exact:true});await expect(target).toBeVisible();
    const box=await target.boundingBox();assert(box.height>=44);
   }
   if(!guest)await expect(menu.getByRole('link',{name:'Settings',exact:true})).toHaveAttribute('href','/account/settings');
   for(const [id,name]of [['yellow','Acid Club'],['cobalt','Blue Hour'],['navy-light','Salt Paper'],['navy','Night Swim']]){
    await menu.getByRole('radio',{name,exact:true}).check();await expect(page.locator('html')).toHaveAttribute('data-theme',id);
    const box=await menu.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=900,'Menu stays within the viewport');
    if(floating)assert(box.y+box.height<=widgetBox.y-8,'Floating menu opens above the button');
    if(landing&&!floating)assert(box.y>=toggleBox.y+toggleBox.height,'Desktop landing menu opens below its header');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
   }
   if(width===390)await page.screenshot({path:`${out}/${landing?'landing':path.slice(1)}-${guest?'guest':'member'}.png`});
   await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(toggle).toBeFocused();
   if(floating){
    await toggle.click();await page.mouse.click(2,2);await expect(menu).toBeHidden();
    await toggle.click();await target.click();
   }else if(width<=900||landing)await target.click();else continue;
   if(guest){await expect.poll(async()=>new URL(page.url()).pathname==='/account'||await page.locator('dialog.ff-signin-dialog').isVisible()).toBeTruthy();if(await page.locator('dialog.ff-signin-dialog').isVisible()){await page.getByRole('button',{name:'Close sign in',exact:true}).click();if(floating)await expect(toggle).toBeFocused();}}
   else await page.waitForURL(url=>url.pathname==='/account/settings'||!floating&&!landing&&url.pathname==='/profile',{waitUntil:'domcontentloaded'});
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('MOBILE_ACCOUNT_NAV_PASS: floating hamburger, no bottom bar, guest/member destinations, account access, theme choices, dismissal/focus, desktop controls and a shared mobile entry point, 320/390/1440px and no overflow.');
}finally{await browser.close();}
