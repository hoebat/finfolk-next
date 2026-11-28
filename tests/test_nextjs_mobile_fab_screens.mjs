import {checkFanOut,checkActionFan} from './fixtures/fan-out-navigation.mjs';
import assert from 'node:assert/strict';
import {readdir,readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {chromium,expect as playwrightExpect} from '@playwright/test';
const expect=playwrightExpect.configure({timeout:30000});
import {mockAccount} from './fixtures/nextjs-account.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3347',url=new URL(base);
assert(['localhost','127.0.0.1'].includes(url.hostname)||url.protocol==='https:'&&(url.hostname==='finfolk.com.au'||/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname)));
const app=process.env.FAB_APP_SOURCE||fileURLToPath(new URL('../js/finfolk-next/site/web-main/app',import.meta.url));
const uuid='11111111-1111-4111-8111-111111111111',paths=[],aliases=new Map();
for(const file of await readdir(app,{recursive:true})){
 if(!file.endsWith('page.jsx')||file.startsWith('offline-app/'))continue;
 const parts=file.split('/').slice(0,-1).filter(x=>!x.startsWith('('));
 const path='/'+parts.map((x,i)=>x==='[id]'?parts[i-1]==='u'?'navigation-fixture':uuid:x).join('/');paths.push(path);
 const redirect=(await readFile(resolve(app,file),'utf8')).match(/redirect\(['"]([^'"]+)['"]\)/);if(redirect)aliases.set(path,redirect[1]);
}
aliases.set('/pages','/directory?manage=1');aliases.set('/profiles','/people');
const all=[...new Set([...paths,'/navigation-fixture-not-found'])].sort();
const out=process.env.FAB_REPORT_DIR||'.cache/mobile-fab-release';await mkdir(out,{recursive:true});const results=[];
const browser=await chromium.launch();
try{
 await Promise.all([false,true].map(async guest=>{
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});page.setDefaultTimeout(30000);await mockAccount(page,base);await page.route('**/v1/features',r=>r.fulfill({json:{flags:{},revision:1}}));
  if(guest)await page.addInitScript(()=>sessionStorage.setItem('fixture:guest','yes'));
  for(const path of all){
   console.log('Checking '+(guest?'guest ':'member ')+path);
   const errors=[];const capture=e=>errors.push(e.message);page.on('pageerror',capture);
   await page.goto(base+path,{waitUntil:'domcontentloaded'});
   const destination=aliases.get(path)||path;if(aliases.has(path)){const target=new URL(destination,base);await page.waitForURL(u=>u.pathname===target.pathname||guest&&target.pathname.startsWith('/account')&&u.pathname==='/map'&&u.searchParams.has('signin'));}
   const host=page.locator('.ff-mobile-navigation'),toggle=host.getByRole('button',{name:'Open menu',exact:true});
   await expect(host.locator('.ff-account-widget').locator(guest?'.ff-signin':'.ff-account-mobile-link')).toHaveCount(1);
   if(['/account','/account/checkin'].includes(path)&&!guest)await page.getByRole('button',{name:'Close session form',exact:true}).click();
   if(!guest&&destination.startsWith('/account/settings'))await expect(page.locator('#settings-title')).toBeFocused();
   if(guest&&destination.startsWith('/account'))await page.getByRole('button',{name:'Close sign in',exact:true}).click();
   // Standalone account routes can open their sign-in dialog. Check navigation
   // after dismissing the modal, when the background becomes interactive again.
   for(let i=0;i<2;i++){const dialog=page.locator('dialog[open]').first();if(await dialog.isVisible()){await page.keyboard.press('Escape');await expect(dialog).toBeHidden();}}
   await expect(toggle).toBeVisible();assert.equal(await page.getByRole('button',{name:'Open menu',exact:true}).count(),1,'Exactly one visible menu entry point');
   const b=await toggle.boundingBox();assert.equal(b.width,56);assert.equal(b.height,56);assert.equal(b.x,318);assert.equal(b.y,772,'Same lower-right position on every route');
   assert.equal(await page.getByRole('navigation',{name:'Main navigation',exact:true}).count(),0,'No bottom bar remains');
   await toggle.click();const menu=host.locator('#mobile-menu-panel');await expect(menu).toBeVisible();
   const nav=menu.getByRole('navigation',{name:'Main navigation',exact:true});await expect(nav.getByRole('link',{name:'Explore',exact:true})).toBeVisible();await expect(nav.getByRole('link',{name:'Community',exact:true})).toBeVisible();
   await expect(nav.getByRole('link',{name:'Events',exact:true})).toHaveCount(0);
   await checkFanOut(page,host);
   for(const icon of await nav.locator('svg').all()){const r=await icon.boundingBox();assert.equal(r.width,22);assert.equal(r.height,22,'Icons retain their size without route-specific styles');}
   await expect(menu.getByRole('radio')).toHaveCount(0);await expect(menu.getByRole('link',{name:'Settings',exact:true})).toHaveCount(0);
   await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(toggle).toBeFocused();
   const avatar=host.getByRole('button',{name:'Open account menu',exact:true});await avatar.click();await expect(menu.getByRole('link',{name:guest?'Sign in':'Settings',exact:true})).toBeVisible();
   await checkActionFan(page,host,'account','.ff-avatar-toggle');
   for(const label of ['View profile','Complete profile','Platform status','How FinFolk works'])await expect(menu.getByText(label,{exact:true})).toHaveCount(0);
   await page.keyboard.press('Escape');await expect(avatar).toBeFocused();
   const context=host.getByRole('button',{name:'Open page options',exact:true});await context.click();await checkActionFan(page,host,'context','.ff-context-toggle');await menu.getByRole('button',{name:'Appearance',exact:true}).click();const group=menu.getByRole('radio',{name:'Night Swim',exact:true});await group.check();await expect(group).toBeChecked();await checkActionFan(page,host,'themes','.ff-context-toggle');await expect(page.locator('html')).toHaveAttribute('data-theme','navy');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
   await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(context).toBeFocused();
   if(['/','/map','/account/settings','/community','/admin','/navigation-fixture-not-found'].includes(path))await page.screenshot({path:resolve(out,'screen-'+(guest?'guest-':'member-')+(path==='/'?'home':path.slice(1).replaceAll('/','-'))+'.png')});
   page.off('pageerror',capture);assert.deepEqual(errors,[],path);results.push({path,guest,passed:true});
  }
  await page.close();
 }));
 await writeFile(resolve(out,'screen-consistency.json'),JSON.stringify({passed:true,url:base,routes:all.length,cases:results.length,guestAndMember:true,consistentPosition:true,singleEntryPoint:true,themeSelection:true,keyboardFocus:true,results},null,2));
 console.log('MOBILE_FAB_SCREENS_PASS: '+results.length+' checks across '+all.length+' routes/templates, guest and member, one FAB, icons, themes, viewport and keyboard focus.');
}finally{await browser.close();}
