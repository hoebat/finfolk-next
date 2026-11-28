// Dedicated native social service. Never consumes archived legacy queue payloads.
import {createPageInstagram} from './page-instagram.mjs';
import {database} from './db.mjs';
import {createSocialRuntime} from './social-runtime.mjs';
import {createSocialInstagramAdapter,socialInstagramProvider} from './social-instagram-adapter.mjs';
import {createMessagingAuthorizationStore} from './messaging-authorization-store.mjs';
import {createSocialMemberHTTP} from './social-member-http.mjs';
import {verifiedIdentity} from '../js/finfolk-next/packages/edge/supabase-auth.js';
import {createSocialOperatorHTTP} from './social-operator-http.mjs';
import {createMessagingOAuth} from './messaging-oauth.mjs';
import {createInstagramMessagingAuthorization} from './messaging-instagram-authorization.mjs';
import {createHash} from 'node:crypto';
import {encryptionKey} from './messaging-config.mjs';
import {createSocialTikTokAdapter,socialTikTokIdentity,socialTikTokAccessToken} from './social-tiktok-adapter.mjs';
import {createTikTokMessagingAuthorization} from './messaging-tiktok-authorization.mjs';

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
export function socialWorkerConfiguration(env,provider='instagram') {
  if(env.NATIVE_SOCIAL_ENABLED!=='true')throw Error('Native social is disabled');
  const config=JSON.parse(env.NATIVE_SOCIAL_CONFIG||'null');
  if(!config||!uuid.test(config.application)||!uuid.test(config.inbox)||
    !['instagram','tiktok'].includes(provider)||config.provider!==provider||
    !Array.isArray(config.administrators)||!config.administrators.length||!config.administrators.every(id=>uuid.test(id))||
    env.SUPABASE_URL!=='https://supabase.finfolk.com.au'||!env.SUPABASE_PUBLISHABLE_KEY||
    !env.SOCIAL_DB?.connectionString||
    !/^[a-f0-9]{64}$/i.test(env.NATIVE_SOCIAL_REPLY_KEY||'')||!env.NATIVE_SOCIAL_QUEUE?.send)
    throw Error('Native social configuration is incomplete');
  if(provider==='instagram'&&(config.accountId!=='17841461601419539'||config.appId!=='1667613151655339'||
    config.pageId!=='1387107281155901'||!/^v\d+\.\d+$/.test(config.graphVersion)||
    !env.INSTAGRAM_MESSAGING_META_APP_SECRET||!env.INSTAGRAM_MESSAGING_VERIFY_TOKEN))
    throw Error('Instagram configuration is incomplete');
  if(provider==='tiktok'&&(config.appId!=='7703991919769632789'||typeof config.accountId!=='string'||
    !config.accountId||config.accountId.length>500||!env.TIKTOK_MESSAGING_APP_SECRET||!config.accountAuthorizationURL))
    throw Error('TikTok Business Messaging configuration is incomplete');
  encryptionKey(env);
  return config;
}

