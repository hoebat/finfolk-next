'use client';
import {resolveModel,runModel} from './page-models.js';
import {useActorData} from './use-actor-data.js';
import {useModelObserver} from './use-model-observer.js';
export function usePageModel(session,page,name,inputs={}){
 const model=resolveModel(page,name,inputs),values=session.client?.authProvider==='supabase'?model.nativeValues:model.values,key=page+':'+name+':'+JSON.stringify(values);
 const result=useActorData(session,key,api=>runModel(api,page,name,inputs));
 useModelObserver(session,key,result.record,fn=>session.client.subscribe(model.name,values,fn),result.refresh);
 return result;
}
