"use client";
import {createContext,useContext,useEffect,useRef,useState} from 'react';
import {usePathname,useSelectedLayoutSegments} from 'next/navigation';
import {useSession} from '../lib/use-session.js';
import {featureSnapshot,resetFeatureFlags,setFeatureFlags,featureForRoute} from '../lib/feature-flags.js';
const Context=createContext({flags:{},ready:false});
export function useFeatureFlags(){return useContext(Context);}
export function Feature({name,children}){const {flags}=useFeatureFlags();return flags[name]===true?children:null;}
export default function FeatureFlags({children}){
 const segments=useSelectedLayoutSegments(),section=segments?.find(segment=>!segment.startsWith('('));
 const session=useSession(),path=usePathname(),actor=session.user?.uid||null,epoch=useRef(0);
 const [record,setRecord]=useState(()=>({actor:null,client:null,...featureSnapshot()}));
 const scoped=record.actor===actor&&record.client===session.client&&session.status!=='loading';
 useEffect(()=>{
  const generation=++epoch.current;let request=0,nextRefresh=0;
  resetFeatureFlags();setRecord({actor,client:session.client,...featureSnapshot()});
  const refresh=async()=>{
   const sequence=++request;nextRefresh=Date.now()+30000;
   if(navigator.onLine===false){setRecord({actor,client:session.client,...setFeatureFlags(null)});return;}
   try{
    const value=session.status==='ready'&&session.client?.featureFlags?await session.client.featureFlags():await(await fetch('/v1/features',{cache:'no-store',signal:AbortSignal.timeout(10000)})).json();
    if(value.preview===true)nextRefresh=Date.now()+1000;
    if(epoch.current===generation&&request===sequence)setRecord({actor,client:session.client,...setFeatureFlags(value)});
   }catch{if(epoch.current===generation&&request===sequence)setRecord({actor,client:session.client,...setFeatureFlags(null)});}
  };
  refresh();const timer=setInterval(()=>{if(Date.now()>=nextRefresh)refresh();},1000);
  window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
  const offline=()=>{request++;resetFeatureFlags();setRecord({actor,client:session.client,...featureSnapshot()});};
  window.addEventListener('offline',offline);
  return()=>{epoch.current++;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('offline',offline);resetFeatureFlags();};
 },[actor,session.client,session.status]);
 // Match the rendered route tree first: an unmatched URL must retain its 404.
 const value=scoped?record:{flags:{},ready:false},flag=['shop','events','practice'].includes(section)?featureForRoute(path||''):null;
 return <Context.Provider value={value}>{flag&&value.flags[flag]!==true?<main className="ff-section-hub"><h1>{value.ready?'Feature unavailable':'Loading…'}</h1>{value.ready&&<a href="/">Back to FinFolk</a>}</main>:children}</Context.Provider>;
}
