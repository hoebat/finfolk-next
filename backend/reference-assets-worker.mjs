import {gunzipSync} from 'node:zlib';
// Private, content-addressed reference assets. No public bucket or browser keys.
const sha=/^[a-f0-9]{64}$/;
const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function equal(a,b){
 if(!a||!b)return false;
 const enc=new TextEncoder(),hash=async v=>new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(v)));
 const [x,y]=await Promise.all([hash(a),hash(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/health'&&request.method==='GET')return reply({service:'finfolk-reference-assets'});
 const match=/^\/v1\/assets\/([a-f0-9]{64})$/.exec(url.pathname);
 if(!match)return reply({error:'not_found'},404);
 const checksum=match[1],key='sha256/'+checksum,read=['GET','HEAD'].includes(request.method),token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(!await equal(token,read?env.ASSET_READ_TOKEN:env.ASSET_WRITE_TOKEN))return reply({error:'unauthorized'},401);
 try{
  if(read&&url.searchParams.has('verify')){
   const match=/^(\d+):(\d+)$/.exec(url.searchParams.get('verify'));
   if(!match)return reply({error:'invalid_verification_range'},400);
   const offset=Number(match[1]),length=Number(match[2]);
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||length>4*1024*1024)return reply({error:'invalid_verification_range'},400);
   const object=await env.REFERENCE.get(key,{range:{offset,length}});
   if(!object)return reply({error:'not_found'},404);
   const data=await object.arrayBuffer();if(data.byteLength!==length)return reply({error:'incomplete_verification_range'},409);
   const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
   return reply({offset,length,bytes:object.size,etag:object.httpEtag,sha256:Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')});
  }
  if(read){
   const object=request.method==='HEAD'?await env.REFERENCE.head(key):await env.REFERENCE.get(key,{range:request.headers});
   if(!object)return reply({error:'not_found'},404);
   const headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','ETag':object.httpEtag,'X-Content-SHA256':object.customMetadata?.sha256||checksum,'Accept-Ranges':'bytes'});
   const partial=request.headers.has('Range')&&object.range;
   object.writeHttpMetadata(headers);headers.set('Content-Length',String(partial?object.range.length:object.size));
   if(partial)headers.set('Content-Range',`bytes ${object.range.offset}-${object.range.offset+object.range.length-1}/${object.size}`);
   return new Response(request.method==='HEAD'?null:object.body,{headers,status:partial?206:200});
  }
  if(request.method==='POST'&&!url.searchParams.has('upload')){
   const existing=await env.REFERENCE.head(key);if(existing)return reply({existing:true,bytes:existing.size});
   const upload=await env.REFERENCE.createMultipartUpload(key,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:checksum}});
   return reply({uploadId:upload.uploadId});
  }
  const uploadId=url.searchParams.get('upload');if(!uploadId||uploadId.length>2048)return reply({error:'invalid_upload'},400);
  const upload=env.REFERENCE.resumeMultipartUpload(key,uploadId);
  if(request.method==='PUT'){
   const part=Number(url.searchParams.get('part'));if(!Number.isInteger(part)||part<1||part>10000)return reply({error:'invalid_part'},400);
   let body=request.body;
   if(url.searchParams.get('source')==='range'){
    const {source,offset,length}=await request.json(),upstream=new URL(source);
    const allowed=['files.ausseabed.gov.au','datasets.seed.nsw.gov.au','data.imas.utas.edu.au','dotazprdauegisextpubst01.blob.core.windows.net'];
    const signedNSW=upstream.hostname==='s3.ap-southeast-2.amazonaws.com'&&upstream.pathname==='/oeh-prod-cloudstorage/resources/2ef6c816-04b1-4aa7-9f06-e727b9c0cdd9/bathymetrymosaic_marinelidar_mbes.zip'&&upstream.searchParams.has('X-Amz-Signature');
    if(upstream.protocol!=='https:'||!(allowed.includes(upstream.hostname)||signedNSW)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(length)||length<1||length>16*1024*1024)return reply({error:'invalid_source_range'},400);
    if(upstream.hostname==='datasets.seed.nsw.gov.au')upstream.searchParams.set('_finfolk_range',offset+'-'+length+'-'+Date.now());
    let remote;
    for(let redirects=0;redirects<6;redirects++){
     remote=await fetch(upstream,{headers:{Range:`bytes=${offset}-${offset+length-1}`},redirect:'manual',cache:'no-store'});
     if(![301,302,303,307,308].includes(remote.status))break;
     const next=new URL(remote.headers.get('Location'),upstream);
     if(next.protocol!=='https:'||!(allowed.includes(next.hostname)||next.hostname.endsWith('.amazonaws.com')))return reply({error:'invalid_source_redirect'},502);
     await remote.body?.cancel();upstream.href=next.href;
    }
    const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(remote.headers.get('Content-Range')||'');
    if(remote.status!==206||!range||Number(range[1])!==offset||Number(range[2])!==offset+length-1){const status=remote.status,contentRange=remote.headers.get('Content-Range');await remote.body?.cancel();return reply({error:'source_range_unavailable',status,contentRange},502);}
    const downloaded=await remote.arrayBuffer();
    if(downloaded.byteLength!==length)return reply({error:'source_range_incomplete'},502);
    body=new Uint8Array(downloaded);
   }else if(url.searchParams.get('compression')==='gzip'){
    const length=Number(url.searchParams.get('length'));
    if(!Number.isInteger(length)||length<1||length>8*1024*1024)return reply({error:'invalid_part_length'},400);
    if(Number(request.headers.get('Content-Length'))>9*1024*1024)return reply({error:'compressed_part_too_large'},413);
    const compressed=await request.arrayBuffer();
    if(compressed.byteLength>9*1024*1024)return reply({error:'compressed_part_too_large'},413);
    const data=gunzipSync(new Uint8Array(compressed),{maxOutputLength:8*1024*1024});
    if(data.byteLength!==length)return reply({error:'part_length_mismatch'},400);
    body=data;
   }
   return reply(await upload.uploadPart(part,body));
  }
  if(request.method==='POST'){
   if(Number(request.headers.get('Content-Length'))>1024*1024)return reply({error:'too_large'},413);
   const text=await request.text();if(text.length>1024*1024)return reply({error:'too_large'},413);
   const {parts}=JSON.parse(text);
   if(!Array.isArray(parts)||!parts.length||parts.length>10000||parts.some((p,i)=>p.partNumber!==i+1||typeof p.etag!=='string'))return reply({error:'invalid_parts'},400);
   const object=await upload.complete(parts);return reply({bytes:object.size});
  }
  if(request.method==='DELETE'){await upload.abort();return reply({aborted:true});}
  return reply({error:'method_not_allowed'},405);
 }catch(error){
  const detail=String(error?.message||'unknown').replace(/https?:\/\/[^\s)]+/g,'[redacted-url]').replace(/Bearer [A-Za-z0-9_-]+/g,'Bearer [redacted]').slice(0,240);
  console.error('asset_operation_failed',error?.name||'Error',detail);
  return reply({error:'asset_operation_failed'},502);
 }
}};
