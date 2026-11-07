import {createHmac,timingSafeEqual} from 'node:crypto';
import {createMessagingWebhook} from './messaging-transport.mjs';

// Contract sources and review date: docs/MESSAGING_PROVIDER_CONTRACTS.md.
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=500;
export function verifyTikTokMessagingSignature(raw,header,secret,{now=()=>Date.now(),toleranceSeconds=300}={}){
 if(!secret||typeof header!=='string'||header.length>512||!Number.isInteger(toleranceSeconds)||toleranceSeconds<1||toleranceSeconds>900)return false;
 const fields=header.split(',').map(part=>part.trim().split('='));
 if(fields.length!==2||fields.some(pair=>pair.length!==2)||new Set(fields.map(pair=>pair[0])).size!==2)return false;
 const values=Object.fromEntries(fields),timestamp=Number(values.t);
 if(!/^\d{1,12}$/.test(values.t||'')||!Number.isSafeInteger(timestamp)||!/^([a-f0-9]{64})$/.test(values.s||'')||
    Math.abs(now()/1000-timestamp)>toleranceSeconds)return false;
 const expected=createHmac('sha256',secret).update(values.t+'.').update(raw).digest();
 return timingSafeEqual(expected,Buffer.from(values.s,'hex'));
}

export function normalizeTikTokMessages(body,{accountId,clientKey,replyWindowSeconds=172800}){
 if(!identifier(accountId)||!identifier(clientKey)||!Number.isInteger(replyWindowSeconds)||replyWindowSeconds<1||replyWindowSeconds>172800)
  throw Error('Configured TikTok account, app and reply window are required.');
 if(!object(body))throw Error('Invalid TikTok webhook');
 if(body.client_key!==clientKey||body.user_openid!==accountId||body.event!=='im_receive_msg')return [];
 if(typeof body.content!=='string')throw Error('TikTok content must be serialized JSON');
 const content=JSON.parse(body.content);
 if(!object(content))throw Error('Invalid TikTok message content');
 if(content.type!=='text')return []; // EU-restricted events, echoes and attachments are not ingested as text.
 const sender=content.from_user?.id,recipient=content.to_user?.id;
 if(recipient!==accountId||content.to_user?.role!=='business_account'||sender===accountId)return [];
 if(!identifier(sender)||!['personal_account','business_account'].includes(content.from_user?.role)||
    !identifier(content.message_id)||!identifier(content.conversation_id)||typeof content.text?.body!=='string'||
    content.text.body.length>2000||!Number.isSafeInteger(content.timestamp)||content.timestamp<=0)
  throw Error('Invalid TikTok text message');
 const sent=new Date(content.timestamp),deadline=new Date(content.timestamp+replyWindowSeconds*1000);
 if(!Number.isFinite(sent.getTime())||!Number.isFinite(deadline.getTime()))throw Error('Invalid TikTok timestamp');
 return [{eventId:content.message_id,messageId:content.message_id,conversationId:content.conversation_id,
  senderId:sender,body:content.text.body,sentAt:sent.toISOString(),deadline:deadline.toISOString(),metadata:{}}];
}

export function createTikTokMessagingTransport({messaging,accountId,clientKey,appSecret,loadAccessToken,
 replyWindowSeconds=172800,fetcher=fetch,wake,now=()=>Date.now(),retryableCodes=[]}){
 if(!identifier(accountId)||!identifier(clientKey)||typeof appSecret!=='string'||!appSecret||typeof loadAccessToken!=='function')
  throw Error('Configured TikTok Business Messaging authorization is required.');
 normalizeTikTokMessages({}, {accountId,clientKey,replyWindowSeconds});
 const transientCodes=new Set(retryableCodes);
 const webhook=createMessagingWebhook({messaging,wake,
  verify:(request,raw)=>verifyTikTokMessagingSignature(raw,request.headers.get('tiktok-signature'),appSecret,{now}),
  normalize:body=>normalizeTikTokMessages(body,{accountId,clientKey,replyWindowSeconds})});
 return {
  webhook,
  async send(message){
   if(message.provider!=='tiktok'||message.accountId!==accountId||!identifier(message.conversationId)||
      typeof message.body!=='string'||message.body.length>2000)return {status:'failed'};
   if(message.deadline&&Date.parse(message.deadline)<=now())return {status:'retry',retryAfter:1};
   let token;
   try{token=await loadAccessToken({generation:message.generation});}catch{return {status:'retry',retryAfter:60};} // No send was attempted.
   if(typeof token!=='string'||!token)return {status:'failed'};
   let response;
   try{
    response=await fetcher('https://business-api.tiktok.com/open_api/v1.3/business/message/send/',{
     method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
     headers:{'Access-Token':token,'Content-Type':'application/json'},
     body:JSON.stringify({business_id:accountId,recipient_type:'CONVERSATION',recipient:message.conversationId,
      message_type:'TEXT',text:{body:message.body}})});
   }catch{return {status:'uncertain'};}
   if(response.status===429){
    const seconds=Number(response.headers.get('retry-after'));
    return {status:'retry',retryAfter:Number.isInteger(seconds)&&seconds>0?Math.min(seconds,3600):120};
   }
   if(response.status>=500)return {status:'uncertain'};
   let data;
   try{data=await response.json();}catch{return {status:'uncertain'};}
   if(response.ok&&data.code===0&&identifier(data.data?.message?.message_id))
    return {status:'accepted',messageId:data.data.message.message_id};
   if(data.code===0)return {status:'uncertain'}; // Missing acknowledgement ID is not proof of non-delivery.
   if(Number.isInteger(data.code)&&transientCodes.has(data.code))return {status:'retry',retryAfter:120};
   if(Number.isInteger(data.code)&&data.code!==0||response.status===401||response.status===403)return {status:'failed'};
   return {status:'uncertain'};
  },
 };
}
