import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3258';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
assert.equal((await(await fetch(base+'/api/account-config')).json()).authProvider,'preview');
const browser=await chromium.launch();
try{
 const page=await browser.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/account/settings/profile?previewActor=guest');
 await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 assert.equal(await page.getByRole('combobox',{name:'Preview role'}).inputValue(),'guest');
 assert.equal(await page.locator('.ff-account-copy').count(),0);
 await page.reload();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 const denied=await page.request.post(base+'/api/preview/operation',{data:{actor:'guest',operation:'me',values:{}}});assert.equal(denied.status(),401);
 await page.getByLabel('Email',{exact:true}).fill('demo@example.test');await page.getByLabel('Password',{exact:true}).fill('preview-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByRole('textbox',{name:'Display name',exact:true}).waitFor();assert.equal(await page.getByRole('combobox',{name:'Preview role'}).inputValue(),'alice');
 await page.getByRole('combobox',{name:'Preview role'}).selectOption('guest');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
 await page.goto(base+'/community');await page.getByRole('combobox',{name:'Preview role'}).waitFor();await page.locator('.ff-signin').waitFor();assert.equal(await page.getByRole('link',{name:'Edit profile',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PREVIEW_AUTH_PASS: logged-out deep link, persistence, guest protection, mock sign-in and role switching.');
}finally{await browser.close();}
