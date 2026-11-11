// Own a disposable database per suite. No preview/cloud database is accepted.
import {execFileSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import pg from 'pg';
const suffix=randomBytes(5).toString('hex'),container='finfolk-db-tests-'+suffix;
let started=false,base=process.env.FINFOLK_TEST_POSTGRES_URL;
try {
 if(!base){
  execFileSync('docker',['run','--detach','--rm','--name',container,'-e','POSTGRES_PASSWORD=finfolk-test','-p','127.0.0.1::5432','postgres:18@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81'],{stdio:'pipe'});started=true;
  const port=execFileSync('docker',['port',container,'5432/tcp'],{encoding:'utf8'}).trim().split(':').at(-1);
  base=`postgresql://postgres:finfolk-test@127.0.0.1:${port}/postgres`;
 }
 const target=new URL(base);if(!['localhost','127.0.0.1','postgres'].includes(target.hostname))throw Error('Tests require isolated local PostgreSQL.');
 let admin;
 for(let i=0;i<60;i++){try{admin=new pg.Client({connectionString:base});await admin.connect();break;}catch(e){await admin?.end().catch(()=>{});admin=null;await new Promise(r=>setTimeout(r,500));}}
 if(!admin)throw Error('Test PostgreSQL did not become ready. Start Docker Desktop or provide FINFOLK_TEST_POSTGRES_URL.');
 try {
  const suites=['tests/db/native_rpc.mjs','tests/db/rebuild.mjs','tests/db/site_notes.mjs','tests/db/finnies.mjs','tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/common.mjs','tests/db/messaging_entities.mjs','tests/db/types.mjs','tests/db/content_entities.mjs','tests/db/trip_entities.mjs','tests/db/directory_native.mjs','tests/db/directory_entities.mjs','tests/db/entities.mjs','tests/db/enums.mjs','tests/db/clojure.mjs','tests/db/schema.mjs','tests/db/fresh_schema.mjs','tests/db/functions.mjs','tests/db/directory.mjs','tests/db/events.mjs','tests/db/environment.mjs','tests/db/sites.mjs','tests/db/transactions.mjs','tests/db/trips.mjs','tests/db/migrations.mjs','tests/db/readiness.mjs','tests/test_media_imports.mjs','tests/test_substrate_api.mjs','tests/test_instagram_connect.mjs','tests/test_instagram_visits.mjs'] ;
  const selected=process.argv.includes('--clojure-common')?['clojure:common']:process.argv.includes('--native-rpc')?['tests/db/native_rpc.mjs']:process.argv.includes('--directory-native')?['tests/db/directory_native.mjs']:process.argv.includes('--rebuild')?['tests/db/rebuild.mjs']:process.argv.includes('--notes')?['tests/db/site_notes.mjs']:process.argv.includes('--finnies')?['tests/db/finnies.mjs']:process.argv.includes('--common')?['tests/db/common.mjs']:process.argv.includes('--messaging')?['tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/messaging_entities.mjs']:process.argv.includes('--types')?['tests/db/site_notes.mjs','tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/messaging_entities.mjs','tests/db/types.mjs',...suites.filter(file=>/\/(content_entities|trip_entities|directory_entities|entities)\.mjs$/.test(file))]:suites;
  for(const [i,file] of selected.entries()){
   const name=`finfolk_test_${suffix}_${i}`;await admin.query(`CREATE DATABASE "${name}"`);
   const url=new URL(base);url.pathname='/'+name;
   try{await new Promise((resolve,reject)=>{const commonIndex=process.argv.indexOf('--clojure-common');const namespace=commonIndex>=0?process.argv[commonIndex+1]:null;const command=file==='clojure:common'?'lein':process.execPath;const args=file==='clojure:common'?['run','-m','finfolkdb.test','--common',...(namespace?[namespace]:[])]:[file];const p=spawn(command,args,{stdio:'inherit',env:{...process.env,FINFOLK_TEST_DATABASE_URL:url.toString()}});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(file+' failed ('+code+')')));});}
   finally{await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);}
  }
 }finally{await admin.end();}
}finally{if(started)execFileSync('docker',['stop',container],{stdio:'pipe'});}
