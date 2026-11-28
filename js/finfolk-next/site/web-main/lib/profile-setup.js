import {portraitDataURL} from '../src/profile-model.js';
export const SETUP_STEPS=['Identity','About','Dive sites','Privacy'];
export function needsProfileSetup(profile){return profile?.profileSetup?.status==='pending'||(!profile?.profileSetup&&(!profile?.displayName?.trim()||profile.displayName==='Diver'));}
export function suggestedName(account){const profile=account.profile||{};return profile.profileSetup?.nameConfirmed||profile.displayName&&profile.displayName!=='Diver'?profile.displayName:account.profileSuggestions?.name||'';}
export function providerPhotoURL(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&url.href.length<2048&&/(^|\.)(googleusercontent\.com|avatars\.githubusercontent\.com|fbcdn\.net)$|^graph\.facebook\.com$/.test(url.hostname)?url.href:null;}catch{return null;}}
export async function importProviderPortrait(value,win=window){
 const url=providerPhotoURL(value);if(!url)throw Error('This photo is unavailable. Upload a photo or continue with your illustration.');
 const response=await fetch(url,{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(12000)});
 if(!response.ok||!/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type')||''))throw Error('This photo is unavailable. Upload a photo or continue with your illustration.');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2097152){await reader.cancel();throw Error('This photo is too large. Upload a photo up to 2 MiB.');}chunks.push(value);}}finally{reader.releaseLock();}
 return portraitDataURL(new File(chunks,'profile-photo',{type:response.headers.get('content-type').split(';')[0]}),win);
}
