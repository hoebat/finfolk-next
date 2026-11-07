import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import worker from '../backend/reference-assets-worker.mjs';
const objects=new Map(),uploads=new Map(),checksum='a'.repeat(64);
const object=body=>({size:body.length,range:{offset:0,length:body.length},body,arrayBuffer:async()=>new Uint8Array(body).buffer,customMetadata:{sha256:checksum},httpEtag:'"test"',writeHttpMetadata:h=>h.set('Content-Type','application/octet-stream')});
const env={ASSET_READ_TOKEN:'read-token',ASSET_WRITE_TOKEN:'write-token',REFERENCE:{
 head:async k=>objects.has(k)?object(objects.get(k)):null,get:async k=>objects.has(k)?object(objects.get(k)):null,
 createMultipartUpload:async k=>{uploads.set('upload-id',{k,parts:[]});return {uploadId:'upload-id'};},
 resumeMultipartUpload:(k,id)=>({uploadPart:async(n,body)=>{const u=uploads.get(id);assert.equal(k,u.k);u.parts[n-1]=new Uint8Array(await new Response(body).arrayBuffer());return {partNumber:n,etag:'part-'+n};},
 complete:async parts=>{const u=uploads.get(id);assert.equal(parts.length,u.parts.length);const bytes=Buffer.concat(u.parts);objects.set(k,bytes);uploads.delete(id);return object(bytes);},abort:async()=>{uploads.delete(id);}})
}};
const url='https://assets.example/v1/assets/'+checksum;
const call=(method,token,body,suffix='')=>worker.fetch(new Request(url+suffix,{method,headers:{...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body,duplex:'half'})}),env);
assert.equal((await call('GET')).status,401);
assert.equal((await call('POST','read-token')).status,401);
assert.equal((await call('GET','write-token')).status,401);
assert.equal((await call('GET','read-token')).status,404);
const init=await (await call('POST','write-token')).json();assert.equal(init.uploadId,'upload-id');
assert.equal((await call('PUT','write-token','hello','?upload=upload-id&part=0')).status,400);
const part=await (await call('PUT','write-token',gzipSync('hello'),'?upload=upload-id&part=1&compression=gzip&length=5')).json();
assert.equal((await call('POST','write-token',JSON.stringify({parts:[part]}),'?upload=upload-id')).status,200);
const read=await call('GET','read-token');assert.equal(read.status,200);assert.equal(await read.text(),'hello');assert.equal(read.headers.get('X-Content-SHA256'),checksum);
assert.equal((await call('HEAD','read-token')).headers.get('Content-Length'),'5');
assert.equal((await (await call('POST','write-token')).json()).existing,true,'Content addresses are never overwritten');
assert.equal(objects.size,1);
const proof=await (await call('GET','read-token',undefined,'?verify=0:5')).json();assert.equal(proof.sha256,'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
assert.equal((await call('GET','read-token',undefined,'?verify=0:99999999')).status,400);
assert.equal((await worker.fetch(new Request('https://assets.example/v1/assets/invalid'),env)).status,404);
assert.equal((await worker.fetch(new Request('https://assets.example/health'),{})).status,200);
console.log('REFERENCE_ASSETS_PASS: private reads, separate writer scope, streamed multipart upload, immutable object addresses and integrity headers.');
const originalFetch=globalThis.fetch;
try{
 objects.clear();
 await call('POST','write-token');
 let upstreamCalls=0;
 globalThis.fetch=async(input,options)=>{upstreamCalls++;assert.equal(new URL(input).hostname,'files.ausseabed.gov.au');assert.equal(options.headers.Range,'bytes=0-4');assert.equal(options.cache,'no-store');return new Response('hello',{status:206,headers:{'Content-Range':'bytes 0-4/5'}});};
 const remote=await call('PUT','write-token',JSON.stringify({source:'https://files.ausseabed.gov.au/survey/test.zip',offset:0,length:5}),'?upload=upload-id&part=1&source=range');
 assert.equal(remote.status,200);assert.equal(upstreamCalls,1);
 assert.equal((await call('PUT','write-token',JSON.stringify({source:'http://169.254.169.254/latest',offset:0,length:5}),'?upload=upload-id&part=1&source=range')).status,400);
 assert.equal(upstreamCalls,1,'Non-publisher/private requests are rejected before fetching');
 globalThis.fetch=async()=>new Response('ignored range',{status:200});
 assert.equal((await call('PUT','write-token',JSON.stringify({source:'https://files.ausseabed.gov.au/survey/test.zip',offset:0,length:5}),'?upload=upload-id&part=1&source=range')).status,502);
}finally{globalThis.fetch=originalFetch;}
console.log('REFERENCE_RANGE_PASS: allowlisted publisher transfers enforce exact byte ranges and reject ignored ranges.');
