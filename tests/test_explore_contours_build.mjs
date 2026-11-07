import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {buildExploreContours,contourCollection} from '../scripts/build_explore_contours.mjs';
const root=await mkdtemp(join(tmpdir(),'finfolk-contours-'));
const feature=(depth,coords=[[151.26,-33.91],[151.27,-33.90],[151.28,-33.89]])=>({type:'Feature',geometry:{type:'LineString',coordinates:coords},properties:{depth_m:depth,datum_label:'AHD',survey_date:'2018',private_field:'not copied'}});
try{await mkdir(join(root,'data/areas'),{recursive:true});await mkdir(join(root,'__compressed/data/contours'),{recursive:true});
 const original=JSON.stringify({type:'FeatureCollection',features:[feature(10),feature(-5),feature(null),feature(20,[[151.7,-33.93],[151.72,-33.92]])]});
 await writeFile(join(root,'__compressed/data/contours/sample.geojson.gz'),gzipSync(original));
 await writeFile(join(root,'data/catalog.json'),JSON.stringify({updated_at:'fixture',regions:[{id:'sample',name:'Published source',contour_file:'data/contours/sample.geojson',contours:{licence:'CC BY 4.0',attribution:'Fixture authority',datum:'AHD',survey_date:'2018'},contour_catalog:'https://example.invalid/source',notes:'Source limits'}]}));
 await writeFile(join(root,'beaches.json'),JSON.stringify({areas:[{id:'area',detail_file:'data/areas/area.json'}]}));
 await writeFile(join(root,'data/areas/area.json'),JSON.stringify({context_source:{title:'Regional model',datum:'MSL',source_resolution_m:250,licence:'CC BY 4.0',attribution:'Regional authority',limitation:'Model context'},context_contours:[feature(30)]}));
 const manifest=await buildExploreContours(root);assert.equal(manifest.sources.length,2);assert.equal(manifest.sources[0].features,2);assert.equal(manifest.sources[1].kind,'regional');assert.equal(manifest.sources[0].limitation,'Source limits');
 let decoded=0,empty=0;async function inspect(path){for(const item of await readdir(path,{withFileTypes:true})){const p=join(path,item.name);if(item.isDirectory())await inspect(p);else if(p.endsWith('.pbf')){const data=new VectorTile(new Pbf(await readFile(p))),layer=data.layers.contours;if(!layer){assert.deepEqual(Object.keys(data.layers),[]);empty++;continue;}if(!layer.length)empty++;for(let i=0;i<layer.length;i++){const f=layer.feature(i);assert.equal(f.type,2);assert.ok(f.properties.depth_m>0);assert.equal(f.properties.private_field,undefined);assert.ok(['survey','regional'].includes(f.properties.kind));assert.equal(f.properties.datum,'AHD');assert.ok(f.loadGeometry().every(line=>line.length>1));decoded++;}}}}
 await inspect(join(root,'data/explore-contours'));assert.ok(decoded>2);assert.ok(empty>0,'Bounded empty tiles must decode without missing-file errors');
 const stable=await readFile(join(root,'data/explore-contours/manifest.json'),'utf8');await buildExploreContours(root);assert.equal(await readFile(join(root,'data/explore-contours/manifest.json'),'utf8'),stable);
 assert.equal(gzipSync(original).compare(await readFile(join(root,'__compressed/data/contours/sample.geojson.gz'))),0);
 assert.throws(()=>contourCollection([feature(10,[[NaN,0],[1,2]])],{title:'bad'}),/geometry/);
 console.log('EXPLORE_CONTOURS_BUILD_PASS: compressed inputs, clipped MVT geometry, positive depths, metadata/limits, bounded empty tiles, stable revisions and preserved originals.');
}finally{await rm(root,{recursive:true,force:true});}
