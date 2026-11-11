import assert from 'node:assert/strict';
import {InstagramProvider} from '../backend/instagram-provider.mjs';
import {verifyInstagramMessagingAuthorization,createInstagramMessagingAuthorization} from '../backend/messaging-instagram-authorization.mjs';
import {createTikTokMessagingAuthorization} from '../backend/messaging-tiktok-authorization.mjs';

const graphConfig={provider:'instagram-facebook',accountId:'123',appId:'999',pageId:'321',metaAppId:'999',clientSecret:'TEST_SECRET',graphVersion:'v26.0',token:'TEST_TOKEN'};
const facebook=new InstagramProvider(graphConfig,async(url)=>{
 const path=new URL(url).pathname;
 if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',type:'PAGE',expires_at:0,data_access_expires_at:0}});
 if(path.endsWith('/me'))return Response.json({id:'321'});
 if(path.endsWith('/321'))return Response.json({id:'321',instagram_business_account:{id:'123',username:'another.business'}});
 if(path.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 throw Error('Unexpected Page request');
});
assert.equal((await verifyInstagramMessagingAuthorization(facebook,{accountId:'123'})).username,'another.business');
await assert.rejects(verifyInstagramMessagingAuthorization(facebook,{accountId:'123',expectedUsername:'finfolk.com.au'}),/account mismatch/);
await assert.rejects(verifyInstagramMessagingAuthorization(facebook,{accountId:'456'}),/configured Facebook Page/);
const pageAuth=createInstagramMessagingAuthorization({authMethod:'instagram-facebook',appId:'999',clientSecret:'SECRET',accountId:'123',pageId:'321',graphVersion:'v26.0',redirectURI:'https://api.example.test/oauth/page',expectedUsername:'another.business'},async(url)=>{
 const parsed=new URL(url),path=parsed.pathname;
 if(path.endsWith('/oauth/access_token'))return Response.json({access_token:parsed.searchParams.has('fb_exchange_token')?'LONG_USER':'USER',expires_in:3600});
 if(path.endsWith('/321'))return Response.json({id:'321',instagram_business_account:{id:'123',username:'another.business'},access_token:'PAGE_TOKEN'});
 if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',type:'PAGE',expires_at:0,data_access_expires_at:0}});
 if(path.endsWith('/me'))return Response.json({id:'321'});
 if(path.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 throw Error('Unexpected Page OAuth request');
});
const pageGrant=await pageAuth.exchangeCode({code:'PAGE_CODE'});assert.equal(pageGrant.credential.token,'PAGE_TOKEN');assert.equal(pageGrant.expiresAt,null);
assert.equal((await pageAuth.verify(pageGrant.credential)).nonExpiring,true);
assert.equal(pageAuth.refresh,undefined,'Page authorization has no user-token refresh pathway');
const scopes='message.list.manage,message.list.send,user.account.type';
const ttConfig={appId:'app',appSecret:'SECRET',accountId:'business',callbackURL:'https://api.example.test/webhooks/tt',oauthRedirectURI:'https://api.example.test/oauth/tt'};
let observed=[];
const fetcher=async(url,init)=>{
 const parsed=new URL(url),path=parsed.pathname;observed.push({url:parsed,init});
 if(path.endsWith('/token_info/get/'))return Response.json({code:0,data:{app_id:'app',creator_id:'business',scope:scopes}});
 if(path.endsWith('/business/get/'))return Response.json({code:0,data:{has_advanced_access:true}});
 if(path.endsWith('/conversation/list/'))return Response.json({code:0,data:{conversations:[]}});
 if(path.endsWith('/webhook/list/'))return Response.json({code:0,data:{app_id:'app',event_type:'DIRECT_MESSAGE',callback_url:ttConfig.callbackURL}});
 if(path.endsWith('/oauth2/token/')||path.endsWith('/oauth2/refresh_token/'))return Response.json({code:0,data:{open_id:'business',access_token:'TT_ACCESS',refresh_token:'TT_REFRESH',scope:scopes,expires_in:86400,refresh_token_expires_in:31536000}});
 throw Error('Unexpected Business Messaging request');
};
const tt=createTikTokMessagingAuthorization({...ttConfig,fetcher});
const grant=await tt.exchangeCode({code:'CODE'});assert.equal(grant.credential.authMethod,'tiktok-business');assert.ok(grant.credential.refreshExpiresAt);
assert.equal(JSON.parse(observed.at(-1).init.body).redirect_uri,ttConfig.oauthRedirectURI);
assert.equal((await tt.verify(grant.credential)).authorized,true);assert.ok(observed.some(request=>request.url.pathname.endsWith('/conversation/list/')),'Verification makes a real messaging entitlement read');
assert.equal((await tt.refresh(grant.credential)).credential.token,'TT_ACCESS');
await assert.rejects(tt.refresh({...grant.credential,refreshExpiresAt:'2000-01-01'}),/expired/);
for(const [suffix,data,error]of [
 ['/token_info/get/',{app_id:'other',creator_id:'business',scope:scopes},/do not match/],
 ['/token_info/get/',{app_id:'app',creator_id:'other',scope:scopes},/do not match/],
 ['/token_info/get/',{app_id:'app',creator_id:'business',scope:'user.info.basic,video.list'},/do not match/],
 ['/business/get/',{has_advanced_access:false},/Advanced Access/],
 ['/webhook/list/',{app_id:'app',event_type:'DIRECT_MESSAGE',callback_url:'https://foreign.example/webhook'},/does not match/],
]){
 const invalid=createTikTokMessagingAuthorization({...ttConfig,fetcher:async(url,init)=>new URL(url).pathname.endsWith(suffix)?Response.json({code:0,data}):fetcher(url,init)});
 await assert.rejects(invalid.verify(grant.credential),error);
}
console.log('MESSAGING_AUTH_PROVIDER_PASS: configured Facebook Page identity, OAuth and reauthorization; TikTok Business token/app/scopes/entitlement/subscription verification, code exchange and refresh.');
