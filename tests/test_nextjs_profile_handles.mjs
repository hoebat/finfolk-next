import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3335';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{sessionStorage.setItem('finfolk:preview:actor','alice');localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done')});
 await page.goto(base+'/account/settings/profile');const handle=page.getByRole('textbox',{name:'Handle',exact:true});await handle.waitFor();const original=await handle.inputValue(),displayName=await page.getByRole('textbox',{name:'Display name',exact:true}).inputValue(),next='alice-dives-'+width;
 await handle.fill(next);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();await expect(page.getByRole('link',{name:'finfolk.com.au/u/'+next+' ↗',exact:true})).toHaveAttribute('href','/u/'+next);
 await handle.fill('bob');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'That handle is already taken.'}).waitFor();
 await handle.fill(next);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();
 const guest=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'});await guest.addInitScript(()=>sessionStorage.setItem('finfolk:preview:actor','guest'));const publicPage=await guest.newPage();publicPage.on('pageerror',e=>errors.push(e.message));
 await publicPage.goto(base+'/u/'+next);await expect(publicPage.getByRole('heading',{name:displayName,level:1,exact:true})).toBeVisible();await expect(publicPage.getByText('@'+next,{exact:true})).toBeVisible();await expect(publicPage.getByRole('link',{name:'Sign in to connect',exact:true})).toBeVisible();assert.equal(await publicPage.getByRole('link',{name:'Edit profile',exact:true}).count(),0);assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.equal(await publicPage.locator('img[src^="data:"]').count(),0);
 assert.equal((await guest.request.get(base+'/u/does-not-exist-zzz')).status(),404);const canonical=await guest.request.get(base+'/u/'+next.toUpperCase(),{maxRedirects:0});assert.equal(canonical.status(),307);assert.equal(canonical.headers().location,'/u/'+next);
 await handle.fill(original);await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('status').filter({hasText:'Changes saved.'}).waitFor();
 assert.deepEqual(errors,[]);await guest.close();await context.close();
}console.log('PROFILE_HANDLES_BROWSER_PASS: edit/save, duplicate rejection, public anonymous profile, canonical casing, missing profiles, compact images and mobile layout.');}finally{await browser.close()}
