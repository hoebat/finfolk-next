// Native requests use the same-origin Next proxy. The configured backend keeps
// its existing cache namespace, including public SQLite data from the old app.
export async function nativeApplicationBackbone(){
 const mode=await(await fetch('/api/account-config',{cache:'no-store'})).json();
 if(['supabase','preview'].includes(mode.authProvider)){
  const {browserClient}=await import('./browser-client.js');
  return (await browserClient()).application;
 }
 const path='/app-backbone.js';
 const {appConfiguration,applicationBackbone}=await import(/* webpackIgnore: true */ path);
 const config=await appConfiguration();
 return applicationBackbone({...config,cacheApiUrl:config.cacheApiUrl||config.apiUrl,apiUrl:location.origin+'/'});
}
