import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {operations,restOperation,createBackbone,createApplicationBackbone} from '../js/finfolk-next/site/web-main/src/next-backbone.js';
import preview from '../backend/preview-worker.mjs';
import {messagingReturnURL} from '../backend/messaging-api.mjs';
// Every implemented browser action must have an explicit registry entry.
for(const file of ['api','posts','trips','invitations','instagram-actions','instagram-discovery','instagram-claims','instagram-commands','messaging-api']){
 const text=await readFile('backend/'+file+'.mjs','utf8');
 for(const match of text.matchAll(/(?:action\s*===\s*|case\s*)["']([A-Za-z][A-Za-z0-9]+)["']/g))if(match[1]!=='string')assert.ok(operations[match[1]],'Missing action '+match[1]);
}
for(const match of (await readFile('backend/messaging-api.mjs','utf8')).matchAll(/app\.(get|post|put|delete)\("([^\"]+)"/g)){
 if(match[2].includes('/oauth/callback'))continue;
 if(match[1]==='post' && ['/v1/me/instagram/claims','/v1/me/instagram/claims/:id/review-request','/v1/admin/messaging/claim-reviews/:id/decision'].includes(match[2])){
  assert.throws(()=>restOperation(match[2].replace(':id','test'),'POST'),/Unknown/,'Retired mutations have no browser binding');
  continue;
 }
 assert.ok(restOperation(match[2].replace(':id','test'),match[1].toUpperCase()));
}
assert.throws(()=>restOperation('/v1/unknown'),/Unknown/);
// The static router must never consume API requests, including errors/OPTIONS.
const config=JSON.parse(await readFile('wrangler.next.jsonc','utf8'));
const forwarded=[];let assets=0;
const env={NEXT_API:{async fetch(r){forwarded.push(r);return Response.json({api:true},{status:r.method==='OPTIONS'?200:403});}},ASSETS:{async fetch(){assets++;return new Response('static');}}};
for(const origin of ['http://finfolk.com.au','http://www.finfolk.com.au','https://www.finfolk.com.au'])for(const path of ['/?view=account&tab=instagram','/api?cursor=two'])for(const method of ['GET','HEAD','POST','OPTIONS']){
 const response=await preview.fetch(new Request(origin+path,{method}),env);
 assert.equal(response.status,308);assert.equal(response.headers.get('Location'),'https://finfolk.com.au'+path);
}
assert.equal(forwarded.length,0,'Insecure or noncanonical requests redirect before reaching the API');
assert.equal(assets,0,'Insecure or noncanonical requests redirect before loading assets');
assert.deepEqual(config.routes.map(r=>r.pattern),['finfolk.com.au','www.finfolk.com.au']);
for(const spec of Object.values(operations).filter(o=>o.transport==='rest')){
 const path=spec.path.replace(':id','fixture')+'?cursor=two';
 assert.ok(config.assets.run_worker_first.some(pattern=>pattern.endsWith('*')?path.split('?')[0].startsWith(pattern.slice(0,-1)):path.split('?')[0]===pattern),path+' must run Worker first');
 const req=new Request('https://finfolk.com.au'+path,{method:spec.method,headers:{Authorization:'Bearer fixture','Idempotency-Key':'fixture'},...(spec.write?{body:'{"fixture":true}'}:{})});
 const response=await preview.fetch(req,env);assert.equal(response.status,403);assert.equal(forwarded.at(-1).url,req.url);assert.equal(forwarded.at(-1).headers.get('Authorization'),'Bearer fixture');if(spec.write)assert.equal(await forwarded.at(-1).text(),'{"fixture":true}');
}
await preview.fetch(new Request('https://finfolk.com.au/trips',{method:'OPTIONS'}),env);assert.equal(assets,0);
await preview.fetch(new Request('https://finfolk.com.au/app.js'),env);assert.equal(assets,1);
const assetRequests=[];
const landingEnv={ASSETS:{async fetch(request){assetRequests.push(new URL(request.url));return new Response('static');}}};
for(const path of ['/', '/?utm_source=instagram&fbclid=example','/?gclid=example','/?v=2','/?v=2&utm_source=instagram&fbclid=example']){
 await preview.fetch(new Request('https://finfolk.com.au'+path),landingEnv);assert.equal(assetRequests.at(-1).pathname,'/','public and campaign URLs load the homepage');
}
for(const query of ['view=discover&section=index&q=beach','view=logbook','view=account&tab=settings','site=bondi','token=reset','invite=fixture','view=discover&v=2','site=bondi&v=2','token=reset&v=2']){
 await preview.fetch(new Request('https://finfolk.com.au/?'+query),landingEnv);assert.equal(assetRequests.at(-1).pathname,'/app');assert.equal(assetRequests.at(-1).search,'?'+query,'preserve application and auth parameters');
}
await preview.fetch(new Request('https://finfolk.com.au/app'),landingEnv);assert.equal(assetRequests.at(-1).pathname,'/app');
assert.equal(new URL(messagingReturnURL({ENVIRONMENT:'next'})).origin,'https://finfolk.com.au');assert.equal(new URL(messagingReturnURL({})).origin,'https://finfolk.com.au');
// Actual runtime: different inputs retain separate outputs and duplicate reads coalesce.
let release;const requests=[];const gate=new Promise(resolve=>{release=resolve;});
const b=createBackbone('route-fixture',async(name,input)=>{requests.push({name,input});if(name==='session'&&input.id==='held')await gate;return {name,input};});
const one=b.call('session',{id:'held'}),two=b.call('session',{id:'held'});await b.call('session',{id:'other'});assert.equal(requests.filter(r=>r.input.id==='held').length,1);release();await Promise.all([one,two]);
assert.equal(b.read('session',{id:'held'}).input.id,'held');assert.equal(b.read('session',{id:'other'}).input.id,'other');
let ready=0;const dispose=b.subscribe('sessions',{cursor:'second'},state=>{if(state.status==='ready')ready++;});await b.call('sessions',{cursor:'second'});await b.call('saveSession',{values:{notes:'private fixture'}});assert.equal(ready>=2,true);assert.equal(b.read('session',{id:'held'}),undefined,'Unobserved related reads are invalidated');dispose();b.close();
// Navigation's source of truth is a substrate model; URL adapters preserve history semantics.
const window=new Window({url:'https://example.test/?view=account&tab=settings&token=SECRET',settings:{disableJavaScriptFileLoading:true,disableCSSFileLoading:true}});window.document.write(await readFile('js/finfolk-next/site/web-main/src/index.html','utf8'));
for(const key of ['document','location','history'])globalThis[key]=window[key];globalThis.addEventListener=window.addEventListener.bind(window);globalThis.innerHeight=844;
const {installAppShell}=await import('../js/finfolk-next/site/web-main/src/mobile-shell.js');
const app=createApplicationBackbone({apiUrl:'https://navigation.example.test'}),shell=installAppShell({backbone:app});
assert.equal(app.state('navigation').tab,'settings');assert.ok(!JSON.stringify(app.state('navigation')).includes('SECRET'));
shell.navigate('logbook',{params:{session:'session-one'}});assert.equal(app.state('navigation').session,'session-one');assert.equal(window.document.body.dataset.view,'logbook');
shell.navigate('trip',{params:{trip:'trip-one'}});assert.equal(app.state('navigation').trip,'trip-one');assert.equal(app.state('navigation').session,undefined);
history.replaceState(null,'','?view=areas');window.dispatchEvent(new window.PopStateEvent('popstate'));assert.equal(app.state('navigation').view,'discover');assert.equal(app.state('navigation').section,'index');
shell.navigate('maps',{params:{site:'bondi'}});shell.setParams({site:'hyams'},{notify:false});assert.equal(app.state('navigation').site,'hyams');assert.equal(shell.route.site,'hyams');
const publicModel=app.public;app.member('alice',async()=>({}));app.clearMember();assert.equal(app.public,publicModel);assert.ok(app.node.spaces.application);assert.ok(app.node.spaces.public===undefined || !app.node.spaces['member:alice']);
await window.happyDOM.close();
console.log('SUBSTRATE_ROUTES_PASS: registry coverage, API forwarding, keyed models, deduplication, subscriptions, invalidation, navigation and identity isolation.');
