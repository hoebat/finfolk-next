// Real native PostgreSQL + HTTP Worker, with synthetic TikTok I/O only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import pg from 'pg';
import {connect} from './harness.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
import {createNativeSocialWorker} from '../../backend/social-worker.mjs';
const db=await connect(),actor=randomUUID(),application=randomUUID(),inbox=randomUUID(),role='finfolk_tt_'+randomUUID().replaceAll('-','');
const appId='7703991919769632789',accountId='fixture-business',origin='https://finfolk.com.au',api='https://api.finfolk.com.au';
const config={application,inbox,provider:'tiktok',appId,accountId,administrators:[actor],accountAuthorizationURL:'https://www.tiktok.com/v2/auth/authorize/?client_key='+appId};
const env={NATIVE_SOCIAL_ENABLED:'true',NATIVE_SOCIAL_CONFIG:JSON.stringify(config),SUPABASE_URL:'https://supabase.finfolk.com.au',SUPABASE_PUBLISHABLE_KEY:'public-fixture',
  SOCIAL_DB:{connectionString:process.env.FINFOLK_TEST_DATABASE_URL},TIKTOK_MESSAGING_APP_SECRET:'synthetic-secret',NATIVE_SOCIAL_REPLY_KEY:'2'.repeat(64),
  MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,37).toString('base64'),NATIVE_SOCIAL_QUEUE:{send:async()=>{}}};
