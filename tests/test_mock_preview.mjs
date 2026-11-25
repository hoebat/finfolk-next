import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {discoverRoutes,inspectPage} from '../scripts/check_pages.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://127.0.0.1:3330';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
assert.equal((await (await fetch(base+'/api/account-config')).json()).authProvider,'preview');
const browser=await chromium.launch(),failures=[];
try{
 const {routes}=await discoverRoutes();
 for(const route of [...routes.filter(x=>!['/profiles','/members','/account/review'].includes(x)),'/members/bob','/directory/school','/events/public-event','/logbook?session=session-one']){
 const {context,page,result}=await inspectPage(browser,base+route,{settleMs:600});
 const text=await page.locator('body').innerText();
 if(/Mock (operation|route|write) not implemented|Sign in to manage|Sign in or create/.test(text))result.issues.push({kind:'fixture',message:text.slice(-600)});
 if(result.issues.length)failures.push({route,issues:result.issues});await context.close();
 }
 console.log(JSON.stringify(failures,null,2));assert.equal(failures.length,0,'Every preview route must render without auth or missing fixtures');
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.goto(base+'/profile/edit');await page.getByLabel('Display name',{exact:true}).fill('Preview Alice');await page.getByRole('button',{name:'Save profile',exact:true}).click();await page.getByRole('heading',{name:'Preview Alice',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Preview Alice',exact:true}).waitFor();
 await page.request.post(base+'/api/preview/reset',{data:{}});
 await context.close();console.log('MOCK_PREVIEW_PASS');
}finally{await browser.close();}
