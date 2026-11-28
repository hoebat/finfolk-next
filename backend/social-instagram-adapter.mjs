// Provider I/O only. Commands, eligibility decisions and delivery leases belong
// to the Clojure-authored social protocol, also used by TikTok and local mock.
import {createMessagingWebhook} from './messaging-transport.mjs';
import {createInstagramMessagingTransport,normalizeInstagramMessages,verifyInstagramMessagingSignature} from './messaging-instagram-transport.mjs';
import {InstagramProvider} from './instagram-provider.mjs';
import {nativeCommandEnvelopes} from './social-envelopes.mjs';

export function createSocialInstagramAdapter({runtime,appSecret,verifyToken,replyWindowSeconds=86400,loadProvider,wake}) {
  const {scope}=runtime;
  if(scope.provider!=='instagram'||typeof loadProvider!=='function'||!appSecret||!verifyToken)
    throw Error('A scoped Instagram runtime and credentials are required');
  const verify=verifyInstagramMessagingSignature;
  const normalize=body=>nativeCommandEnvelopes(normalizeInstagramMessages(body,{accountId:scope.accountId,replyWindowSeconds}));
  // Validate configured policy even before the first webhook arrives.
  normalize({object:'instagram',entry:[]});
  const receive=createMessagingWebhook({messaging:runtime,verify:(request,raw)=>verify(raw,request.headers.get('x-hub-signature-256'),appSecret),normalize,wake});
  return {
    async webhook(request) {
      if(request.method!=='GET')return receive(request);
      // Use the existing constant-time verifier for the token as well.
      const challenge=createInstagramMessagingTransport({messaging:runtime,accountId:scope.accountId,appSecret,verifyToken,
        replyWindowSeconds,provider:{sendText(){throw Error('Challenge only');}}});
      return challenge.webhook(request);
    },
    async verifyAccount(request,{includeHandle=false}={}) {
      if(request.provider!=='instagram'||request.namespace!==scope.namespace||typeof request.externalId!=='string')
        throw Error('Identity outside configured inbox');
      const profile=await (await loadProvider()).profile(request.externalId);
      return {provider:'instagram',namespace:scope.namespace,externalId:request.externalId,eligible:profile.follows===true,...(includeHandle?{handle:profile.handle}:{})};
    },
    async send(message) {
      if(message.provider!=='instagram'||message.accountId!==scope.accountId||message.destination?.channel!=='message'||
        !/^\d{1,40}$/.test(message.destination.recipientId||'')||typeof message.body!=='string'||message.body.length>2000)
        return {status:'failed'};
      if(message.deadline!=null&&(!Number.isSafeInteger(message.deadline)||message.deadline<=Date.now()*1000))
        return {status:'failed'};
      try {
        const messageId=await (await loadProvider()).sendText(message.destination.recipientId,message.body);
        return {status:'accepted',messageId};
      } catch(error) {
        if(error.definiteRejection)return {status:'retry',retryAfter:error.retryAfter};
        if(['provider_rejected','token_invalid','token_missing'].includes(error.code))return {status:'failed'};
        return {status:'uncertain'};
      }
    },
  };
}

export function socialInstagramProvider({authorization,appId,accountId,pageId,graphVersion,fetcher=fetch}) {
  return async()=>{
    const current=await authorization.connection();
    if(current.provider!=='instagram'||current.accountId!==accountId||current.mode==='disabled'||
      current.checks?.authorized!==true||current.checks?.subscribed!==true||current.checks?.appId!==appId)
      throw Object.assign(Error('Instagram authorization is not ready'),{definiteRejection:true,retryAfter:60});
    return new InstagramProvider({provider:'instagram-facebook',appId,metaAppId:appId,accountId,pageId,graphVersion,
      token:await authorization.accessToken({authMethod:'instagram-facebook',appId,generation:current.generation})},fetcher);
  };
}
