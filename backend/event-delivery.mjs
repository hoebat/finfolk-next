// Delivery transport only. The DB owns authorization, encrypted work, leases and acknowledgement.
import {randomUUID} from 'node:crypto';
import {createNativeRPC} from './native-rpc.mjs';
export async function deliverEventInvitation({transaction,actor,event,invite,key,provider,origin,signal}){
 const lease=randomUUID(),work=await transaction(query=>createNativeRPC(query)('event_delivery_claim',[actor,event,invite,key,lease]));
 if(!work?.token)return work;
 let state='sent',receipt='';
 try{
  if(typeof provider!=='function')throw Error('Email provider is not configured');
  const base=new URL(origin);
  if(base.username||base.password||base.search||base.hash||!(base.protocol==='https:'||(base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname))))throw Error('Invalid invitation origin');
  const link=new URL('/events/invitation',base);link.searchParams.set('token',work.token);
  const limited=AbortSignal.any([signal,AbortSignal.timeout(10000)]);let onAbort;
  try{const result=await Promise.race([Promise.resolve().then(()=>provider({to:work.email,title:work.title,url:link.href,idempotencyKey:work.id},{signal:limited})),new Promise((_,reject)=>{onAbort=()=>reject(Error('Email delivery interrupted'));if(limited.aborted)onAbort();else limited.addEventListener('abort',onAbort,{once:true});})]);receipt=typeof result?.id==='string'?result.id.slice(0,200):'';if(!receipt)throw Error('Provider did not acknowledge delivery');}finally{if(onAbort)limited.removeEventListener('abort',onAbort);}
 }catch{state='failed';}
 return transaction(query=>createNativeRPC(query)('event_delivery_complete',[actor,event,invite,lease,state,receipt]));
}
