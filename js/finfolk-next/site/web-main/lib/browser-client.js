let ready;
export function browserClient(){
 if(!ready)ready=(async()=>{
  const config=await(await fetch('/api/account-config',{cache:'no-store'})).json();
  if(!config.enabled)throw Error('Accounts are temporarily unavailable.');
  if(config.authProvider==='supabase'){
   const [{AuthClient},{createAccountClient}]=await Promise.all([import('@supabase/auth-js'),import('@finfolk/edge/supabase-client.js')]);
   if(!config.supabaseUrl||!config.publishableKey)throw Error('Supabase account configuration is incomplete.');
   const auth=new AuthClient({url:new URL('/auth/v1',config.supabaseUrl).href,headers:{apikey:config.publishableKey},storageKey:'finfolk:auth:'+new URL(config.supabaseUrl).origin,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'});
   const path='/app-backbone.js';const {applicationBackbone}=await import(/* webpackIgnore: true */ path);
   const scoped={...config,backbone:true,authUrl:config.supabaseUrl,cacheBackend:'memory',apiUrl:location.origin+'/',authRedirectTo:location.origin+'/account'};
   const app=await applicationBackbone(scoped),client=createAccountClient(auth,scoped,app);await client.ready;return client;
  }
  const path='/neon-client.js';const {createLogbookClient}=await import(/* webpackIgnore: true */ path);
  return createLogbookClient({...config,cacheApiUrl:config.cacheApiUrl||config.apiUrl,apiUrl:location.origin+'/'});
 })().catch(error=>{ready=null;throw error;});
 return ready;
}
