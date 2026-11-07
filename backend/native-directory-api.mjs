// Isolated native-directory candidate API. This does not replace the serving API.
import {Hono} from 'hono';
import {registerDirectoryPublic,registerDirectoryPrivate} from './directory.mjs';
export function createNativeDirectoryAPI({db,verify,releaseId,origins=[]}){
 if(!/^[a-f0-9]{64}$/.test(releaseId||''))throw Error('Pin the expected native DatabaseRelease before creating the directory API.');
 const nativeDb={transaction:work=>db.transaction(async query=>{
  let release;
  try{release=(await query('SELECT EXISTS(SELECT 1 FROM finfolk."DatabaseRelease" WHERE id=$1) AS matched',[releaseId]))[0]?.matched;}
  catch(error){if(error.code!=='42P01')throw error;}
  if(!release)throw Object.assign(Error('The native directory release is not ready.'),{status:503});
  return work(query);
 })};
 const app=new Hono();
 app.onError((error,c)=>c.json({error:error.status?error.message:'Directory request failed.'},error.status||500));
 app.use('*',async(c,next)=>{
  const origin=c.req.header('Origin');
  if(origin&&!origins.includes(origin))return c.json({error:'Origin not allowed.'},403);
  if(origin)c.header('Access-Control-Allow-Origin',origin);
  c.header('Vary','Origin');c.header('Cache-Control','private, no-store');
  c.header('Access-Control-Allow-Headers','Authorization, Content-Type');c.header('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  if(c.req.method==='OPTIONS')return c.body(null,204);
  await next();
 });
 registerDirectoryPublic(app,{db:nativeDb});
 app.use('/v1/*',async(c,next)=>{
  const token=c.req.header('Authorization');let claims;
  try{if(!token?.startsWith('Bearer '))throw Error();claims=await verify(token.slice(7));if(typeof claims?.sub!=='string'||!claims.sub)throw Error();}
  catch{return c.json({error:'Sign in to continue.'},401);}
  // The database rechecks verified/banned/deleted state for each operation.
  c.set('messagingIdentity',{uid:claims.sub,verified:true});await next();
 });
 registerDirectoryPrivate(app,{db:nativeDb,fetcher:async()=>{throw Object.assign(Error('Discovery is not enabled on this native candidate.'),{status:503});}});
 return app;
}
