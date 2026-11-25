import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifiedIdentity} from '../js/finfolk-next/packages/edge/supabase-auth.js';

test('uses the Workers-compatible redirect policy and returns only trusted identity fields',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async(url,options)=>{
   assert.equal(String(url),'https://supabase.finfolk.com.au/auth/v1/user');
   assert.equal(options.redirect,'manual');
   return Response.json({id:'11111111-1111-4111-a111-111111111111',email:'fixture@example.test',email_confirmed_at:'2026-11-25',user_metadata:{admin:true}});
  };
  const identity=await verifiedIdentity({supabaseUrl:'https://supabase.finfolk.com.au',publishableKey:'public'},'Bearer fixture');
  assert.deepEqual(identity,{id:'11111111-1111-4111-a111-111111111111',email:'fixture@example.test',verified:true});
 }finally{globalThis.fetch=previous;}
});
test('rejects redirects without following them or forwarding the bearer elsewhere',async()=>{
 const previous=globalThis.fetch;let calls=0;
 try{
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{Location:'https://untrusted.example'}});};
  await assert.rejects(()=>verifiedIdentity({supabaseUrl:'https://supabase.finfolk.com.au',publishableKey:'public'},'Bearer fixture'),{status:503});
  assert.equal(calls,1);
 }finally{globalThis.fetch=previous;}
});
