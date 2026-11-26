const NAME='finfolk-published-sites-v1';
const key=scope=>new URL('/__finfolk/public-sites/'+scope,location.origin).href;
export const validDirectory=value=>!!value&&Array.isArray(value.beaches)&&Array.isArray(value.states)&&value.beaches.every(site=>typeof site.id==='string'&&typeof site.name==='string');
export async function readSiteDirectoryCache(scope){try{const response=await(await caches.open(NAME)).match(key(scope));if(!response)return null;const value=await response.json();return value.version===1&&validDirectory(value.directory)?value.directory:null}catch{return null}}
export async function writeSiteDirectoryCache(scope,directory){if(!validDirectory(directory))return;try{await(await caches.open(NAME)).put(key(scope),new Response(JSON.stringify({version:1,directory}),{headers:{'Content-Type':'application/json'}}))}catch{}}
export function createPublicSiteStore({scope,load,read=readSiteDirectoryCache,write=writeSiteDirectoryCache}){
 const initial={directory:null,loading:true,error:null};let state=initial,started=false,namespace,pending,writeQueue=Promise.resolve(),resolveFirst,rejectFirst;const listeners=new Set(),first=new Promise((resolve,reject)=>{resolveFirst=resolve;rejectFirst=reject});first.catch(()=>{});
 const publish=value=>{state=value;listeners.forEach(fn=>fn())};
 function remember(directory,persist=true){if(!validDirectory(directory))throw Error('Dive site catalogue unavailable.');try{if(state.directory?.revision!=null&&directory.revision!=null&&BigInt(directory.revision)<BigInt(state.directory.revision))return state.directory}catch{}
  const areas=new Map((directory.areas||[]).map(area=>[area.id,area.name]));directory={...directory,beaches:directory.beaches.map(site=>({...site,state:site.state||site.state_id,area_name:site.area_name||areas.get(site.area_id)||''}))};publish({directory,loading:false,error:null});resolveFirst(directory);if(namespace&&persist)writeQueue=writeQueue.then(()=>write(namespace,directory)).catch(()=>{});return directory;
 }
 function refresh(){if(pending)return pending;pending=Promise.resolve().then(load).then(remember).catch(error=>{publish({...state,loading:false,error});if(!state.directory)rejectFirst(error)}).finally(()=>{pending=null});return pending}
 async function start(){if(started)return;started=true;try{namespace=await scope();const cached=await read(namespace);if(cached&&validDirectory(cached)){remember(cached,false);publish({...state,loading:true})}await refresh()}catch(error){publish({...state,loading:false,error});if(!state.directory)rejectFirst(error)}}
 return {subscribe(fn){listeners.add(fn);start();return()=>listeners.delete(fn)},getSnapshot:()=>state,getServerSnapshot:()=>initial,read(){start();if(state.directory)return Promise.resolve(state.directory);if(state.error)return refresh().then(()=>{if(state.directory)return state.directory;throw state.error});return first},remember,refresh};
}
