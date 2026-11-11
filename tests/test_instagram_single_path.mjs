// Regression: retired authorization choices must never silently select another account.
import assert from 'node:assert/strict';
import {oauthSettings,oauthFlowKey,instagramAuthorizationURL,messagingConfig,seal} from '../backend/messaging-config.mjs';
import {InstagramProvider,exchangeOAuth} from '../backend/instagram-provider.mjs';
import {createInstagramMessagingAuthorization} from '../backend/messaging-instagram-authorization.mjs';
const env={INSTAGRAM_APP_ID:'111',INSTAGRAM_APP_SECRET:'fixture',INSTAGRAM_MESSAGING_PAGE_ID:'222',INSTAGRAM_MESSAGING_ACCOUNT_ID:'333'};
assert.equal(oauthSettings(env).provider,'instagram-facebook');
const url=new URL(instagramAuthorizationURL(oauthSettings(env),'bound-state'));
assert.equal(url.origin,'https://www.facebook.com');assert.equal(url.searchParams.get('state'),'bound-state');
assert.ok(url.searchParams.get('scope').split(',').includes('instagram_manage_comments'));
assert.equal(url.searchParams.has('config_id'),false);
assert.notEqual(oauthFlowKey(env),oauthFlowKey({...env,INSTAGRAM_MESSAGING_PAGE_ID:'999'}));
for(const retired of ['instagram-login','instagram-unified','unknown']){
 assert.throws(()=>oauthSettings({...env,INSTAGRAM_MESSAGING_PROVIDER:retired}),{code:'provider_not_supported'});
 assert.throws(()=>new InstagramProvider({provider:retired}),{code:'provider_not_supported'});
 assert.throws(()=>createInstagramMessagingAuthorization({authMethod:retired}),/Facebook Page/);
 await assert.rejects(exchangeOAuth('code',{...env,INSTAGRAM_MESSAGING_PROVIDER:retired},()=>{throw Error('Must never call provider');}),{code:'provider_not_supported'});
}
const key={...env,MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64')};
const stale={account_id:'333',provider_scope:'instagram-login:111:333',checks:{authorization:true,subscription:true},credential_ciphertext:seal({accessToken:'old-token'},key,'instagram-login:111:333')};
const config=await messagingConfig(async()=>[stale],key);
assert.equal(config.checks.authorization,false);assert.equal(config.checks.subscription,false);
await assert.rejects(messagingConfig(async()=>[stale],key,{credentials:true}),/decrypt|credential/i);
console.log('INSTAGRAM_SINGLE_PATH_PASS: only Meta Facebook Page OAuth, comment scope, bound state, rejected retired providers and isolated stale grants.');
