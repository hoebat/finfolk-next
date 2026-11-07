import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connect,quote} from './harness.mjs';
const db=await connect();
try{
 const contracts=JSON.parse(await readFile('resources/finfolkdb/enums.json','utf8'));
 await db.query(await readFile('resources/finfolkdb/enums.sql','utf8'));
 const actual=(await db.query(`SELECT t.typname AS name,json_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='finfolk' GROUP BY t.typname ORDER BY t.typname`)).rows;
 assert.deepEqual(actual.map(row=>row.name).sort(),contracts.map(row=>row.name).sort());
 for(const spec of contracts){
  assert.deepEqual(actual.find(row=>row.name===spec.name).labels,spec.values,spec.name);
  await db.query(`CREATE TEMP TABLE enum_fixture (value finfolk.${quote(spec.name)} NOT NULL)`);
  for(const value of spec.values)assert.equal((await db.query('INSERT INTO enum_fixture VALUES($1) RETURNING value',[value])).rows[0].value,value);
  await assert.rejects(db.query('INSERT INTO enum_fixture VALUES($1)',['NOT_A_DOMAIN_VALUE']),error=>error.code==='22P02');
  await db.query('DROP TABLE enum_fixture');
 }
 const first=contracts[0];
 await db.query(`DROP TYPE finfolk.${quote(first.name)}`);
 await db.query(`CREATE TYPE finfolk.${quote(first.name)} AS ENUM ('conflicting-value')`);
 await assert.rejects(db.query(await readFile('resources/finfolkdb/enums.sql','utf8')),/Enum declaration mismatch/);
 console.log(`DOMAIN_ENUMS_PASS: ${contracts.length} Clojure-generated native PostgreSQL enums, ordered labels, accepted values and invalid-value rejection on live PostgreSQL.`);
}finally{await db.end();}
