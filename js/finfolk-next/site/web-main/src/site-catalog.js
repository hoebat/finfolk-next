import {hydrateSiteCatalog} from './site-model.js';
export async function readSiteDirectory({application,data,fallback,atlas}){
 if(!application)return hydrateSiteCatalog(fallback,atlas);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const directory=await application.public.call('siteCatalog',{}, {signal:controller.signal});if(!Array.isArray(directory?.beaches)||!Array.isArray(directory?.states))throw Error('Invalid site catalog.');return hydrateSiteCatalog(directory,atlas);}
 catch{try{const directory=await data.json('sites-snapshot.json');if(!Array.isArray(directory?.beaches)||!Array.isArray(directory.states))throw Error();return hydrateSiteCatalog(directory,atlas);}catch{return hydrateSiteCatalog(fallback,atlas);}}
 finally{clearTimeout(timer);}
}
export function observeSiteDirectory({application,directory,atlas,onChange}){
 if(!application)return ()=>{};
 const apply=state=>{if(state.status!=='ready'||!state.data?.beaches)return;const incoming=state.data;if(String(incoming.revision)===String(directory.revision))return;if(directory.revision!==undefined&&BigInt(incoming.revision)<BigInt(directory.revision))return;Object.assign(directory,hydrateSiteCatalog(incoming,atlas));onChange();};
 const dispose=application.public.subscribe('siteCatalog',{},apply);
 const refresh=()=>application.public.call('siteCatalog',{}).then(data=>apply({status:'ready',data})).catch(()=>{});
 globalThis.addEventListener('online',refresh);globalThis.addEventListener('finfolk:sites-published',refresh);globalThis.addEventListener('focus',refresh);
 return ()=>{dispose();for(const name of ['online','finfolk:sites-published','focus'])globalThis.removeEventListener(name,refresh);};
}
