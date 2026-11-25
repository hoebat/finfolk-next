import {stableKey} from '@finfolk/edge/backbone.js';
import {operation} from '@finfolk/edge/operations.js';
const publicSeeds=new WeakMap();
export function publicSeed(name,values,data){
 const spec=operation(name),seed=data&&typeof data==='object'?publicSeeds.get(data):null;
 if(spec.auth||spec.write||spec.admin||spec.cache===false||!seed||seed.name!==name||seed.key!==stableKey(values))throw Error('SSR hydration requires matching public loader data.');
 return seed;
}
import {resolveModel} from './page-models.js';
export async function loadPublicPage(key,inputs={}){
 const {definition}=await import('./page-models.js');
 const entries=Object.keys(definition(key).models).map(name=>[name,resolveModel(key,name,inputs)]).filter(([,m])=>!m.spec.auth);
 return Object.fromEntries(await Promise.all(entries.map(async([name,m])=>{
  // Event collections are loaded after browser flag/session resolution.
  if(key==='listing'&&m.name==='publicEvents')return [name,{events:[]}];
  const nativeCatalog=process.env.FINFOLK_AUTH_PROVIDER==='supabase'&&m.name==='siteCatalog';
  const nativeRPC=process.env.FINFOLK_AUTH_PROVIDER==='supabase'&&m.spec['native-rpc'];
  const path=nativeRPC?'/v1/native/account':nativeCatalog?'/v1/native/sites/catalog':m.spec.path.replace(/:([a-z]+)/g,(_,k)=>encodeURIComponent(m.values[k]));
  const url=new URL(path,process.env.FINFOLK_API_ORIGIN||'https://api.finfolk.com.au');
  for(const [k,v]of Object.entries(m.values))if(!nativeRPC&&v!=null&&!m.spec.path.includes(':'+k))url.searchParams.set(k,String(v));
  const response=await fetch(url,{cache:'no-store',...(nativeRPC?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:m.name,values:m.nativeValues})}:{})});
  const entry=definition(key).models[name];
  if(response.status===404&&!entry['not-found'])return [name,null];
  if(!response.ok){
   if(entry['error-body']){const body=await response.json();throw Error(body.error||entry['not-found']||'FinFolk is temporarily unavailable. Please try again.');}
   throw Error('FinFolk is temporarily unavailable. Please try again.');
  }
  const data=await response.json();
  if(data&&typeof data==='object')publicSeeds.set(data,{name:m.name,key:stableKey(m.values),at:Date.now()});
  return [name,data];
 })));
}
