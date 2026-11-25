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

test('does not expose retired messaging routes or background handlers',async()=>{
 const s=setup();
 for(const path of ['/instagram/webhook','/v1/messaging/connections/chat/status']){
  const response=await s.worker.fetch(new Request('https://api.finfolk.com.au'+path,{method:'POST'}),env);
  assert.equal(response.status,501);assert.equal((await response.json()).code,'native_operation_unavailable');
 }
 assert.equal(s.closed(),s.opened());assert.equal(s.worker.queue,undefined);assert.equal(s.worker.scheduled,undefined);
 const retired=await retiredWorker.fetch(new Request('https://api.finfolk.com.au/instagram/webhook'),{});
 assert.equal(retired.status,410);assert.equal(retired.headers.get('Cache-Control'),'no-store');
 assert.equal(retiredWorker.queue,undefined);assert.equal(retiredWorker.scheduled,undefined);
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
