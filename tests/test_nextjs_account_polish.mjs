import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
// Disposable mock data: no real account or production writes.
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3267';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();await mkdir('.cache/account-polish',{recursive:true});
try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('finfolk:member-tour:3:alice','done'));
 for(const theme of ['yellow','cobalt','navy-light','navy'])for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1000});
  await page.goto(base+'/account/checkin');await page.getByRole('heading',{name:'Your recent check-ins',exact:true}).waitFor();
  await page.evaluate(theme=>{localStorage.setItem('finfolk-theme',theme);globalThis.FinFolkAppearance.apply(theme);},theme);
  for(const [name,path,ready]of [
   ['checkin','/account/checkin','.checkin-history'],['posts','/account/posts','.trip-manager'],
   ['instagram','/account/instagram','#member-actions'],['buddies','/account/privacy','#social-buddies'],
   ['sites','/account/sites','.site-editor'],['appearance','/account/settings/appearance','.theme-choice'],
   ['profile','/account/settings/profile','.settings-editor'],['privacy','/account/settings/privacy','.settings-privacy'],
   ['account','/account/settings/account','.settings-content']
  ]){
   await page.goto(base+path);await page.locator(ready).first().waitFor();await page.evaluate(theme=>{localStorage.setItem('finfolk-theme',theme);globalThis.FinFolkAppearance.apply(theme);},theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${theme} ${width} ${name}`);
   if(width===1440&&theme==='yellow'||width===390&&theme==='navy')await page.screenshot({path:`.cache/account-polish/${name}-${theme}-${width}.png`,fullPage:name!=='sites'});
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/account/checkin');
 await page.getByRole('navigation',{name:'Main navigation',exact:true}).getByRole('link',{name:'Check in',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Check in',exact:true}).count(),0);assert.equal(await page.getByRole('tablist',{name:'Your account',exact:true}).count(),0);await page.goto(base+'/account/posts');await page.getByRole('tab',{name:'Your posts',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.waitForURL('**/account/instagram');assert.equal(await page.getByRole('tab',{name:'Instagram tools',exact:true}).getAttribute('aria-selected'),'true');
 await page.goto(base+'/account/checkin');await page.getByRole('combobox',{name:'Dive site to check in at'}).fill('Bondi');await page.getByRole('option',{name:/Bondi Beach/}).first().click();await page.getByRole('button',{name:'Check in today',exact:true}).click();await page.getByRole('status').filter({hasText:'You’re checked in at Bondi Beach.'}).waitFor();await page.locator('.acct-checkin-row').first().waitFor();await page.locator('.acct-checkin-row').getByRole('button',{name:'Remove',exact:true}).first().click();await page.locator('.acct-checkin-row').waitFor({state:'hidden'});
 await page.goto(base+'/account/sites');await page.getByRole('group',{name:'Site basics',exact:true}).waitFor();await page.getByLabel('Site name',{exact:true}).fill('Presentation test');assert.equal(await page.getByLabel('Site ID',{exact:true}).inputValue(),'presentation-test');await page.getByLabel('State / territory',{exact:true}).selectOption('QLD');assert.equal(await page.getByLabel('Timezone',{exact:true}).inputValue(),'Australia/Brisbane');
 assert.deepEqual(errors,[]);console.log('ACCOUNT_POLISH_PASS: nine account views, four themes, 320/390/1440px, keyboard navigation and grouped form bindings; no overflow or browser errors.');
}finally{await browser.close();}
