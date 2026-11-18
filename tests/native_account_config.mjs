import assert from 'node:assert/strict';
import {GET} from '../js/finfolk-next/site/web-main/app/api/account-config/route.js';
const names=['FINFOLK_AUTH_PROVIDER','FINFOLK_SUPABASE_URL','FINFOLK_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY'];
const saved=Object.fromEntries(names.map(key=>[key,process.env[key]]));
try{
 delete process.env.FINFOLK_AUTH_PROVIDER;
 const redirect=GET(new Request('http://localhost:3010/api/account-config'));assert.equal(redirect.status,307);assert.equal(redirect.headers.get('location'),'http://localhost:3010/neon-config.json');assert.equal(redirect.headers.get('cache-control'),'no-store');
 Object.assign(process.env,{FINFOLK_AUTH_PROVIDER:'supabase',FINFOLK_SUPABASE_URL:'http://127.0.0.1:55431',FINFOLK_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',SUPABASE_SERVICE_ROLE_KEY:'private-server-credential'});
 const response=GET(new Request('http://localhost:3010/api/account-config'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const config=await response.json();assert.deepEqual(Object.keys(config).sort(),['authProvider','enabled','googleEnabled','publishableKey','supabaseUrl'].sort());
 for(const key of ['sb_secret_unsafe','invalid', 'header.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.signature']){
  process.env.FINFOLK_SUPABASE_PUBLISHABLE_KEY=key;const rejected=GET(new Request('http://localhost:3010/api/account-config'));assert.equal(rejected.status,503);assert.deepEqual(await rejected.json(),{enabled:false});
 }
 console.log('PASS: public Auth configuration is allowlisted, uncached and rejects secret/service-role keys');
}finally{for(const key of names){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}}