const rpc=createNativeRPC((...args)=>db.query(...args)),prefix='/v1/messaging/connections/finfolk-tiktok/';
let follower=true,sendMode='accepted',refreshes=0,lookups=0;const sends=[],originalFetch=globalThis.fetch;
const provider=async(raw,options={})=>{
 const url=new URL(raw),path=url.pathname;
 if(url.origin==='https://supabase.finfolk.com.au'){
  return options.headers.Authorization==='Bearer fixture-operator'?Response.json({id:actor,email_confirmed_at:'2026-11-26'}):Response.json({error:'invalid'},{status:401});
 }
 assert.equal(url.origin,'https://business-api.tiktok.com');
 if(path.endsWith('/oauth2/token/')||path.endsWith('/oauth2/refresh_token/')){
  if(path.endsWith('/refresh_token/'))refreshes++;
  return Response.json({code:0,data:{open_id:accountId,access_token:'synthetic-token',refresh_token:'synthetic-refresh',expires_in:86400,
   refresh_token_expires_in:31536000,scope:'message.list.manage,message.list.send,user.account.type'}});
 }
 if(path.endsWith('/token_info/get/'))return Response.json({code:0,data:{app_id:appId,creator_id:accountId,scope:'message.list.manage,message.list.send,user.account.type'}});
 if(path.endsWith('/business/get/'))return Response.json({code:0,data:{has_advanced_access:true}});
 if(path.endsWith('/conversation/list/'))return Response.json({code:0,data:{conversations:[]}});
 if(path.endsWith('/webhook/list/')||path.endsWith('/webhook/update/'))return Response.json({code:0,data:{app_id:appId,event_type:'DIRECT_MESSAGE',callback_url:api+'/tiktok/webhook'}});
 if(path.endsWith('/content/list/')){
  lookups++;assert.equal(url.searchParams.get('business_id'),accountId);assert.equal(url.searchParams.get('conversation_id'),'thread+/=');
  return Response.json({code:0,data:{participants:[{id:accountId,role:'BUSINESS_ACCOUNT'},{id:'tester',role:'PERSONAL_ACCOUNT',is_follower:follower}],messages:[]}});
 }
 if(path.endsWith('/message/send/')){
  const value=JSON.parse(options.body);assert.equal(value.business_id,accountId);assert.equal(value.recipient,'thread+/=');
  sends.push(value);if(sendMode==='uncertain')throw Error('Ambiguous synthetic connection reset');
  return Response.json({code:0,data:{message:{message_id:'fixture-reply-'+sends.length}}});
 }
 throw Error('Unexpected provider request '+path);
};
const worker=createNativeSocialWorker({provider:'tiktok',fetcher:provider,openDatabase(connectionString){
 const pool=new pg.Pool({connectionString,options:'-c role='+role,max:1});return {query:async(sql,args)=>{const rows=(await pool.query(sql,args)).rows;if(sql.includes('\"claim_social_delivery\"')&&rows[0]?.value)assert(Number.isInteger(rows[0].value.generation),'Every native delivery retains its rollout generation');return rows;},pool};
}});
function request(path,body,headers={}){
 return new Request(api+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,Authorization:'Bearer fixture-operator',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function command(body,{messageId=randomUUID(),senderId='tester'}={}){
 const raw=JSON.stringify({client_key:appId,user_openid:accountId,event:'im_receive_msg',content:JSON.stringify({type:'text',
  from_user:{id:senderId,role:'personal_account'},to_user:{id:accountId,role:'business_account'},message_id:messageId,
  conversation_id:senderId==='tester'?'thread+/=':'other-thread',timestamp:Date.now(),text:{body}})});
 const t=String(Math.floor(Date.now()/1000)),signature='t='+t+',s='+createHmac('sha256',env.TIKTOK_MESSAGING_APP_SECRET).update(t+'.'+raw).digest('hex');
 const incoming=()=>new Request(api+'/tiktok/webhook',{method:'POST',body:raw,headers:{'tiktok-signature':signature}});
 assert.equal((await worker.fetch(incoming(),env)).status,200);assert.equal((await worker.fetch(incoming(),env)).status,200);
 await worker.scheduled(null,env);return messageId;
}
try{
 await db.query(await readFile('resources/finfolkdb/entity-schema.sql','utf8'));
 for(const file of ['account-grants.sql','messaging-grants.sql','social-grants.sql'])await db.query(await readFile('resources/finfolkdb/'+file,'utf8'));
 await rpc('sync_account_identity',[actor,true]);const op=await rpc('new_social_operation',[actor]);
 await rpc('bootstrap_tiktok_inbox',[application,inbox,actor,accountId,op]);await rpc('bootstrap_tiktok_inbox',[application,inbox,actor,accountId,op]);
 assert.equal((await rpc('ret_social_operator_health',[application,inbox])).mode,'disabled');
 await db.query('CREATE ROLE '+role+' NOLOGIN INHERIT; GRANT finfolk_social,finfolk_messaging TO '+role+'; GRANT '+role+' TO CURRENT_USER WITH SET TRUE');
 globalThis.fetch=provider;
 const start=await worker.fetch(request(prefix+'authorization',{}),env);assert.equal(start.status,200);
 const state=new URL((await start.json()).authorizationURL).searchParams.get('state');
 const callback=request('/v1/integrations/tiktok/oauth/callback?state='+state+'&auth_code=synthetic-code',undefined,{Cookie:start.headers.get('Set-Cookie').split(';')[0]});
 const completed=await worker.fetch(callback,env);assert.equal(completed.status,303);assert.equal(completed.headers.get('Location'),origin+'/admin/tiktok');
 assert.equal((await worker.fetch(callback,env)).status,400,'OAuth code/state cannot replay');
 let status=await (await worker.fetch(request(prefix+'status'),env)).json();assert.equal(status.connection.checks.authorized,true);assert.equal(status.connection.mode,'disabled');
 const activated=await worker.fetch(request(prefix+'activation',{generation:status.connection.generation,mode:'pilot',senders:['tester']}),env);assert.equal(activated.status,200);
 // Unsigned payloads and non-allowlisted senders cannot produce replies.
 assert.equal((await worker.fetch(new Request(api+'/tiktok/webhook',{method:'POST',body:'{}'}),env)).status,403);
 await command('/ping',{senderId:'outside-pilot'});assert.equal(sends.length,0);
 await command('/ping');assert.equal(sends.at(-1).text.body,'Pong.');assert.equal(sends.length,1,'Duplicate ingress produces one reply');
 await command('/help');assert.match(sends.at(-1).text.body,/\/connect/);
 follower=false;await command('/connect');assert.match(sends.at(-1).text.body,/not eligible/);
 assert.equal((await db.query('SELECT count(*)::int n FROM finfolk."SocialConnectionProof"')).rows[0].n,0);
 follower=true;await command('/connect');const code=sends.at(-1).text.body.match(/\b[A-Z0-9]{8}\b/)?.[0];assert(code);
 assert(lookups>=3,'Issue and send independently check current participants');
 const before=lookups;
 const connect=await worker.fetch(request('/v1/me/tiktok/connect',{code},{'CF-Connecting-IP':'192.0.2.1'}),env);
 assert.equal(connect.status,200);let linked=await connect.json();assert.equal(linked.connected,true);assert.equal(lookups,before+1,'Redemption rechecks current participants');
 assert.equal((await (await worker.fetch(request('/v1/me/tiktok'),env)).json()).connected,true,'Connection persists across fresh Worker runtimes');
 assert.equal((await worker.fetch(request('/v1/me/tiktok/disconnect',{connectionId:linked.connectionId,identityVersion:linked.identityVersion}),env)).status,200);
 assert.equal((await (await worker.fetch(request('/v1/me/tiktok'),env)).json()).connected,false);
 // A newly issued code becomes unusable if the user unfollows before redemption.
 await command('/connect');const secondCode=sends.at(-1).text.body.match(/\b[A-Z0-9]{8}\b/)?.[0];assert(secondCode);
 follower=false;assert.equal((await worker.fetch(request('/v1/me/tiktok/connect',{code:secondCode},{'CF-Connecting-IP':'192.0.2.1'}),env)).status,409);follower=true;
 // A refresh runs under the real credential lease and persists a new token.
 // Reinstall through the store instead: ciphertext expiry is bound to the row.
 const {createMessagingAuthorizationStore}=await import('../../backend/messaging-authorization-store.mjs');
 const auth=createMessagingAuthorizationStore({db,application,account:inbox,encryptionEnv:env});
 const current=await auth.connection();
 await auth.install({expectedGeneration:current.generation,credential:{token:'synthetic-token',refreshToken:'synthetic-refresh',authMethod:'tiktok-business'},
  expiresAt:new Date(Date.now()+300000).toISOString(),verify:async()=>({provider:'tiktok',appId,accountId,authorized:true,subscribed:true})});
 status=await auth.connection();await worker.fetch(request(prefix+'activation',{generation:status.generation,mode:'pilot',senders:['tester']}),env);
 await worker.scheduled(null,env);assert.equal(refreshes,1);assert(Date.parse((await auth.connection()).expiresAt)>Date.now()+80000000);
 sendMode='uncertain';const sentBefore=sends.length;await command('/ping');assert.equal(sends.length,sentBefore+1);
 await worker.scheduled(null,env);assert.equal(sends.length,sentBefore+1,'Uncertain delivery is never resent');
 const uncertain=(await db.query('SELECT count(*)::int n FROM finfolk."MessagingOutbox" WHERE state=\'uncertain\'')).rows[0].n;assert.equal(uncertain,1);
 status=await auth.connection();assert.equal((await worker.fetch(request(prefix+'activation',{generation:status.generation,mode:'live',senders:[]}),env)).status,409,'No public activation without actual acceptance');
 assert.equal((await worker.fetch(request(prefix+'pause',{generation:status.generation}),env)).status,200);
 await command('/ping');assert.equal(sends.length,sentBefore+1,'Pause prevents new sends');
 console.log('TIKTOK_NATIVE_INTEGRATION_PASS: restricted PostgreSQL Worker; bound OAuth/replay rejection; signed deduplicated ingress; pilot isolation; ping/help; follower denial; encrypted codes; live participant rechecks; persisted member linking/unlinking; token refresh; uncertain-send isolation; pause and public acceptance gate. Synthetic provider, no production changes.');
}finally{
 globalThis.fetch=originalFetch;await db.query('RESET ROLE').catch(()=>{});await db.end();
 const cleanup=new pg.Client({connectionString:process.env.FINFOLK_TEST_DATABASE_URL});await cleanup.connect();
 try{await cleanup.query('DROP OWNED BY '+role);await cleanup.query('DROP ROLE IF EXISTS '+role);}finally{await cleanup.end();}
}
