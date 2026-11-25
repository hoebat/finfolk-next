// Match the generated native RPC types while keeping provider timestamps as ISO strings.
import catalog from '../resources/finfolkdb/rpc-catalog.json' with {type:'json'};
import {createNativeRPC} from './native-rpc.mjs';
export function messagingTime(value){
 if(value==null||typeof value==='number')return value;
 const milliseconds=value instanceof Date?value.getTime():Date.parse(value);
 if(!Number.isFinite(milliseconds))throw Error('Invalid messaging timestamp');
 return milliseconds*1000;
}
const timeKeys=new Set(['sent_at','deadline','lease_until','next_attempt_at','token_expires_at','credential_lease_until','time_created','time_updated','expires_at','expiresAt']);
function fromNative(value,key){
 if(value==null)return value;
 if(timeKeys.has(key)&&(typeof value==='number'||typeof value==='string'&&/^\d+$/.test(value)))return new Date(Number(value)/1000).toISOString();
 if(Array.isArray(value))return value.map(item=>fromNative(item));
 if(typeof value!=='object')return value;
 if(value instanceof Date)return value.toISOString();
 return Object.fromEntries(Object.entries(value).map(([name,item])=>[name,['metadata','result','checks'].includes(name)?item:fromNative(item,name)]));
}
export function createMessagingRPC(query){
 const rpc=createNativeRPC(query);
 return async(name,values)=>{
  const args=values.map((value,index)=>{
   const type=catalog[name]?.arguments[index];
   if(type?.type==='bigint'&&type.name==='i-expires')return messagingTime(value);
   if(type?.name==='i-envelope'&&value!=null){
    const envelope=typeof value==='string'?JSON.parse(value):value;
    return {...envelope,sentAt:messagingTime(envelope.sentAt),deadline:messagingTime(envelope.deadline)};
   }
   return value;
  });
  return fromNative(await rpc(name,args));
 };
}
