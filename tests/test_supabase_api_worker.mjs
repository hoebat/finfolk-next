import {test} from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../resources/finfolkdb/entity-catalog.json' with {type:'json'};
import retiredWorker from '../backend/next-api-worker.mjs';
import {createSupabaseWorker} from '../backend/supabase-api-worker.mjs';
const env={ENVIRONMENT:'production',SUPABASE_URL:'https://supabase.finfolk.com.au',SUPABASE_PUBLISHABLE_KEY:'public-key',SUPABASE_DB:{connectionString:'private-supabase'},NATIVE_SCHEMA_SHA:'a'.repeat(64)};
function setup(change={},options={}){
 let closed=0,opened=0,transactions=0;const accountQueries=[];
 const worker=createSupabaseWorker({openDatabase:()=>{opened++;return {
  pool:{end:async()=>{closed++;}},
  query:async text=>{
   if(options.queryError)throw options.queryError;
   return text.includes('current_database')?[{database:'postgres',tables:Object.keys(catalog).length,installed:true,...change}]:[];
  },
  transaction:async fn=>{transactions++;return fn(async(text,values)=>{
   accountQueries.push({text,values});
   if(options.accountError)throw options.accountError;
   return [{value:text.includes('"ensure_account"')?{id:values[0],profile:{},verified:true}:null}];
  });},
 };}});
 return {worker,accountQueries,closed:()=>closed,opened:()=>opened,transactions:()=>transactions};
}
test('health verifies the native release through the Supabase binding and closes its connection',async()=>{
 const s=setup(),r=await s.worker.fetch(new Request('https://api.finfolk.com.au/health'),env);
 assert.equal(r.status,200);assert.equal((await r.json()).databaseProvider,'supabase');assert.equal(s.closed(),1);
});
test('does not report ready for an empty, foreign or unmatched database',async()=>{
 for(const change of [{installed:false},{tables:0},{database:'finfolk_next'}]){
  const s=setup(change);assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/health'),env)).status,503);assert.equal(s.closed(),1);
 }
});
test('rejects unexpected origins and handles preflight independently of database availability',async()=>{
 const s=setup();assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/health',{headers:{Origin:'https://evil.example'}}),env)).status,403);
 const r=await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/native/account',{method:'OPTIONS',headers:{Origin:'https://finfolk.com.au'}}),{});
 assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://finfolk.com.au');assert.equal(s.opened(),0);
});
test('never falls back to legacy routes or legacy provider bindings',async()=>{
 const s=setup();assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/me'),env)).status,501);
 assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/health'),{...env,SUPABASE_DB:null,HYPERDRIVE:{connectionString:'legacy'}})).status,503);
});
test('retains the existing public privacy page independently of database readiness',async()=>{
 const s=setup();const r=await s.worker.fetch(new Request('https://api.finfolk.com.au/privacy'),{});
 assert.equal(r.status,200);assert.match(await r.text(),/FinFolk/);assert.equal(s.opened(),0);
});
test('allows only the exact reviewed preview origin when explicitly configured',async()=>{
 const s=setup(),preview='https://111111111111111111111111--finfolk.netlify.app';
 assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/health',{headers:{Origin:preview}}),{...env,FINFOLK_PREVIEW_ORIGIN:preview})).status,200);
 assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/health',{headers:{Origin:'https://222222222222222222222222--finfolk.netlify.app'}}),{...env,FINFOLK_PREVIEW_ORIGIN:preview})).status,403);
});

test('Instagram fails closed without its dedicated service and retired workers remain stopped',async()=>{
 const s=setup();
 const instagram=await s.worker.fetch(new Request('https://api.finfolk.com.au/instagram/webhook',{method:'POST'}),env);
 assert.equal(instagram.status,503);assert.equal((await instagram.json()).code,'social_unavailable');
 const other=await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/messaging/connections/chat/status',{method:'POST'}),env);
 assert.equal(other.status,501);assert.equal((await other.json()).code,'native_operation_unavailable');
 assert.equal(s.closed(),s.opened());assert.equal(s.worker.queue,undefined);assert.equal(s.worker.scheduled,undefined);
 const retired=await retiredWorker.fetch(new Request('https://api.finfolk.com.au/instagram/webhook'),{});
 assert.equal(retired.status,410);assert.equal(retired.headers.get('Cache-Control'),'no-store');
 assert.equal(retiredWorker.queue,undefined);assert.equal(retiredWorker.scheduled,undefined);
});
test('native Instagram delegation preserves bearer authentication and the OAuth cookie with credentialed CORS',async()=>{
 const s=setup();let seen;
 const binding={fetch:async request=>{seen=request;return Response.json({authorizationURL:'https://www.facebook.com/'},{headers:{'Set-Cookie':'__Host-flow=nonce; Path=/; Secure; HttpOnly; SameSite=Lax'}});}};
 const response=await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/messaging/connections/finfolk-instagram/authorization',{
  method:'POST',headers:{Origin:'https://finfolk.com.au',Authorization:'Bearer owner-token'},body:'{}'}),{...env,NATIVE_SOCIAL_SERVICE:binding});
 assert.equal(response.status,200);assert.equal(seen.headers.get('Authorization'),'Bearer owner-token');
 assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://finfolk.com.au');
 assert.equal(response.headers.get('Access-Control-Allow-Credentials'),'true');
 assert.match(response.headers.get('Set-Cookie'),/__Host-flow=nonce/);assert.equal(s.closed(),1);
});
test('closes a failed readiness connection and does not disclose database details',async()=>{
 const s=setup({}, {queryError:Error('PRIVATE_DATABASE_DETAIL')});
 const response=await s.worker.fetch(new Request('https://api.finfolk.com.au/health'),env);
 assert.equal(response.status,503);assert.equal(s.closed(),1);assert(! (await response.text()).includes('PRIVATE_DATABASE_DETAIL'));
});
test('native account requests use the verified identity and reject missing or invalid tokens',async()=>{
 const previous=globalThis.fetch,actor='11111111-1111-4111-a111-111111111111';
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(String(url),'https://supabase.finfolk.com.au/auth/v1/user');
   if(options.headers.Authorization!=='Bearer valid')return Response.json({error:'Invalid token'},{status:401});
   return Response.json({id:actor,email_confirmed_at:'2026-11-26'});
  };
  for(const token of [null,'invalid','valid']){
   const s=setup(),response=await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/native/account?actor=forged',{headers:token?{Authorization:'Bearer '+token}:{}}),env);
   assert.equal(response.status,token==='valid'?200:401);
   assert.equal(s.transactions(),token==='valid'?1:0);assert.equal(s.closed(),1);
   if(token==='valid'){
    assert.equal((await response.json()).id,actor);
    assert.deepEqual(s.accountQueries.map(query=>query.values[0]),[actor,actor]);
   }
  }
 }finally{globalThis.fetch=previous;}
});
test('native permission failures stay forbidden and release the connection',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({id:'11111111-1111-4111-a111-111111111111',email_confirmed_at:'2026-11-26'});
  const s=setup({}, {accountError:Object.assign(Error('PRIVATE_SQL_DETAIL'),{code:'42501'})});
  const response=await s.worker.fetch(new Request('https://api.finfolk.com.au/v1/native/account',{headers:{Authorization:'Bearer valid'}}),env);
  assert.equal(response.status,403);assert.equal(s.closed(),1);assert(! (await response.text()).includes('PRIVATE_SQL_DETAIL'));
 }finally{globalThis.fetch=previous;}
});

