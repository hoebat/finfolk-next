import {createMessagingGateway} from './messaging-gateway.mjs';
import {createFinFolkMessagingHandler,createFinFolkMessagingIdentityPolicy} from './messaging-handlers.mjs';

const rows=result=>Array.isArray(result)?result:result.rows;
// JWT verification is supplied by the managed issuer verifier. Membership and
// operator authority are checked again against current database/configuration.
export function createMessagingAccessPolicy({db,verify,applications}){
 const permissions=new Map(applications.map(app=>[app.id,new Set(app.administrators)]));
 async function allowed(id,scope){
  const admins=permissions.get(scope.application);
  if(!admins||scope.action==='admin'&&!admins.has(id))return false;
  const result=await db.query(`SELECT u.id FROM finfolk."User" u JOIN neon_auth."user" a ON a.id::text=u.id
   WHERE u.id=$1 AND NOT u.deleted AND coalesce(a.banned,false)=false AND a."emailVerified"=true`,[id]);
  return rows(result).length===1;
 }
 return {
  async authorize(request,scope){
   const header=request.headers.get('Authorization')||'';
   if(!header.startsWith('Bearer ')||header.length>16384)return null;
   let claims;try{claims=await verify(header.slice(7));}catch{return null;}
   if(typeof claims.sub!=='string'||!claims.sub||claims.sub.length>500||!await allowed(claims.sub,scope))return null;
   return {id:claims.sub};
  },
  authorizeCallback:(id,scope)=>allowed(id,{...scope,action:'admin'}),
 };
}

// Trusted deployment JSON contains mappings, never tokens or executable handlers.
// Provider secrets are referenced by environment variable name.
export function messagingWorkerConfiguration(env){
 if(env.ENTITY_MESSAGING_ENABLED!=='true')throw Error('Entity messaging is disabled.');
 if(!env.ENTITY_MESSAGING_DATABASE_NAME||!env.ENTITY_MESSAGING_HYPERDRIVE?.connectionString||
    !env.ENTITY_MESSAGING_AUTH_BASE_URL||!env.ENTITY_MESSAGING_AUTH_JWKS_URL)throw Error('Entity messaging configuration is incomplete.');
 const parsed=JSON.parse(env.ENTITY_MESSAGING_CONFIG||'null');
 if(!parsed||!Array.isArray(parsed.apps)||!Array.isArray(parsed.connections)||!Array.isArray(parsed.applications)||!Array.isArray(parsed.allowedOrigins))throw Error('Invalid entity messaging configuration.');
 const applicationIds=new Set();
 for(const app of parsed.applications){
  if(!app?.id||applicationIds.has(app.id)||!Array.isArray(app.administrators)||!app.administrators.length||!app.administrators.every(id=>typeof id==='string'&&id))throw Error('Explicit messaging application operators are required.');
  applicationIds.add(app.id);
 }
 const apps=parsed.apps.map(app=>{
  if(Object.hasOwn(app,'appSecret')||Object.hasOwn(app,'verifyToken')||typeof app.secretEnv!=='string'||!env[app.secretEnv]||
     app.provider==='instagram'&&(typeof app.verifyTokenEnv!=='string'||!env[app.verifyTokenEnv]))throw Error('Provider secrets must use configured environment bindings.');
  return {...app,appSecret:env[app.secretEnv],verifyToken:env[app.verifyTokenEnv]};
 });
 if(parsed.connections.some(connection=>!applicationIds.has(connection.application)||connection.handler!=='finfolk'))throw Error('Connection application or handler is not registered.');
 for(const name of ['ENTITY_MESSAGING_AUTH_BASE_URL','ENTITY_MESSAGING_AUTH_JWKS_URL'])if(new URL(env[name]).protocol!=='https:')throw Error('Managed messaging authentication requires HTTPS.');
 return {...parsed,apps,expectedDatabase:env.ENTITY_MESSAGING_DATABASE_NAME,apiOrigin:env.ENTITY_MESSAGING_API_ORIGIN||'https://api.finfolk.com.au'};
}

export function createWorkerMessaging({db,env,verify,fetcher=fetch}){
 const config=messagingWorkerConfiguration(env);
 const policy=createMessagingAccessPolicy({db,verify,applications:config.applications});
 // Public commands are the initial FinFolk registration. Personal commands must
 // be explicitly registered with the native domain model and eligibility policy.
 const handler=createFinFolkMessagingHandler({authorizePersonal:createFinFolkMessagingIdentityPolicy({db})});
 return createMessagingGateway({db,enabled:true,expectedDatabase:config.expectedDatabase,apiOrigin:config.apiOrigin,
  apps:config.apps,connections:config.connections,handlers:{finfolk:handler},...policy,
  allowedOrigins:config.allowedOrigins,encryptionEnv:env,fetcher,
  wake:async connectionKey=>{
   if(!env.ENTITY_MESSAGING_QUEUE?.send)throw Error('Messaging queue is not configured.');
   await env.ENTITY_MESSAGING_QUEUE.send({kind:'entity-messaging',connectionKey});
  }});
}

export function assertMessagingDrain(results){
 if(results.some(result=>result.status==='unavailable'||result.status==='refreshing'))throw Error('Messaging work needs recovery.');
 return results;
}