export function createNativeSocialWorker({openDatabase=database,fetcher=fetch,provider='instagram'}={}) {
  if(!['instagram','tiktok'].includes(provider))throw Error('Unsupported native social provider');
  const memberPrefix='/v1/me/'+provider,connectionPrefix='/v1/messaging/connections/finfolk-'+provider+'/';
  const redirectURI='https://api.finfolk.com.au/v1/integrations/'+provider+'/oauth/callback';
  const callbackPath=new URL(redirectURI).pathname,webhookPath='/'+provider+'/webhook';
  async function withRuntime(env,run) {
    const config=socialWorkerConfiguration(env,provider),db=openDatabase(env.SOCIAL_DB.connectionString);
    try {
      const runtime=await createSocialRuntime({db,application:config.application,inbox:config.inbox,provider:config.provider,
        cryptoKey:new Uint8Array(Buffer.from(env.NATIVE_SOCIAL_REPLY_KEY,'hex'))});
      if(runtime.scope.accountId!==config.accountId||runtime.scope.capability==='tiktok-comments')throw Error('Native inbox account mismatch');
      const authorization=createMessagingAuthorizationStore({db,application:config.application,account:config.inbox,encryptionEnv:env});
      const wake=()=>env.NATIVE_SOCIAL_QUEUE.send({kind:'native-social',inbox:config.inbox});
      const adapter=provider==='tiktok'?createSocialTikTokAdapter({runtime,clientKey:config.appId,
        appSecret:env.TIKTOK_MESSAGING_APP_SECRET,fetcher,wake,
        loadAccessToken:options=>socialTikTokAccessToken({authorization,...config,...options}),
        verifyIdentity:socialTikTokIdentity({authorization,...config,fetcher})}):createSocialInstagramAdapter({runtime,appSecret:env.INSTAGRAM_MESSAGING_META_APP_SECRET,
        verifyToken:env.INSTAGRAM_MESSAGING_VERIFY_TOKEN,loadProvider:socialInstagramProvider({...config,authorization,fetcher}),
        wake});
      const providerAuthorization=provider==='tiktok'?createTikTokMessagingAuthorization({...config,
        appSecret:env.TIKTOK_MESSAGING_APP_SECRET,callbackURL:'https://api.finfolk.com.au'+webhookPath,
        oauthRedirectURI:redirectURI,fetcher}):createInstagramMessagingAuthorization({...config,authMethod:'instagram-facebook',
        clientSecret:env.INSTAGRAM_MESSAGING_META_APP_SECRET,redirectURI,expectedUsername:'finfolk.com.au'},fetcher);
      const oauth=createMessagingOAuth({db,application:config.application,account:config.inbox,provider,providerAuthorization,
        authorizationStore:authorization,redirectURI,returnURL:'https://finfolk.com.au/admin/'+provider,
        configurationFingerprint:createHash('sha256').update(JSON.stringify([config,provider==='tiktok'?env.TIKTOK_MESSAGING_APP_SECRET:env.INSTAGRAM_MESSAGING_META_APP_SECRET])).digest('hex'),
        subscribeOnAuthorization:true,reportFailure:failure=>console.error(JSON.stringify({service:'finfolk-native-social',operation:'oauth',...failure}))});
      return await run({runtime,adapter,config,db,authorization,oauth,providerAuthorization});
    } finally {await db.pool.end();}
  }
  async function drain(env) {
    return withRuntime(env,async({runtime,adapter,authorization,providerAuthorization,config,db})=>{
      if(provider==='tiktok'){
        const current=await authorization.connection();
        if(current.mode!=='disabled'&&current.expiresAt&&Date.parse(current.expiresAt)<=Date.now()+600000){
          const renewed=await authorization.refresh({exchange:credential=>providerAuthorization.refresh(credential),
            verify:credential=>providerAuthorization.verify(credential)});
          if(renewed.status!=='refreshed')return;
        }
      }
      // Bounded work per invocation; committed cursors resume on the next tick.
      for(let i=0;i<10;i++)if(!(await runtime.reconcile()).more)break;
      for(let i=0;i<25;i++)if(!await runtime.processNext())break;
      for(let i=0;i<25;i++)if(!await runtime.performNextAction(adapter))break;
      for(let i=0;i<25;i++)if(!await runtime.deliverNext(adapter))break;
      await runtime.cleanup();
      if(provider==='instagram'&&env.PAGE_INSTAGRAM_ENABLED==='true'){try{await createPageInstagram({db,config,env,fetcher}).collect();}catch{console.error('Page Instagram collection unavailable');}}
    });
  }
  return {
    async fetch(request,env) {
      const path=new URL(request.url).pathname;
      const member=[memberPrefix,memberPrefix+'/connect',memberPrefix+'/disconnect',...(provider==='instagram'?[memberPrefix+'/claim']:[])].includes(path);
      const operator=path.startsWith(connectionPrefix)||path===callbackPath;
      if(!member&&!operator&&![webhookPath,'/v1/messaging/webhooks/finfolk-'+provider].includes(path))return new Response('',{status:404});
      const authenticate=request=>verifiedIdentity({supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY},request.headers.get('Authorization'));
      try {return await withRuntime(env,({runtime,adapter,config,db,authorization,oauth})=>operator?createSocialOperatorHTTP({db,config,authorization,oauth,authenticate,
        allowedOrigins:['https://finfolk.com.au','https://www.finfolk.com.au'],administrators:config.administrators,
        pageInstagram:provider==='instagram'&&env.PAGE_INSTAGRAM_ENABLED==='true'?createPageInstagram({db,config,env,fetcher}):null})(request):member?createSocialMemberHTTP({runtime,adapter,authenticate,provider,
        allowedOrigins:['https://finfolk.com.au','https://www.finfolk.com.au'],
        trustedIP:request=>request.headers.get('CF-Connecting-IP'),
      })(request):adapter.webhook(request));}
      catch {return Response.json({error:'Native social unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
    },
    async queue(batch,env) {
      const config=socialWorkerConfiguration(env,provider);
      const selected=batch.messages.filter(message=>message.body?.kind==='native-social'&&message.body.inbox===config.inbox);
      // Unknown payloads are rejected, rather than interpreted as legacy work.
      for(const message of batch.messages)if(!selected.includes(message))message.ack();
      if(!selected.length)return;
      try {await drain(env);for(const message of selected)message.ack();}
      catch {for(const message of selected)message.retry({delaySeconds:60});}
    },
    async scheduled(_controller,env) {await drain(env);},
  };
}
export default createNativeSocialWorker();
