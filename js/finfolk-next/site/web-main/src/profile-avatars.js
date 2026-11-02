// Shared illustrated defaults. A member keeps the same avatar across every view.
export const PROFILE_AVATARS=Object.freeze([
 Object.freeze({id:'alex',url:new URL('./demo-alex.webp',import.meta.url).href}),
 Object.freeze({id:'maya',url:new URL('./demo-maya.webp',import.meta.url).href}),
 Object.freeze({id:'kai',url:new URL('./demo-kai.webp',import.meta.url).href}),
]);
export function standardAvatar(identity=''){
 let hash=2166136261;for(const character of String(identity)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
 return PROFILE_AVATARS[(hash>>>0)%PROFILE_AVATARS.length];
}
