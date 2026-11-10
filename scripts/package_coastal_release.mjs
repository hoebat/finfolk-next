// Extend a pinned runtime release without changing its existing LFS objects.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {fromVectorTileJs} from '@maplibre/vt-pbf';

const sha=b=>createHash('sha256').update(b).digest('hex');
const encoded=v=>Buffer.from(JSON.stringify(v,Object.keys(v).sort())+'\n');
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])]));return v;}
const json=v=>Buffer.from(JSON.stringify(canonical(v))+'\n');
const oldOrigin='https://finfolk-datasets.netlify.app/coastal/';
const newOrigin='https://datasets.finfolk.com.au/v1/coastal/';
const rewrite=s=>s.replaceAll(oldOrigin,newOrigin);
export function rewriteTile(bytes){
 const tile=new VectorTile(new Pbf(bytes)),layers={};
 for(const [name,layer]of Object.entries(tile.layers)){
  const features=Array.from({length:layer.length},(_,i)=>{
   const f=layer.feature(i);for(const k of Object.keys(f.properties))if(typeof f.properties[k]==='string')f.properties[k]=rewrite(f.properties[k]);return f;
  });
  layers[name]={name,version:layer.version,extent:layer.extent,length:features.length,feature:i=>features[i]};
 }
 return Buffer.from(fromVectorTileJs({layers}));
}
function walk(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(resolve(root,e.name)):[resolve(root,e.name)]).sort();}
export function packageCoastal(checkout,publication,baselineId){
 const base=resolve(checkout,'datasets/runtime/releases',baselineId),manifest=JSON.parse(readFileSync(resolve(base,'manifest.json')));
 const plan=JSON.parse(readFileSync(resolve(publication,'publication-plan.json'))),bodies=new Map();
 const add=(name,body,label)=>{const compressed=name.endsWith('.json')||name.endsWith('.geojson'),stored=compressed?gzipSync(body,{mtime:0}):body;
  manifest.files[name]={hash:sha(body),bytes:body.length,label,storage:{path:name+(compressed?'.gz':''),hash:sha(stored),bytes:stored.length,encoding:compressed?'gzip':null}};bodies.set(name,stored);};
 const explore=JSON.parse(rewrite(readFileSync(resolve(publication,'map/data/explore-contours/manifest.json'),'utf8')));
 const previous=JSON.parse(readFileSync(resolve(publication,'../ocean-release/live-dataset-manifest.json'),'utf8'));
 if(JSON.stringify(explore.sources.slice(0,previous.sources.length))!==JSON.stringify(previous.sources))throw Error('Existing live contour sources changed');
 add('data/explore-contours/manifest.json',json(explore),'Survey contour catalogue');
 const cache=new Map();let tiles=0;
 for(const source of explore.sources.slice(previous.sources.length)){
  const prefix=source.tiles[0].replace('/{z}/{x}/{y}.pbf','').replace(/^\//,''),folder=resolve(publication,'map',prefix);
  for(const z of readdirSync(folder))for(const x of readdirSync(resolve(folder,z))){
   const entries={};
   for(const path of walk(resolve(folder,z,x))){
    const input=readFileSync(path),hash=sha(input);let body=cache.get(hash);
    if(!body){body=rewriteTile(input);cache.set(hash,body);}
    entries[x+'/'+relative(resolve(folder,z,x),path).replace('.pbf','')]={data:body.toString('base64'),hash:sha(body),bytes:body.length};tiles++;
   }
   const name=prefix+'/'+z+'/'+x+'.tiles.json',body=json({version:1,tiles:entries});
   if(body.length>24*1024**2)throw Error('Tile archive exceeds runtime bound');
   add(name,body,'Native coastal survey contours');manifest.tileArchives[prefix.split('/').at(-1)+'/'+z+'/'+x]=name;
  }
 }
 const native=resolve(publication,'site/coastal',plan.release);
 for(const path of walk(native)){
  let body=readFileSync(path);if(/\.(json|html)$/.test(path))body=Buffer.from(rewrite(body.toString()));
  add('data/coastal/'+plan.release+'/'+relative(native,path),body,'Native coastal source archive');
 }
 manifest.coastalRelease=plan.release;manifest.nativeCoastalCogCount=plan.native_cog_count;
 manifest.coastalSources=plan.sources.map(s=>JSON.parse(rewrite(JSON.stringify(s.metadata))));
 manifest.coastalContourSources=explore.sources.length-previous.sources.length;
 delete manifest.id;manifest.id=sha(json(manifest));
 const target=resolve(checkout,'datasets/runtime/releases',manifest.id);
 if(existsSync(target))throw Error('Release already exists; inspect before replacing');
 for(const [name,file]of Object.entries(manifest.files)){
  const path=resolve(target,'files',file.storage.path);mkdirSync(dirname(path),{recursive:true});
  if(bodies.has(name))writeFileSync(path,bodies.get(name));else{
   const pointer=readFileSync(resolve(base,'files',file.storage.path));
   if(!pointer.toString().includes('oid sha256:'+file.storage.hash+'\n'))throw Error('Baseline LFS pointer changed');
   copyFileSync(resolve(base,'files',file.storage.path),path);
  }
 }
 writeFileSync(resolve(target,'manifest.json'),json(manifest));
 console.log(JSON.stringify({id:manifest.id,nativeCogs:plan.native_cog_count,newContourSources:manifest.coastalContourSources,tiles,files:Object.keys(manifest.files).length,manifestSha256:sha(json(manifest))}));return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)packageCoastal(...process.argv.slice(2));
