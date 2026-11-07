/* Generated from an exact native build; no personal or dataset responses cached. */
const manifest=__MANIFEST__,CACHE='finfolk-next-shell-'+manifest.version;
__COMPATIBILITY__
const paths=new Set(manifest.assets.map(asset=>asset.path));
const clientKey=id=>'/__finfolk_shell_client/'+encodeURIComponent(id);
async function recordClient(id,compatible){
  if(!id)return;
  const cache=await caches.open(CACHE);await cache.put(clientKey(id),new Response(compatible?'1':'0'));
  // Only opaque browser client IDs and a build-match bit; no URLs or user data.
  const entries=(await cache.keys()).filter(request=>new URL(request.url).pathname.startsWith('/__finfolk_shell_client/'));
  for(const entry of entries.slice(0,-100))await cache.delete(entry);
}
async function compatibleClient(id){return !!id&&await(await(await caches.open(CACHE)).match(clientKey(id)))?.text()==='1';}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try{
    let index=0;
    const results=await Promise.allSettled(Array.from({length:6},async()=>{
      while(index<manifest.assets.length){
        const asset=manifest.assets[index++],response=await fetch(asset.path,{cache:'no-store',credentials:'omit'});
        if(!response.ok||response.redirected)throw Error('Offline asset unavailable: '+asset.path);
        const bytes=await response.clone().arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),byte=>byte.toString(16).padStart(2,'0')).join('');
        if(hash!==asset.hash)throw Error('Offline asset version mismatch: '+asset.path);
        await cache.put(asset.path,response);
      }
    }));
    const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason;
  }catch(error){await caches.delete(CACHE);throw error;}
  // Wait for existing tabs to close before switching their JS/runtime version.
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if((name.startsWith('finfolk-shell-')||name.startsWith('finfolk-next-shell-'))&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='FINFOLK_SHELL_STATUS')event.ports[0]?.postMessage({version:manifest.version,cache:CACHE,documents:Object.keys(manifest.documents),patterns:manifest.documentPatterns||{}});
  if(event.data?.type==='FINFOLK_SHELL_CLIENT'){
    const scripts=event.data.scripts;
    const compatible=Array.isArray(scripts)&&scripts.length>0&&scripts.every(path=>typeof path==='string'&&path.startsWith('/_next/static/')&&paths.has(path));
    event.waitUntil(recordClient(event.source?.id,compatible));
  }
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await fetch(request,{signal:AbortSignal.timeout(5000)});
        const compatible=response.ok&&response.headers.get('Content-Type')?.includes('text/html')&&(await response.clone().text()).includes(manifest.buildId);
        await recordClient(event.resultingClientId,compatible);
        return response;
      }catch(error){
        const canonical=url.pathname.replace(/\/+$/,'')||'/';
        const destination=canonical==='/profiles'?profileDestination(url):canonical==='/'?homeDestination(url):legacyDestination(url);
        if(destination)return Response.redirect(destination.href,307);
        if(canonical!==url.pathname&&offlineDocumentPath(canonical,manifest.documents,manifest.documentPatterns)){const target=new URL(url);target.pathname=canonical;return Response.redirect(target.href,307);}
        // The native saved map replaces the legacy shell only when offline.
        if(['/app','/app/'].includes(url.pathname)&&(!url.searchParams.get('view')||url.searchParams.get('view')==='maps')){const target=new URL('/map',url);target.search=url.search;target.searchParams.delete('view');return Response.redirect(target.href,307);}
        const path=offlineDocumentPath(url.pathname,manifest.documents,manifest.documentPatterns);if(!path)throw error;
        const cached=await(await caches.open(CACHE)).match(path);
        if(!cached)return new Response('Reconnect to finish saving FinFolk for offline use.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
        const document=await cached.json();
        if(document.buildId!==manifest.buildId||typeof document.html!=='string')return new Response('Reconnect to update the saved FinFolk application.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
        await recordClient(event.resultingClientId,true);
        const headers=new Headers(cached.headers);headers.delete('Content-Encoding');headers.delete('Content-Length');headers.set('Content-Type','text/html; charset=utf-8');headers.set('X-FinFolk-Offline','1');
        return new Response(document.html,{status:200,headers});
      }
    })());
  }else if(paths.has(url.pathname)&&(!url.search||(url.pathname==='/workers/finfolk.sharedworker.js'&&url.search==='?protocol=2')||(url.pathname.startsWith('/_next/static/')&&manifest.deploymentId&&url.searchParams.get('dpl')===manifest.deploymentId&&[...url.searchParams.keys()].length===1))){
    event.respondWith((async()=>{
      // Hash-addressed Next chunks are safe across releases. Stable public
      // runtime URLs require a document from this exact build, including after
      // the browser restarts this worker between offline module requests.
      if(url.pathname.startsWith('/_next/static/')||await compatibleClient(event.clientId)){
        const cached=await(await caches.open(CACHE)).match(url.pathname);if(cached){
          // A worker receiving these verified bytes belongs to this build too.
          // Its own dependency requests use its new client ID, not the page's.
          if(['worker','sharedworker'].includes(request.destination))await recordClient(event.resultingClientId,true);
          return cached;
        }
      }
      return fetch(request);
    })());
  }
});
