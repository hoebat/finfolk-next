// TikTok provider I/O; the shared native protocol owns work and policy.
import {createMessagingWebhook} from './messaging-transport.mjs';
import {createTikTokMessagingTransport,normalizeTikTokMessages,verifyTikTokMessagingSignature} from './messaging-tiktok-transport.mjs';
import {nativeCommandEnvelopes} from './social-envelopes.mjs';

export function createSocialTikTokAdapter({runtime,clientKey,appSecret,loadAccessToken,verifyIdentity,
  replyWindowSeconds=172800,fetcher=fetch,wake,now=()=>Date.now()}){
  const {scope}=runtime;
  if(scope.provider!=='tiktok'||typeof verifyIdentity!=='function')throw Error('Scoped TikTok identity adapter required');
  const transport=createTikTokMessagingTransport({messaging:runtime,accountId:scope.accountId,clientKey,appSecret,
    loadAccessToken,replyWindowSeconds,fetcher,wake,now});
  const webhook=createMessagingWebhook({messaging:runtime,wake,
    verify:(request,raw)=>verifyTikTokMessagingSignature(raw,request.headers.get('tiktok-signature'),appSecret,{now}),
    normalize:body=>nativeCommandEnvelopes(normalizeTikTokMessages(body,{accountId:scope.accountId,clientKey,replyWindowSeconds}))});
  return {
    webhook,
    async verifyAccount(request){
      if(request.provider!=='tiktok'||request.namespace!==scope.namespace||typeof request.externalId!=='string')throw Error('Identity outside configured inbox');
      const evidence=await verifyIdentity(request);
      if(!evidence||evidence.provider!==request.provider||evidence.namespace!==request.namespace||
        evidence.externalId!==request.externalId||typeof evidence.eligible!=='boolean')throw Error('Unverified TikTok identity');
      return evidence;
    },
    async send(message){
      if(message.destination?.channel!=='message'||message.deadline!=null&&
        (!Number.isSafeInteger(message.deadline)||message.deadline<=now()*1000))return {status:'failed'};
      return transport.send({...message,conversationId:message.destination.conversationId,
        deadline:message.deadline==null?null:new Date(message.deadline/1000).toISOString()});
    },
  };
}

// Re-read participants instead of trusting a webhook's historic is_follower.
// TikTok supplies follower status only for PERSONAL_ACCOUNT participants.
export function socialTikTokIdentity({authorization,appId,accountId,fetcher=fetch}) {
  return async request=>{
    if(typeof request.conversationId!=='string'||!request.conversationId||request.conversationId.length>500)
      throw Error('A receipt-bound TikTok conversation is required');
    const token=await socialTikTokAccessToken({authorization,appId,accountId});
    const url=new URL('https://business-api.tiktok.com/open_api/v1.3/business/message/content/list/');
    url.searchParams.set('business_id',accountId);url.searchParams.set('conversation_id',request.conversationId);
    let response,data;
    try {
      response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Access-Token':token}});
      data=await response.json();
    }catch{throw Error('TikTok participant verification unavailable');}
    const participants=data?.data?.participants;
    if(!response.ok||data.code!==0||!Array.isArray(participants)||
      participants.filter(p=>p.id===accountId&&p.role==='BUSINESS_ACCOUNT').length!==1)
      throw Error('TikTok conversation account mismatch');
    const matches=participants.filter(p=>p.id===request.externalId&&p.id!==accountId);
    if(matches.length!==1||!['PERSONAL_ACCOUNT','BUSINESS_ACCOUNT'].includes(matches[0].role)||
      matches[0].role==='PERSONAL_ACCOUNT'&&typeof matches[0].is_follower!=='boolean')
      throw Error('TikTok participant identity was not confirmed');
    return {provider:'tiktok',namespace:request.namespace,externalId:request.externalId,
      eligible:matches[0].role==='PERSONAL_ACCOUNT'&&matches[0].is_follower===true};
  };
}

export async function socialTikTokAccessToken({authorization,appId,accountId,generation}) {
  const current=await authorization.connection();
  if(current.provider!=='tiktok'||current.accountId!==accountId||current.mode==='disabled'||
    current.checks?.authorized!==true||current.checks?.subscribed!==true||current.checks?.appId!==appId)
    throw Error('TikTok authorization is not ready');
  return authorization.accessToken({authMethod:'tiktok-business',appId,generation:generation??current.generation});
}
