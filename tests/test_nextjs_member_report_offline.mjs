import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
import {tripId,publishedReport} from './fixtures/nextjs-posts.mjs';
const upstream=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(upstream).hostname));
const server=createServer(async(request,response)=>{try{if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);return response.end();}const result=await fetch(new URL(request.url,upstream)),headers=Object.fromEntries(result.headers);delete headers['content-encoding'];delete headers['content-length'];response.writeHead(result.status,headers);response.end(Buffer.from(await result.arrayBuffer()));}catch(error){response.writeHead(502);response.end(error.message);}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const profile=await mkdtemp('.cache/member-report-offline-');let context;const errors=[],requests=[];
const privateConfig={authUrl:'https://private-cache-fixture.invalid',apiUrl:base+'/',cacheApiUrl:'https://private-api-fixture.invalid',cacheBackend:'sqlite'},sentinel='FINFOLK_PRIVATE_RESTART_SENTINEL_8a7f7e';
function watch(page){page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(page.url()+': '+error.message));page.on('request',request=>requests.push(new URL(request.url())));page.on('console',message=>{if(message.type()==='error'&&/Minified React error|ChunkLoadError|Hydration failed/.test(message.text()))errors.push(page.url()+': '+message.text());});}
try{
 context=await chromium.launchPersistentContext(profile,{headless:true});
 await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());if(!['GET','HEAD'].includes(request.method()))return route.abort();if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();return route.fallback();});
 const warm=await context.newPage();watch(warm);
 for(const [path,name,values]of [['/people?location=bondi','siteCatalog',{}],['/profile','siteCatalog',{}],['/profile/edit','siteCatalog',{}],['/members/fixture-member','siteCatalog',{}],['/reports/'+tripId,'publicTrip',{id:tripId}]]){
  await warm.goto(base+path);
  // Poll the resolved async result. A promise itself is truthy and does not prove
  // that the public cache has been populated before navigating away.
  await expect.poll(()=>warm.evaluate(async({name,values})=>{
   const {appConfiguration}=await import('/app-backbone.js'),{createApplicationBackbone}=await import('/next-backbone.js'),app=createApplicationBackbone(await appConfiguration());
   await app.ready;const stats=await app.storage.stats();
   return !!app.public.read(name,values)&&stats.entries.some(row=>row.id.includes('|public|'+name+':'));
  },{name,values}),{timeout:30000}).toBe(true);
 }
 const seeded=await warm.evaluate(async({config,sentinel})=>{const {createApplicationBackbone}=await import('/next-backbone.js'),app=createApplicationBackbone(config),member=app.member('private-fixture-user',async()=>({profile:{displayName:sentinel}}));const value=await member.call('me',{});return {value,stats:await app.storage.stats()};},{config:privateConfig,sentinel});
 assert.equal(seeded.value.profile.displayName,sentinel);assert.equal(seeded.stats.mode,'persistent');assert.ok(seeded.stats.entries.some(entry=>entry.id.includes('private-fixture-user')));
 await warm.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});await(await context.newCDPSession(warm)).send('Network.clearBrowserCache');await context.close();context=null;await new Promise(resolve=>server.close(resolve));
 context=await chromium.launchPersistentContext(profile,{headless:true,offline:true,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost']});const blank=context.pages()[0]||await context.newPage();await(await context.newCDPSession(blank)).send('Network.clearBrowserCache');
 let count=0;
 const cases=[['/people?location=bondi','people'],['/profile?location=bondi','profile'],['/profile/edit','edit'],['/members/fixture-member?location=bondi','member'],['/reports/'+tripId,'report'],['/reports/99999999-9999-4999-8999-999999999999','unavailable'],['/reports/not-a-uuid','invalid'],['/profiles?screen=people&site=bondi','people'],['/profiles?screen=edit','edit'],['/profiles?screen=member&id=fixture-member','member'],['/?view=trip&trip='+tripId,'report'],['/reports/'+tripId+'/','report']];
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}])for(const theme of ['yellow','cobalt','navy-light','navy'])for(const [path,kind]of cases){
  const page=await context.newPage();watch(page);await page.setViewportSize(viewport);await page.addInitScript(theme=>localStorage.setItem('finfolk-theme',theme),theme);const response=await page.goto(base+path);assert.equal(response.headers()['x-finfolk-offline'],'1',path);
  if(kind==='report'){await page.getByRole('heading',{name:publishedReport.title,exact:true}).waitFor();await page.getByRole('button',{name:'Copy report link',exact:true}).waitFor();assert.equal(await page.title(),publishedReport.title+' · FinFolk');}
  else if(kind==='unavailable'||kind==='invalid'){await page.getByRole('heading',{name:'Trip report unavailable',exact:true}).waitFor();if(kind==='invalid')await page.getByText('Choose a valid trip report.',{exact:true}).waitFor();}
  else{await page.locator('.profile-topbar select:not([disabled])').waitFor();if(kind==='people'){await page.getByRole('heading',{name:'Discover your FinFolk.',exact:true}).waitFor();await page.getByText(/^Refine the mix/).click();await page.getByRole('combobox',{name:'Location',exact:true}).selectOption('portsea');await page.waitForURL(url=>url.pathname==='/people'&&url.searchParams.get('location')==='portsea');}else if(kind==='edit')await page.getByRole('heading',{name:'Edit profile',exact:true}).waitFor();else await page.locator('#profile-main').locator('[role=alert], .profile-guest').first().waitFor();assert.equal(await page.locator('.member-hero,.people-grid,.profile-editor').count(),0);}
  await page.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);assert.ok(!(await page.locator('body').innerText()).includes(sentinel));count++;await page.close();
 }
 const verify=await context.newPage();watch(verify);await verify.goto(base+'/reports/'+tripId);await verify.getByRole('heading',{name:publishedReport.title,exact:true}).waitFor();
 const retained=await verify.evaluate(async config=>{const {createApplicationBackbone}=await import('/next-backbone.js'),app=createApplicationBackbone(config),member=app.member('private-fixture-user',async()=>{throw new TypeError('PRIVATE_OFFLINE_BLOCKED');});const value=await member.call('me',{});let anonymousDenied=false;try{await app.public.call('me',{});}catch(error){anonymousDenied=/Sign in again/.test(error.message);}await app.clearMember();const stats=await app.storage.stats();return {value,anonymousDenied,hasPrivateRow:stats.entries.some(entry=>entry.id.includes('private-fixture-user'))};},privateConfig);
 assert.equal(retained.value.profile.displayName,sentinel);assert.equal(retained.anonymousDenied,true);assert.equal(retained.hasPrivateRow,false);
 await assert.rejects(verify.evaluate(async config=>{const {createApplicationBackbone}=await import('/next-backbone.js'),app=createApplicationBackbone(config);return app.member('private-fixture-user',async()=>{throw new TypeError('PRIVATE_OFFLINE_BLOCKED');}).call('me',{});},privateConfig),/PRIVATE_OFFLINE_BLOCKED/);
 assert.equal(requests.filter(url=>url.pathname==='/trips/not-a-uuid').length,0);assert.deepEqual(errors,[]);
 console.log(`MEMBER_REPORT_OFFLINE_PASS: ${count} people/profile/member/public-report cases, four themes and desktop/mobile; actual browser restart and unavailable origin; saved public reports and catalogue, local filters, legacy aliases, invalid/missing reports anonymous profile guards, actor-scoped cached reads and sign-out erasure.`);
}catch(error){console.error('MEMBER_REPORT_OFFLINE_DIAGNOSTICS',JSON.stringify({errors,pages:await Promise.all((context?.pages()||[]).map(async page=>({url:page.url(),body:(await page.locator('body').innerText().catch(()=>'')).slice(0,1200)})))}));throw error;}finally{await context?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));await rm(profile,{recursive:true,force:true});}
