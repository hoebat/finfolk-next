import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createMessagingWebhook} from '../backend/messaging-transport.mjs';
import {createInstagramMessagingTransport,normalizeInstagramMessages} from '../backend/messaging-instagram-transport.mjs';
const secret='test-secret',accountId='12345',sender='67890';
const payload={object:'instagram',entry:[{id:accountId,messaging:[{sender:{id:sender},recipient:{id:accountId},timestamp:Date.now(),message:{mid:'mid.1',text:'hello'}}]}]};
const raw=JSON.stringify(payload),signature=body=>'sha256='+createHmac('sha256',secret).update(body).digest('hex');
const request=(body=raw,sig=signature(body))=>new Request('https://api.example.test/instagram/webhook',{method:'POST',headers:{'x-hub-signature-256':sig},body});
let saved=[],wakeups=0,sends=0;
const config={accountId,appSecret:secret,verifyToken:'verify',replyWindowSeconds:3600,messaging:{receive:async envelope=>{saved.push(envelope);return {duplicate:false};}},provider:{sendText:async()=>{sends++;return 'reply.1';}},wake:async()=>{wakeups++;}};
const adapter=createInstagramMessagingTransport(config);
assert.equal((await adapter.webhook(request(raw,'sha256='+'0'.repeat(64)))).status,403);assert.equal(saved.length,0);
assert.equal((await adapter.webhook(request(raw+' ',signature(raw)))).status,403,'Exact raw bytes are verified');
assert.equal((await adapter.webhook(request('{'))).status,400);assert.equal(saved.length,0);
assert.equal((await adapter.webhook(request())).status,200);assert.equal(saved.length,1);assert.equal(wakeups,1);
assert.equal(saved[0].conversationId,sender);assert.equal(saved[0].eventId,'mid.1');assert.equal(Date.parse(saved[0].deadline)-Date.parse(saved[0].sentAt),3600000);
const challenge=await adapter.webhook(new Request('https://api.example.test/instagram/webhook?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=abc'));
assert.equal(challenge.status,200);assert.equal(await challenge.text(),'abc');
assert.equal((await adapter.webhook(new Request('https://api.example.test/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc'))).status,403);
const foreign=structuredClone(payload);foreign.entry[0].id='999';assert.deepEqual(normalizeInstagramMessages(foreign,config),[]);
const echo=structuredClone(payload);echo.entry[0].messaging[0].message.is_echo=true;assert.deepEqual(normalizeInstagramMessages(echo,config),[]);
const wrongRecipient=structuredClone(payload);wrongRecipient.entry[0].messaging[0].recipient.id='999';assert.deepEqual(normalizeInstagramMessages(wrongRecipient,config),[]);
const malformed=structuredClone(payload);malformed.entry[0].messaging[0].timestamp='yesterday';assert.throws(()=>normalizeInstagramMessages(malformed,config));
assert.deepEqual(await adapter.send({provider:'instagram',accountId,recipientId:sender,body:'reply'}),{status:'accepted',messageId:'reply.1'});
assert.equal((await adapter.send({provider:'tiktok',accountId,recipientId:sender,body:'reply'})).status,'failed');assert.equal(sends,1);
for(const [error,status]of [[Object.assign(Error(),{definiteRejection:true,retryAfter:120}),'retry'],[Object.assign(Error(),{code:'token_invalid'}),'failed'],[Error('timeout'),'uncertain']]){
 const senderAdapter=createInstagramMessagingTransport({...config,provider:{sendText:async()=>{throw error;}}});
 assert.equal((await senderAdapter.send({provider:'instagram',accountId,recipientId:sender,body:'reply'})).status,status);
}
const deferred=createInstagramMessagingTransport({...config,wake:async()=>{throw Error('queue unavailable');}});
assert.equal((await deferred.webhook(request())).status,200,'Committed receipts survive lost wakeups');
const unavailable=createInstagramMessagingTransport({...config,messaging:{receive:async()=>{throw Error('database unavailable');}}});assert.equal((await unavailable.webhook(request())).status,503);
const generic=createMessagingWebhook({messaging:{receive:async()=>{throw Error('must not write');}},verify:()=>false,normalize:()=>{throw Error('must not parse');}});
assert.equal((await generic(request())).status,403);
assert.equal((await generic(new Request('https://example.test',{method:'POST',body:'123456',headers:{'content-length':'999999'}}))).status,413);
console.log('MESSAGING_TRANSPORT_PASS: signed Instagram ingress, configured-account normalization, challenge verification, durable acknowledgement, safe sender outcomes and provider-independent transport boundary.');

