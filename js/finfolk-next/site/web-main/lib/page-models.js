import {definition,resolveModel,runAction,runModel as baseRunModel,runPage as baseRunPage,runAuthAction,runSdkAction,bindPageClient,createPageAdapter,runLocalEffect,runPageResource,runCompatibility} from '@finfolk/edge/page-models.js';
export {definition,resolveModel,bindPageClient,createPageAdapter,runLocalEffect,runPageResource,runCompatibility};
import {featureForOperation,assertFeatureEnabled} from './feature-flags.js';
export async function runModel(client,page,name,...args){assertFeatureEnabled(featureForOperation(definition(page).models[name]?.operation));return baseRunModel(client,page,name,...args);}
export async function runPage(client,page,...args){if(/^(event|my-events|finnies)/.test(page))assertFeatureEnabled(page.startsWith('finnies')?'shop':'events');return baseRunPage(client,page,...args);}
// Bound actions use the existing SDK: credentials, cache invalidation and recovery
// remain owned by the application backbone.
export function pageActions(client,key,inputs={}){
 return Object.fromEntries([...Object.keys(definition(key).actions),...Object.keys(definition(key)['retired-actions']||{})].map(name=>[name,async(payload,options)=>{assertFeatureEnabled(featureForOperation(definition(key).actions[name]?.operation));return runAction(client,key,name,inputs,payload,options);}]));
}

export function pageAuthActions(client,key){
 return Object.fromEntries(Object.keys(definition(key)['auth-actions']||{}).map(name=>[name,(...args)=>runAuthAction(client,key,name,args)]));
}

export function pageSdkActions(client,key){
 return Object.fromEntries(Object.keys(definition(key)['sdk-actions']||{}).map(name=>[name,(...args)=>runSdkAction(client,key,name,args)]));
}
