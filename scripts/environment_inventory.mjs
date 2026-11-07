// Export a reviewable bundle from local depth assets. No DB writes.
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,extname} from 'node:path';
const root=process.argv[2]||'datasets',inventory=JSON.parse(await readFile(join(root,'inventory.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundle={version:1,sources:[],datasets:[]};
for(const [region,m]of Object.entries(inventory.contours||{})){
 const checksum=sha(await readFile(join(root,m.file))),source_id='contours-'+region;
 bundle.sources.push({id:source_id,enabled:false,metadata:{url:m.source_url,licence:m.licence,attribution:m.attribution,cacheAllowed:false,redistributionAllowed:false}});
 bundle.datasets.push({id:region+'-'+checksum.slice(0,16),source_id,upstream_id:region,version:checksum,checksum,metadata:{...m,kind:'published_contour',datum:m.datum||'unknown',units:'m',assets:[{path:m.file,checksum}]}});
}
for(const m of inventory.rasters||[]){const checksum=sha(await readFile(join(root,m.file))),source_id='raster-'+m.id;bundle.sources.push({id:source_id,enabled:false,metadata:{url:m.source_url,licence:m.licence,attribution:m.attribution}});bundle.datasets.push({id:m.id+'-'+checksum.slice(0,16),source_id,upstream_id:m.id,version:checksum,checksum,metadata:{...m,kind:'measured_raster',assets:[{path:m.file,checksum}]}});}
for(const [id,m] of Object.entries(inventory.context_contours||{})){
 const checksum=sha(JSON.stringify(m.areas)),source_id='context-'+id;bundle.sources.push({id:source_id,enabled:false,metadata:{url:m.source_url||m.url,licence:m.licence,attribution:m.attribution||m.citation}});bundle.datasets.push({id:id+'-'+checksum.slice(0,16),source_id,upstream_id:id,version:checksum,checksum,metadata:{...m,kind:'context',datum:m.datum||'unknown',units:'m',assets:await Promise.all(Object.values(m.areas).map(async a=>({path:a.file,checksum:sha(await readFile(join(root,a.file)))})))}});
}
if(process.argv[3]){const output=process.argv[3];await mkdir(join(output,'data/depth'),{recursive:true});for(const d of bundle.datasets)for(const a of d.metadata.assets){const name=a.checksum+extname(a.path);await copyFile(join(root,a.path),join(output,'data/depth',name));a.url='/data/depth/'+name;}}
console.log(JSON.stringify(bundle,null,2));
