process.env.FINFOLK_FEATURE_ENVIRONMENT='development';
import {localPreviewFeatureFlags} from './lib/environment_feature_flags.mjs';
import {mockEventDelivery} from './lib/mock_event_delivery.mjs';
import {mockDirectorySearch} from './lib/mock_directory_search.mjs';
// Local environment ownership only; DB rules and application models are emitted from Clojure.
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {serve} from '@hono/node-server';
import pg from 'pg';
import {AuthClient} from '@supabase/auth-js';
import {createApplicationBackbone} from '../js/finfolk-next/packages/edge/application.js';
import {createAccountClient} from '../js/finfolk-next/packages/edge/supabase-client.js';
import {database} from '../backend/db.mjs';
import {createAPI} from '../backend/api.mjs';
import {supabase} from './lib/local_supabase.mjs';
for(const file of ['next-backbone.js','app-backbone.js','site-catalog.js']){
 const base='js/finfolk-next/site/web-main/';
 if(!(await readFile(base+'public/'+file)).equals(await readFile(base+'src/'+file)))
  throw Error('The Next public runtime is stale. Run make manage-preview-native.');
}
const connection=new URL(process.env.NATIVE_ACCOUNT_TEST_DB);
if(!['127.0.0.1','localhost'].includes(connection.hostname)||connection.port!=='55432'||!/^\/app_test_account_pages_[a-f0-9]{32}$/.test(connection.pathname)||connection.search||connection.hash)
 throw Error('Native preview requires its owned local fixture database.');
const deliveryKey=randomUUID()+randomUUID();
const port=Number(process.env.NATIVE_PREVIEW_PORT||3011);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Choose a native preview port between 1024 and 65535.');
const {API_URL:url,ANON_KEY:key,SERVICE_ROLE_KEY:secret}=JSON.parse(supabase(['status','--output','json']));
if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Native preview requires local Supabase Auth.');
const seedPool=new pg.Pool({connectionString:connection.href,max:1});
connection.searchParams.set('options','-c role=finfolk_account');
const db=database(connection.href),owned=[];let server,next;
async function auth(path,body,method='POST'){
 const response=await fetch(url+'/auth/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok&&!(method==='DELETE'&&response.status===404))throw Error('Local preview Auth request failed: '+response.status);
 return response.status===204?null:response.json();
}
let stop;
const stopped=new Promise(resolve=>{stop=resolve;});
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{
 const origin='http://127.0.0.1:'+port;
 const api=createAPI({previewFeatureFlags:localPreviewFeatureFlags(),db,directorySearch:mockDirectorySearch,eventDelivery:mockEventDelivery,deliveryKey,invitationOrigin:origin,origins:[origin],verify:async()=>{throw Error('Legacy identity is unavailable in the native preview.');}});
 const apiOrigin=await new Promise(resolve=>{server=serve({fetch:request=>{
  if(!['/v1/features','/v1/native/account','/v1/native/sites/catalog','/health'].includes(new URL(request.url).pathname))
   return Response.json({error:'This feature is not available in this build.',code:'native_operation_unavailable'},{status:501,headers:{'Cache-Control':'no-store'}});
  return api.fetch(request,{FINFOLK_FEATURE_ENVIRONMENT:'development',SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key,SUPABASE_SERVICE_ROLE_KEY:secret});
 },hostname:'127.0.0.1',port:0},info=>resolve('http://127.0.0.1:'+info.port));});
 const accounts=[];
 async function seedAccount(account){
  const sdk=new AuthClient({url:url+'/auth/v1',headers:{apikey:key},persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  const config={backbone:true,cacheBackend:'memory',apiUrl:apiOrigin,cacheApiUrl:apiOrigin+'/preview/'+account.name,authUrl:url};
  const client=createAccountClient(sdk,config,createApplicationBackbone(config));
  try{
   await client.ready;
   const login=await sdk.signInWithPassword({email:account.email,password:account.password});
   if(login.error)throw Error('Preview account sign-in failed.');
   await client.call('preferences',{profile:{displayName:'Preview '+account.name[0].toUpperCase()+account.name.slice(1),open:account.name!=='admin',bio:'Temporary native preview diver',beaches:['30000000-0000-0000-0000-000000000003']}});
   await sdk.signOut();
  }finally{client.close();sdk.stopAutoRefresh();}
 }
 for(const name of ['alice','bob','admin']){
  const email='preview-'+name+'-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!';
  const user=await auth('admin/users',{email,password,email_confirm:true});owned.push(user.id);const account={name,email,password};accounts.push(account);await seedAccount(account);if(name==='admin')await seedPool.query('INSERT INTO finfolk.\"UserRole\"(user_id,role) VALUES($1,\'admin\')',[user.id]);
 }
 next=spawn(process.execPath,[resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{
  cwd:'js/finfolk-next/site/web-main',env:{...process.env,FINFOLK_AUTH_PROVIDER:'supabase',FINFOLK_SUPABASE_URL:url,FINFOLK_SUPABASE_PUBLISHABLE_KEY:key,FINFOLK_API_ORIGIN:apiOrigin,FINFOLK_NEXT_DIST_DIR:'.cache/native-preview-'+port,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','inherit','inherit']});
 console.log('Disposable native preview: '+origin+'/account');
 console.log('Use the fixture beach for check-ins and session location. Supported: account, privacy, check-ins, people, profiles/statistics, private/public logbook, directory/managed pages and events. Use the admin account to review and publish pages.');
 console.log('Temporary local demo sign-ins (removed when this preview stops):');
 for(const account of accounts)console.log(account.name+': '+account.email+' / '+account.password);
 console.log('Other application capabilities remain gated. Stop with Ctrl-C to remove this fixture.');
 const outcome=await Promise.race([once(next,'exit').then(([code])=>({code})),once(next,'error').then(([error])=>({error})),stopped.then(()=>({stopped:true}))]);
 if(outcome.error)throw outcome.error;
 if(!outcome.stopped&&outcome.code!==0)throw Error('Native Next preview exited with code '+outcome.code);
}finally{
 if(next&&next.exitCode===null&&next.signalCode===null){const exited=once(next,'exit');next.kill('SIGTERM');await exited;}
 if(server)await new Promise(resolve=>server.close(resolve));
 const cleanup=await Promise.allSettled(owned.map(id=>auth('admin/users/'+id,undefined,'DELETE')));
 await db.pool.end();
 await seedPool.end();
 const failures=cleanup.filter(result=>result.status==='rejected');
 if(failures.length)throw new AggregateError(failures.map(result=>result.reason),'Preview Auth cleanup failed.');
 process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
}
