import {browserActivity} from './browser-activity.js';
let snapshot=null,epoch=0;
const listeners=new Set();
export const instagramSnapshot=()=>snapshot;
export const instagramServerSnapshot=()=>null;
export const subscribeInstagram=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
// Collection metadata is public and session-local. A late feed/page response
// must not overwrite the status returned by a more recently requested feed.
export async function readInstagramFeed(path,read){
 const request=++epoch,{activity}=await browserActivity(),task=activity.begin({label:'Instagram beach posts',kind:'Instagram',url:new URL(path,location.href).href});
 try{
  const result=await read();task.finish();
  if(request===epoch&&result.activity){snapshot={collecting:!!result.activity.collecting,lastSuccess:result.activity.lastSuccess||null};for(const listener of listeners)listener();}
  return result;
 }catch(error){task.finish({state:'error',error:error.message});throw error;}
}
