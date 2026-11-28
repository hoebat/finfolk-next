import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createNativeAccount} from '../../backend/native-account.mjs';
import {connect} from './harness.mjs';
import {installEntities,user,diveSession} from './fixtures/entities.mjs';
import {ids} from './fixtures/ids.mjs';
const db=await connect();
const save=async(id,profile)=>(await db.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true) value',[id,JSON.stringify(profile)])).rows[0].value;
const read=async handle=>(await db.query('SELECT finfolk_rpc.ret_profile_by_handle($1) value',[handle])).rows[0].value;
try{
 await installEntities(db);await db.query(await readFile('resources/finfolkdb/account-grants.sql','utf8'));
 const alice=await user(db,ids.alice,{displayName:'Alice',open:true}),bob=await user(db,ids.bob,{displayName:'Bob',open:false});
 assert.match(alice.profile.handle,/^diver-[0-9a-f]{32}$/);assert.notEqual(alice.profile.handle,bob.profile.handle);
 assert.equal((await read(alice.profile.handle)).id,ids.alice);
 assert.equal((await save(ids.alice,{handle:'  Alice-Dives  '})).handle,'alice-dives');
 assert.equal((await read('ALICE-DIVES')).id,ids.alice);
 assert.equal(await read(alice.profile.handle),null,'An old default link must not resolve after choosing a handle');
 for(const handle of ['ab','-alice','alice-','alice.dives','admin','finfolk',alice.profile.handle])await assert.rejects(save(ids.bob,{handle}));
 await assert.rejects(save(ids.bob,{handle:'Alice-Dives',bio:'Must roll back'}));
 assert.equal((await db.query('SELECT profile FROM finfolk."User" WHERE id=$1',[ids.bob])).rows[0].profile.bio,bob.profile.bio);
 assert.equal((await save(ids.alice,{handle:'a'.repeat(40)})).handle.length,40);await save(ids.alice,{handle:'alice-dives'});await assert.rejects(save(ids.bob,{handle:'a'.repeat(41)}));
 await save(ids.bob,{handle:'bob-dives',bio:'PRIVATE BIO',sharing:{visits:true}});
 const closed=await read('bob-dives');assert.equal(closed.restricted,true);assert.equal(closed.bio,undefined);assert.equal(closed.sharing,undefined);assert.deepEqual(closed.sessions,[]);
 await diveSession(db,ids.alice,null,{date:'2026-11-28',visibility:'private',notes:'PRIVATE NOTES'});
 const published=await diveSession(db,ids.alice,null,{date:'2026-11-28',visibility:'public',notes:'PUBLIC NOTES'});
 const publishedId=Array.isArray(published)?published[0].id:published.id;await db.query('SELECT finfolk_rpc.set_session_visibility($1,$2,$3,true)',[ids.alice,publishedId,'public']);
 const open=await read('alice-dives');assert.equal(open.restricted,false);assert.equal(open.sharing,undefined);assert.deepEqual(open.sessions.map(s=>s.id),[publishedId]);assert(!JSON.stringify(open).includes('PRIVATE NOTES'));
 await assert.rejects(db.query('UPDATE finfolk."User" SET handle=$2 WHERE id=$1',[ids.bob,'MixedCase']),error=>error.code==='23514');
 const api=createNativeAccount({query:(sql,args)=>db.query(sql,args),transaction:async work=>{await db.query('BEGIN');try{await db.query('SET LOCAL ROLE finfolk_account');const result=await work((sql,args)=>db.query(sql,args));await db.query('COMMIT');return result}catch(error){await db.query('ROLLBACK');throw error}}});
 const response=await api(new Request('https://example.test/v1/native/account',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer deliberately-invalid'},body:JSON.stringify({operation:'publicProfileByHandle',values:{handle:'alice-dives'}})}));
 assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).id,ids.alice,'Public handle reads never need or trust a bearer identity');
 const second=await connect();try{
  const outcomes=await Promise.allSettled([save(ids.alice,{handle:'shared-diver'}),second.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[ids.bob,JSON.stringify({handle:'shared-diver'})])]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1,'Concurrent claims have exactly one winner');
  assert.equal(Number((await db.query('SELECT count(*) FROM finfolk."User" WHERE handle=$1',['shared-diver'])).rows[0].count),1);
 }finally{await second.end()}
 const current=(await db.query('SELECT finfolk_rpc.ret_account($1) value',[ids.alice])).rows[0].value.profile.handle;await db.query('UPDATE finfolk."User" SET deleted=true WHERE id=$1',[ids.alice]);assert.equal(await read(current),null);
 assert.equal(await read('does-not-exist'),null);assert.equal(await read('bad/path'),null);
 console.log('PROFILE_HANDLES_DB_PASS: stable defaults, normalized unique handles, reserved/default protection, atomic collision rollback, concurrent claims, anonymous lookup, privacy and public sessions only.');
}finally{await db.end()}
