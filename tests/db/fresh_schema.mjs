import assert from 'node:assert/strict';import pg from 'pg';import {readFile} from 'node:fs/promises';
import {connect,migrate} from './harness.mjs';
const migrated=await connect(),base=new URL(process.env.FINFOLK_TEST_DATABASE_URL),name=base.pathname.slice(1)+'_fresh';let fresh;
const sql=await readFile('resources/finfolkdb/schema.sql','utf8');
async function snapshot(db){
 const queries={
 columns:`SELECT t.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,a.attidentity,pg_get_expr(d.adbin,d.adrelid) AS default FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum WHERE n.nspname='finfolk' AND t.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY t.relname,a.attnum`,
 constraints:`SELECT t.relname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='finfolk' ORDER BY t.relname,c.contype,pg_get_constraintdef(c.oid)`,
 indexes:`SELECT t.relname,pg_get_indexdef(x.indexrelid,0,true) AS definition FROM pg_index x JOIN pg_class t ON t.oid=x.indrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='finfolk' AND NOT EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=x.indexrelid) ORDER BY t.relname,pg_get_indexdef(x.indexrelid,0,true)`,
 functions:`SELECT p.proname,pg_get_functiondef(p.oid) AS definition,has_function_privilege('finfolk_api',p.oid,'EXECUTE') AS api,has_function_privilege('finfolk_untrusted',p.oid,'EXECUTE') AS untrusted FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' ORDER BY p.proname`,
 sequences:`SELECT c.relname,s.seqtypid::regtype::text,s.seqstart,s.seqincrement,s.seqmin,s.seqmax,s.seqcache,s.seqcycle,t.relname AS owner_table,a.attname AS owner_column,has_sequence_privilege('finfolk_api',c.oid,'USAGE') AS usage,has_sequence_privilege('finfolk_api',c.oid,'SELECT') AS read FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_depend d ON d.objid=c.oid AND d.deptype IN ('a','i') LEFT JOIN pg_class t ON t.oid=d.refobjid LEFT JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE n.nspname='finfolk' ORDER BY c.relname`,
 permissions:`SELECT c.relname,p.privilege,has_table_privilege('finfolk_api',c.oid,p.privilege) AS api,has_table_privilege('finfolk_untrusted',c.oid,p.privilege) AS untrusted FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) AS p(privilege) WHERE n.nspname='finfolk' AND c.relkind='r' ORDER BY c.relname,p.privilege`,
 namespaces:`SELECT nspname,has_schema_privilege('finfolk_api',oid,'USAGE') AS api,has_schema_privilege('finfolk_untrusted',oid,'USAGE') AS untrusted FROM pg_namespace WHERE nspname IN ('finfolk','finfolk_rpc') ORDER BY nspname`
 };const out={};for(const [key,q]of Object.entries(queries))out[key]=(await db.query(q)).rows;
 out.defaults={};for(const table of ['messaging_accounts','instagram_sources','site_catalog']){const cols=(await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='finfolk' AND table_name=$1 AND data_type NOT LIKE 'timestamp%' ORDER BY ordinal_position`,[table])).rows.map(c=>'"'+c.column_name+'"');out.defaults[table]=(await db.query('SELECT '+cols.join(',')+' FROM finfolk.'+table+' ORDER BY 1')).rows;}
 return out;
}
try{
 await migrate(migrated);await migrated.query(`CREATE DATABASE "${name}"`);base.pathname='/'+name;fresh=new pg.Client({connectionString:base.toString()});await fresh.connect();
 await assert.rejects(fresh.query(sql),/Provision finfolk_api and Neon Auth/);await fresh.query('ROLLBACK');
 await fresh.query('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean);');
 await assert.rejects(fresh.query(sql.replace(/COMMIT;\s*$/,'SELECT missing_schema_fixture_function(); COMMIT;')),/missing_schema_fixture_function/);await fresh.query('ROLLBACK');assert.equal((await fresh.query("SELECT to_regnamespace('finfolk') AS name")).rows[0].name,null);
 await fresh.query(sql);
 const expected=await snapshot(migrated),actual=await snapshot(fresh);for(const key of Object.keys(expected))assert.deepEqual(actual[key],expected[key],key+' schema parity');
 await assert.rejects(fresh.query(sql),/requires empty application schemas/);await fresh.query('ROLLBACK');
 for(const db of [migrated,fresh]){await db.query(`INSERT INTO neon_auth."user" VALUES('schema-test','Schema Test',true,false);INSERT INTO finfolk.members(user_id) VALUES('schema-test');BEGIN;SET LOCAL ROLE finfolk_api;SELECT set_config('finfolk.actor_id','schema-test',true);`);assert.deepEqual((await db.query(`SELECT finfolk_rpc.profile_save('{"displayName":"Fresh"}') AS value`)).rows[0].value,{displayName:'Fresh'});assert.deepEqual((await db.query(`SELECT finfolk_rpc.directory_operation('public-list','{}') AS value`)).rows[0].value,{listings:[],next:null});await db.query('ROLLBACK');}
 console.log('FRESH_SCHEMA_PASS: migrated/fresh schema, functions, effective permissions, sequences, defaults, failure rollback and member/directory behavior agree.');
}finally{await fresh?.end();await migrated.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);await migrated.end();}
