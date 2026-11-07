// TikTok API for Business, not Login/Display API. See provider contract references.
const host='https://business-api.tiktok.com/open_api/v1.3';
const required=['message.list.manage','message.list.send','user.account.type'];
const string=value=>typeof value==='string'&&value.length>0;
export function createTikTokMessagingAuthorization({appId,appSecret,accountId,callbackURL,oauthRedirectURI,accountAuthorizationURL,fetcher=fetch,now=()=>Date.now()}){
 if(![appId,appSecret,accountId].every(string)||new URL(callbackURL).protocol!=='https:')throw Error('TikTok Business Messaging configuration is required.');
 async function request(path,{token,body,params}={}){
  const url=new URL(host+path);for(const [key,value]of Object.entries(params||{}))url.searchParams.set(key,value);
  let response,data;
  try{
   response=await fetcher(url,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{...(token?{'Access-Token':token}:{}),...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})});data=await response.json();
  }catch{throw Error('TikTok authorization request was not confirmed.');}
  if(!response.ok||data.code!==0||!data.data||typeof data.data!=='object')throw Error('TikTok authorization was rejected.');
  return data.data;
 }
 function formatToken(data){
  const scopes=new Set(typeof data.scope==='string'?data.scope.split(',').map(s=>s.trim()):[]);
  if(data.open_id!==accountId||!string(data.access_token)||!string(data.refresh_token)||
     !Number.isFinite(data.expires_in)||data.expires_in<=0||!Number.isFinite(data.refresh_token_expires_in)||data.refresh_token_expires_in<=0||
     !required.every(scope=>scopes.has(scope)))throw Error('TikTok account, messaging scopes or token expiry were not verified.');
  return {credential:{token:data.access_token,refreshToken:data.refresh_token,authMethod:'tiktok-business',
   refreshExpiresAt:new Date(now()+data.refresh_token_expires_in*1000).toISOString()},
   expiresAt:new Date(now()+data.expires_in*1000).toISOString()};
 }
 return {
  authorizationURL(state){
   const url=new URL(accountAuthorizationURL);
   if(!string(state)||url.protocol!=='https:'||!['www.tiktok.com','tiktok.com'].includes(url.hostname)||
      !/^\/v2\/auth\/authorize\/?$/.test(url.pathname)||url.username||url.hash)
    throw Error('Use the configured TikTok account-holder authorization URL.');
   const appKeys=['client_key','client_id','app_id'].map(key=>url.searchParams.get(key)).filter(Boolean);
   if(!appKeys.length||appKeys.some(value=>value!==appId))throw Error('TikTok authorization URL app mismatch.');
   if(url.searchParams.has('redirect_uri')&&url.searchParams.get('redirect_uri')!==oauthRedirectURI)throw Error('TikTok authorization redirect mismatch.');
   if(new URL(oauthRedirectURI).protocol!=='https:')throw Error('Configured TikTok OAuth redirect required.');
   url.searchParams.set('redirect_uri',oauthRedirectURI);url.searchParams.set('state',state);url.searchParams.set('disable_auto_auth','1');
   return url.href;
  },
  async exchangeCode({code}){
   if(!string(code)||new URL(oauthRedirectURI).protocol!=='https:')throw Error('A validated OAuth callback is required.');
   return formatToken(await request('/tt_user/oauth2/token/',{body:{client_id:appId,client_secret:appSecret,
    grant_type:'authorization_code',auth_code:code,redirect_uri:oauthRedirectURI}}));
  },
  async refresh(credential){
   if(credential.authMethod!=='tiktok-business'||!string(credential.refreshToken)||
      credential.refreshExpiresAt&&(!Number.isFinite(Date.parse(credential.refreshExpiresAt))||Date.parse(credential.refreshExpiresAt)<=now()))throw Error('TikTok refresh authorization has expired or is missing.');
   return formatToken(await request('/tt_user/oauth2/refresh_token/',{body:{client_id:appId,client_secret:appSecret,
    grant_type:'refresh_token',refresh_token:credential.refreshToken}}));
  },
  async verify(credential,{subscribe=false}={}){
   if(credential.authMethod!=='tiktok-business'||!string(credential.token))throw Error('TikTok Business Messaging token required.');
   const info=await request('/tt_user/token_info/get/',{body:{app_id:appId,access_token:credential.token}});
   const scopes=new Set(typeof info.scope==='string'?info.scope.split(',').map(s=>s.trim()):[]);
   if(info.app_id!==appId||info.creator_id!==accountId||!required.every(scope=>scopes.has(scope)))throw Error('TikTok token app, account or messaging scopes do not match.');
   const profile=await request('/business/get/',{token:credential.token,params:{business_id:accountId,fields:JSON.stringify(['has_advanced_access'])}});
   if(profile.has_advanced_access!==true)throw Error('TikTok account does not have Advanced Access.');
   // A real read-only messaging call must succeed; profile/video scopes alone
   // and a nominal OAuth success are not evidence of Business Messaging access.
   const conversations=await request('/business/message/conversation/list/',{token:credential.token,
    params:{business_id:accountId,conversation_type:'SINGLE',limit:'1'}});
   if(!Array.isArray(conversations.conversations))throw Error('TikTok Business Messaging access was not confirmed.');
   if(subscribe)await request('/business/webhook/update/',{body:{app_id:appId,secret:appSecret,event_type:'DIRECT_MESSAGE',callback_url:callbackURL}});
   const subscription=await request('/business/webhook/list/',{params:{app_id:appId,secret:appSecret,event_type:'DIRECT_MESSAGE'}});
   if(subscription.app_id!==appId||subscription.event_type!=='DIRECT_MESSAGE'||subscription.callback_url!==callbackURL)
    throw Error('TikTok messaging webhook subscription does not match.');
   return {provider:'tiktok',appId,accountId,authorized:true,subscribed:true,nonExpiring:false};
  },
 };
}
