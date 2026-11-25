import {Hono} from 'hono';
import {database} from './db.mjs';
import {registerFeatureFlags} from './feature-flags.mjs';
import {createNativeAccount,nativeAccountSites} from './native-account.mjs';
import {publicPage} from './public-pages.mjs';
import {createNativeRPC} from './native-rpc.mjs';
import catalog from '../resources/finfolkdb/entity-catalog.json' with {type:'json'};

const origins=new Set(['https://finfolk.com.au','https://www.finfolk.com.au','https://old.finfolk.com.au']);
export function createSupabaseWorker({openDatabase=database}={}) {
 return {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const reviewedPreview=origin===env.FINFOLK_PREVIEW_ORIGIN&&/^https:\/\/[a-f0-9]{24}--finfolk\.netlify\.app$/.test(origin||'');
  if(origin&&!origins.has(origin)&&!reviewedPreview)return Response.json({error:'Origin not allowed'},{status:403});
  const headers={'Cache-Control':'private, no-store',Vary:'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(['GET','HEAD'].includes(request.method)){
   const publication=publicPage(new URL(request.url).pathname);
   if(publication)return new Response(request.method==='HEAD'?null:publication.body,{status:publication.status,headers:new Headers([...publication.headers,...new Headers(headers)])});
  }
  let db;
  try{
   if(env.ENVIRONMENT!=='production'||env.SUPABASE_URL!=='https://supabase.finfolk.com.au'||
      !env.SUPABASE_PUBLISHABLE_KEY||!env.SUPABASE_DB?.connectionString||!/^[a-f0-9]{64}$/.test(env.NATIVE_SCHEMA_SHA||''))
    throw Error('Native backend configuration is incomplete');
   db=openDatabase(env.SUPABASE_DB.connectionString);
   const check=(await db.query(`SELECT current_database() AS database,
    (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finfolk' AND c.relkind IN ('r','p')) AS tables,
    EXISTS(SELECT 1 FROM finfolk."DatabaseRelease" WHERE key=$1 AND manifest->>'schema_sha'=$1) AS installed`,[env.NATIVE_SCHEMA_SHA]))[0];
   if(check?.database!=='postgres'||check.tables!==Object.keys(catalog).length||check.installed!==true)
    throw Error('Native database release mismatch');
   const app=new Hono();
   app.use('*',async(c,next)=>{for(const [key,value]of Object.entries(headers))c.header(key,value);await next();});
   const flags=registerFeatureFlags(app,{db,verify:async()=>{throw Error('Supabase identity required');}});
   app.get('/health',c=>c.json({ready:true,service:'FinFolk API',databaseProvider:'supabase',schemaSha:env.NATIVE_SCHEMA_SHA}));
   app.get('/v1/native/sites/catalog',c=>nativeAccountSites(db.query));
   // Stable public URLs also serve the map's initial, anonymous bootstrap.
   // Both routes use the same native Clojure functions as the account client.
   app.get('/v1/sites/catalog',async c=>c.json(await createNativeRPC(db.query)('native_public_site_catalog',[])));
   app.get('/v1/discover/popular',async c=>c.json(await createNativeRPC(db.query)('native_public_popular',[])));
   app.all('/v1/native/account',c=>createNativeAccount({
    assertFeature:(operation,request)=>flags.assertNative(operation,request,env),
    query:db.query,transaction:db.transaction,supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey:env.SUPABASE_SERVICE_ROLE_KEY,
   })(c.req.raw));
   app.notFound(c=>c.json({error:'This API operation is not available on the native backend.',code:'native_operation_unavailable'},501));
   app.onError((error,c)=>{console.error(JSON.stringify({service:'finfolk-supabase',code:error.code||'request_failed'}));return c.json({error:'Service unavailable. Please retry.'},503);});
   return await app.fetch(request,env);
  }catch(error){
   console.error(JSON.stringify({service:'finfolk-supabase',code:error.code||'database_unavailable'}));
   return Response.json({error:'Supabase backend unavailable.'},{status:503,headers});
  }finally{if(db)await db.pool.end();}
 }};
}
export default createSupabaseWorker();
