import {InstagramProvider,exchangeOAuth} from './instagram-provider.mjs';
import {instagramAuthorizationURL} from './messaging-config.mjs';

// One provider path for every application: app-bound Page token and linked IG account.
export async function verifyInstagramMessagingAuthorization(provider,{accountId,expectedUsername,subscribe=false}={}){
 const config=provider.config;
 if(!config||config.provider!=='instagram-facebook'||config.accountId!==accountId)
  throw Error('Instagram authorization must match the configured Facebook Page connection.');
 const metadata=await provider.validatePageToken();
 const page=await provider.request('/'+config.pageId+'?fields=id,instagram_business_account{id,username}');
 const identity=page.instagram_business_account;
 if(String(page.id)!==config.pageId||!identity||String(identity.id)!==accountId||typeof identity.username!=='string'||
    expectedUsername&&identity.username.toLowerCase()!==expectedUsername.toLowerCase())throw Error('Instagram authorized account mismatch.');
 if(subscribe)await provider.subscribe();
 if(!await provider.subscriptions())throw Error('Instagram messaging subscription is missing.');
 const expiries=[metadata.expires_at,metadata.data_access_expires_at].filter(v=>Number.isSafeInteger(v)&&v>0);
 return {provider:'instagram',appId:config.appId,accountId,username:identity.username,authorized:true,subscribed:true,
  nonExpiring:metadata.expires_at===0&&!expiries.length,
  ...(expiries.length?{expiresAt:new Date(Math.min(...expiries)*1000).toISOString()}:{})};
}
export function createInstagramMessagingAuthorization({authMethod,appId,clientSecret,accountId,pageId,graphVersion,redirectURI,expectedUsername},fetcher=fetch){
 if(authMethod!=='instagram-facebook'||!/^\d{1,40}$/.test(appId||'')||!clientSecret||!/^\d{1,40}$/.test(accountId||'')||
    !/^\d{1,40}$/.test(pageId||'')||!/^v\d+\.\d+$/.test(graphVersion||'')||new URL(redirectURI).protocol!=='https:')
  throw Error('Configured Facebook Page OAuth connection is required.');
 const settings={provider:authMethod,appId,clientSecret,pageId,redirectURI};
 const env={INSTAGRAM_MESSAGING_PROVIDER:authMethod,INSTAGRAM_MESSAGING_META_APP_ID:appId,
  INSTAGRAM_MESSAGING_META_APP_SECRET:clientSecret,INSTAGRAM_MESSAGING_PAGE_ID:pageId,
  INSTAGRAM_MESSAGING_ACCOUNT_ID:accountId,INSTAGRAM_MESSAGING_REDIRECT_URI:redirectURI,INSTAGRAM_MESSAGING_GRAPH_VERSION:graphVersion};
 return {
  authorizationURL:state=>instagramAuthorizationURL(settings,state),
  verify(credential,{subscribe=false}={}){
   if(credential.authMethod!==authMethod)throw Error('Instagram authorization method mismatch.');
   return verifyInstagramMessagingAuthorization(new InstagramProvider({...settings,accountId,graphVersion,token:credential.token},fetcher),{accountId,expectedUsername,subscribe});
  },
  async exchangeCode({code}){
   if(typeof code!=='string'||!code)throw Error('A validated OAuth code is required.');
   const grant=await exchangeOAuth(code,env,fetcher,{expectedUsername});
   return {credential:{token:grant.token,authMethod,issuedAt:new Date().toISOString()},expiresAt:grant.expiresAt};
  },
 };
}
