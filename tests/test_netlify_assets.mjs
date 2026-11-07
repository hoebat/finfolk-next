import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base=process.env.NETLIFY_TEST_URL;assert.ok(base&&new URL(base).protocol==='https:'&&new URL(base).hostname.endsWith('.netlify.app'),'Set an explicit Netlify deployment URL; never probe production account/API data.');
const response=await fetch(base+'/sw.js',{redirect:'manual',signal:AbortSignal.timeout(30000)});assert.equal(response.status,200);
const worker=await response.text(),manifest=JSON.parse(worker.match(/^const manifest=(.*),CACHE=/m)[1]);
const local=await readFile(new URL('../js/finfolk-next/site/web-main/public/sw.js',import.meta.url),'utf8');assert.equal(worker,local,'Deployed worker must match the local build.');
let index=0;const failures=[];
await Promise.all(Array.from({length:6},async()=>{while(index<manifest.assets.length){const asset=manifest.assets[index++];try{
 const r=await fetch(base+asset.path,{redirect:'manual',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,asset.path+' must be directly available without a canonical redirect');
 const hash=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');assert.equal(hash,asset.hash,asset.path+' must retain its exact build bytes after CDN delivery');
 }catch(error){failures.push({path:asset.path,error:error.message});}}}));
assert.deepEqual(failures,[],'A redirect, transform or missing asset would prevent the real browser worker from installing.');
if(manifest.deploymentId){const asset=manifest.assets.find(asset=>asset.path.startsWith('/_next/static/'));const r=await fetch(base+asset.path+'?dpl='+encodeURIComponent(manifest.deploymentId));assert.equal(r.status,200);assert.equal(createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex'),asset.hash);}
console.log(`NETLIFY_ASSETS_PASS: all ${manifest.assets.length} actual deployed shell assets match the exact local build, without redirects or CDN transformations; deployment-tagged chunks also match.`);
