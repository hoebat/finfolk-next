'use client';
import {useEffect,useState} from 'react';
import {browserClient} from './browser-client.js';
export function useSession(){
 const [version,setVersion]=useState(0);
 const [state,setState]=useState({status:'loading',client:null,user:null,error:null});
 useEffect(()=>{let alive=true,stop;setState({status:'loading',client:null,user:null,error:null});browserClient().then(client=>{if(!alive)return;stop=client.observe(user=>{if(alive)setState({status:'ready',client,user,error:null});});}).catch(error=>{if(alive)setState({status:'error',client:null,user:null,error});});return()=>{alive=false;stop?.();};},[version]);
 return {...state,retry:()=>setVersion(value=>value+1)};
}
