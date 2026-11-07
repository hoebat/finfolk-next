import {createHash,randomBytes} from 'node:crypto';
import {MessagingAuthorizationChanged} from './messaging-authorization-store.mjs';

const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const noncePattern=/^[A-Za-z0-9_-]{43}$/;
export class MessagingOAuthError extends Error{
 constructor(message,status=400){super(message);this.status=status;}
}

export function createMessagingOAuth({db,application,account,provider,providerAuthorization,authorizationStore,
 redirectURI,returnURL,configurationFingerprint,subscribeOnAuthorization=false}){
 const redirect=new URL(redirectURI),destination=new URL(returnURL);
 if(redirect.protocol!=='https:'||destination.protocol!=='https:'||redirect.hash||destination.username||redirect.username||
    !configurationFingerprint||!['instagram','tiktok'].includes(provider)||!providerAuthorization?.authorizationURL)
  throw Error('Trusted connection-bound OAuth configuration is required.');
 const flow=hash(JSON.stringify([application,account,provider,redirect.href,configurationFingerprint]));
 const cookieName='__Host-finfolk-messaging-'+hash(JSON.stringify([application,account])).slice(0,16);
 const cookie=(value,age)=>`${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
 async function call(name,args){
  const values=[application,account,...args];
  const result=await db.query(`SELECT finfolk_rpc.${name}(${values.map((_,i)=>'$'+(i+1))}) AS value`,values);
  return (Array.isArray(result)?result:result.rows)[0].value;
 }
 return {
  clearCookie:()=>cookie('',0),
  async begin(userId){
   const state=secret(),nonce=secret();
   const authorizationURL=providerAuthorization.authorizationURL(state); // Validate before saving an intent.
   const intent=await call('begin_messaging_oauth',[userId,hash(state),hash(nonce),flow]);
   return {authorizationURL,expiresAt:intent.expiresAt,cookie:cookie(nonce,600)};
  },
  async complete(request,authorizeOperator){
   const url=new URL(request.url),state=url.searchParams.get('state'),codeName=provider==='tiktok'?'auth_code':'code',code=url.searchParams.get(codeName);
   if(url.origin!==redirect.origin||url.pathname!==redirect.pathname||url.searchParams.getAll('state').length!==1||!noncePattern.test(state||'')||
      url.searchParams.has('error')||url.searchParams.getAll(codeName).length!==1||!code||code.length>4096)
    throw new MessagingOAuthError('Authorization callback is invalid.');
   const cookies=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(cookieName+'='));
   if(cookies.length!==1)throw new MessagingOAuthError('Authorization browser binding is missing.',403);
   const nonce=cookies[0].slice(cookieName.length+1);
   if(!noncePattern.test(nonce))throw new MessagingOAuthError('Authorization browser binding is invalid.',403);
   const intent=await call('ret_messaging_oauth_intent',[hash(state)]);
   if(!intent)throw new MessagingOAuthError('Authorization state is expired or already used.');
   if(typeof authorizeOperator!=='function'||!await authorizeOperator(intent.user_id,{application,account,action:'authorization_callback'}))
    throw new MessagingOAuthError('Operator access is no longer available.',403);
   const consumed=await call('consume_messaging_oauth',[intent.user_id,hash(state),hash(nonce),flow]);
   if(!consumed)throw new MessagingOAuthError('Authorization state is expired, changed or already used.');
   try{
    const grant=await providerAuthorization.exchangeCode({code});
    const installed=await authorizationStore.install({...grant,expectedGeneration:consumed.generation,
     verify:credential=>providerAuthorization.verify(credential,{subscribe:subscribeOnAuthorization})});
    return {installed,returnURL:destination.href,cookie:cookie('',0)};
   }catch(error){
    if(error instanceof MessagingAuthorizationChanged)throw new MessagingOAuthError('The account changed during authorization.',409);
    throw new MessagingOAuthError('Provider authorization could not be confirmed. Start authorization again.',503);
   }
  },
 };
}
