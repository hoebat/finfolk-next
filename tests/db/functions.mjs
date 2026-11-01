import assert from 'node:assert/strict';
import pg from 'pg';
import {connect,migrate,apiDatabase,savepoint} from './harness.mjs';
import {withActor,memberProfile,saveMemberProfile,recordMemberCheckin,lookupIdentity} from '../../backend/backbone.mjs';
const owner=await connect();
const pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:4,options:'-c role=finfolk_api'}),db=apiDatabase(pool);
try{
 await migrate(owner);
 await owner.query(`INSERT INTO neon_auth."user" VALUES('alice','Alice',true,false),('bob','Bob',false,false),('banned','Banned',true,true);
 INSERT INTO finfolk.members(user_id,profile) VALUES('alice','{"displayName":"Alice"}'),('bob','{"displayName":"Bob"}'),('banned','{}');
 INSERT INTO finfolk.beaches(id,name,timezone) VALUES('bondi','Bondi','Australia/Sydney'),('future','East','Pacific/Kiritimati'),('past','West','Etc/GMT+12');`);
 const functions=(await owner.query(`SELECT p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' ORDER BY p.proname`)).rows;
 assert.deepEqual(functions.map(f=>f.proname),['actor_id','auth_identity','checkin_record','member_permitted','member_profile','profile_save','site_catalog_read','site_document_valid','site_draft_save','site_publish']);
 assert.deepEqual(await memberProfile(db,'alice'),{displayName:'Alice'});
 assert.deepEqual(await memberProfile(db,'bob'),{displayName:'Bob'});
 assert.equal(await memberProfile(db,'banned'),null);assert.equal(await memberProfile(db,'missing'),null);
 assert.deepEqual(await lookupIdentity(db.query,'alice'),{id:'alice',name:'Alice',verified:true});
 assert.equal(await lookupIdentity(db.query,'banned'),null);assert.equal(await lookupIdentity(db.query,'missing'),null);
 for(const [actor,verified,expected] of [['alice',true,true],['bob',true,false],['bob',false,true],['banned',false,false],['missing',false,false]])
  assert.equal(await withActor(db,actor,async q=>(await q('SELECT finfolk_rpc.member_permitted($1) AS ok',[verified]))[0].ok),expected);
 assert.deepEqual(await saveMemberProfile(db,'alice',{displayName:'New',open:true}),{displayName:'New',open:true});
 await assert.rejects(saveMemberProfile(db,'bob',{open:true}),e=>e.status===403);
 assert.deepEqual(await saveMemberProfile(db,'bob',{displayName:'Closed',open:false}),{displayName:'Closed',open:false});
 for(const value of [null,[],true,'text',1])await assert.rejects(saveMemberProfile(db,'alice',value),e=>e.status===403);
 await assert.rejects(saveMemberProfile(db,'banned',{}),e=>e.status===403);
 for(const beach of ['bondi','future','past']){
  const result=await recordMemberCheckin(db,'alice',beach);
  const expected=(await owner.query(`SELECT (now() AT TIME ZONE timezone)::date::text AS day FROM finfolk.beaches WHERE id=$1`,[beach])).rows[0].day;
  assert.equal(result.day,expected);assert.equal(result.selfReported,true);assert.equal(result.count,1);
  assert.equal((await recordMemberCheckin(db,'alice',beach)).count,1);
 }
 for(const actor of ['bob','banned','missing'])await assert.rejects(recordMemberCheckin(db,actor,'bondi'),e=>e.status===403);
 await assert.rejects(recordMemberCheckin(db,'alice','absent'),e=>e.status===403);
 assert.equal((await db.query('SELECT finfolk_rpc.actor_id() AS actor'))[0].actor,'');
 await assert.rejects(withActor(db,'alice',async q=>{await q(`UPDATE finfolk.members SET profile='{"rolledBack":true}' WHERE user_id='alice'`);throw Error('rollback');}),/rollback/);
 assert.equal((await db.query('SELECT finfolk_rpc.actor_id() AS actor'))[0].actor,'');assert.equal((await memberProfile(db,'alice')).displayName,'New');
 for(const bad of ["alice';SELECT 1",'',null,'x'.repeat(129)])await assert.rejects(memberProfile(db,bad),/Invalid authenticated actor/);
 await owner.query(`UPDATE finfolk.members SET deleted=true WHERE user_id='alice'`);
 assert.equal(await memberProfile(db,'alice'),null);await assert.rejects(saveMemberProfile(db,'alice',{}),e=>e.status===403);await assert.rejects(recordMemberCheckin(db,'alice','bondi'),e=>e.status===403);
 for(const name of ['member_permitted','auth_identity']){const f=functions.find(f=>f.proname===name);assert.equal(f.prosecdef,true);assert.ok(f.proconfig.includes('search_path=pg_catalog'));}
 await owner.query(`DO $$ BEGIN CREATE ROLE finfolk_untrusted NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
 for(const name of ['actor_id()','auth_identity(text)','checkin_record(text)','member_permitted(boolean)','member_profile()','profile_save(jsonb)','site_catalog_read()','site_document_valid(jsonb)','site_draft_save(text,boolean,jsonb,uuid,bigint,uuid)','site_publish(text,uuid,bigint)']){
  assert.equal((await owner.query(`SELECT has_function_privilege('finfolk_untrusted',$1,'EXECUTE') AS ok`,['finfolk_rpc.'+name])).rows[0].ok,false,name+' denied to PUBLIC');
  assert.equal((await owner.query(`SELECT has_function_privilege('finfolk_api',$1,'EXECUTE') AS ok`,['finfolk_rpc.'+name])).rows[0].ok,true,name+' internal API grant');
 }
 await owner.query('BEGIN');await savepoint(owner,async()=>{await owner.query('SET LOCAL ROLE finfolk_untrusted');await assert.rejects(owner.query('SELECT finfolk_rpc.member_profile()'),e=>e.code==='42501');});await owner.query('ROLLBACK');
 console.log('FINFOLKDB_FUNCTIONS_PASS: member functions and internal site function privileges, identity/verification, JSON validation, timezone dates, deletion, actor cleanup and real role permissions.');
}finally{await pool.end();await owner.end();}
