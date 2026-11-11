import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
import {generateKeyPair,SignJWT,jwtVerify} from 'jose';
import {createNextWorker} from '../../backend/next-api-worker.mjs';
import {createWorkerMessaging} from '../../backend/messaging-worker.mjs';
import {messagingPreflight} from '../../scripts/messaging_preflight.mjs';
import {connect,apiDatabase} from './harness.mjs';
import {installEntities,user} from './fixtures/entities.mjs';
import {createMessagingGateway} from '../../backend/messaging-gateway.mjs';
import {createFinFolkMessagingHandler,createFinFolkMessagingIdentityPolicy} from '../../backend/messaging-handlers.mjs';

const db=await connect(),pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:6}),database=apiDatabase(pool);
const api='https://api.example.test',frontend='https://finfolk.example',expectedDatabase=new URL(process.env.FINFOLK_TEST_DATABASE_URL).pathname.slice(1);
const encryptionEnv={MESSAGING_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
const apps=[{key:'igapp',provider:'instagram',appId:'999',appSecret:'IG_SECRET',verifyToken:'VERIFY'},{key:'ttapp',provider:'tiktok',appId:'tt-app',appSecret:'TT_SECRET'}];
const connections=[
 {key:'ig',application:'finfolk',account:'ig',providerApp:'igapp',accountId:'12345',authMethod:'instagram-facebook',pageId:'321',graphVersion:'v26.0',replyWindowSeconds:3600,handler:'finfolk',returnURL:frontend+'/account'},
 {key:'ig2',application:'finfolk',account:'ig2',providerApp:'igapp',accountId:'12346',authMethod:'instagram-facebook',pageId:'321',graphVersion:'v26.0',replyWindowSeconds:3600,handler:'finfolk',returnURL:frontend+'/account'},
 {key:'tt',application:'finfolk',account:'tt',providerApp:'ttapp',accountId:'tt-business',handler:'finfolk',returnURL:frontend+'/account',accountAuthorizationURL:'https://www.tiktok.com/v2/auth/authorize?client_key=tt-app'},
 {key:'chat',application:'finfolk',account:'chat',provider:'app',accountId:'chat',handler:'finfolk'},
 {key:'other',application:'other',account:'other',provider:'app',accountId:'other',handler:'finfolk'},
];
let adminAllowed=true,exchanges=0,sends=[],wakes=[],providerRequests=[];
async function authorize(request,scope){
 const id=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!['admin','alice','bob'].includes(id))return null;
 const valid=(await db.query(`SELECT id FROM neon_auth."user" WHERE id=$1 AND NOT coalesce(banned,false)`,[id])).rows.length;
 if(!valid||scope.application!=='finfolk'||scope.action==='admin'&&(id!=='admin'||!adminAllowed))return null;return {id};
}
const authorizeCallback=async(id,scope)=>id==='admin'&&adminAllowed&&scope.application==='finfolk';
const request=(key,action,{method='POST',actor='admin',body={},origin=frontend,headers={}}={})=>new Request(`${api}/v1/messaging/connections/${key}/${action}`,{method,headers:{Authorization:'Bearer '+actor,...(origin?{Origin:origin}:{}),...(method==='POST'?{'Content-Type':'application/json'}:{}),...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
const fetcher=async(url,init={})=>{
 const parsed=new URL(url),path=parsed.pathname;
 providerRequests.push({host:parsed.hostname,path,method:init.method||'GET'});
 if(parsed.hostname==='graph.facebook.com'){
  if(path.endsWith('/oauth/access_token')){if(parsed.searchParams.has('code'))exchanges++;return Response.json({access_token:'IG_USER',expires_in:3600});}
  if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',type:'PAGE',expires_at:0,data_access_expires_at:0}});
  if(path.endsWith('/me'))return Response.json({id:'321'});
  if(path.endsWith('/321'))return Response.json({id:'321',instagram_business_account:{id:'12345',username:'finfolk.com.au'},access_token:'IG_LONG'});
  if(path.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
  if(path.endsWith('/messages')){sends.push({provider:'instagram',...JSON.parse(init.body)});return Response.json({message_id:'ig-reply-'+sends.length});}
 }
 if(parsed.hostname==='business-api.tiktok.com'){
  if(path.endsWith('/oauth2/token/')){exchanges++;return Response.json({code:0,data:{open_id:'tt-business',access_token:'TT_ACCESS',refresh_token:'TT_REFRESH',scope:'message.list.manage,message.list.send,user.account.type',expires_in:86400,refresh_token_expires_in:31536000}});}
  if(path.endsWith('/token_info/get/'))return Response.json({code:0,data:{app_id:'tt-app',creator_id:'tt-business',scope:'message.list.manage,message.list.send,user.account.type'}});
  if(path.endsWith('/business/get/'))return Response.json({code:0,data:{has_advanced_access:true}});
  if(path.endsWith('/conversation/list/'))return Response.json({code:0,data:{conversations:[]}});
  if(path.endsWith('/webhook/list/'))return Response.json({code:0,data:{app_id:'tt-app',event_type:'DIRECT_MESSAGE',callback_url:api+'/v1/messaging/webhooks/ttapp'}});
  if(path.endsWith('/message/send/')){sends.push({provider:'tiktok',...JSON.parse(init.body)});return Response.json({code:0,data:{message:{message_id:'tt-reply-'+sends.length}}});}
 }
 throw Error('Unexpected provider request');
};
try{
 await installEntities(db);for(const id of ['admin','alice','bob'])await user(db,id);
 await db.query(`INSERT INTO finfolk."MessagingApplication"(id,name) VALUES('finfolk','FinFolk'),('other','Other');
 INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id) VALUES('ig','finfolk','instagram','12345'),('ig2','finfolk','instagram','12346'),('tt','finfolk','tiktok','tt-business'),('chat','finfolk','app','chat'),('other','other','app','other')`);
 const policy=createFinFolkMessagingIdentityPolicy({db:database});
 const handler=createFinFolkMessagingHandler({authorizePersonal:policy,commands:{test:async({userId,args})=>({reply:'For '+userId,apply:async query=>{
  await query(`INSERT INTO finfolk."UserRequestLimit"(user_id,minute,count) VALUES($1,now(),1) ON CONFLICT(user_id) DO UPDATE SET count=finfolk."UserRequestLimit".count+1`,[userId]);return {owner:userId,args};
 }})}});
 const config={db:database,enabled:true,expectedDatabase,apiOrigin:api,apps,connections,handlers:{finfolk:handler},authorize,authorizeCallback,allowedOrigins:[frontend],encryptionEnv,fetcher,wake:async key=>{wakes.push(key);}};
 const gateway=createMessagingGateway(config);
 assert.equal((await createMessagingGateway({...config,enabled:false}).fetch(request('chat','status',{method:'GET'}))).status,503);
 assert.equal((await createMessagingGateway({...config,expectedDatabase:'wrong'}).fetch(request('chat','status',{method:'GET'}))).status,503);
 assert.equal((await gateway.fetch(request('chat','status',{method:'GET',actor:'alice'}))).status,403);
 assert.equal((await gateway.fetch(request('chat','activation',{origin:'https://evil.example',body:{generation:1,mode:'live'}}))).status,403);
 assert.equal((await gateway.fetch(request('other','messages',{method:'GET',actor:'alice'}))).status,403);
 assert.equal((await gateway.fetch(request('chat','activation',{body:{generation:1,mode:'live'}}))).status,200);
 assert.equal((await gateway.fetch(request('chat','messages',{actor:'alice',body:{text:'/ping',senderId:'bob'},headers:{'Idempotency-Key':'one'}}))).status,400);
 const first=await gateway.fetch(request('chat','messages',{actor:'alice',body:{text:'/ping'},headers:{'Idempotency-Key':'one'}}));assert.equal(first.status,202);
 const duplicate=await gateway.fetch(request('chat','messages',{actor:'alice',body:{text:'/ping'},headers:{'Idempotency-Key':'one'}}));assert.equal((await duplicate.json()).duplicate,true);
 assert.equal((await gateway.fetch(request('chat','messages',{actor:'alice',body:{text:'/help'},headers:{'Idempotency-Key':'one'}}))).status,409);
 assert.equal((await gateway.fetch(request('chat','messages',{actor:'bob',body:{text:'/help'},headers:{'Idempotency-Key':'one'}}))).status,202,'Same client key is scoped to each authenticated subject');
 const drained=await gateway.drain({connectionKeys:['chat']});assert.equal(drained[0].processed,2);assert.equal(drained[0].delivered,2);
 const aliceHistory=await (await gateway.fetch(request('chat','messages',{method:'GET',actor:'alice'}))).json();assert.equal(aliceHistory.messages.length,2);assert.ok(aliceHistory.messages.some(row=>row.body==='Pong.'));assert.equal('account_id' in aliceHistory.messages[0],false);
 const bobHistory=await (await gateway.fetch(request('chat','messages',{method:'GET',actor:'bob'}))).json();assert.ok(!bobHistory.messages.some(row=>row.body==='Pong.'));
 await gateway.fetch(request('chat','messages',{actor:'alice',body:{text:'/test owner=bob'},headers:{'Idempotency-Key':'personal'}}));await gateway.drain({connectionKeys:['chat']});
 assert.equal((await db.query(`SELECT user_id FROM finfolk."UserRequestLimit"`)).rows[0].user_id,'alice','Registered action gets the verified owner, never a body-supplied owner');
 await db.query(`UPDATE neon_auth."user" SET "emailVerified"=false WHERE id='bob'`);
 await gateway.fetch(request('chat','messages',{actor:'bob',body:{text:'/test owner=alice'},headers:{'Idempotency-Key':'personal'}}));await gateway.drain({connectionKeys:['chat']});
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."UserRequestLimit"`)).rows[0].n,1,'Unverified personal commands have no mutation');
 // OAuth: cookie, operator, connection, flow, generation and single consumption.
 const begin=await gateway.fetch(request('ig','authorization'));assert.equal(begin.status,200);
 const intent=await begin.json(),cookie=begin.headers.get('set-cookie').split(';')[0],state=new URL(intent.authorizationURL).searchParams.get('state');
 const callback=(key,extraHeaders={},stateValue=state)=>new Request(`${api}/v1/messaging/connections/${key}/oauth/callback?state=${stateValue}&code=CODE`,{headers:extraHeaders});
 assert.equal((await gateway.fetch(callback('ig'))).status,403);assert.equal(exchanges,0);
 assert.equal((await gateway.fetch(callback('ig2',{Cookie:cookie}))).status,403);assert.equal(exchanges,0);
 adminAllowed=false;assert.equal((await gateway.fetch(callback('ig',{Cookie:cookie}))).status,403);assert.equal(exchanges,0);adminAllowed=true;
 const connected=await gateway.fetch(callback('ig',{Cookie:cookie}));assert.equal(connected.status,303);assert.equal(connected.headers.get('location'),frontend+'/account');assert.equal(exchanges,1);
 assert.equal((await gateway.fetch(callback('ig',{Cookie:cookie}))).status,400);assert.equal(exchanges,1);
 assert.equal((await gateway.fetch(request('ig','activation',{body:{generation:2,mode:'pilot',senders:['67890']}}))).status,200);
 const signedBody=JSON.stringify({object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'67890'},recipient:{id:'12345'},timestamp:Date.now(),message:{mid:'mid-gateway',text:'/ping'}}]},{id:'12346',messaging:[]}]});
 const signed=new Request(api+'/v1/messaging/webhooks/igapp',{method:'POST',body:signedBody,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256','IG_SECRET').update(signedBody).digest('hex')}});
 assert.equal((await gateway.fetch(signed)).status,200);const igDrain=await gateway.drain({connectionKeys:['ig']});assert.equal(igDrain[0].delivered,1);assert.equal(sends.at(-1).provider,'instagram');
 // A challenge remains independent of database availability.
 const noDatabase=createMessagingGateway({...config,db:{query:async()=>{throw Error('offline');},transaction:async()=>{throw Error('offline');}}});
 assert.equal((await noDatabase.fetch(new Request(api+'/v1/messaging/webhooks/igapp?hub.mode=subscribe&hub.verify_token=VERIFY&hub.challenge=challenge'))).status,200);
 const secondBegin=await gateway.fetch(request('ig','authorization'));const secondIntent=await secondBegin.json(),secondCookie=secondBegin.headers.get('set-cookie').split(';')[0],secondState=new URL(secondIntent.authorizationURL).searchParams.get('state');
 await gateway.fetch(request('ig','pause',{body:{generation:2}}));
 assert.equal((await gateway.fetch(callback('ig',{Cookie:secondCookie},secondState))).status,400);assert.equal(exchanges,1,'Generation change invalidates a pending authorization before code exchange');
 const ttBegin=await gateway.fetch(request('tt','authorization'));assert.equal(ttBegin.status,200);const ttIntent=await ttBegin.json(),ttCookie=ttBegin.headers.get('set-cookie').split(';')[0],ttState=new URL(ttIntent.authorizationURL).searchParams.get('state');
 assert.equal(new URL(ttIntent.authorizationURL).searchParams.get('disable_auto_auth'),'1');
 const ttCallback=new Request(`${api}/v1/messaging/connections/tt/oauth/callback?state=${ttState}&auth_code=TT_CODE`,{headers:{Cookie:ttCookie}});
 assert.equal((await gateway.fetch(ttCallback)).status,303);assert.equal((await gateway.fetch(request('tt','activation',{body:{generation:2,mode:'live'}}))).status,200);
 const ttRaw=JSON.stringify({client_key:'tt-app',user_openid:'tt-business',event:'im_receive_msg',content:JSON.stringify({from_user:{id:'person',role:'personal_account'},to_user:{id:'tt-business',role:'business_account'},conversation_id:'thread+/=',message_id:'tt-gateway',type:'text',timestamp:Date.now(),text:{body:'/ping'}})}),timestamp=Math.floor(Date.now()/1000);
 assert.equal((await gateway.fetch(new Request(api+'/v1/messaging/webhooks/ttapp',{method:'POST',body:ttRaw,headers:{'Tiktok-Signature':`t=${timestamp},s=`+createHmac('sha256','TT_SECRET').update(timestamp+'.'+ttRaw).digest('hex')}}))).status,200);
 assert.equal((await gateway.drain({connectionKeys:['tt']}))[0].delivered,1);assert.equal(sends.at(-1).recipient,'thread+/=');
 assert.ok(wakes.includes('ig')&&wakes.includes('tt')&&wakes.includes('chat'));
 assert.throws(()=>createMessagingGateway({...config,connections:[connections[0],{...connections[1],accountId:'12345'}]}),/ambiguous/);
 // Acceptance preflight verifies provider grants without mutating native state or sending.
 const stateSnapshot=async()=>JSON.stringify((await db.query(`SELECT table_name,amount FROM (
  SELECT 'accounts' table_name,jsonb_agg(to_jsonb(a) ORDER BY id) amount FROM finfolk."MessagingAccount" a
  UNION ALL SELECT 'audit',jsonb_agg(to_jsonb(a) ORDER BY id) FROM finfolk."MessagingAudit" a
  UNION ALL SELECT 'outbox',jsonb_agg(to_jsonb(a) ORDER BY id) FROM finfolk."MessagingOutbox" a) snapshot ORDER BY table_name`)).rows);
 const snapshot=await stateSnapshot(),sendCount=sends.length,exchangeCount=exchanges,requestCount=providerRequests.length;
 const preview=await gateway.preflight({connectionKeys:['ig','tt','chat']});
 assert.deepEqual(preview.results.map(row=>row.status),['provider_unchecked','provider_unchecked','app_configured']);
 const checked=await gateway.preflight({connectionKeys:['ig','tt','chat'],verifyProviders:true});
 assert.deepEqual(checked.results.map(row=>row.status),['provider_verified','provider_verified','app_configured']);
 assert.equal(checked.liveDeliveryVerified,false);assert.equal(sends.length,sendCount);assert.equal(exchanges,exchangeCount);
 assert.ok(providerRequests.slice(requestCount).every(request=>request.method==='GET'||request.host==='business-api.tiktok.com'&&request.path.endsWith('/tt_user/token_info/get/')&&request.method==='POST'),'Provider requests only inspect identity, permissions and subscriptions');
 assert.equal(await stateSnapshot(),snapshot,'Preflight does not alter grants, subscriptions, mode, audits or deliveries');
 assert.ok(!JSON.stringify(checked).includes('IG_LONG'));assert.ok(!JSON.stringify(checked).includes('TT_ACCESS'));
 assert.equal((await gateway.preflight({connectionKeys:['ig2'],verifyProviders:true})).results[0].status,'unavailable');
 await assert.rejects(gateway.preflight({connectionKeys:['unregistered']}),/Known/);
 await assert.rejects(gateway.preflight({connectionKeys:['tt','tt']}),/Known/);
 let interruptedProbe=false;
 const racingProbe=createMessagingGateway({...config,fetcher:async(...args)=>{
  const response=await fetcher(...args);
  if(!interruptedProbe){interruptedProbe=true;const generation=(await db.query(`SELECT generation FROM finfolk."MessagingAccount" WHERE id='ig'`)).rows[0].generation;
   assert.equal((await gateway.fetch(request('ig','pause',{body:{generation}}))).status,200);}
  return response;
 }});
 assert.equal((await racingProbe.preflight({connectionKeys:['ig'],verifyProviders:true})).results[0].status,'unavailable','Concurrent account transitions invalidate an in-flight provider proof');

 // Exercise the actual Worker registration with signed JWTs and restricted runtime privileges.
 await db.query(await readFile('resources/finfolkdb/messaging-grants.sql','utf8'));
 assert.equal((await db.query(`SELECT has_function_privilege('finfolk_api','finfolk_rpc.receive_chat_message(text,text,text,text,text,integer)','EXECUTE') AS allowed`)).rows[0].allowed,false);
 const restrictedPool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:5,options:'-c role=finfolk_messaging'});
 const restrictedDatabase=apiDatabase(restrictedPool);
 try{
 const {privateKey,publicKey}=await generateKeyPair('EdDSA');
 const issuer='https://native-auth.example',nativeWakes=[];
 const sign=(id,options={})=>new SignJWT({}).setProtectedHeader({alg:'EdDSA'}).setSubject(id).setIssuer(options.issuer||issuer).setIssuedAt().setExpirationTime(options.expiry||'5m').sign(privateKey);
 const aliceToken=await sign('alice'),adminToken=await sign('admin');
 const workerEnv={...encryptionEnv,IG_SECRET:'IG_SECRET',IG_VERIFY:'VERIFY',ENTITY_MESSAGING_ENABLED:'true',ENTITY_MESSAGING_HYPERDRIVE:{connectionString:'native-fixture'},
  ENTITY_MESSAGING_DATABASE_NAME:expectedDatabase,ENTITY_MESSAGING_API_ORIGIN:api,
  ENTITY_MESSAGING_AUTH_BASE_URL:issuer+'/auth',ENTITY_MESSAGING_AUTH_JWKS_URL:issuer+'/jwks',
  ENTITY_MESSAGING_CONFIG:JSON.stringify({applications:[{id:'finfolk',administrators:['admin']}],apps:[{key:'igapp',provider:'instagram',appId:'999',secretEnv:'IG_SECRET',verifyTokenEnv:'IG_VERIFY'}],connections:[connections[0],connections[3]],allowedOrigins:[frontend]}),
  ENTITY_MESSAGING_QUEUE:{send:async body=>nativeWakes.push(body)}};
 let nativeOpens=0,nativeCloses=0;
 const worker=createNextWorker({openDatabase:connectionString=>{assert.equal(connectionString,'native-fixture');nativeOpens++;return {...restrictedDatabase,pool:{end:async()=>nativeCloses++}};},
  messagingFactory:input=>createWorkerMessaging({...input,fetcher}),
  verifierFactory:env=>{assert.equal(env.NEON_AUTH_BASE_URL,issuer+'/auth');return async token=>(await jwtVerify(token,publicKey,{issuer,algorithms:['EdDSA']})).payload;}});
 const workerRequest=(action,token,method='GET',text='/ping')=>new Request(`${api}/v1/messaging/connections/chat/${action}`,{method,headers:{Authorization:'Bearer '+token,Origin:frontend,'Idempotency-Key':'worker-jwt','Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({text})}:{})});
 assert.equal((await worker.fetch(workerRequest('messages',aliceToken),{})).status,503);assert.equal(nativeOpens,0);
 assert.equal((await worker.fetch(workerRequest('messages',await sign('alice',{issuer:'https://attacker.example'})),workerEnv)).status,403);
 assert.equal((await worker.fetch(workerRequest('messages',await sign('alice',{expiry:1})),workerEnv)).status,403);
 assert.equal((await worker.fetch(workerRequest('status',aliceToken),workerEnv)).status,403);
 assert.equal((await worker.fetch(workerRequest('status',adminToken),workerEnv)).status,200);
 const wrongKeys=await generateKeyPair('EdDSA');
 const forged=await new SignJWT({}).setProtectedHeader({alg:'EdDSA'}).setSubject('admin').setIssuer(issuer).setExpirationTime('5m').sign(wrongKeys.privateKey);
 assert.equal((await worker.fetch(workerRequest('status',forged),workerEnv)).status,403);
 const restrictedBegin=await worker.fetch(new Request(`${api}/v1/messaging/connections/ig/authorization`,{method:'POST',headers:{Authorization:'Bearer '+adminToken,Origin:frontend,'Content-Type':'application/json'},body:'{}'}),workerEnv);
 assert.equal(restrictedBegin.status,200);
 const restrictedIntent=await restrictedBegin.json(),restrictedCookie=restrictedBegin.headers.get('set-cookie').split(';')[0];
 const restrictedState=new URL(restrictedIntent.authorizationURL).searchParams.get('state');
 assert.equal((await worker.fetch(new Request(`${api}/v1/messaging/connections/ig/oauth/callback?state=${restrictedState}&code=CODE`,{headers:{Cookie:restrictedCookie}}),workerEnv)).status,303,'OAuth lifecycle operates with restricted native grants');
 const cliProbe=await messagingPreflight({env:{...workerEnv,ENTITY_MESSAGING_DATABASE_URL:process.env.FINFOLK_TEST_DATABASE_URL},args:['--connection=ig','--verify-providers'],
  openDatabase:()=>({...restrictedDatabase,pool:{end:async()=>{}}}),createGateway:input=>createWorkerMessaging({...input,fetcher})});
 assert.equal(cliProbe.exitCode,0);assert.equal(cliProbe.report.results[0].status,'provider_verified');assert.equal(cliProbe.report.liveDeliveryVerified,false);


 assert.equal((await worker.fetch(workerRequest('messages',aliceToken,'POST'),workerEnv)).status,202);
 assert.deepEqual(nativeWakes,[{kind:'entity-messaging',connectionKey:'chat'}]);
 let acknowledged=0,retried=0;
 await worker.queue({messages:[{body:nativeWakes[0],ack:()=>acknowledged++,retry:()=>retried++}]},workerEnv);
 assert.equal(acknowledged,1);assert.equal(retried,0);
 const workerHistory=await (await worker.fetch(workerRequest('messages',aliceToken),workerEnv)).json();
 assert.ok(workerHistory.messages.filter(row=>row.body==='Pong.').length>=2);
 await worker.queue({messages:[{body:{kind:'entity-messaging',connectionKey:'unregistered'},ack:()=>acknowledged++,retry:()=>retried++}]},workerEnv);
 assert.equal(retried,1,'Unregistered dispatch is retried without executing a handler');
 await db.query(`UPDATE neon_auth."user" SET banned=true WHERE id='alice'`);
 assert.equal((await worker.fetch(workerRequest('messages',aliceToken),workerEnv)).status,403);
 await db.query(`UPDATE neon_auth."user" SET banned=false WHERE id='alice'`);
 // Lost wakeups remain durable; cron recovers using only registered connections.
 await worker.fetch(new Request(`${api}/v1/messaging/connections/chat/messages`,{method:'POST',headers:{Authorization:'Bearer '+aliceToken,Origin:frontend,'Idempotency-Key':'lost-worker-wakeup','Content-Type':'application/json'},body:JSON.stringify({text:'/ping'})}),{...workerEnv,ENTITY_MESSAGING_QUEUE:{send:async()=>{throw Error('offline');}}});
 await worker.scheduled({cron:'* * * * *'},workerEnv);
 assert.equal((await db.query(`SELECT count(*)::int n FROM finfolk."MessagingReceipt" WHERE account_id='chat' AND status='received'`)).rows[0].n,0);
 assert.equal(nativeCloses,nativeOpens,'Every native HTTP/queue/cron connection closes');
 }finally{await restrictedPool.end();}
 console.log('MESSAGING_GATEWAY_PASS: opt-in native readiness, authenticated subject-scoped chat, allowlisted FinFolk actions, browser/operator/generation-bound single-use OAuth, app-level signed routing, provider delivery and worker recovery.');
}finally{await pool.end();await db.end();}
