import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function waitForReviewedPreviewOrigin(value,{fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=300000}={}){
 const url=new URL(value);
 assert(url.protocol==='https:'&&/^[a-f0-9]{24}--finfolk\.netlify\.app$/.test(url.hostname)&&url.origin===value,'An exact FinFolk deploy origin is required');
 const deadline=Date.now()+timeoutMs;
 do{
  try{
   const response=await fetcher('https://api.finfolk.com.au/health',{headers:{Origin:value},signal:AbortSignal.timeout(15000),redirect:'error'});
   if(response.ok&&response.headers.get('Access-Control-Allow-Origin')===value)return {reviewedPreviewOrigin:value,ready:true};
  }catch{/* The operator can finish reviewed-origin setup while this gate waits. */}
  if(Date.now()>=deadline)break;
  await pause(Math.min(5000,Math.max(0,deadline-Date.now())));
 }while(Date.now()<=deadline);
 throw Error('The API has not approved this exact preview origin. Set FINFOLK_PREVIEW_ORIGIN on finfolk-supabase-api to '+value+' before retrying. Production has not been published.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 console.log('Waiting for API access from reviewed preview '+process.argv[2]);
 console.log(JSON.stringify(await waitForReviewedPreviewOrigin(process.argv[2])));
}
