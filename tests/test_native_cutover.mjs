import assert from 'node:assert/strict';
import {checkNativeRelations, nativeReleaseContract, inspectNativeRelations} from '../scripts/lib/native_cutover.mjs';

const contract = await nativeReleaseContract();
assert.match(contract.digest, /^[a-f0-9]{64}$/);
assert.ok(contract.tables.includes('InstagramCommand'));
assert.ok(contract.tables.includes('FinnieRedemption'));
assert.ok(contract.rpc.includes('insert_user'));
const native = contract.tables.map(name => ({schema:'finfolk',name,kind:'r'}));
assert.equal(checkNativeRelations(contract,native).ready,true);
for (const relation of [
  {schema:'finfolk',name:'instagram_commands',kind:'r'},
  {schema:'finfolk',name:'instagram_commands',kind:'v'},
  {schema:'finfolk',name:'InstagramCommand',kind:'v'},
  {schema:'finfolk_shop',name:'finnie_entries',kind:'r'},
  {schema:'finfolk_rpc',name:'legacy_state',kind:'r'},
  {schema:'public',name:'finfolk_migrations',kind:'r'},
]) assert.equal(checkNativeRelations(contract,[...native,relation]).ready,false);
assert.equal(checkNativeRelations(contract,native.slice(1)).ready,false);
assert.equal(checkNativeRelations(contract,[...native,{schema:'neon_auth',name:'user',kind:'r'}]).ready,true);
assert.equal((await inspectNativeRelations(async () => ({rows:native}),contract)).ready,true);
console.log('NATIVE_CUTOVER_PASS: exact generated relation inventory; legacy tables, views, shop objects and missing entities block promotion.');
