import {InstagramProvider,exchangeOAuth} from './instagram-provider.mjs';

// Account ownership verification without the legacy FinFolk brand singleton.
// Instantiate InstagramProvider with the trusted app/token/authorization variant.
export async function verifyInstagramMessagingAuthorization(provider,{accountId,expectedUsername,subscribe=false}={}){
 const config=provider.config;
 if(!config||config.accountId!==accountId||!['instagram-login','instagram-facebook','instagram-unified'].includes(config.provider))
  throw Error('Instagram authorization must match the configured connection.');
 let identity,nonExpiring=false,expiresAt=null;
 const tokenExpiry=metadata=>{
  const expiries=[metadata.expires_at,metadata.data_access_expires_at].filter(value=>Number.isSafeInteger(value)&&value>0);
  expiresAt=expiries.length?new Date(Math.min(...expiries)*1000).toISOString():null;
  nonExpiring=metadata.expires_at===0&&!expiries.length;
 };
 if(config.provider==='instagram-facebook'){
  const debug=await provider.validatePageToken();tokenExpiry(debug);
  const page=await provider.request('/'+config.pageId+'?fields=id,instagram_business_account{id,username}');
  if(String(page.id)!==config.pageId)throw Error('Instagram Page identity mismatch.');
  identity=page.instagram_business_account;
 }else if(config.provider==='instagram-unified'){
  const business=await provider.request('/me?fields=client_business_id');
  if(!/^\d{1,40}$/.test(String(business.client_business_id||'')))throw Error('Instagram business token required.');
  const assigned=await provider.request('/me/assigned_instagram_accounts?fields=id,username&limit=100');
  identity=Array.isArray(assigned.data)?assigned.data.find(row=>String(row.id)===accountId):null;
  // Non-expiring grants require token metadata, not an omitted expiry value.
  if(config.appId&&config.clientSecret){
   const metadata=await provider.request('/debug_token?input_token='+encodeURIComponent(config.token),{token:config.appId+'|'+config.clientSecret});
   if(!metadata.data?.is_valid||String(metadata.data.app_id)!==config.appId)throw Error('Instagram token app mismatch.');
   tokenExpiry(metadata.data);
  }
 }else{
  identity=await provider.request('/me?fields=id,username');
 }
 if(!identity||String(identity.id)!==accountId||typeof identity.username!=='string'||
    expectedUsername&&identity.username.toLowerCase()!==expectedUsername.toLowerCase())throw Error('Instagram authorized account mismatch.');
 if(subscribe)await provider.subscribe();
 if(!await provider.subscriptions())throw Error('Instagram messaging subscription is missing.');
 return {provider:'instagram',appId:config.appId,accountId,username:identity.username,authorized:true,subscribed:true,nonExpiring,...(expiresAt?{expiresAt}:{})};
}

