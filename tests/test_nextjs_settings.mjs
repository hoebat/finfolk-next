import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
// Run against scripts/mock_preview.mjs; all mutations affect disposable demo data.
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3257';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/account/settings/profile');
 const name=page.getByRole('textbox',{name:'Display name',exact:true});await name.waitFor();
 const initial=await name.inputValue();await name.fill('Unsaved draft');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('navigation',{name:'Settings categories'}).getByRole('link',{name:'Appearance',exact:true}).click();assert.ok(page.url().endsWith('/account/settings/profile'));await name.fill(initial+' Settings');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();
 await page.locator('.ff-account-copy strong').filter({hasText:initial+' Settings'}).waitFor();
 const toggle=page.locator('#local-menu-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await page.keyboard.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('link',{name:'Privacy & connections'}).click();
 await page.getByText('Visibility & statistics',{exact:true}).waitFor();assert.equal(await page.getByRole('textbox',{name:'Display name',exact:true}).isVisible(),false);
 await page.getByRole('button',{name:'Save privacy',exact:true}).click();await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();
 await page.goto(base+'/profile/edit');await name.waitFor();assert.ok(page.url().endsWith('/account/settings/profile'));assert.equal(await name.inputValue(),initial+' Settings');
 await name.fill(initial);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();
 for(const theme of ['yellow','cobalt','navy-light','navy'])for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.evaluate(theme=>{localStorage.setItem('finfolk-theme',theme);},theme);
  await page.goto(base+'/account/settings/appearance');await page.locator('.theme-choice').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,theme+' '+width);
  assert.equal(await page.locator('.ff-account-desktop').isVisible(),width>900);
 }
 await page.goto(base+'/account/settings/messaging');await page.getByText('This settings category is unavailable.',{exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Instagram messaging',exact:true}).count(),0);
 await page.getByRole('combobox',{name:'Preview role'}).selectOption('admin');await page.getByRole('heading',{name:'Instagram messaging',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('SETTINGS_PASS: profile/privacy preservation, live sidebar identity, menu dismissal, legacy redirect, four themes and responsive layout.');
}finally{await browser.close();}
