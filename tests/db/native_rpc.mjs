import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const actor=randomUUID();
import {connect} from './harness.mjs';
import {installEntities,operation} from './fixtures/entities.mjs';
import {createNativeRPC} from '../../backend/native-rpc.mjs';
const db=await connect();
try{
  await installEntities(db);

  let calls=0;
  const rpc=createNativeRPC((sql,args)=>{calls++;return db.query(sql,args);});
  const value=await rpc('insert_user',[actor,{displayName:'Native 🌊'},await operation(db,'native-rpc',actor)]);
  assert.equal(value.id,actor);
  assert.equal(value.profile.displayName,'Native 🌊');
  const before=calls;
  for(const name of ['__proto__','constructor','insert_user); DROP SCHEMA finfolk CASCADE;--'])
    await assert.rejects(rpc(name,[]),{code:'native_rpc_contract'});
  await assert.rejects(rpc('insert_user',[]),{code:'native_rpc_contract'});
  assert.equal(calls,before,'Invalid function names or arity must not reach PostgreSQL');
  await assert.rejects(rpc('ret_messaging_account',[randomUUID(),randomUUID()]),/outside application scope/);
  console.log('NATIVE_RPC_PASS: generated signatures execute against native PostgreSQL; JSON/Unicode preserved; unknown names and argument counts rejected before SQL.');
}finally{await db.end();}
