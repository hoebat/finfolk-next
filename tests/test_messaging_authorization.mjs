import assert from 'node:assert/strict';
import {InstagramProvider} from '../backend/instagram-provider.mjs';
import {verifyInstagramMessagingAuthorization,createInstagramMessagingAuthorization} from '../backend/messaging-instagram-authorization.mjs';
import {createTikTokMessagingAuthorization} from '../backend/messaging-tiktok-authorization.mjs';

const graphConfig={provider:'instagram-login',accountId:'123',appId:'999',metaAppId:'999',clientSecret:'TEST_SECRET',graphVersion:'v26.0',token:'TEST_TOKEN'};
const igFetcher=async(url,init)=>{
 const path=new URL(url).pathname;
 if(path.endsWith('/me'))return Response.json({id:'123',username:'another.business'});
 if(path.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 throw Error('Unexpected Graph request');
};
const ig=new InstagramProvider(graphConfig,igFetcher);
assert.equal((await verifyInstagramMessagingAuthorization(ig,{accountId:'123'})).username,'another.business','Reusable verification has no FinFolk brand singleton');
await assert.rejects(verifyInstagramMessagingAuthorization(ig,{accountId:'123',expectedUsername:'finfolk.com.au'}),/account mismatch/);
await assert.rejects(verifyInstagramMessagingAuthorization(ig,{accountId:'456'}),/configured connection/);
const unified=new InstagramProvider({...graphConfig,provider:'instagram-unified'},async(url)=>{
 const parsed=new URL(url);
 if(parsed.pathname.endsWith('/me'))return Response.json({client_business_id:'111'});
 if(parsed.pathname.includes('assigned_instagram_accounts'))return Response.json({data:[{id:'456',username:'elsewhere'},{id:'123',username:'another.business'}],paging:{next:'unused'}});
 if(parsed.pathname.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',expires_at:0}});
 if(parsed.pathname.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 throw Error('Unexpected Graph request');
});
assert.equal((await verifyInstagramMessagingAuthorization(unified,{accountId:'123'})).nonExpiring,true,'Configured account is selected from multiple assigned accounts');
const facebook=new InstagramProvider({...graphConfig,provider:'instagram-facebook',pageId:'321'},async(url)=>{
 const parsed=new URL(url),path=parsed.pathname;
 if(path.endsWith('/debug_token'))return Response.json({data:{is_valid:true,app_id:'999',type:'PAGE',expires_at:0,data_access_expires_at:0}});
 if(path.endsWith('/me'))return Response.json({id:'321'});
 if(path.endsWith('/321'))return Response.json({id:'321',instagram_business_account:{id:'123',username:'another.business'}});
 if(path.endsWith('/subscribed_apps'))return Response.json({data:[{id:'999',subscribed_fields:['messages']}]});
 throw Error('Unexpected Page request');
});
assert.equal((await verifyInstagramMessagingAuthorization(facebook,{accountId:'123'})).authorized,true);
const igAuth=createInstagramMessagingAuthorization({authMethod:'instagram-login',appId:'999',clientSecret:'SECRET',accountId:'123',graphVersion:'v26.0',redirectURI:'https://api.example.test/oauth/ig'},async(url)=>{
 const parsed=new URL(url);
 if(parsed.hostname==='api.instagram.com')return Response.json({access_token:'SHORT'});
 if(parsed.pathname==='/access_token')return Response.json({access_token:'LONG',expires_in:3600});
 if(parsed.pathname==='/refresh_access_token')return Response.json({access_token:'REFRESHED',expires_in:7200});
 return igFetcher(url);
});
assert.equal(new URL(igAuth.authorizationURL('STATE')).searchParams.get('state'),'STATE');
assert.equal((await igAuth.exchangeCode({code:'CODE'})).credential.token,'LONG');
await assert.rejects(igAuth.refresh({token:'NEW',authMethod:'instagram-login',issuedAt:new Date().toISOString()}),/too new/);
assert.equal((await igAuth.refresh({token:'OLD',authMethod:'instagram-login',issuedAt:new Date(Date.now()-172800000).toISOString()})).credential.token,'REFRESHED');

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
const unifiedAuth=createInstagramMessagingAuthorization({authMethod:'instagram-unified',appId:'999',clientSecret:'SECRET',accountId:'123',graphVersion:'v26.0',redirectURI:'https://api.example.test/oauth/unified',loginConfigId:'555'},async()=>Response.json({access_token:'SYSTEM_USER',expires_in:3600}));
assert.equal(new URL(unifiedAuth.authorizationURL('STATE')).searchParams.get('config_id'),'555');assert.equal((await unifiedAuth.exchangeCode({code:'UNIFIED_CODE'})).credential.authMethod,'instagram-unified');

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
console.log('MESSAGING_AUTH_PROVIDER_PASS: configured Instagram Login/Page/Unified identities, OAuth and age-safe refresh; TikTok Business token/app/scopes/entitlement/subscription verification, code exchange and refresh.');
