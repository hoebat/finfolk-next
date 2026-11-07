'use client';
import {useEffect,useRef,useState} from 'react';
import {definition,resolveModel,pageActions,runModel} from './page-models.js';
import {nativeApplicationBackbone} from './application-client.js';
// React owns attachment lifetime; Clojure owns operation selection and bindings.
// Per-model failures are independent, so optional reads do not hide usable data.
export function usePageModels(session,page,inputs={}){
 const actor=session?.user?.uid||'public',key=page+':'+JSON.stringify(inputs),scope=actor+':'+key;
 const client=session?.client,status=session?.status;
 const current=useRef(null);current.current={scope,client,status};
 const [snapshot,setSnapshot]=useState(null),[version,setVersion]=useState(0);
 useEffect(()=>{
  let alive=true;const releases=[];
  const publish=(name,state)=>{if(alive&&current.current.scope===scope&&current.current.client===client&&current.current.status===status)setSnapshot(previous=>({scope,client,status,models:{...(previous?.scope===scope&&previous.client===client&&previous.status===status?previous.models:{}),[name]:{...state,loading:state.status==='loading'}}}));};
  setSnapshot({scope,client,status,models:{}});
  for(const name of Object.keys(definition(page).models)){
   const model=resolveModel(page,name,inputs);
   if(model.spec.auth&&(!session?.user||session.status!=='ready'))continue;
   publish(name,{status:'loading'});
   Promise.resolve().then(async()=>{
    const selected=model.spec.auth?session.client:(await nativeApplicationBackbone())?.public;
    if(!alive||(current.current.scope!==scope||current.current.client!==client||current.current.status!==status))return;
    if(!selected)throw Error('Application models unavailable.');
    const release=await selected.subscribe(model.name,model.values,state=>publish(name,state));
    if(!alive||current.current.scope!==scope||current.current.client!==client||current.current.status!==status){release?.();return;}releases.push(release);
    await runModel(selected,page,name,inputs);
   }).catch(error=>publish(name,{status:'error',error}));
  }
  return()=>{alive=false;for(const release of releases)release?.();};
 },[scope,session?.status,session?.client,version]);
 const actions=Object.fromEntries(Object.keys(definition(page).actions).map(name=>[name,async payload=>{
  const expected=scope;
  if(!session?.user||session.status!=='ready')throw Error('Sign in again.');
  if(current.current.scope!==expected||current.current.client!==client||current.current.status!==status)throw Error('Page context changed.');
  const value=await pageActions(session.client,page,inputs)[name](payload);
  if(current.current.scope!==expected||current.current.client!==client||current.current.status!==status)throw Error('Page context changed.');
  return value;
 }]));
 return {models:snapshot?.scope===scope&&snapshot.client===client&&snapshot.status===status?snapshot.models:{},actions,refresh:()=>setVersion(value=>value+1)};
}
