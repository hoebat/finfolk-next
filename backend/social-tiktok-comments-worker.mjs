// Independent Accounts/Mentions authorization, queue and inbox. No DM routes.
import {createHash} from 'node:crypto';
import {database} from './db.mjs';
import {createSocialRuntime} from './social-runtime.mjs';
import {socialWorkerConfiguration} from './social-worker.mjs';
import {createMessagingAuthorizationStore} from './messaging-authorization-store.mjs';
import {createMessagingOAuth} from './messaging-oauth.mjs';
import {createSocialOperatorHTTP} from './social-operator-http.mjs';
import {verifiedIdentity} from '../js/finfolk-next/packages/edge/supabase-auth.js';
import {socialTikTokAccessToken} from './social-tiktok-adapter.mjs';
import {createTikTokCommentsProvider,createTikTokCommentsAuthorization,tiktokID} from './tiktok-comments-provider.mjs';
import {createSocialTikTokCommentsAdapter} from './social-tiktok-comments-adapter.mjs';
const callback='/v1/integrations/tiktok/comments/oauth/callback',webhook='/tiktok/comments/webhook';
const prefix='/v1/messaging/connections/finfolk-tiktok-comments/';
export function tiktokCommentsConfiguration(env){
 const config=socialWorkerConfiguration({...env,TIKTOK_MESSAGING_APP_SECRET:env.TIKTOK_COMMENTS_APP_SECRET},'tiktok');
 if(config.capability!=='comments'||!tiktokID(config.pilotVideoId))throw Error('Separate TikTok comments configuration required');
 return config;
}
export function createNativeTikTokCommentsWorker({openDatabase=database,fetcher=fetch}={}){
 async function scoped(env,run){
  const config=tiktokCommentsConfiguration(env),db=openDatabase(env.SOCIAL_DB.connectionString);
  try{
   const runtime=await createSocialRuntime({db,application:config.application,inbox:config.inbox,provider:'tiktok',cryptoKey:new Uint8Array(Buffer.from(env.NATIVE_SOCIAL_REPLY_KEY,'hex'))});
   if(runtime.scope.accountId!==config.accountId||runtime.scope.capability!=='tiktok-comments')throw Error('TikTok comments inbox mismatch');
   const authorization=createMessagingAuthorizationStore({db,application:config.application,account:config.inbox,encryptionEnv:env});
   const provider=createTikTokCommentsProvider({...config,fetcher,loadAccessToken:options=>socialTikTokAccessToken({...config,authorization,...options})});
   const adapter=createSocialTikTokCommentsAdapter({runtime,clientKey:config.appId,appSecret:env.TIKTOK_COMMENTS_APP_SECRET,provider,
    enabled:async()=>(await authorization.connection()).mode!=='disabled',wake:()=>env.NATIVE_SOCIAL_QUEUE.send({kind:'native-tiktok-comments',inbox:config.inbox})});
   const redirectURI='https://api.finfolk.com.au'+callback;
   const providerAuthorization=createTikTokCommentsAuthorization({...config,appSecret:env.TIKTOK_COMMENTS_APP_SECRET,fetcher,callbackURL:'https://api.finfolk.com.au'+webhook,oauthRedirectURI:redirectURI});
   const oauth=createMessagingOAuth({db,application:config.application,account:config.inbox,provider:'tiktok',providerAuthorization,authorizationStore:authorization,
    redirectURI,returnURL:'https://finfolk.com.au/admin/tiktok/comments',subscribeOnAuthorization:true,
    configurationFingerprint:createHash('sha256').update(JSON.stringify([config,env.TIKTOK_COMMENTS_APP_SECRET])).digest('hex')});
   return await run({runtime,authorization,adapter,providerAuthorization,config,db,oauth});
  }finally{await db.pool.end();}
 }
 async function drain(env){return scoped(env,async({runtime,adapter,authorization,providerAuthorization})=>{
  const current=await authorization.connection();
  if(current.mode!=='disabled'){
   if(current.expiresAt&&Date.parse(current.expiresAt)<=Date.now()+600000){
    const refreshed=await authorization.refresh({exchange:credential=>providerAuthorization.refresh(credential),verify:credential=>providerAuthorization.verify(credential)});
    if(refreshed.status!=='refreshed')return;
   }
   for(let i=0;i<10;i++)if(!(await runtime.reconcile()).more)break;
   for(let i=0;i<25;i++)if(!await runtime.processNext())break;
   for(let i=0;i<25;i++)if(!await runtime.deliverNext(adapter))break;
  }
  await runtime.cleanup();
 });}
 return {
  async fetch(request,env){
   const path=new URL(request.url).pathname;
   if(path!==webhook&&path!==callback&&!path.startsWith(prefix))return new Response('',{status:404});
   try{return await scoped(env,({adapter,config,db,authorization,oauth})=>path===webhook?adapter.webhook(request):createSocialOperatorHTTP({db,config,authorization,oauth,
    authenticate:request=>verifiedIdentity({supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY},request.headers.get('Authorization')),
    administrators:config.administrators,allowedOrigins:['https://finfolk.com.au','https://www.finfolk.com.au']})(request));}
   catch{return Response.json({error:'TikTok comments unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
  },
  async queue(batch,env){
   const config=tiktokCommentsConfiguration(env),selected=batch.messages.filter(m=>m.body?.kind==='native-tiktok-comments'&&m.body.inbox===config.inbox);
   for(const message of batch.messages)if(!selected.includes(message))message.ack();
   if(!selected.length)return;
   try{await drain(env);for(const message of selected)message.ack();}catch{for(const message of selected)message.retry({delaySeconds:60});}
  },
  async scheduled(_controller,env){await drain(env);},
 };
}
export default createNativeTikTokCommentsWorker();
