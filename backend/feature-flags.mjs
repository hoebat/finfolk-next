import {timingSafeEqual} from 'node:crypto';
import contract from '../resources/finfolkdb/feature-flags.json' with {type:'json'};
import {verifiedIdentity} from '../js/finfolk-next/packages/edge/supabase-auth.js';
export const flagDefinitions=contract.definitions;
const ids=new Set(flagDefinitions.map(f=>f.id));
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const problem=(status,code,message)=>Object.assign(Error(message),{status,code});
export const localFlags=env=>env.FINFOLK_FEATURE_ENVIRONMENT==='development'&&env.FINFOLK_FEATURE_FLAGS_DEFAULT==='everyone';
export function validateFlagUpdate(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!contract.update.required.includes(k))||!ids.has(value.id)||!contract.modes.includes(value.mode)||!Number.isInteger(value.revision)||value.revision<0||value.revision>2147483646||!Array.isArray(value.testers)||value.testers.length>1000||value.testers.some(id=>typeof id!=='string'||!uuid.test(id)))throw problem(400,'invalid_flag','Invalid flag settings.');
 const testers=value.testers.map(id=>id.toLowerCase());if(new Set(testers).size!==testers.length)throw problem(400,'invalid_flag','Duplicate tester member IDs.');
 return {...value,testers:testers.sort()};
}
export function evaluateFlags(rows,actor=null){
 const flags=Object.fromEntries(flagDefinitions.map(f=>[f.id,false]));let revision=0;
 for(const row of rows){if(!ids.has(row.id))continue;revision+=Number(row.revision)||0;flags[row.id]=row.mode==='everyone'||row.mode==='testers'&&!!actor&&(row.testers||[]).includes(actor.toLowerCase());}
 return {flags,revision};
}
export function createFlagStore(db){
 return {
  rows:()=>db.query('SELECT id,mode,testers,revision,updated_at,updated_by FROM finfolk_flags.flags ORDER BY id'),
  async snapshot(){return {definitions:flagDefinitions,flags:await this.rows(),history:await db.query('SELECT flag_id,revision,previous,current,changed_at,changed_by FROM finfolk_flags.history ORDER BY id DESC LIMIT 100')};},
  async save(input,operator='app.manage'){
   const v=validateFlagUpdate(input);
   return db.transaction(async q=>{
    const previous=(await q('SELECT * FROM finfolk_flags.flags WHERE id=$1 FOR UPDATE',[v.id]))[0];
    if(!previous||previous.revision!==v.revision)throw problem(409,'flag_conflict','Flag changed. Refresh before saving.');
    const current=(await q('UPDATE finfolk_flags.flags SET mode=$2,testers=$3::uuid[],revision=revision+1,updated_at=now(),updated_by=$4 WHERE id=$1 RETURNING *',[v.id,v.mode,v.testers,operator]))[0];
    await q('INSERT INTO finfolk_flags.history(flag_id,revision,previous,current,changed_by) VALUES($1,$2,$3::jsonb,$4::jsonb,$5)',[v.id,current.revision,JSON.stringify(previous),JSON.stringify(current),operator]);
    return current;
   });
  }
 };
}
export async function flagActor(request,env,verify){
 const auth=request.headers.get('Authorization');if(!auth?.startsWith('Bearer '))return null;
 try{
  const identity=env.SUPABASE_URL&&env.SUPABASE_PUBLISHABLE_KEY?await verifiedIdentity({supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY},auth):await verify(auth.slice(7));
  const id=identity.id||identity.sub;return typeof id==='string'&&uuid.test(id)?id.toLowerCase():null;
 }catch{return null;}
}
// Central path mapping also covers routes registered by private API modules.
export function flagForPath(path){
 if(/^\/shop(?:\/|$)/.test(path)||/^\/v1\/(?:me|admin)\/finnies(?:\/|$)/.test(path))return 'shop';
 if(/^\/v1\/(?:me\/|admin\/)?events(?:\/|$)/.test(path))return 'events';
 const practice=/^\/v1\/practice\/(progress|breathing|watch-imports|breath-check)(?:\/|$)/.exec(path);
 return practice?'practice.'+practice[1]:null;
}
export function nativeOperationFlag(operation){return /^(publicEvent|event)/.test(operation)?'events':null;}
export function registerFeatureFlags(app,{db,verify,previewFeatureFlags=null}){
 const store=createFlagStore(db);
 const settings=async(env,actor)=>previewFeatureFlags?previewFeatureFlags():localFlags(env)?{flags:Object.fromEntries(flagDefinitions.map(f=>[f.id,true])),revision:0}:evaluateFlags(await store.rows(),actor);
 const requestSettings=async(request,env)=>settings(env,localFlags(env)?null:await flagActor(request,env,verify));
 const management=c=>{
  const expected=c.env?.FINFOLK_FLAG_MANAGEMENT_TOKEN,auth=c.req.header('Authorization')||'',actual=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(typeof expected!=='string'||expected.length<32||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))throw problem(401,'flag_credentials','Flag management credentials required.');
 };
 app.use('*',async(c,next)=>{
  const flag=flagForPath(c.req.path);if(!flag)return next();
  let enabled=false;
  try{enabled=(await requestSettings(c.req.raw,c.env||{})).flags[flag]===true;}catch{}
  if(!enabled)return c.json({error:'Feature unavailable.',code:'feature_disabled'},403);
  return next();
 });
 app.get('/v1/features',async c=>{
  let result;try{result=await requestSettings(c.req.raw,c.env||{});}catch{result={...evaluateFlags([]),...(previewFeatureFlags?{preview:true}:{})};}
  c.header('Cache-Control','private, no-store');return c.json(result);
 });
 app.get('/v1/admin/feature-flags',async c=>{management(c);return c.json({environment:c.env?.FINFOLK_FEATURE_ENVIRONMENT||'production',...await store.snapshot()});});
 app.post('/v1/admin/feature-flags',async c=>{
  management(c);const raw=await c.req.text();if(raw.length>65536)throw problem(413,'flag_size','Request too large.');
  let value;try{value=JSON.parse(raw);}catch{throw problem(400,'invalid_flag','Invalid flag settings.');}
  return c.json(await store.save(value,c.env?.FINFOLK_FLAG_OPERATOR||'app.manage'));
 });
 return {store,async assertNative(operation,request,env){
  const flag=nativeOperationFlag(operation);if(!flag)return;
  let enabled=false;try{enabled=(await requestSettings(request,env)).flags[flag]===true;}catch{}
  if(!enabled)throw problem(403,'feature_disabled','Feature unavailable.');
 }};
}
