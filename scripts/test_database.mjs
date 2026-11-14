// Each suite owns an empty database on Finfolk's local Supabase PostgreSQL server.
import {spawn} from 'node:child_process';
import {connectAdmin,ensureSupabase,localAdminURL,withTestDatabase} from './lib/local_supabase.mjs';

async function main(){
 const base=process.env.FINFOLK_TEST_POSTGRES_URL
  ?localAdminURL(process.env.FINFOLK_TEST_POSTGRES_URL):ensureSupabase();
 const admin=await connectAdmin(base);
 try {
   const suites=['tests/db/native_rpc.mjs','tests/db/rebuild.mjs','tests/db/site_notes.mjs','tests/db/finnies.mjs','tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/common.mjs','tests/db/messaging_entities.mjs','tests/db/types.mjs','tests/db/content_entities.mjs','tests/db/trip_entities.mjs','tests/db/directory_native.mjs','tests/db/directory_entities.mjs','tests/db/entities.mjs','tests/db/enums.mjs','tests/db/clojure.mjs','tests/db/schema.mjs','tests/db/fresh_schema.mjs','tests/db/functions.mjs','tests/db/directory.mjs','tests/db/events.mjs','tests/db/environment.mjs','tests/db/sites.mjs','tests/db/transactions.mjs','tests/db/trips.mjs','tests/db/migrations.mjs','tests/db/readiness.mjs','tests/test_media_imports.mjs','tests/test_substrate_api.mjs','tests/test_instagram_connect.mjs','tests/test_instagram_visits.mjs'] ;
   const selected=process.argv.includes('--clojure-common')?['clojure:common']:process.argv.includes('--native-rpc')?['tests/db/native_rpc.mjs']:process.argv.includes('--directory-native')?['tests/db/directory_native.mjs']:process.argv.includes('--rebuild')?['tests/db/rebuild.mjs']:process.argv.includes('--notes')?['tests/db/site_notes.mjs']:process.argv.includes('--finnies')?['tests/db/finnies.mjs']:process.argv.includes('--common')?['tests/db/common.mjs']:process.argv.includes('--messaging')?['tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/messaging_entities.mjs']:process.argv.includes('--types')?['tests/db/site_notes.mjs','tests/db/messaging_gateway.mjs','tests/db/messaging_authorization.mjs','tests/db/messaging_entities.mjs','tests/db/types.mjs',...suites.filter(file=>/\/(content_entities|trip_entities|directory_entities|entities)\.mjs$/.test(file))]:suites;
   for(const file of selected){
    await withTestDatabase(admin,base,async url=>{
     const commonIndex=process.argv.indexOf('--clojure-common');
     const namespace=commonIndex>=0?process.argv[commonIndex+1]:null;
     const command=file==='clojure:common'?'lein':process.execPath;
     const args=file==='clojure:common'
      ?['run','-m','finfolkdb.test','--common',...(namespace?[namespace]:[])]
      :[file];
     await new Promise((resolve,reject)=>{
      const child=spawn(command,args,{stdio:'inherit',env:{...process.env,FINFOLK_TEST_DATABASE_URL:url.toString()}});
      child.on('error',reject);
      child.on('exit',code=>code===0?resolve():reject(Error(file+' failed ('+code+')')));
     });
    });
   }
 }finally{await admin.end();}
}
try{await main();}
catch(error){console.error(error.message);process.exitCode=1;}
