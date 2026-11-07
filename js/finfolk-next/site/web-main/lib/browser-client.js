let ready;
export function browserClient(){
 if(!ready)ready=(async()=>{
  const config=await(await fetch('/neon-config.json',{cache:'no-store'})).json();
  if(!config.enabled)throw Error('Accounts are temporarily unavailable.');
  const path='/neon-client.js';const {createLogbookClient}=await import(/* webpackIgnore: true */ path);
  return createLogbookClient({...config,cacheApiUrl:config.cacheApiUrl||config.apiUrl,apiUrl:location.origin+'/'});
 })().catch(error=>{ready=null;throw error;});
 return ready;
}
