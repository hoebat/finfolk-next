import assert from 'node:assert/strict';
import {connect} from './harness.mjs';
import {installEntities} from './fixtures/entities.mjs';
import {ids} from './fixtures/ids.mjs';
const db=await connect();
const read=async id=>(await db.query('SELECT finfolk_rpc.ret_account($1) value',[id])).rows[0].value;
const sync=async id=>db.query('SELECT finfolk_rpc.sync_account_identity($1,true)',[id]);
const save=async(id,profile,step,status='pending',verified=true)=>(await db.query('SELECT finfolk_rpc.save_profile_setup($1,$2::jsonb,$3) value',[id,JSON.stringify({profile,step,status}),verified])).rows[0].value;
try{
 await installEntities(db);await sync(ids.alice);
 let account=await read(ids.alice);assert.equal(account.profile.displayName,'');assert.equal(account.profile.open,false);assert.deepEqual(account.profile.sharing,{});assert.equal(account.profile.profileSetup.status,'pending');
 await assert.rejects(save(ids.alice,{},3,'completed'));await assert.rejects(save(ids.alice,{displayName:' '},1));
 account=await save(ids.alice,{},0,'deferred');assert.equal(account.profile.profileSetup.status,'deferred');assert.equal(account.profile.displayName,'');
 await sync(ids.alice);assert.equal((await read(ids.alice)).profile.profileSetup.status,'deferred');
 account=await save(ids.alice,{displayName:'Maya Chen'},1);assert.equal(account.profile.displayName,'Maya Chen');assert.equal(account.profile.profileSetup.nameConfirmed,true);
 await save(ids.alice,{bio:'Shore dives'},2);await save(ids.alice,{},2,'deferred');await sync(ids.alice);
 account=await read(ids.alice);assert.equal(account.profile.bio,'Shore dives');assert.equal(account.profile.profileSetup.step,2);
 await assert.rejects(save(ids.alice,{open:true},3,'completed',false));
 account=await save(ids.alice,{open:false,sharing:{}},3,'completed');assert.equal(account.profile.profileSetup.status,'completed');
 await sync(ids.alice);assert.equal((await read(ids.alice)).profile.displayName,'Maya Chen');
 await assert.rejects(db.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[ids.alice,JSON.stringify({profileSetup:{status:'completed'}})]));
 await db.query('SELECT finfolk_rpc.save_account_preferences($1,$2::jsonb,true)',[ids.alice,JSON.stringify({bio:'Changed bio'})]);assert.equal((await read(ids.alice)).profile.profileSetup.status,'completed');
 await sync(ids.bob);await db.query('UPDATE finfolk."User" SET profile=$2::jsonb WHERE id=$1',[ids.bob,JSON.stringify({displayName:'Diver',open:true,sharing:{visits:true}})]);
 await sync(ids.bob);account=await read(ids.bob);assert.equal(account.profile.displayName,'Diver');assert.equal(account.profile.open,true);assert.deepEqual(account.profile.sharing,{visits:true});assert.equal(account.profile.profileSetup.status,'pending');
 await save(ids.bob,{},0,'deferred',false);await sync(ids.bob);assert.equal((await read(ids.bob)).profile.displayName,'Diver');
 await sync(ids.carol);await db.query('UPDATE finfolk."User" SET profile=$2::jsonb WHERE id=$1',[ids.carol,JSON.stringify({displayName:'My chosen name',portrait:'custom',open:true})]);await sync(ids.carol);account=await read(ids.carol);assert.equal(account.profile.displayName,'My chosen name');assert.equal(account.profile.portrait,'custom');assert.equal(account.profile.profileSetup,undefined);
 console.log('PROFILE_SETUP_DB_PASS: defaults, confirmation, saved progress, deferral, completion, verification, legacy and chosen profiles.');
}finally{await db.end();}
