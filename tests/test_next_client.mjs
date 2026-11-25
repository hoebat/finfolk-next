import assert from 'node:assert/strict';
import {createAccountClient} from '../js/finfolk-next/packages/edge/supabase-client.js';
const alice='11111111-1111-4111-a111-111111111111',bob='22222222-2222-4222-a222-222222222222';
let notify,created=0,session={user:{id:alice,email_confirmed_at:'2026-11-26'},access_token:'alice-token'};
const auth={onAuthStateChange(fn){notify=fn;return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session}};},async signOut(){session=null;return {data:{}};}};
const transports=[];
const app={member(id,transport){created++;transports.push(transport);return {call:(operation,values)=>transport(operation,values)};},clearMember(){},setPublicTransport(){},public:{}};
const previous=globalThis.fetch,calls=[];
let started,release;
try{
 globalThis.fetch=async(url,options)=>{
  calls.push({url:String(url),...options});const {operation}=JSON.parse(options.body);
  if(started){started();started=null;await new Promise(resolve=>release=resolve);}
  return Response.json(operation==='me'?{id:alice,profile:{},verified:true}:{displayName:'Saved'});
 };
 const client=createAccountClient(auth,{apiUrl:'https://finfolk.example/'},app);await client.ready;
 await Promise.all([client.call('me',{}),client.call('preferences',{profile:{displayName:'Saved'}})]);
 assert.equal(created,1,'Concurrent calls reuse the same account model');
 assert(calls.every(call=>call.url==='https://finfolk.example/v1/native/account'&&call.headers.Authorization==='Bearer alice-token'));
 const oldTransport=transports[0];
 const pendingStarted=new Promise(resolve=>started=resolve),pending=client.call('me',{});await pendingStarted;
 session={user:{id:bob,email_confirmed_at:'2026-11-26'},access_token:'bob-token'};notify('SIGNED_IN',session);release();
 await assert.rejects(()=>pending,/Account changed/);assert.equal(created,2);
 const before=calls.length;await assert.rejects(()=>oldTransport('preferences',{profile:{displayName:'Stale'}}),/Account changed/);assert.equal(calls.length,before,'An old account transport must not send a mutation');
 await assert.rejects(()=>client.request('/v1/admin/sites/imports',{method:'POST'}),{status:501,code:'native_operation_unavailable'});
 globalThis.fetch=async()=>Response.json({error:'Service unavailable'},{status:503});
 await assert.rejects(()=>client.call('preferences',{profile:{displayName:'Saved'}}),error=>error.status===503&&error.mutationOutcomeUnknown===true);
 await client.signOut();assert.equal(client.user,null);client.close();
 console.log('NEXT_CLIENT_PASS: native bearer requests, shared account model, stale-account read/write rejection and structured unavailable-operation errors.');
}finally{globalThis.fetch=previous;}
