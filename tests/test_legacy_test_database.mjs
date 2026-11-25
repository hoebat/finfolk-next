import {test} from 'node:test';
import assert from 'node:assert/strict';
import {legacyTestDatabaseURL,legacyTestRuntimeURL} from '../scripts/lib/legacy_test_database.mjs';

test('archived integration tools accept only disposable local fixture databases',()=>{
 assert.equal(legacyTestDatabaseURL('postgresql://tester:fixture@127.0.0.1:55432/finfolk_test_fixture'),'postgresql://tester:fixture@127.0.0.1:55432/finfolk_test_fixture');
 for(const value of [undefined,'postgresql://tester:fixture@remote.test/finfolk_test_fixture','postgresql://tester:fixture@localhost/postgres','postgresql://tester:fixture@localhost/finfolk_test_fixture?host=remote.test','postgresql://tester:fixture@localhost/production'])assert.throws(()=>legacyTestDatabaseURL(value));
});
test('runtime fixtures must use the same database and restricted role',()=>{
 const names=['FINFOLK_TEST_DATABASE_URL','FINFOLK_TEST_RUNTIME_DATABASE_URL'],saved=names.map(name=>process.env[name]);
 try{
  process.env.FINFOLK_TEST_DATABASE_URL='postgresql://owner:fixture@localhost/finfolk_test_fixture';
  process.env.FINFOLK_TEST_RUNTIME_DATABASE_URL='postgresql://finfolk_api:fixture@localhost/finfolk_test_fixture';
  assert.equal(new URL(legacyTestRuntimeURL()).username,'finfolk_api');
  for(const url of ['postgresql://owner:fixture@localhost/finfolk_test_fixture','postgresql://finfolk_api:fixture@localhost/finfolk_test_other']){process.env.FINFOLK_TEST_RUNTIME_DATABASE_URL=url;assert.throws(()=>legacyTestRuntimeURL());}
 }finally{names.forEach((name,index)=>saved[index]===undefined?delete process.env[name]:process.env[name]=saved[index]);}
});
