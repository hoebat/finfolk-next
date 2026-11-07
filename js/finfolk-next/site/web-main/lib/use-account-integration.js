'use client';
import {runModel} from './page-models.js';
import {useCallback,useEffect,useRef,useState} from 'react';
// Keep this read alive across atlas routes, but never across auth identities.
// Object identity matters: a fresh sign-in to the same uid is a new session.
export function useAccountIntegration(session,enabled){
 const generation=useRef(0),[version,setVersion]=useState(0),[record,setRecord]=useState(null);
 const refresh=useCallback(()=>{generation.current++;setVersion(value=>value+1);},[]);
 const user=session.user,client=session.client;
 useEffect(()=>{
  const request=++generation.current;
  if(!enabled||session.status!=='ready'||!user||client?.user!==user){setRecord(null);return;}
  setRecord(previous=>({user,loading:true,data:previous?.user===user?previous.data:undefined}));
  Promise.resolve().then(()=>runModel(client,'account-integration','status',{})).then(data=>{
   if(request===generation.current&&client.user===user)setRecord({user,loading:false,data});
  }).catch(error=>{if(request===generation.current&&client.user===user)setRecord(previous=>({user,loading:false,data:previous?.user===user?previous.data:undefined,error}));});
  return()=>{generation.current++;};
 },[user,client,session.status,enabled,version]);
 return {record:enabled&&session.status==='ready'&&user&&client?.user===user&&record?.user===user?record:null,refresh};
}