const {createTikTokMessagingTransport,normalizeTikTokMessages,verifyTikTokMessagingSignature}=await import('../backend/messaging-tiktok-transport.mjs');
const ttNow=Date.now(),ttTime=Math.floor(ttNow/1000),ttAccount='business-account',ttKey='business-app';
const ttContent={from_user:{id:'person+1',role:'personal_account'},to_user:{id:ttAccount,role:'business_account'},conversation_id:'conversation+/=',message_id:'tt-message',timestamp:ttNow,type:'text',text:{body:'TikTok hello'}};
const ttBody={client_key:ttKey,user_openid:ttAccount,event:'im_receive_msg',create_time:ttTime,content:JSON.stringify(ttContent)};
const ttRaw=JSON.stringify(ttBody),ttSign=(body,time=ttTime)=>`t=${time},s=`+createHmac('sha256',secret).update(time+'.'+body).digest('hex');
const ttRequest=(body=ttRaw,header=ttSign(body))=>new Request('https://api.example.test/tiktok/webhook',{method:'POST',body,headers:{'Tiktok-Signature':header}});
const ttConfig={accountId:ttAccount,clientKey:ttKey,appSecret:secret,loadAccessToken:async()=>'TT_TEST_TOKEN',now:()=>ttNow,messaging:{receive:async message=>{saved.push(message);return {duplicate:false};}}};
let ttCalls=0;
const tt=createTikTokMessagingTransport({...ttConfig,fetcher:async(url,init)=>{
 ttCalls++;assert.equal(url,'https://business-api.tiktok.com/open_api/v1.3/business/message/send/');assert.equal(init.headers['Access-Token'],'TT_TEST_TOKEN');
 assert.deepEqual(JSON.parse(init.body),{business_id:ttAccount,recipient_type:'CONVERSATION',recipient:'conversation+/=',message_type:'TEXT',text:{body:'reply'}});
 return Response.json({code:0,data:{message:{message_id:'tt-accepted'}}});
}});
assert.equal(verifyTikTokMessagingSignature(Buffer.from(ttRaw),ttSign(ttRaw),secret,{now:()=>ttNow}),true);
assert.equal(verifyTikTokMessagingSignature(Buffer.from(ttRaw),ttSign(ttRaw,ttTime-3600),secret,{now:()=>ttNow}),false);
assert.equal(verifyTikTokMessagingSignature(Buffer.from(ttRaw),ttSign(ttRaw,ttTime+3600),secret,{now:()=>ttNow}),false);
assert.equal(verifyTikTokMessagingSignature(Buffer.from(ttRaw),ttSign(ttRaw)+',t='+ttTime,secret,{now:()=>ttNow}),false);
assert.equal((await tt.webhook(ttRequest(ttRaw+' ',ttSign(ttRaw)))).status,403);
assert.equal((await tt.webhook(ttRequest())).status,200);
assert.equal(saved.at(-1).senderId,'person+1');assert.equal(saved.at(-1).conversationId,'conversation+/=');
assert.equal(Date.parse(saved.at(-1).deadline)-Date.parse(saved.at(-1).sentAt),172800000);
assert.deepEqual(normalizeTikTokMessages({...ttBody,client_key:'another-app'},ttConfig),[]);
assert.deepEqual(normalizeTikTokMessages({...ttBody,user_openid:'another-business'},ttConfig),[]);
assert.deepEqual(normalizeTikTokMessages({...ttBody,event:'im_send_msg'},ttConfig),[]);
assert.deepEqual(normalizeTikTokMessages({...ttBody,event:'im_receive_msg_eu'},ttConfig),[]);
assert.throws(()=>normalizeTikTokMessages({...ttBody,content:ttContent},ttConfig));
assert.equal((await tt.webhook(ttRequest(JSON.stringify({...ttBody,content:'invalid'})))).status,400);
const ttMessage={provider:'tiktok',accountId:ttAccount,conversationId:'conversation+/=',recipientId:'person+1',body:'reply'};
assert.deepEqual(await tt.send(ttMessage),{status:'accepted',messageId:'tt-accepted'});
assert.equal((await tt.send({...ttMessage,provider:'instagram'})).status,'failed');assert.equal(ttCalls,1);
for(const [fetcher,status]of [
 [async()=>Response.json({code:0,data:{message:{}}}),'uncertain'],
 [async()=>new Response('',{status:429,headers:{'retry-after':'60'}}),'retry'],
 [async()=>new Response('',{status:500}),'uncertain'],
 [async()=>Response.json({code:40002}),'failed'],
 [async()=>{throw Error('network timeout');},'uncertain'],
]){
 const candidate=createTikTokMessagingTransport({...ttConfig,fetcher});assert.equal((await candidate.send(ttMessage)).status,status);
}
const noToken=createTikTokMessagingTransport({...ttConfig,loadAccessToken:async()=>{throw Error('vault unavailable');},fetcher:async()=>{throw Error('must not send');}});
assert.equal((await noToken.send(ttMessage)).status,'retry');
console.log('TIKTOK_TRANSPORT_PASS: official Business Messaging envelope, timestamped raw signatures, application/account checks, conversation-based sending, nested acknowledgements and conservative failure handling.');
