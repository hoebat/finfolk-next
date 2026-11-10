import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {packageCoastal} from '../scripts/package_coastal_release.mjs';
const root=mkdtempSync(resolve(tmpdir(),'coastal-package-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
try{
 const base=resolve(root,'datasets/runtime/releases/baseline'),publication=resolve(root,'publication');
 mkdirSync(resolve(base,'files'),{recursive:true});mkdirSync(resolve(publication,'map/data/explore-contours'),{recursive:true});
 mkdirSync(resolve(publication,'site/coastal/new'),{recursive:true});
 const old={id:'reviewed-numeric',tiles:['/unchanged/{z}/{x}/{y}.pbf']};
 const explore={sources:[old]},files={};
 function fixture(name,value){const body=Buffer.from(JSON.stringify(value)),stored=gzipSync(body),path=sha(body)+'.gz';writeFileSync(resolve(base,'files',path),stored);files[name]={hash:sha(body),bytes:body.length,storage:{path,hash:sha(stored),bytes:stored.length,encoding:'gzip'}};}
 fixture('data/explore-contours/manifest.json',explore);fixture('data/downloads.json',{files:{}});fixture('data/numeric.json',{value:17});
 writeFileSync(resolve(base,'manifest.json'),JSON.stringify({id:'baseline',rasterCount:1,files,tileArchives:{}}));
 writeFileSync(resolve(publication,'map/data/explore-contours/manifest.json'),JSON.stringify(explore));
 writeFileSync(resolve(publication,'publication-plan.json'),JSON.stringify({release:'new',native_cog_count:0,sources:[]}));
 writeFileSync(resolve(publication,'site/coastal/new/catalog.json'),'{}');
 const result=packageCoastal(root,publication,'baseline'),target=resolve(root,'datasets/runtime/releases',result.id);
 assert.equal(result.rasterCount,1);assert.deepEqual(result.files['data/numeric.json'],files['data/numeric.json']);
 const pointer=readFileSync(resolve(target,'files',files['data/numeric.json'].storage.path),'utf8');assert.ok(pointer.includes('oid sha256:'+files['data/numeric.json'].storage.hash));
 const entry=result.files['data/downloads.json'],downloads=JSON.parse(gunzipSync(readFileSync(resolve(target,'files',entry.storage.path))));
 for(const name of ['data/explore-contours/manifest.json','data/coastal/new/catalog.json','data/numeric.json'])assert.equal(downloads.files[name].hash,result.files[name].hash);
 writeFileSync(resolve(publication,'map/data/explore-contours/manifest.json'),JSON.stringify({sources:[]}));
 assert.throws(()=>packageCoastal(root,publication,'baseline'),/Existing source removed/);
 console.log('COASTAL_RELEASE_PACKAGE_PASS: reviewed numeric files retained, download hashes refreshed, removed sources rejected.');
}finally{rmSync(root,{recursive:true,force:true});}
