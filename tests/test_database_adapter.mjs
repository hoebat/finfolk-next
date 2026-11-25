import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {database} from '../backend/db.mjs';

test('PostgreSQL adapter preserves parameter binding, transaction ownership and rollback',async()=>{
 const Pool=pg.Pool,queries=[],rows=[{value:'fixture'}];let released=0,options;
 pg.Pool=class {constructor(value){options=value;}on(){}async query(text,values){queries.push({text,values});return {rows};}async connect(){return {query:this.query,release(){released++;}};}};
 try{
  const db=database('postgresql://fixture:fixture@localhost/finfolk_test_adapter?sslmode=require');
  assert.equal(new URL(options.connectionString).searchParams.get('sslmode'),'verify-full');
  const value="'; DROP TABLE accounts; --";
  assert.deepEqual(await db.query('SELECT $1::text AS value',[value]),rows);
  assert.deepEqual(queries[0],{text:'SELECT $1::text AS value',values:[value]});
  await db.transaction(query=>query('SELECT $1',[2]));assert.deepEqual(queries.slice(1).map(q=>q.text),['BEGIN','SELECT $1','COMMIT']);
  await assert.rejects(()=>db.transaction(async()=>{throw Error('failed write');}),/failed write/);
  assert.deepEqual(queries.slice(-2).map(q=>q.text),['BEGIN','ROLLBACK']);assert.equal(released,2);
 }finally{pg.Pool=Pool;}
});
