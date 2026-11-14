import test from 'node:test';
import assert from 'node:assert/strict';
import {connectAdmin,ensureSupabase,localAdminURL,replDatabase,testDatabaseURL,withTestDatabase} from '../scripts/lib/local_supabase.mjs';

const base='postgresql://postgres:postgres@127.0.0.1:55432/postgres';

test('admin connections reject remote destinations and pg URL overrides before connecting',async()=>{
 let connections=0;
 class Client{constructor(){connections++;}}
 for(const url of [
  'postgresql://postgres:secret@cloud.example/postgres',
  'postgresql://postgres:secret@localhost/finfolk',
  'postgresql://localhost/postgres',
  'https://postgres:secret@localhost/postgres',
  base+'?host=cloud.example',base+'?options=-crole=postgres',base+'#fragment',
 ])await assert.rejects(connectAdmin(url,Client),/local|remote|overridden/);
 assert.equal(connections,0);
});

test('local URLs preserve encoded credentials and the supplied port',()=>{
 const url=localAdminURL('postgresql://test%2Buser:p%3Ass%2Bword@localhost:55432/postgres');
 assert.equal(decodeURIComponent(url.username),'test+user');
 assert.equal(decodeURIComponent(url.password),'p:ss+word');
 assert.equal(url.port,'55432');
});

test('disposable names cannot target the main database or inject identifiers',async()=>{
 const queries=[],admin={query:async sql=>queries.push(sql)};
 for(const name of ['postgres','finfolk','finfolk_test_x"; DROP DATABASE postgres;--','finfolk_test_'])
  assert.throws(()=>testDatabaseURL(base,name),/non-test database/);
 await assert.rejects(withTestDatabase(admin,base,()=>{},replDatabase),/REPL/);
 assert.deepEqual(queries,[]);
});

test('an existing local Supabase stack is reused without restarting it',()=>{
 const calls=[];
 const url=ensureSupabase(args=>{calls.push(args);return JSON.stringify({DB_URL:base});});
 assert.equal(url.toString(),base);
 assert.deepEqual(calls,[['status','--output','json']]);
});

test('a stopped stack is started locally and its reported URL is checked',()=>{
 const calls=[];
 const url=ensureSupabase(args=>{
  calls.push(args);
  if(calls.length===1)throw Error('not running');
  return args[0]==='status'?JSON.stringify({DB_URL:base}):'';
 });
 assert.equal(url.toString(),base);
 assert.deepEqual(calls,[['status','--output','json'],['start'],['status','--output','json']]);
});

test('invalid status output never falls back to another database or starts a stack',()=>{
 for(const output of ['{}',JSON.stringify({DB_URL:'postgresql://test:secret@cloud.example/postgres'})]){
  const calls=[];
  assert.throws(()=>ensureSupabase(args=>{calls.push(args);return output;}));
  assert.equal(calls.length,1);
 }
});

for(const fails of [false,true])test(`suite database is isolated and removed after ${fails?'failure':'success'}`,async()=>{
 const queries=[],admin={query:async sql=>queries.push(sql)},failure=Error('suite failed');
 const work=async url=>{
  assert.equal(url.pathname,'/finfolk_test_fixture');
  assert.equal(url.hostname,'127.0.0.1');
  if(fails)throw failure;
  return 'passed';
 };
 if(fails)await assert.rejects(withTestDatabase(admin,base,work,'finfolk_test_fixture'),error=>error===failure);
 else assert.equal(await withTestDatabase(admin,base,work,'finfolk_test_fixture'),'passed');
 assert.deepEqual(queries,[
  'CREATE DATABASE "finfolk_test_fixture" TEMPLATE template0',
  'DROP DATABASE "finfolk_test_fixture" WITH (FORCE)',
 ]);
 assert.equal(new URL(base).pathname,'/postgres');
});

test('failed database creation never drops an existing database',async()=>{
 const queries=[],failure=Error('already exists');
 const admin={query:async sql=>{queries.push(sql);throw failure;}};
 await assert.rejects(withTestDatabase(admin,base,()=>assert.fail('must not run'),'finfolk_test_collision'),error=>error===failure);
 assert.equal(queries.length,1);
});

test('a failed admin connection is closed',async()=>{
 let closed=false;
 class Client{
  async connect(){throw Error('unreachable');}
  async end(){closed=true;}
 }
 await assert.rejects(connectAdmin(base,Client),/unreachable/);
 assert.equal(closed,true);
});
