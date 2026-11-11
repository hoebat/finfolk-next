import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {createInstagramMessagingTransport} from '../../backend/messaging-instagram-transport.mjs';
import {InstagramProvider} from '../../backend/instagram-provider.mjs';
import {createTikTokMessagingTransport} from '../../backend/messaging-tiktok-transport.mjs';
import {connect,apiDatabase} from './harness.mjs';
import pg from 'pg';
import {createMessagingDatabase} from '../../backend/messaging-database.mjs';
import {installEntities} from './fixtures/entities.mjs';

const db=await connect();
const call=async(name,args,client=db)=>(await client.query(`SELECT finfolk_rpc.${name}(${args.map((_,i)=>'$'+(i+1))}) AS value`,args)).rows[0].value;
const envelope=(key,extra={})=>({eventId:key,messageId:key,conversationId:'thread-'+key,senderId:'sender-'+key,body:'hello',sentAt:new Date().toISOString(),deadline:new Date(Date.now()+3600000).toISOString(),metadata:{},...extra});
const receive=(account,body,application='finfolk',client=db)=>call('receive_message',[application,account,JSON.stringify(body)],client);
const claim=(account,client=db)=>call('claim_message',['finfolk',account],client);
const complete=(account,receipt,reply='hello back',client=db)=>call('complete_message',['finfolk',account,receipt.id,receipt.lease,JSON.stringify({handled:true}),reply],client);
const delivery=(account,client=db)=>call('claim_delivery',['finfolk',account],client);
const result=(account,row,outcome='accepted',providerMessage=randomUUID(),delay=1)=>call('record_delivery_result',['finfolk',account,row.id,row.lease,outcome,providerMessage,delay]);
const count=async table=>(await db.query(`SELECT count(*)::int AS n FROM finfolk."${table}"`)).rows[0].n;
try{
 await installEntities(db);
 await db.query(`INSERT INTO finfolk."MessagingApplication"(id,name) VALUES('finfolk','FinFolk'),('statsdb','Another system');
 INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode,credential_ciphertext)
 VALUES('ig','finfolk','instagram','brand','live','SECRET'),('tt','finfolk','tiktok','brand','live','SECRET'),
 ('other','statsdb','instagram','brand','live','OTHER_SECRET'),('disabled','finfolk','app','disabled','disabled',null),
 ('pilot','finfolk','instagram','pilot','pilot',null);`);
 // Both provider channels run the exact same normalized DB protocol.
 for(const account of ['ig','tt']){
  const input=envelope('same-provider-event');
  const received=await receive(account,input);assert.equal(received.duplicate,false);
  const duplicate=await receive(account,input);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.receipt.id,received.receipt.id);
  const retriedWithNewEvent=await receive(account,{...input,eventId:'another-event-id'});assert.equal(retriedWithNewEvent.receipt.id,received.receipt.id);
  await assert.rejects(receive(account,{...input,body:'changed'}),/Conflicting duplicate/);
  const work=await claim(account);assert.equal(work.provider,account==='ig'?'instagram':'tiktok');assert.equal(work.message.body,'hello');assert.ok(work.receipt.lease);
  assert.equal(JSON.stringify(work).includes('SECRET'),false);
  assert.equal(await complete(account,{...work.receipt,lease:randomUUID()}),null);
  assert.equal((await complete(account,work.receipt)).status,'completed');
  assert.equal(await complete(account,work.receipt),null,'Completion is fenced and produces only one reply');
  const send=await delivery(account);assert.equal(send.recipientId,input.senderId);assert.equal(send.conversationId,input.conversationId);assert.equal(send.delivery.body,'hello back');assert.equal(JSON.stringify(send).includes('SECRET'),false);
  assert.equal((await db.query(`SELECT sent_at FROM finfolk."MessagingMessage" WHERE id=$1`,[send.delivery.message_id])).rows[0].sent_at,null);
  const accepted=await result(account,send.delivery,'accepted',account+'-reply');assert.equal(accepted.state,'provider_accepted');
  assert.equal(await result(account,send.delivery),null,'Old acknowledgement cannot alter a final result');
  const history=await call('ret_messaging_history',['finfolk',account,work.message.conversation_id]);
  assert.equal(history.length,2);assert.deepEqual(new Set(history.map(row=>row.direction)),new Set(['inbound','outbound']));
 }
 assert.equal(await count('MessagingReceipt'),2);assert.equal(await count('MessagingOutbox'),2);
 await assert.rejects(receive('other',envelope('unauthorized')),/outside application scope/);
 await assert.rejects(call('ret_messaging_history',['statsdb','ig',randomUUID()]),/outside application scope/);
 await assert.rejects(receive('ig',envelope('missing',{senderId:''})),/Invalid normalized/);
 await assert.rejects(receive('tt',envelope('metadata',{metadata:[]})),/Expected a JSON object/);
 await assert.rejects(receive('tt',envelope('body-type',{body:{text:'hello'}})),/Invalid normalized/);
 await assert.rejects(receive('tt',envelope('infinite',{deadline:'infinity'})),/Invalid normalized/);
 await assert.rejects(receive('tt',envelope('future',{sentAt:new Date(Date.now()+86400000).toISOString()})),/Invalid normalized/);
 const other=await receive('other',envelope('same-provider-event'),'statsdb');assert.equal(other.duplicate,false,'Provider event keys are scoped by application account');
 const igConversation=(await db.query(`SELECT id FROM finfolk."MessagingConversation" WHERE account_id='ig' LIMIT 1`)).rows[0].id;
 assert.deepEqual(await call('ret_messaging_history',['finfolk','tt',igConversation]),[]);
 await assert.rejects(db.query(`UPDATE finfolk."MessagingConversation" SET participant_id=(SELECT participant_id FROM finfolk."MessagingConversation" WHERE account_id='tt' LIMIT 1) WHERE id=$1`,[igConversation]),error=>error.code==='23503','Account scope enforced below helper functions');
 await assert.rejects(db.query(`UPDATE finfolk."MessagingOutbox" SET account_id='other' WHERE account_id='tt'`),error=>error.code==='23503');
 const disabled=await receive('disabled',envelope('disabled'));assert.ok(disabled.receipt.id);assert.equal(await claim('disabled'),null);
 await receive('pilot',envelope('not-in-pilot'));assert.equal(await claim('pilot'),null);
 await db.query(`UPDATE finfolk."MessagingAccount" SET pilot_sender_ids='["sender-in-pilot"]' WHERE id='pilot'`);
 await receive('pilot',envelope('in-pilot'));const pilot=await claim('pilot');assert.ok(pilot);
 await complete('pilot',pilot.receipt);await db.query(`UPDATE finfolk."MessagingAccount" SET pilot_sender_ids='[]' WHERE id='pilot'`);assert.equal(await delivery('pilot'),null);
 // Concurrent receipt claims skip locked work; a rolled-back claim is recoverable.
 await receive('ig',envelope('parallel-1'));await receive('ig',envelope('parallel-2'));
 const a=await connect(),b=await connect();
 try{
  await a.query('BEGIN');await b.query('BEGIN');await b.query("SET LOCAL statement_timeout='3s'");
  const first=await claim('ig',a),second=await claim('ig',b);assert.notEqual(first.receipt.id,second.receipt.id);
  await a.query('ROLLBACK');await b.query('COMMIT');
  const recovered=await claim('ig');assert.equal(recovered.receipt.id,first.receipt.id);
  await complete('ig',recovered.receipt,null);await complete('ig',second.receipt,null);
 }finally{await a.end();await b.end();}
 // Ingestion itself deduplicates concurrent retries without creating orphan rows.
 const input=envelope('concurrent-receive');const c=await connect();
 try{
  const replies=await Promise.all([receive('tt',input),receive('tt',input,'finfolk',c)]);
  assert.equal(replies.filter(row=>row.duplicate).length,1);assert.equal(replies[0].receipt.id,replies[1].receipt.id);
 }finally{await c.end();}
 const retry=await claim('tt');
 assert.equal((await call('retry_message',['finfolk','tt',retry.receipt.id,retry.receipt.lease,1])).status,'failed');
 assert.equal(await complete('tt',retry.receipt),null);
 assert.equal(await claim('tt'),null,'Retry delay is respected');
 await db.query(`UPDATE finfolk."MessagingReceipt" SET next_attempt_at=now()-interval '1 second' WHERE id=$1`,[retry.receipt.id]);
 const reprocessed=await claim('tt');assert.notEqual(reprocessed.receipt.lease,retry.receipt.lease);
 await db.query(`UPDATE finfolk."MessagingReceipt" SET lease_until=now()-interval '1 second' WHERE id=$1`,[retry.receipt.id]);
 assert.equal(await complete('tt',reprocessed.receipt),null);
 const reclaimed=await claim('tt');assert.notEqual(reclaimed.receipt.lease,reprocessed.receipt.lease);
 await complete('tt',reclaimed.receipt);
 const sending=await delivery('tt');assert.ok(sending);
 await db.query(`UPDATE finfolk."MessagingOutbox" SET lease_until=now()-interval '1 second' WHERE id=$1`,[sending.delivery.id]);
 assert.equal(await result('tt',sending.delivery),null);
 assert.equal(await delivery('tt'),null);
 assert.equal((await db.query(`SELECT state FROM finfolk."MessagingOutbox" WHERE id=$1`,[sending.delivery.id])).rows[0].state,'uncertain','Lost acknowledgements never trigger automatic resend');
 // Definite non-acceptance can retry; unknown outcomes cannot.
 await receive('ig',envelope('send-retry'));const work=await claim('ig');await complete('ig',work.receipt);
 const send=await delivery('ig');assert.equal((await result('ig',send.delivery,'retry',null,1)).state,'pending');assert.equal(await delivery('ig'),null);
 await db.query(`UPDATE finfolk."MessagingOutbox" SET next_attempt_at=now()-interval '1 second' WHERE id=$1`,[send.delivery.id]);
 const sendAgain=await delivery('ig');assert.notEqual(sendAgain.delivery.lease,send.delivery.lease);
 assert.equal((await result('ig',sendAgain.delivery,'uncertain',null)).state,'uncertain');assert.equal(await delivery('ig'),null);
 // Generation fences stop stale processing and delivery after reconnection.
 await receive('ig',envelope('generation'));const fenced=await claim('ig');
 await db.query(`UPDATE finfolk."MessagingAccount" SET generation=generation+1 WHERE id='ig'`);
 assert.equal(await complete('ig',fenced.receipt),null);
 await receive('ig',envelope('generation-send'));const current=await claim('ig');await complete('ig',current.receipt);
 await db.query(`UPDATE finfolk."MessagingAccount" SET generation=generation+1 WHERE id='ig'`);assert.equal(await delivery('ig'),null);
 // Domain changes, completion, audit and outgoing reply share caller rollback.
 await receive('tt',envelope('rollback'));const rollback=await claim('tt');const before=await count('MessagingOutbox'),auditBefore=await count('MessagingAudit');
 await db.query(`INSERT INTO finfolk."SiteCatalog"(id) VALUES(1)`);
 await db.query('BEGIN');await db.query(`UPDATE finfolk."SiteCatalog" SET revision=1`);await complete('tt',rollback.receipt);await db.query('ROLLBACK');
 assert.equal((await db.query(`SELECT revision::int AS n FROM finfolk."SiteCatalog" WHERE id=1`)).rows[0].n,0);
 assert.equal(await count('MessagingOutbox'),before);assert.equal(await count('MessagingAudit'),auditBefore);
 assert.equal((await db.query(`SELECT status FROM finfolk."MessagingReceipt" WHERE id=$1`,[rollback.receipt.id])).rows[0].status,'processing');
 await complete('tt',rollback.receipt,null);
 await receive('tt',envelope('expired',{sentAt:new Date(Date.now()-7200000).toISOString(),deadline:new Date(Date.now()-3600000).toISOString()}));assert.equal(await claim('tt'),null);

 await db.query(`INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode) VALUES('app-chat','finfolk','app','app-chat','live')`);
 await receive('app-chat',envelope('max-processing'));const exhausted=await claim('app-chat');
 await db.query(`UPDATE finfolk."MessagingReceipt" SET attempts=5,lease_until=now()-interval '1 second' WHERE id=$1`,[exhausted.receipt.id]);
 assert.equal(await claim('app-chat'),null);
 assert.equal((await db.query(`SELECT status FROM finfolk."MessagingReceipt" WHERE id=$1`,[exhausted.receipt.id])).rows[0].status,'failed');
 await receive('app-chat',envelope('max-delivery'));const maxWork=await claim('app-chat');await complete('app-chat',maxWork.receipt);
 await db.query(`UPDATE finfolk."MessagingOutbox" SET attempts=4 WHERE account_id='app-chat' AND state='pending'`);
 const maxSend=await delivery('app-chat');assert.equal((await result('app-chat',maxSend.delivery,'retry',null,1)).state,'failed');
 await receive('app-chat',envelope('delivery-expired'));const expWork=await claim('app-chat');await complete('app-chat',expWork.receipt);
 await db.query(`UPDATE finfolk."MessagingOutbox" SET deadline=now()-interval '1 second' WHERE account_id='app-chat' AND state='pending'`);
 assert.equal(await delivery('app-chat'),null);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."MessagingOutbox" WHERE account_id='app-chat' AND state='expired'`)).rows[0].n,1);
 await receive('app-chat',envelope('backoff'));
 await db.query(`UPDATE finfolk."MessagingAccount" SET backoff_until=now()+interval '1 hour' WHERE id='app-chat'`);assert.equal(await claim('app-chat'),null);
 await db.query(`UPDATE finfolk."MessagingAccount" SET backoff_until=null WHERE id='app-chat'`);
 const backoff=await claim('app-chat');await complete('app-chat',backoff.receipt);
 await receive('app-chat',envelope('delivery-concurrent'));const secondSendWork=await claim('app-chat');await complete('app-chat',secondSendWork.receipt);
 const x=await connect(),y=await connect();
 try{
  await x.query('BEGIN');await y.query('BEGIN');await y.query("SET LOCAL statement_timeout='3s'");
  const dx=await delivery('app-chat',x),dy=await delivery('app-chat',y);assert.notEqual(dx.delivery.id,dy.delivery.id);
  await x.query('ROLLBACK');await y.query('ROLLBACK');
 }finally{await x.end();await y.end();}
 assert.equal((await db.query(`SELECT has_function_privilege('finfolk_api','finfolk_rpc.receive_message(text,text,jsonb)','EXECUTE') AS allowed`)).rows[0].allowed,false);

 // The reusable worker bridge executes real DB transactions, with provider I/O
 // injected independently of the application handler.
 const pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:4});
 try{
  for(const [account,provider] of [['bridge-ig','instagram'],['bridge-tt','tiktok']]){
   await db.query(`INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode) VALUES($1,'finfolk',$2,$1,'live')`,[account,provider]);
   const runtime=createMessagingDatabase({db:apiDatabase(pool),application:'finfolk',account});
   await runtime.receive(envelope(account));
   const processed=await runtime.processNext(async context=>{
    assert.equal(context.provider,provider);assert.equal((await context.history()).length,1);
    return {reply:'Application reply',apply:async query=>{
     const rows=await query(`UPDATE finfolk."SiteCatalog" SET revision=revision+1 RETURNING revision`);
     return {revision:rows[0].revision};
    }};
   });assert.equal(processed.status,'completed');
   const delivered=await runtime.deliverNext({send:async message=>{
    assert.equal(message.provider,provider);assert.equal(message.body,'Application reply');assert.equal(message.generation,1);assert.ok(message.deadline);
    assert.equal((await db.query(`SELECT state FROM finfolk."MessagingOutbox" WHERE id=$1`,[message.idempotencyKey])).rows[0].state,'sending','Claim commits before network I/O');
    return {status:'accepted',messageId:account+'-provider-reply'};
   }});assert.equal(delivered.status,'provider_accepted');
   assert.equal((await runtime.processNext(async()=>{throw Error('must not run');})).status,'idle');
  }
  // Verified raw webhook -> actual PostgreSQL -> handler -> actual provider
  // HTTP request encoding (network is injected) -> recorded acknowledgement.
  await db.query(`INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode) VALUES('ingress-ig','finfolk','instagram','12345','live')`);
  const ingress=createMessagingDatabase({db:apiDatabase(pool),application:'finfolk',account:'ingress-ig'});
  let wakes=0,providerCalls=0;
  const provider=new InstagramProvider({provider:'instagram-facebook',accountId:'12345',graphVersion:'v26.0',token:'TEST_TOKEN'},async(url,init)=>{
   providerCalls++;assert.equal(new URL(url).pathname,'/v26.0/12345/messages');assert.equal(init.headers.Authorization,'Bearer TEST_TOKEN');
   assert.deepEqual(JSON.parse(init.body),{recipient:{id:'67890'},message:{text:'Signed webhook reply'}});
   return Response.json({message_id:'graph-reply-1'});
  });
  const transport=createInstagramMessagingTransport({messaging:ingress,provider,accountId:'12345',appSecret:'TEST_SECRET',verifyToken:'TEST_VERIFY',replyWindowSeconds:3600,wake:async()=>{wakes++;}});
  const body=JSON.stringify({object:'instagram',entry:[{id:'12345',messaging:[{sender:{id:'67890'},recipient:{id:'12345'},timestamp:Date.now(),message:{mid:'signed-mid-1',text:'Signed hello'}}]}]});
  const signed=()=>new Request('https://api.example.test/instagram/webhook',{method:'POST',body,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256','TEST_SECRET').update(body).digest('hex')}});
  assert.equal((await transport.webhook(signed())).status,200);assert.equal((await transport.webhook(signed())).status,200);assert.equal(wakes,1);
  assert.equal((await ingress.processNext(async({message})=>{assert.equal(message.body,'Signed hello');return {reply:'Signed webhook reply'};})).status,'completed');
  assert.equal((await ingress.deliverNext(transport)).status,'provider_accepted');assert.equal(providerCalls,1);
  await db.query(`INSERT INTO finfolk."MessagingAccount"(id,application_id,provider,account_id,mode) VALUES('ingress-tt','finfolk','tiktok','tt-business','live')`);
  const ttIngress=createMessagingDatabase({db:apiDatabase(pool),application:'finfolk',account:'ingress-tt'});
  let ttWakes=0,ttSends=0;
  const ttTransport=createTikTokMessagingTransport({messaging:ttIngress,accountId:'tt-business',clientKey:'tt-app',appSecret:'TT_SECRET',loadAccessToken:async()=>'TT_TOKEN',wake:async()=>{ttWakes++;},fetcher:async(url,init)=>{
   ttSends++;assert.equal(url,'https://business-api.tiktok.com/open_api/v1.3/business/message/send/');
   assert.equal(init.headers['Access-Token'],'TT_TOKEN');assert.equal(JSON.parse(init.body).recipient,'tt-thread+/=');
   return Response.json({code:0,data:{message:{message_id:'tt-http-ack'}}});
  }});
  const ttPayload=JSON.stringify({client_key:'tt-app',user_openid:'tt-business',event:'im_receive_msg',create_time:Math.floor(Date.now()/1000),content:JSON.stringify({from_user:{id:'tt-person',role:'personal_account'},to_user:{id:'tt-business',role:'business_account'},conversation_id:'tt-thread+/=',message_id:'tt-http-mid',type:'text',timestamp:Date.now(),text:{body:'TikTok signed hello'}})});
  const ttSigned=()=>{const timestamp=Math.floor(Date.now()/1000);return new Request('https://api.example.test/tiktok/webhook',{method:'POST',body:ttPayload,headers:{'Tiktok-Signature':`t=${timestamp},s=`+createHmac('sha256','TT_SECRET').update(timestamp+'.'+ttPayload).digest('hex')}});};
  assert.equal((await ttTransport.webhook(ttSigned())).status,200);assert.equal((await ttTransport.webhook(ttSigned())).status,200);assert.equal(ttWakes,1);
  assert.equal((await ttIngress.processNext(async({message})=>{assert.equal(message.body,'TikTok signed hello');return {reply:'TikTok reply'};})).status,'completed');
  assert.equal((await ttIngress.deliverNext(ttTransport)).status,'provider_accepted');assert.equal(ttSends,1);
  const runtime=createMessagingDatabase({db:apiDatabase(pool),application:'finfolk',account:'bridge-ig'});
  await runtime.receive(envelope('bridge-failure'));
  assert.equal((await runtime.processNext(async()=>{throw Error('model unavailable');})).status,'retry');
  await db.query(`UPDATE finfolk."MessagingReceipt" SET next_attempt_at=now()-interval '1 second' WHERE account_id='bridge-ig' AND status='failed'`);
  await runtime.processNext(async()=>({reply:'Timeout test'}));
  assert.equal((await runtime.deliverNext({send:async()=>{throw Error('timeout after sending');}})).status,'uncertain');
  assert.equal((await runtime.deliverNext({send:async()=>{throw Error('must not resend');}})).status,'idle');
  await runtime.receive(envelope('bridge-stale'));const revisionBefore=(await db.query(`SELECT revision FROM finfolk."SiteCatalog" WHERE id=1`)).rows[0].revision;
  assert.equal((await runtime.processNext(async()=>{
   await db.query(`UPDATE finfolk."MessagingReceipt" SET lease_until=now()-interval '1 second' WHERE account_id='bridge-ig' AND status='processing'`);
   return {reply:'Must roll back',apply:async query=>{await query(`UPDATE finfolk."SiteCatalog" SET revision=999`);return {applied:true};}};
  })).status,'stale');
  assert.equal((await db.query(`SELECT revision FROM finfolk."SiteCatalog" WHERE id=1`)).rows[0].revision,revisionBefore,'Stale completion rolls back application mutations');
 }finally{await pool.end();}
 console.log('MESSAGING_ENTITIES_PASS: Instagram/TikTok shared receive/claim/reply/delivery/history, scoped identities, atomic duplicates, concurrent workers, retries and lease recovery, generation/pilot/expiry gates, rollback and ambiguous-send protection.');
}finally{await db.end();}
