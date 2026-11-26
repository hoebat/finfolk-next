import {createPublicSiteStore,readSiteDirectoryCache,validDirectory} from './site-directory-cache.js';
import {accountConfiguration} from './browser-client.js';
async function localDirectory(scope){
 const {nativeApplicationBackbone}=await import('./application-client.js');
 const app=await nativeApplicationBackbone();
 if(!app?.public)return readSiteDirectoryCache(scope);
 const saved=await new Promise(resolve=>{let stop,finished=false;const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);stop?.();resolve(value)};const timer=setTimeout(()=>finish(null),2000);
  Promise.resolve(app.public.subscribe('siteCatalog',{},state=>{if(validDirectory(state.data))finish(state.data);else if(['idle','error','closed'].includes(state.status))finish(null)})).then(release=>{stop=release;if(finished)release?.()}).catch(()=>finish(null));
 });
 if(saved){try{await(await caches.open('finfolk-published-sites-v1')).delete(new URL('/__finfolk/public-sites/'+scope,location.origin).href)}catch{}return saved;}
 const legacy=await readSiteDirectoryCache(scope);
 if(validDirectory(legacy)){
  const result=await app.public.hydrate('siteCatalog',{},legacy,1);
  if(result?.applied)try{await(await caches.open('finfolk-published-sites-v1')).delete(new URL('/__finfolk/public-sites/'+scope,location.origin).href)}catch{}
  return result?.state?.data||legacy;
 }
 return null;
}
const sites=createPublicSiteStore({scope:async()=>(await accountConfiguration()).authProvider,read:localDirectory,write:async()=>{},load:async()=>{const {readPublicPageModel}=await import('./public-page-client.js');return readPublicPageModel('atlas','siteCatalog')}});
export const publicSites=sites;
export const readPublishedSites=()=>sites.read();
export const rememberPublishedSites=directory=>sites.remember(directory);
