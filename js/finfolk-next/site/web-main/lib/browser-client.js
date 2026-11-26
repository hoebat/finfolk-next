let configuration,ready;
export function accountConfiguration(){
 if(!configuration)configuration=Promise.resolve().then(async()=>{
  const embedded=document.getElementById('finfolk-account-config');let value;
  if(embedded)try{value=JSON.parse(embedded.textContent)}catch{}
  if(value?.enabled&&value.authProvider==='supabase')return {...value,apiUrl:location.origin+'/',authUrl:value.supabaseUrl,backbone:true,cacheBackend:'sqlite'};
  const response=await fetch('/api/account-config',{cache:'no-store'});if(!response.ok)throw Error('Accounts are temporarily unavailable.');return response.json();
 }).catch(error=>{configuration=null;throw error});
 return configuration;
}
export function browserClient(){
 if(!ready)ready=(async()=>{
  const config=await accountConfiguration();
  if(!config.enabled)throw Error('Accounts are temporarily unavailable.');
  if(config.authProvider==='preview'){const selected=new URL(location.href).searchParams.get('previewActor');if(['guest','alice','bob','owner','admin'].includes(selected))sessionStorage.setItem('finfolk:preview:actor',selected);const {createPreviewClient}=await import(/* webpackIgnore: true */ '/preview-client.js');const client=createPreviewClient(config,sessionStorage.getItem('finfolk:preview:actor')||'alice');client.featureFlags=async()=>{const r=await fetch('/v1/features',{cache:'no-store'});if(!r.ok)throw Error('Feature settings unavailable');return r.json();};return client;}
  if(config.authProvider!=='supabase')throw Error('Supabase account configuration is required.');
  const path='/account-client.js';const {createLogbookClient}=await import(/* webpackIgnore: true */path);
  return createLogbookClient(config);
 })().catch(error=>{ready=null;throw error;});
 return ready;
}

// Public feature reads still carry identity for tester evaluation. The API keeps
// their public-data semantics; credentials are restricted to same-origin paths.
export async function publicFeatureFetch(path,options={}){
 if(!/^\/(?:shop\/items|v1\/events(?:\/[^?#]*)?)(?:[?].*)?$/.test(path))throw Error('Invalid public feature path');
 const client=await browserClient(),headers=await client.featureHeaders?.()||{};
 return fetch(path,{...options,headers:{...options.headers,...headers},cache:'no-store'});
}