test('TikTok delegates only to its own service and preserves signed webhook bytes',async()=>{
 const s=setup(),path='/tiktok/webhook';let got;
 assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au'+path,{method:'POST'}),env)).status,503);
 const signature='t=123,s=fixture',body='{"event":"im_receive_msg"}';
 const response=await s.worker.fetch(new Request('https://api.finfolk.com.au'+path,{method:'POST',headers:{'tiktok-signature':signature},body}),{
  ...env,NATIVE_SOCIAL_SERVICE:{fetch(){throw Error('Wrong provider');}},NATIVE_TIKTOK_SERVICE:{fetch:async request=>{got={body:await request.text(),signature:request.headers.get('tiktok-signature')};return new Response('Accepted');}}});
 assert.equal(response.status,200);assert.deepEqual(got,{body,signature});assert.equal(s.closed(),s.opened());
});

test('the configured native TikTok OAuth callback takes precedence over the setup placeholder',async()=>{
 const s=setup();let seen;
 const callback='https://api.finfolk.com.au/v1/integrations/tiktok/oauth/callback?state=fixture&auth_code=fixture';
 const response=await s.worker.fetch(new Request(callback,{headers:{Cookie:'__Host-bound=fixture'}}),{...env,NATIVE_TIKTOK_SERVICE:{fetch:async request=>{
  seen=request;return new Response(null,{status:303,headers:{Location:'https://finfolk.com.au/admin/tiktok','Set-Cookie':'__Host-bound=; Path=/; Secure; Max-Age=0'}});
 }}});
 assert.equal(response.status,303);assert.equal(seen.url,callback);assert.equal(seen.headers.get('Cookie'),'__Host-bound=fixture');
 assert.equal(response.headers.get('Location'),'https://finfolk.com.au/admin/tiktok');assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
 const disabled=await s.worker.fetch(new Request(callback),env);assert.equal(disabled.status,503);assert(!(await disabled.text()).includes('auth_code=fixture'));
});

test('TikTok comments use the separate service binding and preserve OAuth cookies and raw signatures',async()=>{
 const s=setup(),seen=[];
 const binding={fetch:async request=>{seen.push({path:new URL(request.url).pathname,cookie:request.headers.get('Cookie'),signature:request.headers.get('tiktok-signature'),body:request.method==='POST'?await request.text():null});return new Response(null,{status:303,headers:{Location:'https://finfolk.com.au/admin/tiktok/comments','Set-Cookie':'__Host-comments=; Path=/; Secure; Max-Age=0'}});}};
 const path='/v1/integrations/tiktok/comments/oauth/callback?state=fixture&auth_code=fixture';
 const response=await s.worker.fetch(new Request('https://api.finfolk.com.au'+path,{headers:{Cookie:'__Host-comments=fixture'}}),{...env,NATIVE_TIKTOK_COMMENTS_SERVICE:binding,NATIVE_TIKTOK_SERVICE:{fetch(){throw Error('Wrong DM binding');}}});
 assert.equal(response.status,303);assert.equal(seen[0].cookie,'__Host-comments=fixture');assert.match(response.headers.get('Set-Cookie'),/Max-Age=0/);
 await s.worker.fetch(new Request('https://api.finfolk.com.au/tiktok/comments/webhook',{method:'POST',body:'{"event":"comment.update"}',headers:{'tiktok-signature':'fixture'}}),{...env,NATIVE_TIKTOK_COMMENTS_SERVICE:binding});
 assert.equal(seen[1].body,'{"event":"comment.update"}');assert.equal(seen[1].signature,'fixture');
 assert.equal((await s.worker.fetch(new Request('https://api.finfolk.com.au/tiktok/comments/webhook',{method:'POST'}),env)).status,503);
});
