import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createNextWorker} from '../../backend/next-api-worker.mjs';
const worker=createNextWorker({databaseName:new URL(process.env.FINFOLK_TEST_DATABASE_URL).pathname.slice(1)});
import {connect,migrate} from './harness.mjs';
const db=await connect();
try{
 await migrate(db);
 const url=new URL(process.env.FINFOLK_TEST_DATABASE_URL);url.searchParams.set('options','-c role=finfolk_api');
 const sha=createHash('sha256').update(await readFile('resources/finfolkdb/pilot.sql')).digest('hex');
 const env={ENVIRONMENT:'next',HYPERDRIVE:{connectionString:url.toString()},NEON_AUTH_BASE_URL:'https://auth.fixture.test',DB_BACKBONE_ENABLED:'true',DB_SQL_SHA:sha};
 async function health(options=env){const closing=[];const r=await worker.fetch(new Request('https://next.finfolk.com.au/health'),options,{waitUntil:p=>closing.push(p)});await Promise.all(closing);return r;}
 assert.equal((await health({})).status,503);
 assert.equal((await health({...env,NEON_AUTH_BASE_URL:'https://ep-crimson-queen.invalid'})).status,503);
 assert.equal((await health()).status,503,'Missing release marker fails readiness without leaking SQL errors');
 await db.query(`CREATE TABLE finfolk.backbone_release(id integer PRIMARY KEY CHECK(id=1),sql_sha text NOT NULL);GRANT SELECT ON finfolk.backbone_release TO finfolk_api;`);
 assert.equal((await health()).status,503);
 await db.query(`INSERT INTO finfolk.backbone_release VALUES(1,'outdated')`);assert.equal((await health()).status,503);
 await db.query(`UPDATE finfolk.backbone_release SET sql_sha=$1`,[sha]);
 const ready=await health();assert.equal(ready.status,200);assert.equal(ready.headers.get('Cache-Control'),'no-store');assert.equal((await ready.json()).sqlSha,sha);
 assert.equal((await db.query(`SELECT has_table_privilege('finfolk_untrusted','finfolk.backbone_release','SELECT') AS ok`)).rows[0].ok,false);
 await assert.rejects(db.query(`INSERT INTO finfolk.backbone_release VALUES(2,$1)`,[sha]),e=>e.code==='23514');
 console.log('FINFOLKDB_READINESS_PASS: separate deployment marker, actual API-role reads, missing/stale hashes, isolation gates and unavailable-database response.');
}finally{await db.end();}
