import assert from 'node:assert/strict';
import {fromGeojsonVt} from '@maplibre/vt-pbf';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';
import {rewriteTile} from '../scripts/package_coastal_release.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const raw=fromGeojsonVt({contours:{extent:4096,features:[{type:2,geometry:[[[1,2],[3,4]]],tags:{source_url:'https://finfolk-datasets.netlify.app/coastal/test/sources/test.html',depth_m:4,source_elevation_m:-4}}]}});
const before=new VectorTile(new Pbf(raw)).layers.contours.feature(0),rewritten=rewriteTile(raw),after=new VectorTile(new Pbf(rewritten)).layers.contours.feature(0);
assert.deepEqual(after.loadGeometry(),before.loadGeometry());assert.equal(after.properties.source_elevation_m,-4);assert.equal(after.properties.depth_m,4);
assert.equal(after.properties.source_url,'https://datasets.finfolk.com.au/v1/coastal/test/sources/test.html');assert.deepEqual(rewriteTile(rewritten),rewritten);
const root=new URL('../datasets/runtime/releases/',import.meta.url),id='9c8eed2d09c42080c775a46df8f4006af3b9f15f3edde042c8fcbfc0d4303eca';
const base=JSON.parse(readFileSync(new URL('a772a9ac76155293b12e688e32ddc1a83a483b420da385756fbcd5b71b706bf4/manifest.json',root)));
const current=JSON.parse(readFileSync(new URL(id+'/manifest.json',root)));
assert.equal(current.nativeCoastalCogCount,709);assert.equal(current.coastalContourSources,20);assert.equal(current.rasterCount,0);
assert.equal(Object.keys(current.files).filter(n=>n.endsWith('.tif')).length,709);
for(const [name,file]of Object.entries(base.files))if(name!=='data/explore-contours/manifest.json')assert.deepEqual(current.files[name],file);
for(const [key,name]of Object.entries(base.tileArchives))assert.equal(current.tileArchives[key],name);
for(const [name,file]of Object.entries(current.files)){
 const body=readFileSync(new URL(id+'/files/'+file.storage.path,root));
 if(body.subarray(0,7).toString()==='version'){assert.match(body.toString(),new RegExp('oid sha256:'+file.storage.hash+'\\n'));}
 else{assert.equal(sha(body),file.storage.hash,name);assert.equal(body.length,file.storage.bytes,name);}
}
console.log('COASTAL_RELEASE_PASS: 709 original COGs, old sources retained, signed elevations and MVT geometry preserved, URL transformation idempotent, all stored hashes verified.');
