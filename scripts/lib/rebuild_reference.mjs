// Fresh native reference release. No migration runner and no live API side effects.
import {readFile,realpath,readdir,stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {siteDocument} from '../../backend/sites.mjs';
export function canonical(value){
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
export const digest=value=>createHash('sha256').update(value).digest('hex');
const id=value=>digest(value);
const uuid=value=>{const h=id(value);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
export async function safeFile(root,path){
 const base=await realpath(root),file=await realpath(resolve(base,path)),rel=relative(base,file);
 if(rel==='..'||rel.startsWith('..'+sep)||resolve(base,path)!==file)throw Error('Import path escapes root or uses a symlink: '+path);
 if(!(await stat(file)).isFile())throw Error('Expected regular file: '+path);
 return file;
}
export async function hashFile(root,path){
 const file=await safeFile(root,path),hash=createHash('sha256');let bytes=0,first=true;
 for await(const chunk of createReadStream(file)){
  if(first&&chunk.subarray(0,100).toString().startsWith('version https://git-lfs.github.com/spec/'))throw Error('Git LFS pointer is not acquired data: '+path);
  first=false;bytes+=chunk.length;hash.update(chunk);
 }
 return {path,bytes,sha256:hash.digest('hex')};
}
export function validateGeometry(g){
 const depths={Point:0,MultiPoint:1,LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3};
 if(!g||!(g.type in depths))throw Error('Unsupported or missing GeoJSON geometry');
 function visit(v,n){
  if(!Array.isArray(v)||!v.length)throw Error('Empty GeoJSON coordinates');
  if(n)return v.forEach(x=>visit(x,n-1));
  if(v.length<2||!v.every(Number.isFinite)||Math.abs(v[0])>180||Math.abs(v[1])>90)throw Error('Geometry must use finite WGS84 longitude/latitude coordinates');
 }
 visit(g.coordinates,depths[g.type]);return g;
}
async function geojson(root,descriptor){
 const bytes=await readFile(await safeFile(root,descriptor.path));
 if(digest(bytes)!==descriptor.sha256)throw Error('Source changed since manifest: '+descriptor.path);
 const data=JSON.parse(bytes);
 if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw Error('Expected GeoJSON FeatureCollection: '+descriptor.path);
 if(data.crs&&!/4326|CRS84/.test(canonical(data.crs)))throw Error('Non-WGS84 GeoJSON: '+descriptor.path);
 for(const f of data.features){if(f.type!=='Feature')throw Error('Expected GeoJSON Feature');validateGeometry(f.geometry);}
 if(descriptor.count!==undefined&&data.features.length!==descriptor.count)throw Error('Feature count mismatch: '+descriptor.path);
 return data.features;
}
const zones={VIC:'Australia/Melbourne',NSW:'Australia/Sydney',JBT:'Australia/Sydney',QLD:'Australia/Brisbane',SA:'Australia/Adelaide',WA:'Australia/Perth',NT:'Australia/Darwin',TAS:'Australia/Hobart',ACT:'Australia/Sydney'};
const zone=site=>site.timezone||(site.area_id?.includes('lord-howe')?'Australia/Lord_Howe':site.area_id?.includes('christmas')?'Indian/Christmas':site.area_id?.includes('cocos')?'Indian/Cocos':zones[site.state_id]||'Australia/Sydney');
const assetKind=p=>/\.geojson$/i.test(p)?'geojson':/\.(tif|tiff|bag)$/i.test(p)?'raster':/\.zip$/i.test(p)?'archive':/\.(json|xml|txt|html)$/i.test(p)?'document':'other';

async function implementation(){
 const files=['./rebuild_reference.mjs','../rebuild_database.mjs','../../backend/sites.mjs','../../js/finfolk-next/site/web-main/src/site-model.js'];
 return Object.fromEntries(await Promise.all(files.map(async path=>[path,digest(await readFile(new URL(path,import.meta.url)))])));
}
export async function prepareReferenceRelease({root=process.cwd(),siteRoot='.cache/next-site',assetUris={}}={}){
 root=await realpath(root);const inputs=new Map(),rows={},features=[],warnings=[];
 const add=(kind,row)=>{(rows[kind]??=[]).push(JSON.parse(JSON.stringify(row)));};
 async function pin(path,expected){
  let record=inputs.get(path);if(!record){record=await hashFile(root,path);inputs.set(path,record);}
  if(expected&&record.sha256!==expected)throw Error('Checksum mismatch: '+path);
  return record;
 }
 async function json(path){const p=await pin(path);const b=await readFile(await safeFile(root,path));if(digest(b)!==p.sha256)throw Error('Source changed while preparing: '+path);return JSON.parse(b);}
 async function asset(source,path,expected,metadata={}){
  const p=await pin(path,expected),uri=assetUris[path]||pathToFileURL(resolve(root,path)).href;
  if(!/^(https:|file:)/.test(uri))throw Error('Asset requires HTTPS or a local file URI: '+path);
  const key=id(source+':'+path+':'+p.sha256);
  if(!rows.DataAsset?.some(r=>r.id===key))add('DataAsset',{id:key,source_id:source,checksum:p.sha256,bytes:p.bytes,kind:assetKind(metadata.filename||path),uri,metadata:{path,...metadata}});
  return {...p,asset:key};
 }
 const inventory=await json('datasets/inventory.json');
 const sourceRecords=[];
 for(const name of (await readdir(resolve(root,'datasets/ocean/records'))).filter(n=>n.endsWith('.json')).sort())sourceRecords.push(await json('datasets/ocean/records/'+name));
 const evidenceByAsset=new Map();
 async function evidence(dir){
  for(const entry of (await readdir(resolve(root,dir),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
   const p=dir+'/'+entry.name;
   if(entry.isDirectory())await evidence(p);
   else if(entry.name.endsWith('.json')){const record=await json(p);if(record.asset_id){const records=evidenceByAsset.get(record.asset_id)||[];records.push({path:p,...record});evidenceByAsset.set(record.asset_id,records);}}
  }
 }
 await evidence('datasets/ocean/provenance');
 const sourceByPath=new Map();
 for(const source of sourceRecords){
  add('DataSource',{id:source.id,enabled:false,metadata:source});
  for(const a of source.observed?.assets||[]){await asset(source.id,a.path,a.sha256,{role:a.role});sourceByPath.set(a.path,source);}
  for(const acquisition of source.acquisitions||[]){
   const whole=createHash('sha256'),parts=[];let total=0;
   for(const [i,part]of (acquisition.parts||[]).entries()){
    const p=await asset(source.id,part.path,part.sha256,{acquisition:acquisition.id,part:i,filename:acquisition.filename,upstream_url:acquisition.url,numeric_validation:acquisition.numeric_validation||'pending'});
    parts.push(p.asset);
    if(p.bytes!==part.bytes)throw Error('Acquired part size mismatch: '+part.path);
    for await(const b of createReadStream(await safeFile(root,part.path)))whole.update(b);total+=p.bytes;
   }
   if(!acquisition.parts?.length||total!==acquisition.bytes||whole.digest('hex')!==acquisition.sha256)throw Error('Incomplete acquisition: '+acquisition.id);
   const inspections=evidenceByAsset.get(acquisition.id)||[];
   for(const inspection of inspections)if(inspection.sha256&&inspection.sha256!==acquisition.sha256)throw Error('Native inspection checksum mismatch: '+inspection.path);
   add('DepthDataset',{id:source.id+':native:'+acquisition.id,source_id:source.id,upstream_id:acquisition.id,version:acquisition.sha256,checksum:acquisition.sha256,status:'staged',metadata:{kind:'native_asset',acquisition,native_inspections:inspections,review:source.review,limitation:'Asset references imported; raster samples are not stored in GeoFeature.'}});
   for(const part of parts)add('DepthDatasetAsset',{dataset_id:source.id+':native:'+acquisition.id,asset_id:part});
  }
 }
 // Pin the acquisition state and validation evidence, including products still pending.
 await pin('datasets/ocean/acquisition-manifest.json');
 const catalog=await json(siteRoot+'/beaches.json'),areas=await json('config/areas.json'),examples=await json('config/site-examples.json');
 const sources=new Map((rows.DataSource||[]).map(r=>[r.id,r]));
 for(const s of [...catalog.sources,{id:'finfolk-geography',title:'FinFolk curated browsing regions',attribution:areas.note}]){
  if(!sources.has(s.id)){const row={id:s.id,enabled:false,metadata:s};add('DataSource',row);sources.set(s.id,row);}
 }
 const areaMap=new Map([...areas.areas,...catalog.areas].map(a=>[a.id,a]));
 for(const [key,value]of areaMap)add('GeoArea',{id:key,source_id:'finfolk-geography',metadata:{...value,boundary_kind:'curated_browsing_region',limitation:areas.note}});
 const details=new Map();
 for(const area of catalog.areas)if(area.detail_file){const doc=await json(siteRoot+'/'+area.detail_file);for(const site of doc.beaches||[])details.set(site.id,site);}
 const sites=new Map();
 for(const light of catalog.beaches){const s={...light,...details.get(light.id)};const entry=s.entry?.verified?{name:s.entry.label||'Documented entry',mode:'shore',point:s.entry.point,source_url:s.entry.source_url||s.source_url,verified:true}:null;
  const doc=siteDocument({...s,timezone:zone(s),access_mode:s.access_mode||(entry?'shore':'unknown'),access_points:s.access_points||(entry?[entry]:[]),features:s.features||['beach']});
  if(sites.has(doc.id))throw Error('Duplicate catalog site: '+doc.id);sites.set(doc.id,doc);
 }
 for(const raw of examples){const doc=siteDocument(raw);sites.set(doc.id,doc);}
 for(const doc of sites.values()){
  if(!sources.has(doc.source_id))throw Error('Unregistered site source: '+doc.source_id);
  if(!areaMap.has(doc.area_id))throw Error('Unregistered site area: '+doc.area_id);
  const revision=uuid('site-revision:'+doc.id);
  add('Beach',{id:doc.id,name:doc.name,timezone:doc.timezone,area_name:doc.area_name,state:doc.state_id});
  add('SiteLocation',{beach_id:doc.id,area_id:doc.area_id,source_id:doc.source_id,geometry:validateGeometry({type:'Point',coordinates:doc.point})});
  add('SiteProfile',{beach_id:doc.id,revision:1,waterbody:doc.waterbody,access_mode:doc.access_mode,status:'published',payload:doc});
  add('SiteRevision',{id:revision,site_id:doc.id,base_revision:0,version:1,status:'published',payload:doc,reason:'Initial sourced catalog import'});
  for(const [i,a]of doc.access_points.entries())add('SiteAccessPoint',{id:uuid('site-access:'+doc.id+':'+i),revision_id:revision,mode:a.mode,payload:a});
  for(const [i,d]of doc.depth_evidence.entries())add('SiteDepthEvidence',{id:uuid('site-depth:'+doc.id+':'+i),revision_id:revision,kind:d.kind,payload:d});
 }
 async function contours(source,key,meta,quality){
  const path='datasets/'+meta.file,observed=sourceByPath.get(path);
  if(!observed||observed.id!==source.id)throw Error('No reviewed physical asset observation for '+path);
  const physical=await pin(path);
  if(physical.sha256!==meta.sha256)warnings.push({path,kind:'inventory_hash_drift',inventory:meta.sha256,verified_observation:physical.sha256});
  const dataset=source.id+':'+key,descriptor={path,sha256:physical.sha256,dataset};
  const fs=await geojson(root,descriptor);descriptor.count=fs.length;
  if(meta.count!==undefined&&meta.count!==fs.length)warnings.push({path,kind:'inventory_count_drift',inventory:meta.count,verified_observation:fs.length});
  features.push(descriptor);
  add('DepthDatasetAsset',{dataset_id:dataset,asset_id:id(source.id+':'+path+':'+physical.sha256)});
  add('DepthDataset',{id:dataset,source_id:source.id,upstream_id:key,version:String(meta.source_revision||1),checksum:physical.sha256,status:'staged',metadata:{...meta,kind:'contours',quality,review:source.review,crs:'EPSG:4326',verified_feature_count:fs.length,physical_sha256:physical.sha256}});
  for(const doc of sites.values()){
   const bbox=meta.query_bbox,inside=Array.isArray(bbox)&&doc.point[0]>=bbox[0]&&doc.point[0]<=bbox[2]&&doc.point[1]>=bbox[1]&&doc.point[1]<=bbox[3];
   if(inside||meta.area_id===doc.area_id)add('SiteDepthDataset',{revision_id:uuid('site-revision:'+doc.id),dataset_id:dataset,relationship:'candidate',evidence:{basis:inside?'source_query_bbox':'curated_region',quality,datum:meta.datum||'unknown',limitation:'Discovery candidate only; not confirmed numeric depth coverage.'}});
  }
 }
 for(const [region,meta]of Object.entries(inventory.contours).sort()){
  const source=sourceByPath.get('datasets/'+meta.file);if(!source)throw Error('Unregistered contour source: '+region);
  await contours(source,'contours:'+region,meta,source.review?.quality||'unverified');
 }
 for(const [sourceId,product]of Object.entries(inventory.context_contours||{}).sort()){
  const source=sourceRecords.find(s=>s.id===sourceId);if(!source)throw Error('Unregistered context source: '+sourceId);
  const {areas:packages,...metadata}=product;
  for(const [area,meta]of Object.entries(packages).sort())await contours(source,'context:'+area,{...metadata,...meta,area_id:area},'context');
 }
 // Coastline and optional dissolved browse overlays remain geography, never depth datasets.
 const coastPath='resources/atlas/coastline.geojson';
 const coast=await asset('natural-earth',coastPath,undefined,{role:'coarse_coastal_context',limitation:'Natural Earth display coastline; not legal boundaries or entry points.'});
 if(!sources.has('natural-earth')){add('DataSource',{id:'natural-earth',enabled:false,metadata:{title:'Natural Earth coastline',source_url:'https://www.naturalearthdata.com/about/terms-of-use/',licence:'Public domain',attribution:'Natural Earth'}});}
 const coastDescriptor={path:coastPath,sha256:coast.sha256,asset:coast.asset,kind:'GeoBoundary'};
 coastDescriptor.count=(await geojson(root,coastDescriptor)).length;features.push(coastDescriptor);
 if(catalog.area_regions_file){
  const path=siteRoot+'/'+catalog.area_regions_file,source='finfolk-geography',collection=await json(path);
  const provenance=Object.fromEntries(Object.entries(collection).filter(([key])=>key!=='features'));
  const p=await asset(source,path,undefined,{...provenance,role:'discovery_overlay'});
  const descriptor={path,sha256:p.sha256,asset:p.asset,kind:'GeoBoundary',link_area:true};descriptor.count=(await geojson(root,descriptor)).length;features.push(descriptor);
 }
 const {beaches,revision,...metadata}=catalog;
 add('SiteCatalog',{id:1,revision:1,metadata});
 const schemaFiles=['entity-schema.sql','rebuild.sql','rebuild-contract.json','messaging-grants.sql','site-notes-grants.sql'];
 for(const file of schemaFiles)await pin('resources/finfolkdb/'+file);
 const counts=Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,v.length]));counts.GeoFeature=features.filter(f=>!f.kind).reduce((n,f)=>n+f.count,0);counts.GeoBoundary=features.filter(f=>f.kind==='GeoBoundary').reduce((n,f)=>n+f.count,0);
 const manifest={version:1,implementation:await implementation(),inputs:[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path)),rows,features,counts,warnings,asset_scope:Object.values(assetUris).length?'explicit_asset_uris':'local_files',unavailable_sources:sourceRecords.filter(s=>!(s.observed?.assets?.length||s.acquisitions?.length)).map(s=>({id:s.id,review:s.review}))};
 return {...manifest,id:digest(canonical(manifest))};
}
export async function verifyManifest(root,manifest){
 const {id,...body}=manifest;
 if(manifest.version!==1||id!==digest(canonical(body)))throw Error('Invalid release manifest checksum');
 if(canonical(manifest.implementation)!==canonical(await implementation()))throw Error('Importer implementation changed; prepare a new release manifest');
 for(const input of manifest.inputs){const actual=await hashFile(root,input.path);if(actual.sha256!==input.sha256||actual.bytes!==input.bytes)throw Error('Source changed since manifest: '+input.path);}
}
export async function* referenceBatches(root,manifest,size=100){
 // Preserve FK order explicitly; the Clojure contract is a map, not an ordering API.
 const order=['DataSource','GeoArea','DataAsset','DepthDataset','DepthDatasetAsset','GeoFeature','GeoBoundary','Beach','SiteLocation','SiteProfile','SiteRevision','SiteAccessPoint','SiteDepthEvidence','SiteDepthDataset','TideStation','SiteTideStation','SiteCatalog'];
 for(const kind of order){
  if(kind==='GeoFeature'||kind==='GeoBoundary'){
   for(const descriptor of manifest.features.filter(f=>(f.kind||'GeoFeature')===kind)){const fs=await geojson(root,descriptor);let batch=[],bytes=0;
    for(const [index,f]of fs.entries()){
     const key=descriptor.dataset||descriptor.asset;
     const row={id:id(key+':'+index),...(kind==='GeoFeature'?{dataset_id:descriptor.dataset}:{asset_id:descriptor.asset,area_id:descriptor.link_area?(f.properties?.id||f.id):null}),geometry:f.geometry,properties:{...f.properties,upstream_feature_id:f.id??null}};
     const length=Buffer.byteLength(JSON.stringify(row));
     if(batch.length&&(bytes+length>4*1024*1024||batch.length>=size)){yield [kind,batch];batch=[];bytes=0;}
     batch.push(row);bytes+=length;
    }if(batch.length)yield [kind,batch];
   }
  }else{const rs=manifest.rows[kind]||[];for(let i=0;i<rs.length;i+=size)yield [kind,rs.slice(i,i+size)];}
 }
}
export async function importReferenceRelease(db,manifest,{root=process.cwd(),onBatch=()=>{}}={}){
 await verifyManifest(root,manifest); // All files checked before the first mutation.
 await db.query('BEGIN');
 try{
  await db.query("SELECT pg_advisory_xact_lock(hashtext('finfolk:native-reference-import'))");
  const counts={};
  for await(const [kind,rows]of referenceBatches(root,manifest)){
   const n=(await db.query('SELECT finfolk_rpc.import_reference_batch($1,$2::jsonb) AS n',[kind,JSON.stringify(rows)])).rows[0].n;
   counts[kind]=(counts[kind]||0)+n;await onBatch(kind,n);
  }
  for(const [kind,count]of Object.entries(manifest.counts))if((counts[kind]||0)!==count)throw Error('Import count mismatch: '+kind);
  const release={id:manifest.id,manifest:{...manifest,rows:undefined},counts};
  await db.query('SELECT finfolk_rpc.import_reference_batch($1,$2::jsonb)',['DatabaseRelease',JSON.stringify([release])]);
  await verifyReferenceDatabase(db,manifest);
  await db.query('COMMIT');return {id:manifest.id,counts,warnings:manifest.warnings};
 }catch(error){await db.query('ROLLBACK');throw error;}
}
export async function verifyReferenceDatabase(db,manifest){
 const result=(await db.query('SELECT finfolk_rpc.verify_reference_release($1) AS value',[manifest.id])).rows[0].value;
 if(!result)throw Error('Release is not imported into this database');
 for(const [kind,count]of Object.entries(result.actual))if(count!==(manifest.counts[kind]||0))throw Error('Database count mismatch: '+kind);
 if(canonical(result.expected)!==canonical(Object.fromEntries(Object.entries(result.actual).filter(([k,v])=>v||k in result.expected))))throw Error('Stored release counts differ from the database');
 return result;
}
export async function installFreshDatabase(db,{root=process.cwd(),manifest}={}){
 if(manifest)await verifyManifest(root,manifest);
 // The generated schema itself refuses existing application objects and requires managed auth.
 // There is deliberately no DROP, reset, fake auth provisioning or migration replay here.
 await db.query('BEGIN');
 try{
  for(const file of ['entity-schema.sql','rebuild.sql','messaging-grants.sql','site-notes-grants.sql']){
   const sql=await readFile(resolve(root,'resources/finfolkdb/'+file),'utf8');
   // These generated publications own outer BEGIN/COMMIT only. Compose them in
   // one transaction so failure in a later grant leaves an empty candidate.
   await db.query(sql.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,''));
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}
}
