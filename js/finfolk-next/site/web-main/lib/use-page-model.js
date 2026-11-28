'use client';
import {useEffect,useRef,useState} from 'react';
import {resolveModel,runModel} from './page-models.js';
export function usePageModel(session,page,name,inputs={},options={}){
 const model=resolveModel(page,name,inputs,options.payload),values=session.client?.authProvider==='supabase'?model.nativeValues:model.values,key=page+':'+name+':'+JSON.stringify(values);
 const actor=session.user?.uid||(options.allowGuest?'__guest__':null),client=session.client,current=useRef();current.current={actor,client,key,status:session.status};
 const [record,setRecord]=useState(null),[revision,bump]=useState(0),load=useRef();load.current=()=>options.load?options.load(client):runModel(client,page,name,inputs,options.payload);
 useEffect(()=>{
  if(!actor||session.status!=='ready')return;
  let active=true,stop;const valid=()=>active&&current.current.actor===actor&&current.current.client===client&&current.current.key===key&&current.current.status==='ready';
  const publish=state=>{if(!valid())return;setRecord(previous=>{
   const data=state.data,denied=state.error?.status&&[401,403,404,410].includes(state.error.status);
   return {actor,client,key,data:denied?undefined:data,loading:data===undefined&&!state.error,error:state.error||null,cached:!!state.cached,savedAt:state.savedAt,refreshing:state.status==='loading'&&data!==undefined};
  });};
  // Subscribe before fetching so persisted snapshots can render during revalidation.
  try{Promise.resolve(client.subscribe?.(model.name,values,publish)).then(release=>{if(active)stop=release;else release?.();}).catch(()=>{});}catch{}
  load.current().then(data=>{if(valid())setRecord(previous=>previous?.actor===actor&&previous.client===client&&previous.key===key&&JSON.stringify(previous.data)===JSON.stringify(data)?previous:{actor,client,key,data,loading:false,error:null});}).catch(error=>{if(valid())setRecord(previous=>({...previous,actor,client,key,loading:false,refreshing:false,error,data:error.status?undefined:previous?.data}));});
  const online=()=>{if(valid())bump(x=>x+1)};window.addEventListener('online',online);
  return()=>{active=false;stop?.();window.removeEventListener('online',online)};
 },[actor,client,key,session.status,revision]);
 return {record:session.status==='ready'&&record&&record.actor===actor&&record.client===client&&record.key===key?record:null,refresh:()=>bump(x=>x+1)};
}
