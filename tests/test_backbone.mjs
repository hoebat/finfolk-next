import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {nativeSQLFixture} from './fixtures/native-sql.mjs';
import {createNativeRPC} from '../backend/native-rpc.mjs';
const {db,query,rpc}=await nativeSQLFixture(),alice=randomUUID(),bob=randomUUID(),site=randomUUID();
try{
 await rpc('sync_account_identity',[alice,true]);await rpc('sync_account_identity',[bob,false]);
 await rpc('save_account_preferences',[alice,{displayName:'Alice',open:true},true]);
 await rpc('save_account_preferences',[bob,{displayName:'Bob'},false]);
 assert.equal((await rpc('ret_account',[alice])).profile.displayName,'Alice');
 assert.equal((await rpc('ret_account',[bob])).profile.displayName,'Bob');
 await assert.rejects(rpc('save_account_preferences',[bob,{open:true},false]),error=>error.code==='42501');
 await query('INSERT INTO finfolk."Site"(id,name,timezone) VALUES($1,$2,$3)',[site,'Native fixture beach','Australia/Sydney']);
 await rpc('record_community_checkin',[alice,site,true]);await rpc('record_community_checkin',[alice,site,true]);
 assert.equal((await rpc('ret_community_checkins',[alice])).length,1,'Duplicate check-ins remain idempotent');
 assert.equal((await rpc('ret_community_checkins',[bob])).length,0,'Account data remains actor-scoped');
 await assert.rejects(rpc('record_community_checkin',[bob,site,false]),error=>error.code==='42501');
 await assert.rejects(rpc('record_community_checkin',[alice,randomUUID(),true]));
 await assert.rejects(db.transaction(async tx=>{
  const call=createNativeRPC(async(sql,values)=>(await tx.query(sql,values)).rows);
  await call('save_account_preferences',[alice,{displayName:'Rolled back'},true]);throw Error('rollback');
 }),/rollback/);
 assert.equal((await rpc('ret_account',[alice])).profile.displayName,'Alice');
 await assert.rejects(rpc('ret_account',["alice';SELECT 1"]),error=>error.code==='22P02');
 await db.exec('SET ROLE finfolk_account');
 await assert.rejects(query('INSERT INTO finfolk."UserRole"(user_id,role) VALUES($1,$2)',[bob,'admin']),error=>error.code==='42501');
 await db.exec('RESET ROLE');
 await query('UPDATE finfolk."User" SET deleted=true WHERE id=$1',[alice]);
 await assert.rejects(rpc('ret_account',[alice]),/Account unavailable/);
 console.log('BACKBONE_NATIVE_SQL_PASS: generated schema/RPCs, UUID actors, verified writes, idempotent check-ins, rollback, restricted grants and deleted accounts.');
}finally{await db.close();}
