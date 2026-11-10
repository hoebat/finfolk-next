// Compile native survey-derived contours into bounded, viewport-loaded tiles.
// Sources stay separate: differing vertical references are never mosaicked.
import {readFile,writeFile,mkdir,appendFile,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import geojsonvt from 'geojson-vt';
import {fromGeojsonVt} from '@maplibre/vt-pbf';

const xTile=(lon,z)=>Math.floor((lon+180)/360*2**z);
const yTile=(lat,z)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z);
export function featureBounds(features){
 const bounds=[180,85,-180,-85];
 for(const feature of features){
  if(feature.geometry?.type!=='LineString'||!Number.isFinite(feature.properties?.depth_m)||feature.properties.depth_m<=0)throw Error('Invalid native contour');
  for(const point of feature.geometry.coordinates){
   if(point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>85)throw Error('Invalid native contour coordinates');
   bounds[0]=Math.min(bounds[0],point[0]);bounds[1]=Math.min(bounds[1],point[1]);bounds[2]=Math.max(bounds[2],point[0]);bounds[3]=Math.max(bounds[3],point[1]);
  }
 }
 return bounds;
}

export async function build(planPath,baselinePath,target){
 const plan=JSON.parse(await readFile(planPath,'utf8')),baseline=JSON.parse(await readFile(baselinePath,'utf8'));
 target=resolve(target);const sources=[];let files=0,features=0;
 if(baseline.version!==1||!Array.isArray(baseline.sources))throw Error('Unsupported live contour manifest');
 for(const source of plan.sources){
  if(!/^coastal-[a-zA-Z0-9_-]+$/.test(source.id))throw Error('Unsafe coastal source ID');
  const version=createHash('sha256').update(JSON.stringify({pipeline:2,release:plan.release,source:source.id,rasters:source.rasters.map(r=>r.sha256)})).digest('hex').slice(0,16);
  const prefix=source.id+'-'+version,spool=resolve(target,'..','tile-spool',prefix),folder=resolve(target,'data/explore-contours',prefix);
  const checkpoint=resolve(target,'..','tile-checkpoints',prefix+'.json');
  try{const cached=JSON.parse(await readFile(checkpoint,'utf8'));sources.push(cached);files+=cached.tile_count;features+=cached.features;console.log('Reused coastal tiles',source.id);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
  await rm(spool,{recursive:true,force:true});await mkdir(spool,{recursive:true});await mkdir(folder,{recursive:true});
  const bounds=[180,85,-180,-85];let count=0;const minzoom=10,maxzoom=14;
  for(const path of source.contours){
   const value=JSON.parse(gunzipSync(await readFile(path)).toString('utf8')),collection=value.collection;
   if(!collection?.features?.length)continue;
   const part=featureBounds(collection.features);count+=collection.features.length;
   bounds[0]=Math.min(bounds[0],part[0]);bounds[1]=Math.min(bounds[1],part[1]);bounds[2]=Math.max(bounds[2],part[2]);bounds[3]=Math.max(bounds[3],part[3]);
   const index=geojsonvt(collection,{maxZoom:maxzoom,tolerance:2,extent:4096,buffer:64,indexMaxZoom:5});
   for(let z=minzoom;z<=maxzoom;z++)for(let x=xTile(part[0],z);x<=xTile(part[2],z);x++)for(let y=yTile(part[3],z);y<=yTile(part[1],z);y++){
    const tile=index.getTile(z,x,y);if(tile?.features.length)await appendFile(resolve(spool,`${z}-${x}-${y}.jsonl`),JSON.stringify(tile.features)+'\n');
   }
  }
  if(!count){await rm(spool,{recursive:true,force:true});continue;}
  let tiles=0,bytes=0;
  for(let z=minzoom;z<=maxzoom;z++)for(let x=xTile(bounds[0],z);x<=xTile(bounds[2],z);x++){
   const directory=resolve(folder,String(z),String(x));await mkdir(directory,{recursive:true});
   for(let y=yTile(bounds[3],z);y<=yTile(bounds[1],z);y++){
    let tileFeatures=[];
    try{const chunks=(await readFile(resolve(spool,`${z}-${x}-${y}.jsonl`),'utf8')).trim().split('\n');for(const chunk of chunks)for(const feature of JSON.parse(chunk))tileFeatures.push(feature);}catch(error){if(error.code!=='ENOENT')throw error;}
    const body=fromGeojsonVt({contours:{features:tileFeatures,extent:4096}},{version:2,extent:4096});
    await writeFile(resolve(directory,y+'.pbf'),body);tiles++;bytes+=body.length;
   }
  }
  const meta={...source.metadata,id:source.id,kind:'survey',bounds,minzoom,maxzoom,features:count,tile_count:tiles,bytes,
              tiles:['/data/explore-contours/'+prefix+'/{z}/{x}/{y}.pbf'],url:source.metadata.source_url,
              native_cog_count:source.rasters.length,derivation:'native-grid iso-elevation contours',archive_release:plan.release};
  sources.push(meta);files+=tiles;features+=count;
  await mkdir(dirname(checkpoint),{recursive:true});await writeFile(checkpoint,JSON.stringify(meta));
  await rm(spool,{recursive:true,force:true});console.log('Built coastal source',source.id,count,'contours;',tiles,'tiles');
  globalThis.gc?.();
 }
 const ids=new Set(sources.map(s=>s.id));if(baseline.sources.some(s=>ids.has(s.id)))throw Error('Coastal source collides with existing live source');
 const manifest={...baseline,coastal_release:plan.release,coastal_catalog_url:plan.origin+'/'+plan.prefix+'/catalog.json',
                 native_coastal_cog_count:plan.native_cog_count,sources:[...baseline.sources,...sources]};
 await mkdir(resolve(target,'data/explore-contours'),{recursive:true});await writeFile(resolve(target,'data/explore-contours/manifest.json'),JSON.stringify(manifest));
 console.log('COASTAL_MAP_BUILT',sources.length,'survey sources,',features,'contours,',files,'tiles; existing',baseline.sources.length,'sources retained');return manifest;
}

export async function buildIncremental(planPath,baselinePath,target){
 const plan=JSON.parse(await readFile(planPath,'utf8')),baseline=JSON.parse(await readFile(baselinePath,'utf8'));
 const changed=plan.sources.filter(source=>!source.reuse_contours),ids=new Set(changed.map(source=>source.id));
 for(const source of baseline.sources)if(ids.has(source.id)&&!source.id.startsWith('coastal-'))throw Error('Cannot replace an existing non-coastal source');
 const work=resolve(target,'..');await mkdir(work,{recursive:true});
 const pp=resolve(work,'incremental-plan.json'),bp=resolve(work,'incremental-baseline.json');
 await writeFile(pp,JSON.stringify({...plan,sources:changed}));
 await writeFile(bp,JSON.stringify({...baseline,sources:baseline.sources.filter(source=>!ids.has(source.id))}));
 return build(pp,bp,target);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const compile=process.argv[5]==='--incremental'?buildIncremental:build;
 await compile(process.argv[2],process.argv[3],process.argv[4]);
}
