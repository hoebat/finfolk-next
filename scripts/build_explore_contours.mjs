import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import geojsonvt from 'geojson-vt';
import {fromGeojsonVt} from '@maplibre/vt-pbf';
const safePath=path=>typeof path==='string'&&/^data\/[a-zA-Z0-9_./-]+$/.test(path)&&!path.split('/').includes('..');
async function json(root,path){if(!safePath(path)&&path!=='beaches.json')throw Error('Invalid published dataset path: '+path);try{return JSON.parse(await readFile(resolve(root,path),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;return JSON.parse(gunzipSync(await readFile(resolve(root,'__compressed',path+'.gz'))));}}
export function contourCollection(features,meta){
 const bounds=[180,85,-180,-85],out=[];
 for(const feature of features||[]){const p=feature.properties||{},depth=p.depth_m;if(!Number.isFinite(depth)||depth<=0||!['LineString','MultiLineString'].includes(feature.geometry?.type))continue;
  const lines=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  if(!lines.length||lines.some(line=>line.length<2||line.some(point=>!Array.isArray(point)||!Number.isFinite(point[0])||!Number.isFinite(point[1])||Math.abs(point[0])>180||Math.abs(point[1])>85)))throw Error('Invalid published contour geometry');
  for(const line of lines)for(const [x,y]of line){bounds[0]=Math.min(bounds[0],x);bounds[1]=Math.min(bounds[1],y);bounds[2]=Math.max(bounds[2],x);bounds[3]=Math.max(bounds[3],y);}
  out.push({type:'Feature',geometry:feature.geometry,properties:{depth_m:depth,datum:p.datum_label||meta.datum||'Unspecified datum',survey_date:String(p.survey_date||meta.survey_date||''),source_title:meta.title,source_url:meta.url,licence:meta.licence||'',attribution:meta.attribution||'',kind:meta.kind,source_id:meta.id}});
 }
 return {collection:{type:'FeatureCollection',features:out},bounds};
}
const tileX=(lon,z)=>Math.floor((lon+180)/360*2**z),tileY=(lat,z)=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*2**z);
export async function buildExploreContours(root){
 root=resolve(root);const catalog=await json(root,'data/catalog.json'),directory=await json(root,'beaches.json'),target=resolve(root,'data/explore-contours');await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
 const sources=[];let totalTiles=0,totalFeatures=0;
 async function publish(features,meta){
  if(!/^[-a-zA-Z0-9_]+$/.test(meta.id))throw Error('Invalid contour source ID');
  const {collection,bounds}=contourCollection(features,meta);if(!collection.features.length)return;
  const version=createHash('sha256').update(JSON.stringify({pipeline:1,collection})).digest('hex').slice(0,16),prefix=meta.id+'-'+version,minzoom=meta.kind==='regional'?9:10,maxzoom=meta.kind==='regional'?10:12,index=geojsonvt(collection,{maxZoom:maxzoom,tolerance:2,extent:4096,buffer:64,indexMaxZoom:5});let tiles=0,bytes=0;
  for(let z=minzoom;z<=maxzoom;z++){const edge=2**z-1;for(let x=Math.max(0,tileX(bounds[0],z));x<=Math.min(edge,tileX(bounds[2],z));x++)for(let y=Math.max(0,tileY(bounds[3],z));y<=Math.min(edge,tileY(bounds[1],z));y++){
   const tile=index.getTile(z,x,y),body=fromGeojsonVt({contours:tile||{features:[],extent:4096}},{version:2,extent:4096}),path=resolve(target,prefix,String(z),String(x),y+'.pbf');await mkdir(dirname(path),{recursive:true});await writeFile(path,body);tiles++;bytes+=body.length;
  }}
  sources.push({...meta,bounds,minzoom,maxzoom,tiles:['/data/explore-contours/'+prefix+'/{z}/{x}/{y}.pbf'],features:collection.features.length,tile_count:tiles,bytes});totalTiles+=tiles;totalFeatures+=collection.features.length;
 }
 for(const region of catalog.regions||[]){if(!region.contour_file)continue;const data=await json(root,region.contour_file);await publish(data.features,{id:'survey-'+region.id,kind:'survey',title:region.name,datum:region.contours?.datum||region.contour_datum,survey_date:region.contours?.survey_date||region.contour_survey,url:region.contour_catalog||region.contours?.source_url||'',licence:region.contours?.licence||region.licence||'',attribution:region.contours?.attribution||region.attribution||'',limitation:region.notes||''});}
 for(const area of directory.areas||[]){if(!area.detail_file)continue;const data=await json(root,area.detail_file),s=data.context_source||{};await publish(data.context_contours,{id:'regional-'+area.id,kind:'regional',title:s.title||area.name,datum:s.datum,survey_date:'AusBathyTopo 2024 grid',url:s.metadata_url||s.source_url||'',licence:s.licence||'',attribution:s.attribution||'',resolution_m:s.source_resolution_m,limitation:s.limitation||'Regional model context'});}
 const manifest={version:1,source_revision:catalog.updated_at||null,sources};await writeFile(resolve(target,'manifest.json'),JSON.stringify(manifest));console.log(`EXPLORE_CONTOURS_BUILT: ${sources.length} sources, ${totalFeatures} contours, ${totalTiles} bounded vector tiles.`);return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await buildExploreContours(process.argv[2]||'.cache/next-site');
