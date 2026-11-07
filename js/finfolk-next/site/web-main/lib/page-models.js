import {definition,resolveModel,runAction,runModel,runPage,runAuthAction,runSdkAction,bindPageClient,createPageAdapter,runLocalEffect,runPageResource,runCompatibility} from '@finfolk/edge/page-models.js';
export {definition,resolveModel,runModel,runPage,bindPageClient,createPageAdapter,runLocalEffect,runPageResource,runCompatibility};
// Bound actions use the existing SDK: credentials, cache invalidation and recovery
// remain owned by the application backbone.
export function pageActions(client,key,inputs={}){
 return Object.fromEntries([...Object.keys(definition(key).actions),...Object.keys(definition(key)['retired-actions']||{})].map(name=>[name,(payload,options)=>runAction(client,key,name,inputs,payload,options)]));
}

export function pageAuthActions(client,key){
 return Object.fromEntries(Object.keys(definition(key)['auth-actions']||{}).map(name=>[name,(...args)=>runAuthAction(client,key,name,args)]));
}

export function pageSdkActions(client,key){
 return Object.fromEntries(Object.keys(definition(key)['sdk-actions']||{}).map(name=>[name,(...args)=>runSdkAction(client,key,name,args)]));
}
