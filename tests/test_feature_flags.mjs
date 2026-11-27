import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectAdmin,ensureSupabase,withTestDatabase} from '../scripts/lib/local_supabase.mjs';
import {database} from '../backend/db.mjs';
import {createAPI} from '../backend/api.mjs';
import {createFlagStore,evaluateFlags,validateFlagUpdate,flagForPath,nativeOperationFlag} from '../backend/feature-flags.mjs';
import contract from '../resources/finfolkdb/feature-flags.json' with {type:'json'};
import {flagIDs,resetFeatureFlags,setFeatureFlags,assertFeatureEnabled,featureForRoute} from '../js/finfolk-next/site/web-main/lib/feature-flags.js';
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002',token='fixture-management-credential-at-least-32-characters';
const sql=await readFile(new URL('../resources/finfolkdb/feature-flags.sql',import.meta.url),'utf8');
const base=ensureSupabase(),admin=await connectAdmin(base);
try{await withTestDatabase(admin,base,async url=>{
 const db=database(url.href);try{
  await db.query(sql);
  assert.equal((await db.query("SELECT has_schema_privilege('anon','finfolk_flags','USAGE') AS allowed"))[0].allowed,false,'anonymous database roles cannot inspect settings');
  const store=createFlagStore(db);assert.equal((await store.rows()).length,7);
  assert.ok(Object.values(evaluateFlags(await store.rows()).flags).every(v=>v===false));
  await assert.rejects(store.save({id:'shop',mode:'unknown',testers:[],revision:0}),{status:400});
  assert.throws(()=>validateFlagUpdate({id:'shop',mode:'testers',testers:[alice,alice],revision:0}),{status:400});
  await store.save({id:'shop',mode:'testers',testers:[alice],revision:0});
  assert.equal(evaluateFlags(await store.rows(),alice).flags.shop,true);assert.equal(evaluateFlags(await store.rows(),bob).flags.shop,false);
  assert.equal(evaluateFlags(await store.rows()).flags.shop,false);
  const concurrent=await Promise.allSettled([store.save({id:'shop',mode:'everyone',testers:[],revision:1}),store.save({id:'shop',mode:'off',testers:[],revision:1})]);
  assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.equal(concurrent.find(x=>x.status==='rejected').reason.status,409);
  assert.equal((await store.snapshot()).history.length,2);
  const brokenStore=createFlagStore({...db,transaction:work=>db.transaction(q=>work((sql,values)=>{if(sql.startsWith('INSERT INTO finfolk_flags.history'))throw Error('fixture audit failure');return q(sql,values);}))});
  await assert.rejects(brokenStore.save({id:'shop',mode:'off',testers:[],revision:2}),/fixture audit failure/);
  assert.equal((await store.rows()).find(f=>f.id==='shop').revision,2,'audit failure rolls back settings');

  await db.query(sql);assert.equal((await store.rows()).find(f=>f.id==='shop').revision,2,'reinstall preserves settings');
  const verify=async value=>{if(!['alice','bob','admin'].includes(value))throw Error('Invalid token');return {sub:value==='alice'?alice:bob};};
  const app=createAPI({db,verify,origins:['https://finfolk.com.au']});
  const env={FINFOLK_FLAG_MANAGEMENT_TOKEN:token,FINFOLK_FEATURE_ENVIRONMENT:'production'};
  const request=(path,options={})=>app.fetch(new Request('https://api.finfolk.com.au'+path,options),env);
  assert.equal((await request('/v1/admin/feature-flags')).status,401);
  assert.equal((await request('/v1/admin/feature-flags',{headers:{Authorization:'Bearer alice'}})).status,401);
  const management={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  const save=async(value)=>request('/v1/admin/feature-flags',{method:'POST',headers:management,body:JSON.stringify(value)});
  assert.equal((await save({id:'events',mode:'testers',testers:[alice],revision:0})).status,200);
  const guest=await(await request('/v1/features')).json(),member=await(await request('/v1/features',{headers:{Authorization:'Bearer alice'}})).json();
  assert.equal(guest.flags.events,false);assert.equal(member.flags.events,true);assert.equal('testers' in member,false);assert.ok(!JSON.stringify(member).includes(alice));
  assert.equal((await request('/v1/events')).status,403);
  assert.equal((await request('/v1/me/events/mine',{method:'POST',headers:{Authorization:'Bearer bob'}})).status,403);
  assert.equal((await request('/v1/events',{headers:{Authorization:'Bearer admin'}})).status,403,'no admin bypass');
  assert.equal((await request('/v1/admin/feature-flags',{headers:{...management,Origin:'https://evil.test'}})).status,403);
  // Route can pass the flag check yet still fail its original authorization/data requirements.
  const enabledGuest=await app.fetch(new Request('https://api.finfolk.com.au/v1/me/events/mine',{method:'POST'}),{...env,FINFOLK_FEATURE_ENVIRONMENT:'development',FINFOLK_FEATURE_FLAGS_DEFAULT:'everyone'});
  assert.equal(enabledGuest.status,401,'an enabled flag does not grant member authorization');
  const snapshot=await(await request('/v1/admin/feature-flags',{headers:management})).json();assert.equal(snapshot.environment,'production');assert.equal(snapshot.history.length,3);
  assert.equal((await save({id:'events',mode:'off',testers:[],revision:0})).status,409);
  await save({id:'events',mode:'off',testers:[],revision:1});
  const denied=await request('/v1/events',{headers:{Authorization:'Bearer alice'}});assert.equal(denied.status,403);assert.equal((await denied.json()).code,'feature_disabled');
  // The native dispatch rejects before identity provisioning or database effects.
  const nativeEnv={...env,SUPABASE_URL:'https://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'fixture'};
  const native=await app.fetch(new Request('https://api.finfolk.com.au/v1/native/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'publicEvents',values:{}})}),nativeEnv);
  assert.equal(native.status,403);assert.equal((await native.json()).code,'feature_disabled');
  const shop=(await store.rows()).find(f=>f.id==='shop');await store.save({id:'shop',mode:'off',testers:[],revision:shop.revision});
  for(const [path,method] of [['/shop/items','GET'],['/shop/checkout','POST'],['/v1/admin/finnies/items','POST'],['/v1/me/finnies/redeem','POST']])assert.equal((await request(path,{method})).status,403,path);
  await db.query('DROP SCHEMA finfolk_flags CASCADE');
  assert.equal((await request('/shop/items')).status,403,'storage outage closes gate');
  assert.ok(Object.values((await(await request('/v1/features')).json()).flags).every(v=>v===false));
  const preview=await app.fetch(new Request('https://api.finfolk.com.au/v1/features'),{FINFOLK_FEATURE_ENVIRONMENT:'development',FINFOLK_FEATURE_FLAGS_DEFAULT:'everyone'});assert.ok(Object.values((await preview.json()).flags).every(Boolean));
 }finally{await db.pool.end();}
});}finally{await admin.end();}
assert.deepEqual(flagIDs,contract.definitions.map(f=>f.id));
resetFeatureFlags();assert.throws(()=>assertFeatureEnabled('events'),{code:'feature_disabled'});setFeatureFlags({flags:{events:true}});assert.doesNotThrow(()=>assertFeatureEnabled('events'));resetFeatureFlags();assert.throws(()=>assertFeatureEnabled('events'));
const {runModel:readModel,pageActions}=await import('../js/finfolk-next/site/web-main/lib/page-models.js');
let cachedReads=0;const cachedClient={call:async()=>{cachedReads++;return {events:[]};}};
await assert.rejects(readModel(cachedClient,'events','events',{query:{}}),{code:'feature_disabled'});assert.equal(cachedReads,0,'closed gates cannot read cached models');
await assert.rejects(pageActions(cachedClient,'event',{id:alice}).rsvp({state:'going'}),{code:'feature_disabled'});
setFeatureFlags({flags:{events:true}});assert.deepEqual(await readModel(cachedClient,'events','events',{query:{}}),{events:[]});assert.equal(cachedReads,1);resetFeatureFlags();
assert.equal(featureForRoute('/logbook'),null);assert.equal(featureForRoute('/practice/breath-check'),'practice.breath-check');assert.equal(flagForPath('/v1/events/one'),'events');assert.equal(nativeOperationFlag('eventSave'),'events');for(const name of ['buddyRead','buddyAction','sessionPlans','sessionPlanning','sessionCheckin'])assert.equal(nativeOperationFlag(name),'buddies');
console.log('Feature flags: persisted updates, conflicts, audit history, identities, native/REST gates, outage and preview checks passed.');
