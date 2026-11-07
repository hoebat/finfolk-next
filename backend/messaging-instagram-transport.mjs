import {createHmac,timingSafeEqual} from 'node:crypto';
import {createMessagingWebhook} from './messaging-transport.mjs';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const id=value=>typeof value==='string'&&/^\d{1,40}$/.test(value);
export function verifyInstagramMessagingSignature(raw,signature,secret){
 if(!secret||!/^sha256=[a-f0-9]{64}$/.test(signature||''))return false;
 return timingSafeEqual(Buffer.from(signature.slice(7),'hex'),createHmac('sha256',secret).update(raw).digest());
}

export function normalizeInstagramMessages(body,{accountId,replyWindowSeconds}){
 if(!object(body)||body.object!=='instagram'||!Array.isArray(body.entry))throw Error('Invalid Instagram webhook');
 if(!id(accountId)||!Number.isInteger(replyWindowSeconds)||replyWindowSeconds<=0||replyWindowSeconds>604800)
  throw Error('Configured account and provider reply window are required.');
 const envelopes=[];
 for(const entry of body.entry){
  if(!object(entry)||entry.id!==accountId)continue;
  if(entry.messaging===undefined)continue;
  if(!Array.isArray(entry.messaging))throw Error('Invalid messaging batch');
  for(const event of entry.messaging){
   if(!object(event)||!object(event.message)||event.message.is_echo||event.message.is_deleted)continue;
   if(typeof event.message.text!=='string')continue; // Attachments/receipts are separate event kinds.
   const sender=event.sender?.id,recipient=event.recipient?.id,mid=event.message.mid;
   if(!id(sender)||recipient!==accountId||sender===accountId)continue;
   if(typeof mid!=='string'||!mid||mid.length>500||event.message.text.length>2000||
      typeof event.timestamp!=='number'||!Number.isSafeInteger(event.timestamp)||event.timestamp<=0)
    throw Error('Invalid Instagram message');
   const sent=new Date(event.timestamp),deadline=new Date(event.timestamp+replyWindowSeconds*1000);
   if(!Number.isFinite(sent.getTime())||!Number.isFinite(deadline.getTime()))throw Error('Invalid message timestamp');
   envelopes.push({eventId:mid,messageId:mid,conversationId:sender,senderId:sender,
    body:event.message.text,sentAt:sent.toISOString(),deadline:deadline.toISOString(),metadata:{}});
  }
 }
 return envelopes;
}

export function createInstagramMessagingTransport({messaging,accountId,appSecret,verifyToken,replyWindowSeconds,provider,wake}){
 if(!id(accountId)||typeof appSecret!=='string'||!appSecret||typeof verifyToken!=='string'||!verifyToken||
    typeof provider?.sendText!=='function')throw Error('Configured Instagram credentials and sender are required.');
 // Validate policy configuration before accepting a request.
 normalizeInstagramMessages({object:'instagram',entry:[]},{accountId,replyWindowSeconds});
 const receive=createMessagingWebhook({messaging,wake,
  verify:(request,raw)=>verifyInstagramMessagingSignature(raw,request.headers.get('x-hub-signature-256'),appSecret),
  normalize:body=>normalizeInstagramMessages(body,{accountId,replyWindowSeconds})});
 return {
  async webhook(request){
   if(request.method!=='GET')return receive(request);
   const url=new URL(request.url),token=url.searchParams.get('hub.verify_token')||'';
   const supplied=Buffer.from(token),expected=Buffer.from(verifyToken);
   if(url.searchParams.get('hub.mode')!=='subscribe'||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))
    return new Response('',{status:403});
   const challenge=url.searchParams.get('hub.challenge');
   if(!challenge||challenge.length>1000)return new Response('',{status:400});
   return new Response(challenge,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  },
  async send(message){
   if(message.provider!=='instagram'||message.accountId!==accountId||!id(message.recipientId)||
      typeof message.body!=='string'||message.body.length>2000)return {status:'failed'};
   if(message.deadline&&Date.parse(message.deadline)<=Date.now())return {status:'retry',retryAfter:1};
   try{return {status:'accepted',messageId:await provider.sendText(message.recipientId,message.body,{generation:message.generation})};}
   catch(error){
    if(error.definiteRejection)return {status:'retry',retryAfter:error.retryAfter};
    if(['provider_rejected','token_invalid','token_missing'].includes(error.code))return {status:'failed'};
    return {status:'uncertain'};
   }
  },
 };
}
