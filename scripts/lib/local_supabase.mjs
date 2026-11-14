import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import pg from 'pg';

export const root=fileURLToPath(new URL('../../',import.meta.url));
export const replDatabase='finfolk_test_repl';
const localHosts=new Set(['127.0.0.1','localhost','postgres']);

// Validate before connecting: pg also accepts connection overrides in URL queries.
export function localAdminURL(value){
 let url;
 try{url=new URL(value);}catch{throw Error('A local PostgreSQL test server URL is required.');}
 if(!['postgres:','postgresql:'].includes(url.protocol)||!localHosts.has(url.hostname)||
    !url.username||!url.password||url.search||url.hash||
    !(/^\/(postgres|finfolk_test_[a-z0-9_]+)$/.test(url.pathname)))
  throw Error('Refusing a remote or overridden PostgreSQL test server URL.');
 return url;
}

export function supabase(args){
 try{
  return execFileSync('supabase',[...args,'--workdir',root],{
   cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],
   env:{...process.env,SUPABASE_HOME:fileURLToPath(new URL('../../.cache/supabase-cli',import.meta.url)),SUPABASE_TELEMETRY_DISABLED:'1'},
  });
 }catch(error){
  const message=error.code==='ENOENT'
   ?'Install Supabase CLI 2.122.0 and start Docker before running database tests.'
   :'Local Supabase failed. Check Docker access with `docker ps`, then run `make test-db-local-up`.';
  throw new Error(message,{cause:error});
 }
}

export function ensureSupabase(run=supabase){
 let output;
 try{output=run(['status','--output','json']);}
 catch{run(['start']);output=run(['status','--output','json']);}
 const status=JSON.parse(output);
 if(!status.DB_URL)throw Error('Local Supabase status did not contain a DB_URL.');
 return localAdminURL(status.DB_URL);
}

export function testDatabaseURL(base,name){
 if(!/^finfolk_test_[a-z0-9_]+$/.test(name))throw Error('Refusing a non-test database name.');
 const url=localAdminURL(base);
 url.pathname='/'+name;
 return url;
}

export async function connectAdmin(base,Client=pg.Client){
 const url=localAdminURL(base);
 const client=new Client({connectionString:url.toString(),connectionTimeoutMillis:15000});
 try{await client.connect();return client;}
 catch(error){await client.end().catch(()=>{});throw error;}
}

export async function withTestDatabase(admin,base,work,name='finfolk_test_'+randomBytes(6).toString('hex')){
 if(name===replDatabase)throw Error('The persistent REPL database cannot be used as a disposable suite.');
 const url=testDatabaseURL(base,name);
 // template0 keeps Supabase-managed schemas and developer data out of suite fixtures.
 await admin.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
 try{return await work(url);}
 finally{await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);}
}

export async function prepareRepl(base){
 testDatabaseURL(base,replDatabase);
 const admin=await connectAdmin(base);
 try{
  const result=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[replDatabase]);
  if(!result.rowCount){
   try{await admin.query(`CREATE DATABASE "${replDatabase}" TEMPLATE template0`);}
   catch(error){if(error.code!=='42P04')throw error;}
  }
  // A real query verifies that Supabase's PostgreSQL is reachable.
  const resultVersion=await admin.query('SELECT version() AS version');
  return resultVersion.rows[0].version;
 }finally{await admin.end();}
}
