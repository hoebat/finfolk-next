import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export const sha256=body=>createHash('sha256').update(body).digest('hex');
export function referenceUUID(key){
 const h=sha256('finfolk-site:'+key);
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
// Import the reviewed site's location index only. Raster/reference assets keep
// their existing immutable serving origin; no legacy application data is copied.
export function prepareNativeSites(bytes){
 const catalog=JSON.parse(bytes),seen=new Set();
 if(!Array.isArray(catalog.beaches)||!catalog.beaches.length)throw Error('A sourced site index is required');
 const zones={VIC:'Australia/Melbourne',NSW:'Australia/Sydney',JBT:'Australia/Sydney',QLD:'Australia/Brisbane',SA:'Australia/Adelaide',WA:'Australia/Perth',NT:'Australia/Darwin',TAS:'Australia/Hobart',ACT:'Australia/Sydney',EXT:'Australia/Sydney'};
 return catalog.beaches.map(site=>{
  if(typeof site.id!=='string'||!site.id||seen.has(site.id)||typeof site.name!=='string'||!site.name||!zones[site.state_id]||
     !Array.isArray(site.point)||site.point.length!==2||!site.point.every(Number.isFinite)||Math.abs(site.point[0])>180||Math.abs(site.point[1])>90)
   throw Error('Invalid or duplicate sourced site');
  const source=new URL(site.source_url);if(source.protocol!=='https:'||source.username||source.password)throw Error('An HTTPS source is required');
  seen.add(site.id);const timezone=site.timezone||zones[site.state_id];new Intl.DateTimeFormat('en',{timeZone:timezone}).format();
  return {id:referenceUUID(site.id),key:site.id,name:site.name,timezone,area_name:site.area_name||'',state:site.state_id};
 }).sort((a,b)=>a.key.localeCompare(b.key));
}
export function prepareNativeSiteProfiles(bytes,details=new Map()){
 const catalog=JSON.parse(bytes),sites=prepareNativeSites(bytes),sources=new Map((catalog.sources||[]).map(source=>[source.id,source]));
 const originals=new Map(catalog.beaches.map(site=>[site.id,site]));
 return sites.map(site=>{
  const original={...originals.get(site.key),...(details.get(site.key)||{})},source=sources.get(original.source_id)||{};
  const waterbody=['ocean','lake','river','quarry','sinkhole','pool','unknown'].includes(original.waterbody)?original.waterbody:'unknown';
  const access=['shore','boat_only','shore_or_boat','unknown'].includes(original.access_mode)?original.access_mode:'unknown';
  return {site_id:site.id,revision:1,waterbody,access_mode:access,status:'published',payload:{...original,timezone:site.timezone,waterbody,access_mode:access,attribution:original.attribution||source.attribution||'',licence:original.licence||source.licence||''}};
 });
}
export async function nativeSchemaFingerprint(root){
 const hash=createHash('sha256');
 for(const name of ['entity-schema.sql','entity-catalog.json','rpc-catalog.json','rebuild.sql','account-grants.sql','feature-flags.sql','feature-flags.json']){
  const bytes=await readFile(new URL('resources/finfolkdb/'+name,root));hash.update(name+':'+bytes.length+':');hash.update(bytes);
 }
 return hash.digest('hex');
}
