import {readFile,readdir} from 'node:fs/promises';
import pg from 'pg';
export const quote=value=>'"'+value.replaceAll('"','""')+'"';
export const schema=JSON.parse(await readFile('resources/finfolkdb/catalog.json','utf8'));
export async function connect(){
 const url=process.env.FINFOLK_TEST_DATABASE_URL;
 if(!url)throw Error('Use make test-db: a disposable local PostgreSQL database is required.');
 const target=new URL(url);
 if(!['localhost','127.0.0.1','postgres'].includes(target.hostname)||!/^\/finfolk_test_[a-z0-9_]+$/.test(target.pathname))throw Error('Refusing non-disposable database');
 const client=new pg.Client({connectionString:url});await client.connect();
 return client;
}
export async function migrate(db){
 await db.query(`DO $$ BEGIN CREATE ROLE finfolk_api NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 DO $$ BEGIN CREATE ROLE finfolk_untrusted NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean);`);
 for(const file of (await readdir('backend/migrations')).filter(f=>f.endsWith('.sql')).sort())await db.query(await readFile('backend/migrations/'+file,'utf8'));
 // This schema grant is part of role provisioning on Next, outside migrations.
 await db.query('GRANT USAGE ON SCHEMA finfolk TO finfolk_api');
}
export function apiDatabase(pool){
 return {query:async(sql,args)=>(await pool.query(sql,args)).rows,
 transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(async(sql,args)=>(await c.query(sql,args)).rows);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}};
}
export async function savepoint(db,work){
 await db.query('SAVEPOINT scenario');try{return await work();}finally{await db.query('ROLLBACK TO SAVEPOINT scenario');await db.query('RELEASE SAVEPOINT scenario');}
}
export async function compatDatabase(pooled=false){
 const client=await connect();
 let pool;
 return {query:(s,a)=>(pool||client).query(s,a),
 exec:async s=>{const result=await (pool||client).query(s);if(pooled&&/^SET ROLE finfolk_api;?$/.test(s.trim()))pool=new pg.Pool({connectionString:process.env.FINFOLK_TEST_DATABASE_URL,max:8,options:'-c role=finfolk_api'});return result;},
 close:async()=>{await pool?.end();await client.end();},
 transaction:async fn=>{const c=pool?await pool.connect():client;await c.query('BEGIN');try{const r=await fn({query:(s,a)=>c.query(s,a)});await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{if(pool)c.release();}}};
}
