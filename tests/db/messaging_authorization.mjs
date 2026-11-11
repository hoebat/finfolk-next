import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
import {connect,apiDatabase} from './harness.mjs';
import {installEntities} from './fixtures/entities.mjs';
import {InstagramProvider} from '../../backend/instagram-provider.mjs';
import {verifyInstagramMessagingAuthorization} from '../../backend/messaging-instagram-authorization.mjs';
import {createTikTokMessagingAuthorization} from '../../backend/messaging-tiktok-authorization.mjs';
import {createMessagingAuthorizationStore,MessagingAuthorizationChanged} from '../../backend/messaging-authorization-store.mjs';

const db=await connect(),pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:5});
const encryptionEnv={MESSAGING_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const expiry=()=>new Date(Date.now()+3600000).toISOString();
const token=(value='FIRST',authMethod='instagram-facebook')=>({token:value,authMethod});
const query=(sql,args)=>pool.query(sql,args);
const account=async id=>(await db.query(`SELECT * FROM finfolk."MessagingAccount" WHERE id=$1`,[id])).rows[0];
const store=id=>createMessagingAuthorizationStore({db:apiDatabase(pool),application:'finfolk',account:id,encryptionEnv});
const verify=async(credential,connection)=>({provider:connection.provider,accountId:connection.accountId,authorized:true,subscribed:true});
try{
 await installEntities(db);
 await db.query(`INSERT INTO finfolk."MessagingApplication"(id,name) VALUES('finfolk','FinFolk'),('other','Other');
 INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id)
 VALUES('ig','finfolk','instagram','123'),('tt','finfolk','tiktok','tt-business'),('second','finfolk','instagram','456'),('foreign','other','instagram','123'),('app','finfolk','app','app');`);
 const ig=store('ig');
 assert.equal((await ig.connection()).mode,'disabled');assert.equal('credential_ciphertext' in await ig.connection(),false);
 await assert.rejects(ig.accessToken(),/missing/);
 let verificationAttempted=false;
 const missingKey=createMessagingAuthorizationStore({db:apiDatabase(pool),application:'finfolk',account:'ig',encryptionEnv:{}});
 await assert.rejects(missingKey.install({credential:token(),expiresAt:expiry(),verify:async(...args)=>{verificationAttempted=true;return verify(...args);}}));
 assert.equal(verificationAttempted,false,'Missing encrypted storage fails before provider setup calls');
 const installed=await ig.install({credential:token(),expiresAt:expiry(),verify});assert.equal(installed.generation,2);assert.equal(installed.mode,'disabled');
 const first=await account('ig');assert.ok(!first.credential_ciphertext.includes('FIRST'));assert.equal(await ig.accessToken(),'FIRST');
 assert.equal((await ig.activate({generation:2,mode:'pilot',senders:['actor']})).mode,'pilot');
 await assert.rejects(ig.install({credential:token('WRONG'),expiresAt:expiry(),verify:async()=>({provider:'instagram',accountId:'other',authorized:true,subscribed:true})}),/not verified/);
 assert.equal(await ig.accessToken(),'FIRST');assert.equal((await account('ig')).mode,'pilot','Failed reconnect preserves active grant');
 await assert.rejects(ig.install({credential:token('WRONG'),expiresAt:expiry(),verify:async()=>({provider:'instagram',accountId:'123',authorized:true,subscribed:false})}),/not verified/);
 await assert.rejects(ig.install({credential:token('WRONG'),expiresAt:expiry(),verify,expectedGeneration:1}),MessagingAuthorizationChanged);
 await assert.rejects(ig.activate({generation:1,mode:'live'}),MessagingAuthorizationChanged);
 await assert.rejects(ig.activate({generation:2,senders:[123]}),/Invalid messaging activation/);
 // Ciphertexts bind application, local account, provider and external account.
 await db.query(`UPDATE finfolk."MessagingAccount" SET credential_ciphertext=$1,token_expires_at=$2 WHERE id='second'`,[first.credential_ciphertext,first.token_expires_at]);
 await assert.rejects(store('second').accessToken(),/decrypt|credential|Credential|authorization/i);
 await assert.rejects(store('foreign').connection(),/outside application scope/);
 const badKey=createMessagingAuthorizationStore({db:apiDatabase(pool),application:'finfolk',account:'ig',encryptionEnv:{MESSAGING_ENCRYPTION_KEY:randomBytes(32).toString('base64')}});
 await assert.rejects(badKey.accessToken());
 // Refresh preserves active mode/generation and uses a short independently
 // committed lease rather than holding a transaction over provider HTTP.
 let unblock,entered;
 const waiting=new Promise(resolve=>{unblock=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const refresh=ig.refresh({exchange:async credential=>{assert.equal(credential.token,'FIRST');entered();await waiting;return {credential:token('REFRESHED'),expiresAt:expiry()};},verify});
 await started;
 assert.equal((await ig.refresh({exchange:async()=>{throw Error('Must not make a competing request');},verify})).status,'busy');
 assert.ok((await account('ig')).credential_lease);
 await assert.rejects(ig.accessToken(),error=>error.code==='messaging_refresh_busy'&&error.definiteRejection===true);
 unblock();assert.equal((await refresh).status,'refreshed');assert.equal(await ig.accessToken(),'REFRESHED');
 assert.equal((await account('ig')).generation,2);assert.equal((await account('ig')).mode,'pilot');assert.equal((await account('ig')).credential_lease,null);
 await assert.rejects(ig.refresh({exchange:async()=>{throw Error('provider failed');},verify}),/provider failed/);assert.equal((await account('ig')).credential_lease,null);
 // A reconnect winning while refresh is in flight cannot be overwritten.
 let releaseOld,oldStarted;
 const oldWait=new Promise(resolve=>{releaseOld=resolve;}),oldStart=new Promise(resolve=>{oldStarted=resolve;});
 const staleRefresh=ig.refresh({exchange:async()=>{oldStarted();await oldWait;return {credential:token('STALE'),expiresAt:expiry()};},verify});
 await oldStart;
 const reconnected=await ig.install({credential:token('RECONNECTED'),expiresAt:expiry(),verify});assert.equal(reconnected.generation,3);
 releaseOld();await assert.rejects(staleRefresh,MessagingAuthorizationChanged);assert.equal(await ig.accessToken(),'RECONNECTED');
 await assert.rejects(ig.accessToken({generation:2}),error=>error.code==='messaging_generation_changed'&&error.definiteRejection===true);
 const paused=await ig.pause({generation:3});assert.equal(paused.generation,4);assert.equal(await ig.accessToken(),'RECONNECTED');
 assert.equal((await ig.activate({generation:4,mode:'live'})).mode,'live');
 const disconnected=await ig.disconnect({generation:4,revoke:async credential=>{assert.equal(credential.token,'RECONNECTED');throw Error('remote revoke failed');}});
 assert.equal(disconnected.mode,'disabled');assert.equal(disconnected.remoteRevoked,false);assert.equal((await account('ig')).credential_ciphertext,null);await assert.rejects(ig.accessToken(),/missing/);
 await assert.rejects(ig.activate({generation:5,mode:'live'}),/missing/);
 const tt=store('tt');await tt.install({credential:{token:'TT_TOKEN',refreshToken:'TT_REFRESH',authMethod:'tiktok-business'},expiresAt:expiry(),verify});
 assert.equal(await tt.accessToken({authMethod:'tiktok-business'}),'TT_TOKEN');await assert.rejects(tt.accessToken({authMethod:'instagram-facebook'}),/method changed/);
 await assert.rejects(tt.install({credential:token(),expiresAt:expiry(),verify}),/provider mismatch/);
 await assert.rejects(ig.install({credential:token(),expiresAt:null,verify}),/not verified/);
 await ig.install({credential:token('PERMANENT','instagram-facebook'),expiresAt:null,verify:async(c,a)=>({...await verify(c,a),nonExpiring:true})});assert.equal(await ig.accessToken(),'PERMANENT');
 await assert.rejects(ig.install({credential:token(),expiresAt:'2000-01-01',verify}),/expired/);
 // Native proof validation fails closed on missing IDs and string booleans.
 await assert.rejects(db.query(`SELECT finfolk_rpc.set_messaging_authorization('finfolk','ig',6,'bad',now()+interval '1 hour','{"authorized":true,"subscribed":true}')`),/Invalid verified/);
 await assert.rejects(db.query(`SELECT finfolk_rpc.set_messaging_authorization('finfolk','ig',6,'bad',now()+interval '1 hour','{"provider":"instagram","accountId":"123","authorized":"true","subscribed":true}')`),/Invalid verified/);
 await db.query(`INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id) VALUES('provider-ig','finfolk','instagram','789'),('provider-tt','finfolk','tiktok','business')`);
 const providerStore=store('provider-ig');
 const graph=new InstagramProvider({provider:'instagram-facebook',accountId:'789',pageId:'321',appId:'999',metaAppId:'999',clientSecret:'SECRET',token:'VERIFIED',graphVersion:'v26.0'},async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',type:'PAGE',expires_at:0,data_access_expires_at:0}});
  if(path.endsWith('/me'))return Response.json({id:'321'});
  if(path.endsWith('/321'))return Response.json({id:'321',instagram_business_account:{id:'789',username:'another.business'}});
  return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 });
 const verifiedExpiry=new Date(Date.now()+300000).toISOString();
 await providerStore.install({credential:token('VERIFIED'),expiresAt:expiry(),verify:async()=>({...await verifyInstagramMessagingAuthorization(graph,{accountId:'789'}),expiresAt:verifiedExpiry})});
 assert.equal(await providerStore.accessToken({appId:'999'}),'VERIFIED');await assert.rejects(providerStore.accessToken({appId:'other'}),/app changed/);
 assert.equal(new Date((await account('provider-ig')).token_expires_at).toISOString(),verifiedExpiry,'Provider data-access expiry clamps the stored lifetime');
 const business=createTikTokMessagingAuthorization({appId:'app',appSecret:'SECRET',accountId:'business',callbackURL:'https://api.example.test/webhook',fetcher:async url=>{
  const path=new URL(url).pathname;
  if(path.endsWith('/token_info/get/'))return Response.json({code:0,data:{app_id:'app',creator_id:'business',scope:'message.list.manage,message.list.send,user.account.type'}});
  if(path.endsWith('/business/get/'))return Response.json({code:0,data:{has_advanced_access:true}});
  if(path.endsWith('/conversation/list/'))return Response.json({code:0,data:{conversations:[]}});
  return Response.json({code:0,data:{app_id:'app',event_type:'DIRECT_MESSAGE',callback_url:'https://api.example.test/webhook'}});
 }});
 const businessStore=store('provider-tt');
 await businessStore.install({credential:{token:'VERIFIED_TIKTOK',authMethod:'tiktok-business'},expiresAt:expiry(),verify:business.verify});
 assert.equal(await businessStore.accessToken({appId:'app',authMethod:'tiktok-business'}),'VERIFIED_TIKTOK');
 assert.equal((await businessStore.activate({generation:2,mode:'pilot',senders:['sender']})).mode,'pilot');
 console.log('MESSAGING_AUTHORIZATION_PASS: scoped encrypted grants, account verification, explicit activation, preserved reconnects, leased concurrent refresh, stale refresh fencing, expiry, pause and disconnect.');
}finally{await pool.end();await db.end();}
