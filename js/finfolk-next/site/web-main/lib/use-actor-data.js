'use client';
import {useEffect,useRef,useState} from 'react';
// Render-time scope checks hide old records before effect cleanup and fence
// late responses even when the same actor receives a replacement SDK client.
export function useActorData(session,key,load,{allowGuest=false}={}){
 const loader=useRef(load);loader.current=load;
 const epoch=useRef(0),[record,setRecord]=useState(null),[version,setVersion]=useState(0);
 const actor=session.user?.uid||(allowGuest?'__guest__':null),client=session.client,status=session.status;
 const current=useRef(null);current.current={actor,key,client,status};
 useEffect(()=>{
  const generation=++epoch.current,loadNow=loader.current;
  const active=()=>epoch.current===generation&&current.current.actor===actor&&current.current.key===key&&current.current.client===client&&current.current.status==='ready';
  if(!actor||status!=='ready')return;
  setRecord({actor,key,client,loading:true});
  Promise.resolve().then(()=>active()?loadNow(client,actor):undefined).then(data=>{if(active())setRecord({actor,key,client,data,loading:false});}).catch(error=>{if(active())setRecord({actor,key,client,error,loading:false});});
  return()=>{epoch.current++;};
 },[actor,status,key,client,version]);
 return {record:status==='ready'&&record?.actor===actor&&record.key===key&&record.client===client?record:null,refresh:()=>setVersion(x=>x+1)};
}
