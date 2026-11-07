'use client';
import {useActorData} from './use-actor-data.js';
import {runPage,runModel,definition} from './page-models.js';
// Composite reads and access conditions are authored in the Clojure registry.
export function usePageData(session,page,inputs={}){
 return useActorData(session,page+':'+JSON.stringify(inputs),api=>runPage(api,page,inputs));
}

// Explicit snapshot reads retain refresh-on-action semantics. Live subscriptions
// use usePageModel; lazy panels can gate either hook with their session user.
export function usePageRead(session,page,name,inputs={},options={}){
 return useActorData(session,page+':'+name+':'+JSON.stringify(inputs),async api=>{
  const label=definition(page).models[name].activity;let task;
  if(label){const {browserActivity}=await import('./browser-activity.js');const {activity}=await browserActivity();task=activity.begin({label,kind:'Instagram'});}
  try{const value=await runModel(api,page,name,inputs);task?.finish();return value;}
  catch(error){task?.finish({state:'error',error:error.message});throw error;}
 },options);
}

// Configuration and public transport are application services; page selection
// and data composition stay in the generated Clojure loader.
export function useConfiguredPageData(session,page,inputs={},options={}){
 return useActorData(session,page+':'+JSON.stringify(inputs),async api=>{
  const expectedUser=api.user;
  const path='/app-backbone.js';
  const {appConfiguration,httpOperation}=await import(/* webpackIgnore: true */ path);
  const config=await appConfiguration();let publicClient;
  if(page==='logbook-extras'){
   const {nativeApplicationBackbone}=await import('./application-client.js');
   publicClient=(await nativeApplicationBackbone())?.public||{call:(name,values)=>httpOperation({...config,apiUrl:location.origin+'/'},name,values,{signal:AbortSignal.timeout(12000)})};
  }
  if(api.user!==expectedUser)throw Error('Account changed. Sign in again.');
  return runPage(api,page,{...inputs,config},{publicClient});
 },options);
}

export function usePublicAwarePageData(session,page,inputs={}){
 return useActorData(session,page+':'+JSON.stringify(inputs),async api=>{
  const {readPublicAwarePage}=await import('./public-page-client.js');
  return readPublicAwarePage(api,page,inputs);
 },{allowGuest:true});
}
