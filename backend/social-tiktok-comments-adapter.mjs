import {createMessagingWebhook} from './messaging-transport.mjs';
import {verifyTikTokMessagingSignature} from './messaging-tiktok-transport.mjs';
import {parseTikTokJSON,tiktokID} from './tiktok-comments-provider.mjs';
const actor=value=>typeof value==='string'&&value.length>0&&value.length<=500;
const mentioned=text=>/(^|\s)@finfolk\.com\.au[!?,]?(?=\s|$)/i.test(text);
const command=text=>{const plain=text.replace(/(^|\s)@finfolk\.com\.au[!?,]?(?=\s|$)/gi,' ').trim();return plain.startsWith('/')||plain.toLowerCase()==='help';};

export function createSocialTikTokCommentsAdapter({runtime,clientKey,appSecret,provider,wake,enabled=async()=>true,now=()=>Date.now(),replyWindowSeconds=172800}){
 if(runtime.scope.provider!=='tiktok'||runtime.scope.capability!=='tiktok-comments'||!provider?.comment||!provider?.reply||
  !clientKey||!appSecret||!Number.isInteger(replyWindowSeconds)||replyWindowSeconds<1||replyWindowSeconds>172800)
  throw Error('Scoped TikTok comment runtime and verified provider required');
 const {accountId}=runtime.scope;
 async function normalize(body){
  if(body.client_key!==clientKey||body.user_openid!==accountId||!['comment.update','brand.mention.event'].includes(body.event))return [];
  if(!await enabled())return [];
  const content=parseTikTokJSON(body.content);
  if(!content||typeof content!=='object'||Array.isArray(content))throw Error('Invalid TikTok comment event');
  if(body.event==='comment.update'&&!['insert','set_to_public'].includes(content.comment_action))return [];
  if(body.event==='brand.mention.event'&&(content.type_of_event!=='CREATE'||content.mention_type!=='COMMENT'||content.open_id_of_mentioned_user!==accountId))return [];
  if(!tiktokID(content.comment_id)||!tiktokID(content.video_id)||!actor(content.unique_identifier))throw Error('Invalid TikTok comment identity');
  const target={commentId:content.comment_id,mediaId:content.video_id,senderId:content.unique_identifier};
  let value;
  try{value=await provider.comment(target);}catch{throw Object.assign(Error('TikTok comment read unavailable'),{providerRead:true});}
  if(!value||!mentioned(value.text)||!command(value.text)||value.sentAt>now()+300000||value.sentAt+replyWindowSeconds*1000<=now())return [];
  // Canonical context and provider-fetched content make overlapping owned/mention
  // webhooks the same native receipt. Never use notification time as comment time.
  return [{channel:'mention',messageId:target.commentId,mediaId:target.mediaId,commentOrigin:value.origin,senderId:target.senderId,body:value.text,
   sentAt:value.sentAt*1000,deadline:(value.sentAt+replyWindowSeconds*1000)*1000,url:'https://www.tiktok.com/@/video/'+target.mediaId}];
 }
 return {
  webhook:createMessagingWebhook({messaging:runtime,wake,
   verify:(request,raw)=>verifyTikTokMessagingSignature(raw,request.headers.get('tiktok-signature'),appSecret,{now}),
   normalize}),
  async send(message){
   if(message.deadline==null||!Number.isSafeInteger(message.deadline)||message.deadline<=now()*1000)return {status:'failed'};
   return provider.reply(message);
  },
  async verifyAccount(){throw Error('Public comment commands never perform account linking');},
 };
}
