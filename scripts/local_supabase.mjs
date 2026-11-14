import {ensureSupabase,localAdminURL,prepareRepl,replDatabase,supabase} from './lib/local_supabase.mjs';

try{
 const command=process.argv[2];
 if(command==='up'){
  const url=ensureSupabase(),version=await prepareRepl(url);
  console.log(`Local Supabase ready: ${url.hostname}:${url.port}; REPL database ${replDatabase}.`);
  console.log(version);
 }else if(command==='down'){
  supabase(['stop']);
  console.log('Finfolk local Supabase stopped; local volumes retained.');
 }else if(command==='status'){
  const status=JSON.parse(supabase(['status','--output','json']));
  const url=localAdminURL(status.DB_URL);
  console.log(`Database: ${url.hostname}:${url.port}; REPL database ${replDatabase}.`);
  for(const key of ['API_URL','STUDIO_URL','INBUCKET_URL'])if(status[key])console.log(`${key}=${status[key]}`);
 }else throw Error('Usage: node scripts/local_supabase.mjs up|down|status');
}catch(error){console.error(error.message);process.exitCode=1;}
