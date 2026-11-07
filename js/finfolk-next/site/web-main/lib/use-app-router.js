'use client';
import {createContext,useContext,useMemo,useSyncExternalStore} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {isOfflineRoute} from './offline-documents.js';
export const OfflineDocumentContext=createContext(false);
const subscribe=listener=>{window.addEventListener('popstate',listener);window.addEventListener('finfolk:offline-navigation',listener);return()=>{window.removeEventListener('popstate',listener);window.removeEventListener('finfolk:offline-navigation',listener);};};
const inactiveSubscribe=()=>()=>{};
export function useAppSearchParams(){
 const params=useSearchParams(),template=useContext(OfflineDocumentContext),query=useSyncExternalStore(template?subscribe:inactiveSubscribe,()=>template?location.search:'',()=>'');
 return useMemo(()=>template?new URLSearchParams(query):params,[template,query,params]);
}
export function useAppRouter(){
 const router=useRouter(),template=useContext(OfflineDocumentContext);
 return useMemo(()=>{
  function navigate(method,href,options){
   const url=new URL(href,location.href);
   if((template||!navigator.onLine)&&url.origin===location.origin&&isOfflineRoute(url.pathname)){
    if(template&&url.pathname===location.pathname){
     // Offline templates own their query state. Use the browser's native
     // history method without starting a Next server-content transition.
     History.prototype[method==='push'?'pushState':'replaceState'].call(history,history.state,'',url.href);
     window.dispatchEvent(new Event('finfolk:offline-navigation'));
     if(options?.scroll!==false)window.scrollTo(0,0);
    }
    else location[method==='push'?'assign':'replace'](url.href);
    return;
   }
   router[method](href,options);
  }
  return {...router,push:(href,options)=>navigate('push',href,options),replace:(href,options)=>navigate('replace',href,options),refresh:()=>{if((template||!navigator.onLine)&&isOfflineRoute(location.pathname))location.reload();else router.refresh();}};
 },[router,template]);
}