// OAuth exchange and refresh are connection-scoped. The existing provider's
// legacy authorization callbacks and FinFolk policy remain unchanged.
export function createInstagramMessagingAuthorization(config,fetcher=fetch){
 const {authMethod,appId,clientSecret,accountId,graphVersion,redirectURI,expectedUsername,pageId,loginConfigId}=config;
 if(!['instagram-login','instagram-facebook','instagram-unified'].includes(authMethod)||!/^\d{1,40}$/.test(appId||'')||typeof clientSecret!=='string'||!clientSecret||!/^\d{1,40}$/.test(accountId||'')||!/^v\d+\.\d+$/.test(graphVersion||'')||new URL(redirectURI).protocol!=='https:')
  throw Error('Configured Instagram OAuth connection is required.');
 if(authMethod==='instagram-facebook'&&!/^\d{1,40}$/.test(pageId||''))throw Error('Configured Instagram Page is required.');
 const provider=credential=>new InstagramProvider({provider:authMethod,appId,metaAppId:appId,clientSecret,
  accountId,pageId,graphVersion,token:credential.token},fetcher);
 const verify=(credential,{subscribe=false}={})=>{
  if(credential.authMethod!==authMethod)throw Error('Instagram authorization method mismatch.');
  return verifyInstagramMessagingAuthorization(provider(credential),{accountId,expectedUsername,subscribe});
 };
 return {
  verify,
  authorizationURL(state){
   if(typeof state!=='string'||!state)throw Error('A bound OAuth state is required.');
   const url=new URL(authMethod==='instagram-login'?'https://www.instagram.com/oauth/authorize':'https://www.facebook.com/dialog/oauth');
   for(const [key,value]of Object.entries({client_id:appId,redirect_uri:redirectURI,response_type:'code',state}))url.searchParams.set(key,value);
   if(authMethod==='instagram-unified'){
    if(!loginConfigId)throw Error('Instagram business login configuration is missing.');
    url.searchParams.set('config_id',loginConfigId);url.searchParams.set('override_default_response_type','true');
   }else url.searchParams.set('scope',authMethod==='instagram-login'?'instagram_business_basic,instagram_business_manage_messages':'instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging');
   return url.href;
  },
  async exchangeCode({code}){
   if(typeof code!=='string'||!code)throw Error('A validated OAuth code is required.');
   const env={INSTAGRAM_MESSAGING_PROVIDER:authMethod==='instagram-login'?'instagram-login':'instagram-unified',
    INSTAGRAM_MESSAGING_APP_ID:appId,INSTAGRAM_MESSAGING_CLIENT_SECRET:clientSecret,
    INSTAGRAM_MESSAGING_META_APP_ID:appId,INSTAGRAM_MESSAGING_META_APP_SECRET:clientSecret,
    INSTAGRAM_MESSAGING_REDIRECT_URI:redirectURI,INSTAGRAM_MESSAGING_GRAPH_VERSION:graphVersion};
   let grant;
   try{grant=await exchangeOAuth(code,env,fetcher);}catch{throw Error('Instagram authorization exchange was not confirmed.');}
   if(authMethod==='instagram-facebook'){
    const p=provider({token:grant.token});
    const params=new URLSearchParams({grant_type:'fb_exchange_token',client_id:appId,client_secret:clientSecret,fb_exchange_token:grant.token});
    const long=await p.request('/oauth/access_token?'+params);
    if(!long.access_token)throw Error('Facebook long-lived authorization was not confirmed.');
    const page=await p.request('/'+pageId+'?fields=id,instagram_business_account{id,username},access_token',{token:long.access_token});
    if(String(page.id)!==pageId||String(page.instagram_business_account?.id)!==accountId||!page.access_token||
       expectedUsername&&page.instagram_business_account?.username?.toLowerCase()!==expectedUsername.toLowerCase())throw Error('Facebook Page grant does not match the configured account.');
    p.config.token=page.access_token;const metadata=await p.validatePageToken();
    const expiries=[metadata.expires_at,metadata.data_access_expires_at].filter(value=>Number.isSafeInteger(value)&&value>0);
    grant={token:page.access_token,expiresAt:expiries.length?new Date(Math.min(...expiries)*1000).toISOString():null};
   }
   return {credential:{token:grant.token,authMethod,issuedAt:new Date().toISOString()},expiresAt:grant.expiresAt};
  },
  async refresh(credential){
   if(authMethod!=='instagram-login'||credential.authMethod!==authMethod||typeof credential.token!=='string'||!credential.token)throw Error('This Instagram grant requires reauthorization rather than user-token refresh.');
   if(!credential.issuedAt||!Number.isFinite(Date.parse(credential.issuedAt))||Date.now()-Date.parse(credential.issuedAt)<86400000)
    throw Error('Instagram long-lived token is too new to refresh.');
   const url=new URL('https://graph.instagram.com/refresh_access_token');url.searchParams.set('grant_type','ig_refresh_token');url.searchParams.set('access_token',credential.token);
   let response,data;try{response=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000)});data=await response.json();}catch{throw Error('Instagram refresh was not confirmed.');}
   if(!response.ok||typeof data.access_token!=='string'||!data.access_token||!Number.isFinite(data.expires_in)||data.expires_in<=0)throw Error('Instagram refresh was rejected.');
   return {credential:{token:data.access_token,authMethod,issuedAt:new Date().toISOString()},expiresAt:new Date(Date.now()+data.expires_in*1000).toISOString()};
  },
 };
}
