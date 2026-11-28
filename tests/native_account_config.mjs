import assert from 'node:assert/strict';
import {GET} from '../js/finfolk-next/site/web-main/app/api/account-config/route.js';
const names=['NODE_ENV','FINFOLK_MOCK_PREVIEW','FINFOLK_AUTH_PROVIDER','FINFOLK_SUPABASE_URL','FINFOLK_SUPABASE_PUBLISHABLE_KEY','FINFOLK_GOOGLE_AUTH_ENABLED','FINFOLK_GITHUB_AUTH_ENABLED','FINFOLK_FACEBOOK_AUTH_ENABLED','SUPABASE_SERVICE_ROLE_KEY'];
const saved=Object.fromEntries(names.map(key=>[key,process.env[key]]));
try{
 process.env.NODE_ENV='production';delete process.env.FINFOLK_MOCK_PREVIEW;delete process.env.FINFOLK_SUPABASE_PUBLISHABLE_KEY;
 let response=GET(new Request('https://finfolk.com.au/api/account-config'));assert.equal(response.status,503);assert.equal(response.headers.get('location'),null);
 Object.assign(process.env,{FINFOLK_AUTH_PROVIDER:'legacy',FINFOLK_SUPABASE_URL:'https://supabase.finfolk.com.au',FINFOLK_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'private-server-credential',FINFOLK_GOOGLE_AUTH_ENABLED:'false',FINFOLK_GITHUB_AUTH_ENABLED:'true'});
 response=GET(new Request('https://finfolk.com.au/api/account-config'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const config=await response.json();
 assert.equal(config.authProvider,'supabase');assert.equal(config.githubEnabled,true);assert.equal(config.googleEnabled,false);assert.equal(config.apiUrl,'https://finfolk.com.au/');assert(!JSON.stringify(config).includes('private-server-credential'));
 assert.deepEqual(Object.keys(config).sort(),['authProvider','enabled','googleEnabled','githubEnabled','facebookEnabled','publishableKey','supabaseUrl','apiUrl','authUrl','backbone','cacheBackend'].sort());
 for(const key of ['sb_secret_unsafe','invalid', 'header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature']){
  process.env.FINFOLK_SUPABASE_PUBLISHABLE_KEY=key;const rejected=GET(new Request('https://finfolk.com.au/api/account-config'));assert.equal(rejected.status,503);assert.deepEqual(await rejected.json(),{enabled:false});
 }
 process.env.FINFOLK_SUPABASE_PUBLISHABLE_KEY='sb_publishable_fixture';
 for(const url of ['http://127.0.0.1:55431','https://untrusted.example','https://supabase.finfolk.com.au@untrusted.example']){process.env.FINFOLK_SUPABASE_URL=url;assert.equal(GET(new Request('https://finfolk.com.au/api/account-config')).status,503);}
 process.env.NODE_ENV='development';process.env.FINFOLK_SUPABASE_URL='http://127.0.0.1:55431';assert.equal(GET(new Request('http://localhost:3010/api/account-config')).status,200);
 console.log('PASS: native public configuration rejects private keys/untrusted origins and never falls back to legacy provider');
}finally{for(const key of names){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
