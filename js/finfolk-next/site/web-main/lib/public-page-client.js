import {requestValues} from '@finfolk/edge/page-models.js';
import {operations} from '@finfolk/edge/operations.js';
import {bindPageClient,resolveModel,definition,pageActions,runPage} from './page-models.js';
import {nativeApplicationBackbone} from './application-client.js';
import {readInstagramFeed} from './instagram-feed.js';
export async function publicPageClient(page='place-public'){
 const path='/app-backbone.js',module=await import(/* webpackIgnore: true */ path);
 const app=await nativeApplicationBackbone(),config=await module.appConfiguration();
 const client=bindPageClient(page,app?.public||{call:(name,values,options)=>module.httpOperation({...config,apiUrl:location.origin+'/'},name,values,options)});
 return {call(name,values,options={}){
  const signal=options.signal||(name==='publicInstagram'?AbortSignal.timeout(12000):undefined);
  const read=()=>client.call(name,values,{...options,...(signal?{signal}:{})});
  return name==='publicInstagram'?readInstagramFeed(requestValues(operations[name],values).path,read):read();
 }};
}
export async function readPublicPageModel(key,name,values={},options,inputs={}){
 const model=resolveModel(key,name,inputs,values),client=await publicPageClient(key);
 return client.call(model.name,model.values,options);
}
export async function publicPageAction(key,name,values={},options){
 const entry=definition(key).actions[name],client=await publicPageClient(key);
 if(!entry)throw Error('Undeclared public page action: '+name);
 return pageActions({request:(_path,init)=>client.call(entry.operation,{...values,...init.body},options)},key)[name](values,options);
}
export async function readPublicAwarePage(client,key,inputs){
 const user=client.user,publicClient=await publicPageClient(key);
 if(client.user!==user)throw Error('Account changed. Sign in again.');
 return runPage(client,key,inputs,{publicClient});
}
