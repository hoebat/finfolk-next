// Upload pinned assets to private R2, then hash every byte fetched through HTTPS.
import {readFile,writeFile,chmod,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawn} from 'node:child_process';
import {verifyManifest,safeFile} from './lib/rebuild_reference.mjs';
const manifest=JSON.parse(await readFile(process.argv[2]||'.cache/rebuild/manifest.json','utf8'));
const config=JSON.parse(await readFile('.cache/cloud-rebuild/assets-access.json','utf8'));
if(!/^https:\/\/finfolk-reference-assets\.[a-z0-9-]+\.workers\.dev$/.test(config.origin))throw Error('Unexpected reference asset service');
await verifyManifest(process.cwd(),manifest);
const checkpoint='.cache/cloud-rebuild/assets-published.json';
let report;try{report=JSON.parse(await readFile(checkpoint,'utf8'));}catch{report={origin:config.origin,assets:{}};}
if(report.origin!==config.origin)throw Error('Asset checkpoint belongs to another service');
const readConfig='.cache/cloud-rebuild/asset-read.curl',writeConfig='.cache/cloud-rebuild/asset-write.curl';
for(const [path,token]of [[readConfig,config.readToken],[writeConfig,config.writeToken]]){await writeFile(path,'header = "Authorization: Bearer '+token+'"\n',{mode:0o600});await chmod(path,0o600);}
async function curl(url,options){
 const method=options.method||'GET',args=['--http2','--silent','--show-error','--include','--connect-timeout','10','--max-time',method==='PUT'?'120':'45','--request',method,'--config',['GET','HEAD'].includes(method)?readConfig:writeConfig,String(url)];
 if(method==='HEAD')args.push('--head');
 if(options.body!==undefined)args.push('--data-binary','@-');
 if(typeof options.body==='string')args.push('--header','Content-Type: application/json');
 else if(options.body!==undefined)args.push('--header','Content-Type: application/octet-stream');
 const output=await new Promise((resolve,reject)=>{
  const child=spawn('curl',args,{stdio:['pipe','pipe','pipe']}),chunks=[];let size=0;
  child.stdout.on('data',b=>{size+=b.length;if(size>2*1024*1024){child.kill();reject(Error('Unexpected asset response size'));}else chunks.push(b);});child.stderr.resume();
  child.on('error',reject);child.on('exit',code=>code===0?resolve(Buffer.concat(chunks).toString()):reject(Error('Asset HTTPS transport failed ('+code+')')));
  child.stdin.on('error',()=>{});child.stdin.end(options.body);
 });
 let text=output,status,headers;
 while(text.startsWith('HTTP/')){const split=text.indexOf('\r\n\r\n');if(split<0)throw Error('Invalid asset HTTP response');const lines=text.slice(0,split).split('\r\n');status=Number(lines.shift().split(' ')[1]);headers=new Headers();for(const line of lines){const n=line.indexOf(':');if(n>0)headers.append(line.slice(0,n),line.slice(n+1).trim());}text=text.slice(split+4);}
 return new Response(method==='HEAD'?null:text,{status,headers});
}
async function request(url,options){
 let last;
 for(let attempt=0;attempt<5;attempt++){
  try{const r=await curl(url,options);if(r.status<500&&r.status!==429)return r;const detail=await r.json().catch(()=>({}));last=Error('Reference service temporarily unavailable ('+r.status+', '+(detail.error||'unknown')+(detail.status?', upstream '+detail.status:'')+')');}
  catch(error){last=error;}
  console.log('Retrying reference request',options.method||'GET',attempt+1,last.message);
  await new Promise(resolve=>setTimeout(resolve,Math.min(8000,1000*2**attempt)));
 }throw last;
}
async function call(url,method,body){
 const r=await request(url,{method,headers:{Authorization:'Bearer '+config.writeToken,...(typeof body==='string'?{'Content-Type':'application/json'}:{})},body});
 if(!r.ok)throw Error('Asset upload returned HTTP '+r.status);return r.json();
}
async function verify(asset,url){
 const file=await open(await safeFile(process.cwd(),asset.metadata.path),'r');let etag;
 try{
  for(let offset=0;offset<asset.bytes;offset+=4*1024*1024){
   const length=Math.min(4*1024*1024,asset.bytes-offset),buffer=Buffer.alloc(length);let filled=0;
   while(filled<length){const read=await file.read(buffer,filled,length-filled,offset+filled);if(!read.bytesRead)throw Error('Source truncated while verifying');filled+=read.bytesRead;}
   const target=new URL(url);target.searchParams.set('verify',offset+':'+length);
   const r=await request(target,{headers:{Authorization:'Bearer '+config.readToken}});if(!r.ok)throw Error('Published range verification failed ('+r.status+')');
   const proof=await r.json();
   if(proof.offset!==offset||proof.length!==length||proof.bytes!==asset.bytes||proof.sha256!==createHash('sha256').update(buffer).digest('hex')||etag&&proof.etag!==etag)throw Error('Published asset checksum mismatch: '+asset.metadata.path);
   etag=proof.etag;
  }
  const head=await request(url,{method:'HEAD',headers:{Authorization:'Bearer '+config.readToken}});
  if(!head.ok||head.headers.get('ETag')!==etag||Number(head.headers.get('Content-Length'))!==asset.bytes)throw Error('Published asset changed during verification');
  return etag;
 }finally{await file.close();}
}
async function publisherURL(source){
 if(new URL(source).hostname!=='datasets.seed.nsw.gov.au')return source;
 const response=await fetch(source,{redirect:'manual',headers:{Range:'bytes=0-0'},signal:AbortSignal.timeout(15000)});
 try{
  if(response.status!==302)throw Error('NSW publisher redirect unavailable');
  let url;try{url=new URL(response.headers.get('Location'));}catch{throw Error('Invalid NSW publisher redirect');}
  if(url.protocol!=='https:'||url.hostname!=='s3.ap-southeast-2.amazonaws.com'||url.pathname!=='/oeh-prod-cloudstorage/resources/2ef6c816-04b1-4aa7-9f06-e727b9c0cdd9/bathymetrymosaic_marinelidar_mbes.zip'||!url.searchParams.has('X-Amz-Signature'))throw Error('Unexpected NSW publisher redirect');
  return url.href; // Ephemeral signed URL stays in memory, never logs or manifests.
 }finally{await response.body?.cancel();}
}
const unique=[...new Map(manifest.rows.DataAsset.map(a=>[a.checksum,a])).values()];let index=0;
// Sequential publication keeps the ingress and local memory bounded. Multipart
// state is aborted on failure; a completed, verified content address is reusable.
for(const asset of unique){
 const url=config.origin+'/v1/assets/'+asset.checksum,prior=report.assets[asset.checksum];
 if(prior?.verified&&prior.etag&&prior.bytes===asset.bytes){
  const head=await request(url,{method:'HEAD',headers:{Authorization:'Bearer '+config.readToken}});
  if(!head.ok||Number(head.headers.get('Content-Length'))!==asset.bytes||head.headers.get('X-Content-SHA256')!==asset.checksum||head.headers.get('ETag')!==prior.etag)throw Error('Published asset checkpoint is no longer available');
 }else{
  const init=await call(url,'POST');
  if(!init.existing){
   const upload=new URL(url);upload.searchParams.set('upload',init.uploadId);
   const acquisition=manifest.rows.DepthDataset.map(d=>d.metadata.acquisition).find(a=>a?.id===asset.metadata.acquisition);
   const remote=asset.metadata.upstream_url&&acquisition;
   const sourceOffset=remote?acquisition.parts.slice(0,asset.metadata.part).reduce((n,p)=>n+p.bytes,0):0;
   console.log('Copying asset',asset.checksum.slice(0,12),remote?'publisher':'local',asset.bytes);
   const file=remote?null:await open(await safeFile(process.cwd(),asset.metadata.path),'r');
   try{
    const parts=[];let position=0,source;

    while(position<asset.bytes){const length=Math.min((remote?16:8)*1024*1024,asset.bytes-position);
     const part=new URL(upload);part.searchParams.set('part',String(parts.length+1));
     let body;
     if(remote){if(position%(256*1024*1024)===0)source=await publisherURL(asset.metadata.upstream_url);part.searchParams.set('source','range');body=JSON.stringify({source,offset:sourceOffset+position,length});}
     else{body=Buffer.alloc(length);let filled=0;while(filled<length){const {bytesRead}=await file.read(body,filled,length-filled,position+filled);if(!bytesRead)throw Error('Source was truncated during upload');filled+=bytesRead;}part.searchParams.set('compression','gzip');part.searchParams.set('length',String(length));body=gzipSync(body);}
     parts.push(await call(part,'PUT',body));position+=length;
     if(parts.length%16===0)console.log('Uploaded asset parts',asset.checksum.slice(0,12),position,'/',asset.bytes);
    }
    await call(upload,'POST',JSON.stringify({parts}));
   }catch(error){await call(upload,'DELETE').catch(()=>{});throw error;}finally{await file?.close();}
  }
  const etag=await verify(asset,url);report.assets[asset.checksum]={bytes:asset.bytes,url,etag,verified:true,verification:'all_byte_ranges_sha256',verifiedAt:new Date().toISOString()};
  await writeFile(checkpoint,JSON.stringify(report)+'\n',{mode:0o600});await chmod(checkpoint,0o600);
 }
 console.log('Verified asset',++index,'/',unique.length,asset.checksum.slice(0,12),asset.bytes);
}
const uris=Object.fromEntries(manifest.rows.DataAsset.map(a=>[a.metadata.path,report.assets[a.checksum].url]));
await writeFile('.cache/cloud-rebuild/asset-uris.json',JSON.stringify(uris)+'\n',{mode:0o600});
console.log('All reference asset HTTPS URIs are verified.');
