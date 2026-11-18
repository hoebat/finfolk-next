// HTTP transport only; candidate projection is emitted from Clojure/XTalk.
import {searchQuery,collectCandidates} from '../js/finfolk-next/packages/edge/directory-discovery.js';
async function boundedJSON(response){
 if(!response.ok)throw Error('Discovery provider unavailable');
 const reader=response.body.getReader(),decoder=new TextDecoder();let size=0,body='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();throw Error('Discovery response too large');}body+=decoder.decode(value,{stream:true});}body+=decoder.decode();return JSON.parse(body);}finally{reader.releaseLock();}
}
export function createDirectorySearch({fetcher=fetch,key}={}){
 if(!key)return null;
 return async function search(request,{signal}){
  const pages=[];
  for(const filter of ['', 'site:instagram.com', 'site:tiktok.com']){
   const url=new URL('https://api.search.brave.com/res/v1/web/search');url.search=new URLSearchParams({q:searchQuery(request)+' '+filter,country:'AU',count:'20'});
   pages.push(await boundedJSON(await fetcher(url,{headers:{'X-Subscription-Token':key},redirect:'error',signal})));
  }
  return collectCandidates(request,pages);
 };
}

export async function runDirectorySearch(search,values,requestSignal){
 if(typeof search!=='function')throw Error('Discovery provider is not configured');
 const signal=AbortSignal.any([requestSignal,AbortSignal.timeout(15000)]);
 let onAbort;
 try{return await Promise.race([
  Promise.resolve().then(()=>search(values,{signal})),
  new Promise((_,reject)=>{onAbort=()=>reject(Error('Discovery interrupted'));if(signal.aborted)onAbort();else signal.addEventListener('abort',onAbort,{once:true});})
 ]);}finally{if(onAbort)signal.removeEventListener('abort',onAbort);}
}
