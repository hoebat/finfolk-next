// Browser flow uses synthetic public/member data; persistence is independently
// covered by directory_native.mjs against live disposable PostgreSQL.
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mockPlace} from './fixtures/nextjs-place.mjs';
import {administrationModule} from './fixtures/nextjs-administration.mjs';
import {directoryResponse} from './fixtures/nextjs-directory.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const module=administrationModule
 .replace("let user={uid:'alice',emailVerified:true}","let user=sessionStorage.getItem('journey:guest')?null:{uid:'alice',emailVerified:true}")
 .replace('window.adminCalls=[];',"window.adminCalls=[];window.createdPages=[];window.completeDirectorySignIn=()=>{sessionStorage.removeItem('journey:guest');user={uid:'alice',emailVerified:true};listeners.forEach(fn=>fn(user));};")
 .replaceAll('listings:[listing],claims:[]','listings:[listing,...window.createdPages],claims:[]')
 .replace("if(path.endsWith('/save'))",`if(path==='/v1/me/directory/create'){
  if(window.failCreation)throw Error('Temporary page submission failure.');
  const row={id:'new-group',status:'candidate',owner_id:'alice',revision:1,role:'owner',document:body.document};
  window.createdPages.push(row);return {id:row.id,status:row.status};
 }
 if(path.endsWith('/save'))`);
let active;const browser=await chromium.launch();
try{
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 active=page;page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{if(!sessionStorage.getItem('journey:initialized')){sessionStorage.setItem('journey:guest','1');sessionStorage.setItem('journey:initialized','1');}localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');});
 await mockPlace(page,base);
 await page.route('**/neon-client.js',r=>r.fulfill({contentType:'text/javascript',body:module}));
 await page.route(/\/v1\/directory(?:\?|$)/,r=>r.fulfill({json:directoryResponse(new URL(r.request().url()).searchParams)}));
 await page.goto(base+'/map?site=bondi');
 await page.getByRole('heading',{name:'Bondi Beach',exact:true,level:2}).waitFor();
 const panel=page.getByRole('region',{name:'Groups and pages at this location'});
 await panel.getByRole('link',{name:'Coastal Folk',exact:true}).waitFor();
 await panel.screenshot({path:'/tmp/finfolk-journey-map-panel.png'});
 const browse=new URL(await panel.getByRole('link',{name:'Browse local groups and pages'}).getAttribute('href'),base);
 assert.equal(browse.searchParams.get('state'),'NSW');assert.equal(browse.searchParams.get('locality'),'Bondi');assert.equal(browse.searchParams.get('site'),'bondi');
 await panel.getByRole('link',{name:'Create a group or page',exact:true}).click();
 await page.getByRole('link',{name:'Sign in to create a page',exact:true}).click();
 await page.waitForURL(url=>url.pathname==='/account'&&url.searchParams.has('returnTo'));
 assert.match(new URL(page.url()).searchParams.get('returnTo'),/locality=Bondi/);
 await page.waitForFunction(()=>!!window.completeDirectorySignIn);await page.evaluate(()=>window.completeDirectorySignIn());
 await page.waitForURL(url=>url.pathname==='/pages'&&url.searchParams.get('create')==='1');
 await page.getByRole('button',{name:'Submit page for review',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Category',{exact:true}).first().inputValue(),'Group');
 assert.equal(await page.getByLabel('State',{exact:true}).first().inputValue(),'NSW');
 assert.equal(await page.getByLabel('Locations served',{exact:true}).first().inputValue(),'Bondi');
 const form=page.getByRole('region',{name:'Create a group or page'});
 await form.getByLabel('Name',{exact:true}).fill('Bondi Water Folk');await form.getByLabel('Source URLs (separated by commas)',{exact:true}).fill('https://group.example/about');
 await page.evaluate(()=>window.failCreation=true);await form.getByRole('button',{name:'Submit page for review',exact:true}).click();
 await form.getByRole('alert').filter({hasText:'Temporary page submission failure.'}).waitFor();
 await page.evaluate(()=>window.failCreation=false);await form.getByRole('button',{name:'Submit page for review',exact:true}).click();
 await form.getByText(/Your page was submitted for review/).waitFor();
 await page.getByRole('heading',{name:'Bondi Water Folk',exact:true}).waitFor();
 await page.getByText('Awaiting review · visible only to page managers',{exact:true}).waitFor();
 const calls=await page.evaluate(()=>window.adminCalls.filter(x=>x.path==='/v1/me/directory/create'));
 assert.equal(calls.length,2);assert.equal(calls[0].body.requestId,calls[1].body.requestId);assert.equal(calls[1].body.document.locality,'Bondi');
 await page.screenshot({path:'/tmp/finfolk-journey-page.png',fullPage:true});
 assert.equal(await page.getByRole('link',{name:'View public page',exact:true}).count(),1,'Only the existing published page has a public link');
 await form.getByRole('link',{name:'Back to dive site'}).click();await page.waitForURL(url=>url.pathname==='/map'&&url.searchParams.get('site')==='bondi');
 assert.deepEqual(errors,[]);
 console.log('DIRECTORY_BROWSER_JOURNEY_PASS: Bondi details → locality pages → authenticated contextual creation, safe retry, review status and return to map.');
}catch(error){console.error('BROWSER_STATE',JSON.stringify({url:active?.url(),body:await active?.locator('body').innerText()}));await active?.screenshot({path:'/tmp/finfolk-journey-failure.png',fullPage:true});throw error;}finally{await browser.close();}
