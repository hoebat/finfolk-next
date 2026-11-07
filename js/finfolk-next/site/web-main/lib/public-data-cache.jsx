'use client';
import {useEffect,useState} from 'react';
import {nativeApplicationBackbone} from './application-client.js';
async function read(name,values){
 const app=await nativeApplicationBackbone();
 if(!app)throw Error('Published data is unavailable. Please check your connection.');
 return app.public.call(name,values);
}
// Preserve server rendering while letting the existing public model own its
// browser cache. Private operations are rejected by that model's actor checks.
export default function PublicDataCache({name,values,data,fetchedAt}){
 const key=JSON.stringify(values);
 useEffect(()=>{
  if(data==null)return;
  nativeApplicationBackbone().then(app=>{
   if(!app)return;
   // Older browser bundles keep their original read path during an upgrade.
   return app.public.hydrate?app.public.hydrate(name,JSON.parse(key),data,fetchedAt):app.public.call(name,JSON.parse(key));
  }).catch(()=>{});
 },[name,key,fetchedAt]);
 return null;
}
export function usePublicData(name,values,{enabled=true}={}){
 const key=name+':'+JSON.stringify(values),[record,setRecord]=useState(null),[version,setVersion]=useState(0);
 useEffect(()=>{if(!enabled)return;let live=true;setRecord({key,loading:true});read(name,values).then(data=>{if(live)setRecord({key,data});}).catch(error=>{if(live)setRecord({key,error});});return()=>{live=false;};},[key,version,enabled]);
 return {record:record?.key===key?record:null,retry:()=>setVersion(value=>value+1)};
}
