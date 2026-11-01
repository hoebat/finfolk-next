import {publicPage} from './public-pages.mjs';
import {createAPI,managedVerifier} from './api.mjs';
import {database} from './db.mjs';
import {instagramWebhook,processInstagramEvent,reconcileInstagram} from './instagram-webhook.mjs';
import {processInstagramDM,sendOutbox,reconcileInstagramDM} from './messaging-engine.mjs';
import {sendCommandReply} from './instagram-commands.mjs';
import {collectInstagramSource,scheduleInstagramDiscovery} from './instagram-collector.mjs';

export function createNextWorker({openDatabase=database,apiFactory=createAPI,databaseName='finfolk_next'}={}) {
 const verifiers=new Map();
 const configured=env=>env.ENVIRONMENT==='next' && env.HYPERDRIVE && env.NEON_AUTH_BASE_URL &&
  !env.NEON_AUTH_BASE_URL.includes('ep-crimson-queen') && env.DB_BACKBONE_ENABLED==='true';
 async function withDatabase(env,run){
  if(!configured(env))throw Error('Next backend is not isolated and ready.');
  const db=openDatabase(env.HYPERDRIVE.connectionString);
  try{
   const release=(await db.query('SELECT current_database() AS database,sql_sha FROM finfolk.backbone_release WHERE id=1'))[0];
   if(release?.database!==databaseName || release.sql_sha!==env.DB_SQL_SHA)throw Error('Next database release mismatch.');
   return await run(db);
  }finally{await db.pool.end();}
 }
 return {
  async fetch(request,env,ctx){
   const path=new URL(request.url).pathname;
   if(['GET','HEAD'].includes(request.method)){const publication=publicPage(path);if(publication)return request.method==='HEAD'?new Response(null,{status:publication.status,headers:publication.headers}):publication;}
   if(path==='/instagram/webhook' && request.method==='GET' && env.ENVIRONMENT==='next')
    return instagramWebhook(request,env,()=>{throw Error('Verification must be database independent');});
   if(path==='/instagram/webhook' && env.INSTAGRAM_NEXT_INGRESS_ENABLED!=='true')
    return Response.json({error:'Instagram handover has not started.'},{status:503,headers:{'Cache-Control':'no-store'}});
   try{return await withDatabase(env,async db=>{
    if(path==='/health')return Response.json({environment:'next',backbone:'Clojure/Postgres + xt.substrate + xt.db',ready:true,sqlSha:env.DB_SQL_SHA},{headers:{'Cache-Control':'no-store'}});
    let verify=verifiers.get(env.NEON_AUTH_BASE_URL);
    if(!verify){verify=managedVerifier(env);verifiers.set(env.NEON_AUTH_BASE_URL,verify);}
    return apiFactory({db,verify,origins:['https://next.finfolk.com.au','https://finfolk.com.au','https://www.finfolk.com.au','http://localhost:8000','http://127.0.0.1:8000']}).fetch(request,env,ctx);
   });}catch(error){
    console.error(JSON.stringify({service:'finfolk-next',code:error.code || 'next_backend_unavailable'}));
    return Response.json({error:'Next backend is not isolated and ready.'},{status:503,headers:{'Cache-Control':'no-store'}});
   }
  },
  async queue(batch,env){
   await withDatabase(env,async db=>{
    for(const message of batch.messages){
     try{
      const {kind,id,key}=message.body;
      if(kind==='instagram-dm')await processInstagramDM(String(id),env,db);
      else if(kind==='instagram-dm-reply')await sendOutbox(String(id),env,db);
      else if(kind==='instagram-comment-reply')await sendCommandReply(String(id),env,db);
      else if(kind==='discovery-source')await collectInstagramSource(key,env,db.query);
      else await processInstagramEvent(String(id),env,db.query,db);
      message.ack();
     }catch{message.retry({delaySeconds:300});}
    }
   });
  },
  async scheduled(event,env){
   await withDatabase(env,async db=>{
    if(event.cron==='* * * * *')await reconcileInstagramDM(env,db.query);
    else{await reconcileInstagram(env,db.query);await scheduleInstagramDiscovery(env,db.query);}
   });
  }
 };
}
export default createNextWorker();
