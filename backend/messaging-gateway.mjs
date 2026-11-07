import {createHash} from 'node:crypto';
import {createMessagingDatabase} from './messaging-database.mjs';
import {createMessagingAuthorizationStore,MessagingAuthorizationChanged} from './messaging-authorization-store.mjs';
import {createMessagingOAuth} from './messaging-oauth.mjs';
import {createInstagramMessagingTransport,verifyInstagramMessagingSignature} from './messaging-instagram-transport.mjs';
import {createTikTokMessagingTransport,verifyTikTokMessagingSignature} from './messaging-tiktok-transport.mjs';
import {createInstagramMessagingAuthorization} from './messaging-instagram-authorization.mjs';
import {createTikTokMessagingAuthorization} from './messaging-tiktok-authorization.mjs';
import {InstagramProvider} from './instagram-provider.mjs';
import {readLimited} from './messaging-http.mjs';

const keyPattern=/^[a-z0-9][a-z0-9_-]{0,63}$/;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...headers}});
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const hash=value=>createHash('sha256').update(value).digest('hex');

// Explicitly opt-in. Configuration, handler functions and authorization policies
// are trusted server inputs. Request payloads cannot register handlers/accounts.
export function createMessagingGateway({db,enabled=false,expectedDatabase,apiOrigin='https://api.finfolk.com.au',
 apps=[],connections=[],handlers={},authorize=async()=>null,authorizeCallback=async()=>false,
 allowedOrigins=[],encryptionEnv={},fetcher=fetch,wake=async()=>{},notify=async()=>{}}){
 const origin=new URL(apiOrigin).origin;
 if(new URL(apiOrigin).protocol!=='https:'||!expectedDatabase||!db?.query||!db?.transaction)throw Error('An explicitly configured entity database gateway is required.');
 const allowed=new Set(allowedOrigins);
 for(const value of allowed){const parsed=new URL(value);if(parsed.origin!==value||parsed.protocol!=='https:')throw Error('Explicit HTTPS browser origins are required.');}
 const appMap=new Map(),registry=new Map(),scopes=new Set(),targets=new Set();
 for(const app of apps){
  if(!keyPattern.test(app.key)||appMap.has(app.key)||!['instagram','tiktok'].includes(app.provider)||!app.appId||!app.appSecret||
     [...appMap.values()].some(existing=>existing.provider===app.provider&&existing.appId===app.appId))throw Error('Ambiguous provider application configuration.');
  appMap.set(app.key,{...app,connections:[]});
 }
 async function call(name,args){
  const result=await db.query(`SELECT finfolk_rpc.${name}(${args.map((_,i)=>'$'+(i+1))}) AS value`,args);
  return (Array.isArray(result)?result:result.rows)[0].value;
 }
 for(const config of connections){
  const app=appMap.get(config.providerApp),provider=config.provider||app?.provider;
  const scope=JSON.stringify([config.application,config.account]),target=JSON.stringify([config.providerApp,config.accountId]);
  if(!keyPattern.test(config.key)||registry.has(config.key)||!config.application||!config.account||!config.accountId||
     !['instagram','tiktok','app'].includes(provider)||provider!=='app'&&(!app||app.provider!==provider)||
     scopes.has(scope)||provider!=='app'&&targets.has(target)||!Object.hasOwn(handlers,config.handler)||typeof handlers[config.handler]!=='function')throw Error('Invalid or ambiguous messaging connection/handler.');
  scopes.add(scope);targets.add(target);
  const runtime=createMessagingDatabase({db,application:config.application,account:config.account});
  const authorization=createMessagingAuthorizationStore({db,application:config.application,account:config.account,encryptionEnv});
  const external=provider!=='app',callbackURL=external?origin+'/v1/messaging/webhooks/'+app.key:null;
  const redirectURI=origin+'/v1/messaging/connections/'+config.key+'/oauth/callback';
  const base={...config,provider,app,runtime,authorization};
  let providerAuthorization,transport,oauth;
  if(provider==='instagram'){
   const providerConfig={authMethod:config.authMethod,appId:app.appId,clientSecret:app.appSecret,
    accountId:config.accountId,graphVersion:config.graphVersion,pageId:config.pageId,loginConfigId:config.loginConfigId,
    expectedUsername:config.expectedUsername,redirectURI};
   providerAuthorization=createInstagramMessagingAuthorization(providerConfig,fetcher);
   const sender={sendText:async(recipient,body,{generation}={})=>{
    let token;try{token=await authorization.accessToken({authMethod:config.authMethod,appId:app.appId,generation});}
    catch(error){throw Object.assign(error,{definiteRejection:true,retryAfter:60});}
    return new InstagramProvider({provider:config.authMethod,appId:app.appId,metaAppId:app.appId,
     clientSecret:app.appSecret,accountId:config.accountId,pageId:config.pageId,graphVersion:config.graphVersion,token},fetcher).sendText(recipient,body);
   }};
   transport=createInstagramMessagingTransport({messaging:runtime,accountId:config.accountId,appSecret:app.appSecret,
    verifyToken:app.verifyToken,replyWindowSeconds:config.replyWindowSeconds,provider:sender,wake:()=>wake(config.key)});
  }else if(provider==='tiktok'){
   providerAuthorization=createTikTokMessagingAuthorization({appId:app.appId,appSecret:app.appSecret,accountId:config.accountId,
    callbackURL,oauthRedirectURI:redirectURI,accountAuthorizationURL:config.accountAuthorizationURL,fetcher});
   transport=createTikTokMessagingTransport({messaging:runtime,accountId:config.accountId,clientKey:app.appId,appSecret:app.appSecret,
    loadAccessToken:options=>authorization.accessToken({...options,authMethod:'tiktok-business',appId:app.appId}),
    replyWindowSeconds:config.replyWindowSeconds??172800,fetcher,wake:()=>wake(config.key)});
  }else{
   transport={send:async message=>{try{await notify(config.key,message);}catch{/* Message history is already durable. */}
    return {status:'accepted',messageId:'app:'+message.idempotencyKey};}};
  }
  if(external){
   if(!allowed.has(new URL(config.returnURL).origin))throw Error('OAuth return origin must be explicitly allowed.');
   oauth=createMessagingOAuth({db,application:config.application,account:config.account,provider,providerAuthorization,
    authorizationStore:authorization,redirectURI,returnURL:config.returnURL,
    subscribeOnAuthorization:config.subscribeOnAuthorization===true,
    configurationFingerprint:hash(JSON.stringify([app.key,app.provider,app.appId,hash(app.appSecret),app.verifyToken?hash(app.verifyToken):null,config]))});
  }
  const connection={...base,providerAuthorization,transport,oauth};registry.set(config.key,connection);
  if(app)app.connections.push(connection);
 }
 async function ready(){
  if(!enabled)fail(503,'Entity messaging is disabled.');
  const result=await db.query(`SELECT current_database() AS database,
   to_regclass('finfolk."MessagingOauthState"') IS NOT NULL
   AND to_regprocedure('finfolk_rpc.receive_chat_message(text,text,text,text,text,integer)') IS NOT NULL
   AND to_regprocedure('finfolk_rpc.consume_messaging_oauth(text,text,text,text,text,text)') IS NOT NULL AS ready`);
  const row=(Array.isArray(result)?result:result.rows)[0];
  if(row?.database!==expectedDatabase||row.ready!==true)fail(503,'Entity messaging database is not ready.');
 }
 const scope=(connection,action)=>({key:connection.key,application:connection.application,account:connection.account,
  provider:connection.provider,accountId:connection.accountId,action});
 async function binding(connection){
  const current=await connection.authorization.connection();
  if(current.provider!==connection.provider||current.accountId!==connection.accountId)fail(503,'Messaging connection configuration changed.');
  return current;
 }
 async function actor(request,connection,action){
  const result=await authorize(request,scope(connection,action));
  if(!result||typeof result.id!=='string'||!result.id||result.id.length>500)fail(403,'Access is not available.');
  return result;
 }
 async function body(request,keys){
  let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readLimited(request,16384)));}
  catch(error){fail(error.status===413?413:400,'Invalid request.');}
  if(!object(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(400,'Invalid request fields.');return value;
 }
 function browserMutation(request){if(!allowed.has(request.headers.get('Origin')))fail(403,'Request origin is not allowed.');}
 async function appWebhook(request,app){
  if(request.method==='GET'){
   if(app.provider!=='instagram'||!app.connections.length)return new Response('',{status:405});
   return app.connections[0].transport.webhook(request);
  }
  if(request.method!=='POST')return new Response('',{status:405,headers:{Allow:app.provider==='instagram'?'GET, POST':'POST'}});
  let raw;try{raw=await readLimited(request,262144);}catch(error){return new Response('',{status:error.status===413?413:400});}
  const valid=app.provider==='instagram'?verifyInstagramMessagingSignature(raw,request.headers.get('x-hub-signature-256'),app.appSecret):
   verifyTikTokMessagingSignature(raw,request.headers.get('tiktok-signature'),app.appSecret);
  if(!valid)return new Response('',{status:403});
  let payload;try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}catch{return new Response('',{status:400});}
  if(!object(payload))return new Response('',{status:400});
  const ids=app.provider==='instagram'?new Set(Array.isArray(payload.entry)?payload.entry.map(entry=>entry?.id):[]):new Set(payload.client_key===app.appId?[payload.user_openid]:[]);
  const selected=app.connections.filter(connection=>ids.has(connection.accountId));
  // Configuration is the only mapping from signed external IDs to local scopes.
  for(const connection of selected){
   await binding(connection);
   const forwarded=new Request(request.url,{method:'POST',headers:request.headers,body:raw});
   const response=await connection.transport.webhook(forwarded);
   if(!response.ok)return response;
  }
  return new Response('Accepted');
 }
 return {
  async fetch(request){
   let connection;
   const requestOrigin=request.headers.get('Origin');
   const headers=allowed.has(requestOrigin)?{'Access-Control-Allow-Origin':requestOrigin,'Access-Control-Allow-Credentials':'true',Vary:'Origin'}:{};
   try{
    if(!enabled)fail(503,'Entity messaging is disabled.');const path=new URL(request.url).pathname;
    if(new URL(request.url).origin!==origin)fail(400,'Unexpected API origin.');
    const hook=path.match(/^\/v1\/messaging\/webhooks\/([a-z0-9_-]+)$/);
    if(hook){const app=appMap.get(hook[1]);if(!app)fail(404,'Not found.');if(request.method!=='GET')await ready();return await appWebhook(request,app);}
    await ready();
    const route=path.match(/^\/v1\/messaging\/connections\/([a-z0-9_-]+)\/(status|authorization|oauth\/callback|activation|pause|disconnect|messages)$/);
    if(!route||(connection=registry.get(route[1]))===undefined)fail(404,'Not found.');
    const action=route[2];
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key','Cache-Control':'no-store'}});
    if(action==='oauth/callback'){
     if(request.method!=='GET'||!connection.oauth)fail(405,'Method is not supported.');
     const completed=await connection.oauth.complete(request,(id,context)=>authorizeCallback(id,{...context,key:connection.key,provider:connection.provider}));
     return new Response(null,{status:303,headers:{Location:completed.returnURL,'Set-Cookie':completed.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
    }
    const user=await actor(request,connection,action==='messages'?'chat':'admin');
    const current=await binding(connection);
    if(action==='status'&&request.method==='GET')return json({connection:current},200,headers);
    if(action==='messages'){
     if(connection.provider!=='app')fail(400,'Use an application chat connection.');
     if(current.mode==='disabled')fail(503,'Chat is not enabled.');
     if(request.method==='GET'){
      const history=await call('ret_chat_history',[connection.application,connection.account,user.id]);
      return json({messages:history.map(message=>({id:message.id,direction:message.direction,body:message.body,sentAt:message.sent_at,createdAt:message.created_at}))},200,headers);
     }
     if(request.method!=='POST')fail(405,'Method is not supported.');browserMutation(request);
     const input=await body(request,['text']),idempotency=request.headers.get('Idempotency-Key');
     if(typeof input.text!=='string'||input.text.length>2000||!idempotency||idempotency.length>128)fail(400,'Text and an idempotency key are required.');
     const receipt=await call('receive_chat_message',[connection.application,connection.account,user.id,idempotency,input.text,connection.chatReplyWindowSeconds??86400]);
     if(!receipt.duplicate){try{await wake(connection.key);}catch{/* Reconciliation recovers a lost wakeup. */}}
     return json({receiptId:receipt.receipt.id,duplicate:receipt.duplicate},202,headers);
    }
    if(request.method!=='POST')fail(405,'Method is not supported.');browserMutation(request);
    if(action==='authorization'){
     if(!connection.oauth)fail(400,'App chat does not use provider OAuth.');await body(request,[]);
     const intent=await connection.oauth.begin(user.id);return json({authorizationURL:intent.authorizationURL,expiresAt:intent.expiresAt},200,{...headers,'Set-Cookie':intent.cookie});
    }
    const input=await body(request,action==='activation'?['generation','mode','senders']:['generation']);
    if(!Number.isInteger(input.generation)||input.generation<1)fail(400,'A current account generation is required.');
    if(action==='activation'&&(!['pilot','live'].includes(input.mode??'pilot')||!Array.isArray(input.senders??[])||!(input.senders??[]).every(value=>typeof value==='string'&&value.length>0&&value.length<=500)||(input.mode??'pilot')==='pilot'&&!(input.senders??[]).length))fail(400,'Invalid activation.');
    const result=action==='activation'?await connection.authorization.activate(input):action==='pause'?await connection.authorization.pause(input):
     action==='disconnect'?await connection.authorization.disconnect(input):null;
    if(!result)fail(404,'Not found.');return json(result,200,headers);
   }catch(error){
    const status=Number.isInteger(error.status)&&error.status>=400&&error.status<=599?error.status:
     error instanceof MessagingAuthorizationChanged?409:/Conflicting duplicate/.test(error.message||'')?409:503;
    return json({error:status===403?'Access is not available.':status===409?'The request conflicts with current state.':status===503?'Messaging is unavailable.':'Request could not be completed.'},status,
     {...headers,...(connection?.oauth&&new URL(request.url).pathname.endsWith('/oauth/callback')?{'Set-Cookie':connection.oauth.clearCookie()}:{})});
   }
  },
  // Server-only acceptance probe: no refresh, subscription creation, activation,
  // receive/process/send calls, or persistence of provider proof.
  async preflight({connectionKeys=[...registry.keys()],verifyProviders=false}={}){
   await ready();
   if(!Array.isArray(connectionKeys)||!connectionKeys.length||new Set(connectionKeys).size!==connectionKeys.length||
      connectionKeys.some(key=>!registry.has(key))||typeof verifyProviders!=='boolean')throw Error('Known, distinct connection keys are required.');
   const results=[];
   for(const key of connectionKeys){
    const connection=registry.get(key);
    try{
     const current=await binding(connection);
     const result={key,provider:connection.provider,mode:current.mode,generation:current.generation,
      checkedAt:new Date().toISOString(),status:connection.provider==='app'?'app_configured':'provider_unchecked'};
     if(connection.provider!=='app'&&verifyProviders){
      const authMethod=connection.provider==='tiktok'?'tiktok-business':connection.authMethod;
      const token=await connection.authorization.accessToken({generation:current.generation,appId:connection.app.appId,authMethod});
      const proof=await connection.providerAuthorization.verify({token,authMethod},{subscribe:false});
      if(proof?.authorized!==true||proof.subscribed!==true||proof.provider!==connection.provider||
         proof.appId!==connection.app.appId||proof.accountId!==connection.accountId)throw Error('Provider proof does not match.');
      const after=await binding(connection);
      if(after.generation!==current.generation||after.mode!==current.mode||after.expiresAt!==current.expiresAt)throw Error('Connection changed during verification.');
      if(proof.expiresAt&&(!Number.isFinite(Date.parse(proof.expiresAt))||Date.parse(proof.expiresAt)<=Date.now()))throw Error('Provider authorization has expired.');
      result.status='provider_verified';
     }
     results.push(result);
    }catch{results.push({key,provider:connection.provider,status:'unavailable'});}
   }
   return {liveDeliveryVerified:false,results};
  },
  async drain({connectionKeys=[...registry.keys()],maximum=10}={}){
   await ready();if(!Number.isInteger(maximum)||maximum<1||maximum>100)throw Error('Worker batch must be 1 to 100.');
   const results=[];
   for(const key of connectionKeys){
    const connection=registry.get(key);if(!connection)throw Error('Unknown configured messaging connection.');
    try{
     let current=await binding(connection);
     await connection.runtime.reconcile();
     if(current.mode==='disabled'){results.push({key,status:'disabled'});continue;}
     if(connection.provider!=='app'){
      if(current.checks.authorized!==true||current.checks.subscribed!==true||current.checks.appId!==connection.app.appId)throw Error('Authorization not ready.');
      const expiry=current.expiresAt?Date.parse(current.expiresAt):Infinity;
      const refreshable=connection.provider==='tiktok'||connection.authMethod==='instagram-login';
      if(expiry<=Date.now()+300000&&refreshable){
       const refreshed=await connection.authorization.refresh({exchange:connection.providerAuthorization.refresh,verify:connection.providerAuthorization.verify});
       if(refreshed.status==='busy'){results.push({key,status:'refreshing'});continue;}
       current=await binding(connection);
      }
      await connection.authorization.accessToken({generation:current.generation,appId:connection.app.appId,authMethod:current.checks.authMethod});
     }
     let processed=0,delivered=0;
     for(let i=0;i<maximum;i++){
      const result=await connection.runtime.processNext(context=>handlers[connection.handler]({...context,application:connection.application,account:connection.account,connectionKey:key}));
      if(result.status==='idle')break;processed++;
     }
     for(let i=0;i<maximum;i++){const result=await connection.runtime.deliverNext(connection.transport);if(result.status==='idle')break;delivered++;}
     results.push({key,status:'ready',processed,delivered});
    }catch{results.push({key,status:'unavailable'});}
   }
   return results;
  },
 };
}
