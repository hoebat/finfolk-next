import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeSQLFixture} from './fixtures/native-sql.mjs';
import {collectPlatformStatus} from '../backend/platform-status.mjs';
test('status probes preserve partial results and use fixed targets',async()=>{
 const urls=[];const result=await collectPlatformStatus({queues:[]},{fetcher:async url=>{urls.push(url);throw Error('offline');}});
 assert.equal(result.overall,'unavailable');assert.equal(result.services[0].state,'unavailable');assert.equal(result.services[1].state,'healthy');assert.equal(result.services.find(s=>s.name==='Backups').state,'unknown');assert.deepEqual(urls,['https://finfolk.com.au/api/account-config']);assert.ok(!JSON.stringify(result).includes('offline'));
});
test('native snapshot enforces current admin role, active identity and verification with restricted grants',async()=>{
 const {db,query,rpc}=await nativeSQLFixture(),admin=randomUUID(),member=randomUUID();
 try{
  for(const id of [admin,member])await rpc('sync_account_identity',[id,true]);
  await assert.rejects(rpc('ret_platform_status',[member,true]),e=>e.code==='42501');
  await query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[admin,'admin']);
  await db.exec('SET ROLE finfolk_account');
  const data=await rpc('ret_platform_status',[admin,true]);assert.equal(data.queues.length,3);assert.deepEqual(data.failures,[]);assert.equal(data.cleanupPending,0);
  await db.exec('RESET ROLE');
  await query('INSERT INTO finfolk."DatabaseRelease"(key,manifest,counts,time_created) VALUES($1,$2,$3,$4)', ['schema-fixture',{schema_sha:'schema-fixture'},{},1]);
  await query('INSERT INTO finfolk."DatabaseRelease"(key,manifest,counts,time_created) VALUES($1,$2,$3,$4)', ['reference-import',{},{},2]);
  const source=randomUUID(),target=randomUUID();
  await query('INSERT INTO finfolk."DataSource"(id,metadata) VALUES($1,$2)',[source,{}]);
  await query('INSERT INTO finfolk."EnvironmentTarget"(id,source_id,product,configuration) VALUES($1,$2,$3,$4)',[target,source,'weather',{}]);
  await query('INSERT INTO finfolk."EnvironmentJob"(target_id,lease_token,lease_until,error_code) VALUES($1,$2,$3,$4)',[target,randomUUID(),Date.now()*1000-1000000,'provider_unavailable']);
  await db.exec('SET ROLE finfolk_account');
  const installed=await rpc('ret_platform_status',[admin,true]);assert.equal(installed.release,'schema-fixture');
  const queue=installed.queues.find(q=>q.name==='Environment');
  assert.equal(queue.processing,1);assert.equal(queue.overdue,1);assert.equal(queue.failed,1);
  for(const verified of [false,null])await assert.rejects(rpc('ret_platform_status',[admin,verified]),e=>e.code==='42501');
  await db.exec('RESET ROLE');await query('DELETE FROM finfolk."UserRole" WHERE user_id=$1',[admin]);
  await assert.rejects(rpc('ret_platform_status',[admin,true]),e=>e.code==='42501');
  await query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[admin,'admin']);await query('UPDATE finfolk."User" SET deleted=true WHERE id=$1',[admin]);
  await assert.rejects(rpc('ret_platform_status',[admin,true]),e=>e.code==='42501');
 }finally{await db.close();}
});
