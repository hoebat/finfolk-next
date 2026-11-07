import {mockPlace,discovered} from './nextjs-place.mjs';
export const collectionTime='2026-11-03T03:00:00Z';
export async function mockPublicCollection(page,base,{collecting=true,lastSuccess=collectionTime}={}){
 await mockPlace(page,base);let hold=false,fail=false,release,started;
 const waiting=new Promise(resolve=>started=resolve),held=new Promise(resolve=>release=resolve);
 await page.route('**/instagram/posts?*',async route=>{
  const query=new URL(route.request().url()).searchParams,beach=query.get('beachId'),more=query.has('cursor');
  if(more&&hold&&beach==='bondi'){started();await held;return route.fulfill({json:{posts:[{...discovered,id:'old-page',url:'https://www.instagram.com/p/oldcollection/'}],cursor:null,activity:{collecting:false,lastSuccess:'2020-01-01T00:00:00Z'}}});}
  if(more&&fail)return route.fulfill({status:503,json:{error:'Synthetic public feed failure'}});
  return route.fulfill({json:{posts:[{...discovered,id:more?'next-public':discovered.id,url:more?'https://www.instagram.com/p/nextpublic/':discovered.url}],cursor:more?null:'next-public',activity:{collecting,lastSuccess}}});
 });
 return {hold:()=>hold=true,fail:()=>fail=true,started:waiting,release};
}
