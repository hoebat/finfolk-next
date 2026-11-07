import {pathToFileURL} from 'node:url';
import {database} from '../backend/db.mjs';
import {createWorkerMessaging,messagingWorkerConfiguration} from '../backend/messaging-worker.mjs';

// Use --env-file locally with server-only credentials. This command never prints
// tokens, raw errors, URLs or provider responses and cannot activate/send/refresh.
export async function messagingPreflight({env=process.env,args=process.argv.slice(2),openDatabase=database,createGateway=createWorkerMessaging}={}){
 let db;
 try{
  if(args.some(arg=>arg!=='--verify-providers'&&!arg.startsWith('--connection='))||args.filter(arg=>arg==='--verify-providers').length>1)throw Error('Invalid options');
  const keys=args.filter(arg=>arg.startsWith('--connection=')).map(arg=>arg.slice('--connection='.length));
  if(keys.some(key=>!key)||new Set(keys).size!==keys.length)throw Error('Invalid connection');
  const nativeEnv={...env,ENTITY_MESSAGING_HYPERDRIVE:{connectionString:env.ENTITY_MESSAGING_DATABASE_URL}};
  const config=messagingWorkerConfiguration(nativeEnv);
  const target=new URL(env.ENTITY_MESSAGING_DATABASE_URL);
  if(decodeURIComponent(target.pathname.slice(1))!==config.expectedDatabase||config.expectedDatabase==='finfolk_next')throw Error('Incorrect native database');
  const known=new Set(config.connections.map(connection=>connection.key));
  if(!known.size||keys.some(key=>!known.has(key)))throw Error('Unregistered connection');
  db=openDatabase(env.ENTITY_MESSAGING_DATABASE_URL);
  const gateway=createGateway({db,env:nativeEnv,verify:async()=>{throw Error('Preflight has no browser authentication route');}});
  const report=await gateway.preflight({...(keys.length?{connectionKeys:keys}:{}),verifyProviders:args.includes('--verify-providers')});
  return {exitCode:report.results.some(result=>result.status==='unavailable')?1:0,report};
 }catch{return {exitCode:1,report:{liveDeliveryVerified:false,error:'Messaging preflight is unavailable. Check server configuration and provider access.'}};}
 finally{if(db)await db.pool.end().catch(()=>{});}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {exitCode,report}=await messagingPreflight();
 console.log(JSON.stringify(report,null,2));process.exitCode=exitCode;
}
