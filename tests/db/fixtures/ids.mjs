import {createHash} from 'node:crypto';
export function fixtureId(key){
 const h=createHash('sha256').update('finfolk:fixture:'+key).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export const ids=Object.fromEntries(['alice','bob','carol','admin','bondi','missing','rollback','invalid','foreign','unverified','new-member','shadow-event'].map(key=>[key,fixtureId(key)]));
export const nativeTime=value=>Date.parse(value)*1000;
