import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {tripId} from './fixtures/nextjs-posts.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true}),context=await browser.newContext(),requests=[],errors=[];let currentPath='';
try{
 // Server rendering uses the isolated upstream fixture. Browser reads are blocked:
 // model and SQLite population must come exclusively from the SSR payload.
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(/^\/v1\/(directory|events|sites\/catalog)(\/|$)/.test(url.pathname)||url.pathname.startsWith('/trips/')){requests.push({page:currentPath,path:url.pathname});return route.abort();}if(!['localhost','127.0.0.1'].includes(url.hostname))return route.abort();return route.fallback();});
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const cases=[['/directory','publicDirectory',{}],['/directory?category=Group&state=NSW','publicDirectory',{category:'Group',state:'NSW'}],['/directory/school','publicDirectoryDetail',{id:'school'}],['/events','publicEvents',{}],['/events/public-event','publicEvent',{id:'public-event'}],['/people','siteCatalog',{}],['/reports/'+tripId,'publicTrip',{id:tripId}]];
 for(const [path,name,values]of cases){
 currentPath=path;const response=await page.goto(base+path);assert.equal(response.status(),200,path);
 await expect.poll(()=>page.evaluate(async({name,values})=>{
 const {appConfiguration,applicationBackbone}=await import('/app-backbone.js'),app=await applicationBackbone(await appConfiguration());await app.ready;
 const data=app.public.read(name,values),stats=await app.storage.stats();return !!data&&stats.entries.some(row=>row.id.includes('|public|'+name+':'));
 },{name,values}),{timeout:30000,message:'SSR must persist '+name+' for '+path}).toBe(true);
 }
 // The persistent Atlas controller independently loads its catalogue on report
 // entry. It has no server catalogue payload and is outside the cache hydrator.
 assert.ok(requests.every(request=>request.page==='/reports/'+tripId&&request.path==='/v1/sites/catalog'),'SSR cache hydration must not issue warm browser reads: '+JSON.stringify(requests));
 assert.ok(requests.length<=1,'Atlas catalogue loading must not loop');
 const guards=await page.evaluate(async()=>{const {appConfiguration,applicationBackbone}=await import('/app-backbone.js'),app=await applicationBackbone(await appConfiguration());let denied=false;try{await app.public.hydrate('me',{}, {secret:true},Date.now());}catch(error){denied=/Only cacheable public reads/.test(error.message);}const first=await app.public.hydrate('publicDirectory',{q:'seed-order'}, {version:2},200),old=await app.public.hydrate('publicDirectory',{q:'seed-order'}, {version:1},100);return {denied,first:first.applied,old:old.applied,data:app.public.read('publicDirectory',{q:'seed-order'})};});
 assert.deepEqual(guards,{denied:true,first:true,old:false,data:{version:2}});assert.deepEqual(errors,[]);
 console.log('PUBLIC_HYDRATION_PASS: seven SSR route/input cases seed real shared-worker SQLite with zero browser warm requests; worker rejects private seeds and stale replay.');
}finally{await browser.close();}
