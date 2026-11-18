import assert from 'node:assert/strict';
import {createNativeAccount} from '../backend/native-account.mjs';
import {createDirectorySearch} from '../backend/directory-discovery.mjs';
import {collectCandidates} from '../js/finfolk-next/packages/edge/directory-discovery.js';
export async function nativeDiscovery({db,accountDatabase,users,operation,publicOperation,supabaseUrl,publishableKey}){
 const values={region:'Sydney',state:'NSW',country:'Australia',category:'School',seed:''};let providerCalls=0;
 const transport=search=>createNativeAccount({query:accountDatabase.query,transaction:accountDatabase.transaction,supabaseUrl,publishableKey,directorySearch:search});
 const request=(user,values,signal)=>new Request('http://local.test/account',{method:'POST',signal,headers:{Authorization:'Bearer '+user.access_token,'Content-Type':'application/json'},body:JSON.stringify({operation:'directoryDiscover',values})});
 async function call(name,payload=values){const response=await operation(users[0],name,payload);assert.equal(response.status,200,await response.clone().text());return response.json();}
 const probe=transport(async()=>{providerCalls++;return [];});
 assert.equal((await probe(request(users[0],values))).status,403);assert.equal(providerCalls,0,'Database administration is checked before provider work');
 assert.equal((await publicOperation('directoryDiscover',values)).status,401);
 await db.query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,\'admin\')',[users[0].id]);
 try{
  assert.equal((await operation(users[0],'directoryDiscover',{...values,phase:'finish',candidates:[]})).status,400,'Internal completion fields are never public request fields');
  const first=await call('directoryDiscover');assert.equal(first.state,'complete');assert.equal(first.count,3);
  const second=await call('directoryDiscover');assert.equal(second.count,0,'Rerunning provider results never creates duplicates');
  const review=await call('directoryAdmin',{}),candidates=review.listings.filter(row=>row.document.discoveryIdentity);
  assert.equal(candidates.length,3);assert.ok(candidates.every(row=>row.status==='candidate'&&row.owner_id===null));
  assert.deepEqual((await(await publicOperation('publicDirectory',{q:'Demo harbour'})).json()).listings,[]);
  const replay=(await accountDatabase.pool.query('SELECT finfolk_rpc.native_directory_discovery_finish($1,true,$2) value',[users[0].id,{id:first.id,state:'complete',candidates:[]}])).rows[0].value;assert.deepEqual(replay,first);
  const failure=await call('directoryDiscover',{...values,seed:'provider-failure'});assert.equal(failure.state,'failed');assert.equal(failure.count,0);assert.ok(failure.error);assert.ok((await call('directoryAdmin',{})).runs.some(run=>run.id===failure.id&&run.state==='failed'));
  const missing=await transport(null)(request(users[0],values));assert.equal(missing.status,200);assert.equal((await missing.json()).state,'failed','An absent provider is a recorded failed run');
  let release,started;const isStarted=new Promise(resolve=>{started=resolve;});
  const blocked=transport(async()=>{started();await new Promise(resolve=>{release=resolve;});return [];});
  const running=blocked(request(users[0],values));await isStarted;
  assert.equal((await operation(users[0],'directoryDiscover',values)).status,409,'Only one live run per administrator');
  release();assert.equal((await running).status,200);
  const controller=new AbortController();
  const interrupted=transport(async()=>{controller.abort();return new Promise(()=>{});})(request(users[0],values,controller.signal));
  const interruptedResponse=await interrupted;assert.equal(interruptedResponse.status,200);assert.equal((await interruptedResponse.json()).state,'failed','Interrupted providers close their persisted run');
  const projection=collectCandidates(values,[{web:{results:[{title:'Unsafe',url:'javascript:alert(1)'},{title:'Credentials',url:'https://user:pass@example.test/'},{title:'Post',url:'https://instagram.com/p/abc/'},{title:'Useful',url:'https://example.test/useful/#tracking'}]}}]);assert.equal(projection.length,1);assert.equal(projection[0].document.sources[0],'https://example.test/useful/');
  const oversized=createDirectorySearch({key:'fixture',fetcher:async()=>new Response(' '.repeat(262145))});
  const oversizedResponse=await transport(oversized)(request(users[0],values));assert.equal(oversizedResponse.status,200);assert.equal((await oversizedResponse.json()).state,'failed','Oversized provider responses are bounded and recorded');
  assert.equal((await db.query('SELECT count(*)::integer n FROM finfolk."DirectoryRun" WHERE status=\'running\'')).rows[0].n,0);
 }finally{
  await db.query('DELETE FROM finfolk."UserRole" WHERE user_id=$1 AND role=\'admin\'',[users[0].id]);
  const rows=(await db.query('DELETE FROM finfolk."DirectoryListing" WHERE detail ? \'discoveryIdentity\' RETURNING rev_id,audit_id,access_id,social_id')).rows;
  for(const row of rows)for(const [table,id]of[['Rev',row.rev_id],['Audit',row.audit_id],['Access',row.access_id],['Social',row.social_id]])await db.query('DELETE FROM finfolk."'+table+'" WHERE id=$1 AND class_table=\'DirectoryListing\'',[id]);
  await db.query('DELETE FROM finfolk."DirectoryRun" WHERE log->0->>\'actor\'=$1',[users[0].id]);
 }
}
