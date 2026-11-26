import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mockLogbook,logbookModule} from './fixtures/nextjs-logbook.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await mockLogbook(page,base);
  await page.route('**/account-client.js',r=>r.fulfill({contentType:'text/javascript',body:logbookModule+`
   api.supports=operation=>!['mediaInbox','tiktokStatus'].includes(operation)||sessionStorage.getItem('fixture:inbox')==='supported';
   const originalCall=api.call;api.call=async(operation,...args)=>{if(operation==='mediaInbox'&&sessionStorage.getItem('fixture:inbox-failure')){window.logbookCalls.push({action:operation});throw Error('Connection lost. Try again.');}return originalCall(operation,...args)};
   const originalSignOut=api.signOut;api.signOut=async()=>{if(window.failSignOut)throw Error('Could not log out. Please try again.');return originalSignOut()};` }));
  await page.goto(base+'/logbook');await page.getByRole('heading',{name:'Sessions',exact:true}).waitFor();await page.getByRole('button',{name:'Bondi',exact:true}).waitFor();
  assert.equal(await page.locator('.media-inbox').count(),0);assert.equal(await page.evaluate(()=>window.logbookCalls.some(x=>['mediaInbox','tiktokStatus'].includes(x.action))),false);
  const primary=page.getByRole('navigation',{name:'Main navigation',exact:true});assert.equal(await primary.getByRole('link',{name:'Pages',exact:true}).count(),0);
  if(width>900){const widget=page.locator('.ff-account-widget');assert.deepEqual(await widget.evaluate(el=>({w:el.offsetWidth,h:el.offsetHeight})),{w:172,h:64});assert.equal(await widget.getByRole('link',{name:'View profile',exact:true}).getAttribute('href'),'/profile');}
  const toggle=page.getByRole('button',{name:'Open menu',exact:true});await toggle.click();const menu=page.getByRole('navigation',{name:'Account and settings',exact:true});await menu.getByRole('link',{name:'Settings',exact:true}).waitFor();
  for(const name of ['Edit profile','My pages','Suggest a dive site','My sessions'])assert.equal(await menu.getByRole('link',{name,exact:true}).count(),0);
  if(width<=900){assert.equal(await page.evaluate(()=>document.activeElement.textContent),'View profile');await page.keyboard.press('ArrowDown');}assert.equal(await page.evaluate(()=>document.activeElement.textContent),'Settings');await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'How FinFolk works');await page.keyboard.press('Escape');assert.equal(await page.locator('#local-menu-toggle').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>sessionStorage.setItem('fixture:inbox','supported'));await page.reload();await page.getByRole('heading',{name:'Tagged media',exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.setItem('fixture:inbox-failure','yes'));await page.reload();await page.locator('.media-inbox').getByText('Connection lost. Try again.',{exact:false}).waitFor();await page.evaluate(()=>sessionStorage.removeItem('fixture:inbox-failure'));await page.locator('.media-inbox').getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('heading',{name:'Tagged media',exact:true}).waitFor();
  await page.evaluate(()=>window.failSignOut=true);await page.getByRole('button',{name:'Open menu',exact:true}).click();await menu.getByRole('button',{name:'Log out',exact:true}).click();await menu.getByRole('status').filter({hasText:'Could not log out. Please try again.'}).waitFor();await page.evaluate(()=>window.failSignOut=false);await menu.getByRole('button',{name:'Log out',exact:true}).click();await page.locator('.ff-signin').waitFor();await page.getByRole('heading',{name:'Sessions',exact:true}).waitFor();assert.equal(await primary.getByRole('link',{name:'Pages',exact:true}).count(),0);assert.equal(await page.locator('.media-inbox').count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('SESSIONS_NAVIGATION_PASS: capability-gated inbox, retry for real failures, Sessions naming, split profile/menu, community-owned page navigation, keyboard dismissal and logout success/failure at desktop and mobile widths.');
}finally{await browser.close()}
