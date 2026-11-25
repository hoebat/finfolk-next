// Ephemeral release decisions. Never hydrate these from SQLite/localStorage.
export const flagIDs=['shop','events','practice.progress','practice.breathing','practice.watch-imports','practice.breath-check'];
const empty=()=>Object.fromEntries(flagIDs.map(id=>[id,false]));
let current={flags:empty(),revision:0,ready:false};
export function featureSnapshot(){return current;}
export function resetFeatureFlags(){current={flags:empty(),revision:0,ready:false};return current;}
export function setFeatureFlags(value){current={flags:value?.defaults==='everyone'?Object.fromEntries(flagIDs.map(id=>[id,true])):Object.fromEntries(flagIDs.map(id=>[id,value?.flags?.[id]===true])),revision:value?.revision||0,ready:true};return current;}
export function featureForRoute(path){
 if(/^\/shop(?:\/|$)/.test(path))return 'shop';if(/^\/events(?:\/|$)/.test(path))return 'events';
 const practice=/^\/practice\/(progress|breathing|watch-imports|breath-check)(?:\/|$)/.exec(path);return practice?'practice.'+practice[1]:null;
}
export function featureForOperation(operation){return /^(publicEvent|event)/.test(operation)?'events':/^finnies/.test(operation)?'shop':null;}
export function assertFeatureEnabled(flag){if(flag&&current.flags[flag]!==true)throw Object.assign(Error('Feature unavailable.'),{status:403,code:'feature_disabled'});}
