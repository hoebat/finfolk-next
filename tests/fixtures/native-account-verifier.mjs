import {mockEventDelivery} from '../../scripts/lib/mock_event_delivery.mjs';
import {mockDirectorySearch} from '../../scripts/lib/mock_directory_search.mjs';
// Environment ownership only. Case execution and page/model logic are Clojure/XTalk.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {serve} from '@hono/node-server';
import {AuthClient} from '@supabase/auth-js';
import {database} from '../../backend/db.mjs';
import {createAPI} from '../../backend/api.mjs';
import {supabase} from '../../scripts/lib/local_supabase.mjs';
import {createApplicationBackbone} from '../../js/finfolk-next/packages/edge/application.js';
import {createAccountClient} from '../../js/finfolk-next/packages/edge/supabase-client.js';
import {scenario} from '../../generated/verification/native-account/account-verifier.mjs';
const input=JSON.parse(readFileSync(0,'utf8'));
const connection=new URL(process.env.NATIVE_ACCOUNT_TEST_DB);
if(!['127.0.0.1','localhost'].includes(connection.hostname)||connection.port!=='55432'||connection.search||connection.hash||!/^\/app_test_account_pages_[a-f0-9]{32}$/.test(connection.pathname))throw Error('Native verifier requires its owned local database');
const seedDB=database(connection.href);
connection.searchParams.set('options','-c role=finfolk_account');
const deliveryKey=randomUUID()+randomUUID();
const db=database(connection.href),owned=[],clients=new Map();let server;
const {API_URL:url,ANON_KEY:key,SERVICE_ROLE_KEY:secret}=JSON.parse(supabase(['status','--output','json']));
async function auth(path,body,admin=false,method='POST'){
 const response=await fetch(url+'/auth/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+(admin?secret:key),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok&&!(method==='DELETE'&&response.status===404))throw Error('Local Auth fixture request failed');
 return response.status===204?null:response.json();
}
try{
 if(!['127.0.0.1','localhost'].includes(new URL(url).hostname))throw Error('Native verifier requires local Auth');
 const api=createAPI({db,directorySearch:mockDirectorySearch,eventDelivery:mockEventDelivery,deliveryKey,invitationOrigin:'http://127.0.0.1:3011',verify:async()=>{throw Error('Legacy identity is unavailable in this fixture');}});
 const origin=await new Promise(resolve=>{server=serve({fetch:request=>api.fetch(request,{SUPABASE_URL:url,SUPABASE_PUBLISHABLE_KEY:key}),hostname:'127.0.0.1',port:0},info=>resolve('http://127.0.0.1:'+info.port));});
 const context={async clientFor(actor){
  if(!['alice','bob','guest','admin'].includes(actor))throw Error('Unknown fixture actor');
  if(clients.has(actor))return clients.get(actor);
  const email='page-'+randomUUID()+'@example.test',password=randomUUID()+'Aa1!';
  if(actor!=='guest'){const user=await auth('admin/users',{email,password,email_confirm:true},true);owned.push(user.id);if(actor==='admin'){await seedDB.query('SELECT finfolk_rpc.ensure_account($1)',[user.id]);await seedDB.query("INSERT INTO finfolk.\"UserRole\"(user_id,role) VALUES($1,'admin')",[user.id]);}}
  const sdk=new AuthClient({url:url+'/auth/v1',headers:{apikey:key},persistSession:false,autoRefreshToken:false,detectSessionInUrl:false});
  const config={backbone:true,cacheBackend:'memory',apiUrl:origin,cacheApiUrl:origin+'/fixture/'+actor,authUrl:url};
  const app=createApplicationBackbone(config),member=app.member.bind(app);let model;
  app.member=(...args)=>(model=member(...args));
  const client=createAccountClient(sdk,config,app),entry={client,read:(...args)=>model?model.read(...args):app.public.read(...args),close(){client.close();sdk.stopAutoRefresh();}};
  clients.set(actor,entry);await client.ready;
  if(actor!=='guest'){const login=await sdk.signInWithPassword({email,password});if(login.error)throw Error('Local fixture sign-in failed');}
  return entry;
 }};
 console.log(JSON.stringify(await scenario(context,input)));
}finally{
 for(const entry of clients.values())entry.close();
 try{for(const id of owned)await auth('admin/users/'+id,undefined,true,'DELETE');}
 finally{if(server)await new Promise(resolve=>server.close(resolve));await db.pool.end();await seedDB.pool.end();}
}
