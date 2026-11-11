import {createWorkerMessaging,assertMessagingDrain} from './messaging-worker.mjs';
import {scheduleEnvironment} from './environment.mjs';
import {tiktokReady,scheduleTikTok} from './tiktok.mjs';
import {publicPage} from './public-pages.mjs';
import {createAPI,managedVerifier} from './api.mjs';
import {database} from './db.mjs';
import {instagramWebhook,processInstagramEvent,reconcileInstagram} from './instagram-webhook.mjs';
import {processInstagramPublicDM,processInstagramDM,sendOutbox,reconcileInstagramDM} from './messaging-engine.mjs';
import {sendCommandReply} from './instagram-commands.mjs';
import {collectInstagramSource,scheduleInstagramDiscovery} from './instagram-collector.mjs';

export function createNextWorker({openDatabase=database,apiFactory=createAPI,databaseName='finfolk_next',messagingFactory=createWorkerMessaging,verifierFactory=managedVerifier}={}) {
 const verifiers=new Map();
 const configured=env=>env.ENVIRONMENT==='next' && env.HYPERDRIVE && env.NEON_AUTH_BASE_URL &&
  !env.NEON_AUTH_BASE_URL.includes('ep-crimson-queen') && env.DB_BACKBONE_ENABLED==='true';
 async function withDatabase(env,run){
  if(!configured(env))throw Error('Next backend is not isolated and ready.');
  const db=openDatabase(env.HYPERDRIVE.connectionString);
  try{
   const release=(await db.query('SELECT current_database() AS database,sql_sha FROM finfolk.backbone_release WHERE id=1'))[0];
   if(release?.database!==databaseName || ![env.DB_SQL_SHA,env.DB_SQL_SHA_PREVIOUS].filter(Boolean).includes(release.sql_sha))throw Error('Next database release mismatch.');
   return await run(db);
  }finally{await db.pool.end();}
 }
 async function withMessaging(env,run){
  if(env.ENTITY_MESSAGING_ENABLED!=='true'||!env.ENTITY_MESSAGING_HYPERDRIVE?.connectionString||
     !env.ENTITY_MESSAGING_DATABASE_NAME||env.ENTITY_MESSAGING_DATABASE_NAME===databaseName||
     env.ENTITY_MESSAGING_HYPERDRIVE.connectionString===env.HYPERDRIVE?.connectionString)
   throw Error('Entity messaging requires its separate, explicitly enabled database.');
  const db=openDatabase(env.ENTITY_MESSAGING_HYPERDRIVE.connectionString);
  try{
   const verifierKey=JSON.stringify([env.ENTITY_MESSAGING_AUTH_BASE_URL,env.ENTITY_MESSAGING_AUTH_JWKS_URL]);
   let verify=verifiers.get(verifierKey);
   if(!verify){verify=verifierFactory({NEON_AUTH_BASE_URL:env.ENTITY_MESSAGING_AUTH_BASE_URL,NEON_AUTH_JWKS_URL:env.ENTITY_MESSAGING_AUTH_JWKS_URL});verifiers.set(verifierKey,verify);}
   return await run(messagingFactory({db,env,verify}));
  }finally{await db.pool.end();}
 }
 return {
  async fetch(request,env,ctx){
   const path=new URL(request.url).pathname;
   if(path.startsWith('/v1/messaging/')){
    try{return await withMessaging(env,gateway=>gateway.fetch(request));}
    catch{return Response.json({error:'Messaging is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}
   }
   if(['GET','HEAD'].includes(request.method)){const publication=path==='/v1/integrations/tiktok/oauth/callback'&&tiktokReady(env)&&request.method==='GET'?null:publicPage(path);if(publication)return request.method==='HEAD'?new Response(null,{status:publication.status,headers:publication.headers}):publication;}
   if(path==='/instagram/webhook' && request.method==='GET' && env.ENVIRONMENT==='next')
    return instagramWebhook(request,env,()=>{throw Error('Verification must be database independent');});
   if(path==='/instagram/webhook' && env.INSTAGRAM_NEXT_INGRESS_ENABLED!=='true')
    return Response.json({error:'Instagram handover has not started.'},{status:503,headers:{'Cache-Control':'no-store'}});
   try{
    if(path==='/instagram/webhook' && request.method==='POST' && ctx?.waitUntil){
     const direct=[];
     const response=await withDatabase(env,db=>instagramWebhook(request,env,db.query,{onPublicCommand:id=>direct.push(id)}));
     if(direct.length)ctx.waitUntil(withDatabase(env,async db=>{
      await Promise.all(direct.map(async id=>{
       try{await processInstagramPublicDM(id,env,db);}
       catch{console.error(JSON.stringify({service:'instagram-messaging',stage:'public_deferred'}));}
      }));
     }).catch(()=>console.error(JSON.stringify({service:'instagram-messaging',stage:'public_deferred'}))));
     return response;
    }
    return await withDatabase(env,async db=>{
    if(path==='/health')return Response.json({environment:'next',backbone:'Clojure/Postgres + xt.substrate + xt.db',ready:true,sqlSha:env.DB_SQL_SHA},{headers:{'Cache-Control':'no-store'}});
    let verify=verifiers.get(env.NEON_AUTH_BASE_URL);
    if(!verify){verify=managedVerifier(env);verifiers.set(env.NEON_AUTH_BASE_URL,verify);}
    const run=siteNotesDb=>apiFactory({db,siteNotesDb,verify,origins:['https://finfolk.com.au','https://www.finfolk.com.au','https://old.finfolk.com.au','http://localhost:8000','http://127.0.0.1:8000']}).fetch(request,env,ctx);
    const notesPath=/^\/v1\/(?:me\/|admin\/)?sites\/[^/]+\/notes(?:\/|$)/.test(path);
    if(!notesPath||env.ENTITY_SITE_NOTES_ENABLED!=='true')return run(null);
    if(!env.ENTITY_SITE_NOTES_HYPERDRIVE?.connectionString||!env.ENTITY_SITE_NOTES_DATABASE_NAME||
       env.ENTITY_SITE_NOTES_DATABASE_NAME===databaseName||env.ENTITY_SITE_NOTES_HYPERDRIVE.connectionString===env.HYPERDRIVE.connectionString)
      throw Error('Native site notes require their separate database binding.');
    const notes=openDatabase(env.ENTITY_SITE_NOTES_HYPERDRIVE.connectionString);
    try{
     const installed=(await notes.query('SELECT current_database() AS database,to_regclass(\'finfolk."SiteNote"\') IS NOT NULL AS installed'))[0];
     if(installed?.database!==env.ENTITY_SITE_NOTES_DATABASE_NAME||!installed.installed)throw Error('Native site notes are not provisioned.');
     return await run(notes);
    }finally{await notes.pool.end();}
   });}catch(error){
    console.error(JSON.stringify({service:'finfolk-next',code:error.code || 'next_backend_unavailable'}));
    return Response.json({error:'Next backend is not isolated and ready.'},{status:503,headers:{'Cache-Control':'no-store'}});
   }
  },
  async queue(batch,env){
   const native=batch.messages.filter(message=>message.body?.kind==='entity-messaging');
   for(const message of native){
    try{
     if(typeof message.body.connectionKey!=='string')throw Error('Invalid connection wakeup.');
     await withMessaging(env,async gateway=>assertMessagingDrain(await gateway.drain({connectionKeys:[message.body.connectionKey]})));
     message.ack();
    }catch{message.retry({delaySeconds:300});}
   }
   const legacy=batch.messages.filter(message=>message.body?.kind!=='entity-messaging');
   if(!legacy.length&&native.length)return;
   await withDatabase(env,async db=>{
    for(const message of legacy){
     try{
      const {kind,id,key}=message.body;
      if(kind==='instagram-dm' && message.body.publicCommand===true)await processInstagramPublicDM(String(id),env,db);
      else if(kind==='instagram-dm')await processInstagramDM(String(id),env,db);
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
   const tasks=[];
   if(env.ENTITY_MESSAGING_ENABLED==='true')tasks.push(withMessaging(env,async gateway=>assertMessagingDrain(await gateway.drain())));
   if(configured(env))tasks.push(withDatabase(env,async db=>{
    if(event.cron==='* * * * *')await reconcileInstagramDM(env,db.query);
    else{await scheduleEnvironment(db,env);await reconcileInstagram(env,db.query);await scheduleInstagramDiscovery(env,db.query);await scheduleTikTok(env,db);}
   }));
   if(!tasks.length)throw Error('No configured background database.');
   const results=await Promise.allSettled(tasks);
   const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  }
 };
}
export default createNextWorker();
