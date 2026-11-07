'use client';
import {useEffect,useRef} from 'react';
// Subscribe after the read, then compare the model's immediate snapshot with that read.
// This closes the window where a newer model value arrives before React commits the read.
export function useModelObserver(session,key,record,subscribe,refresh){
 const observer=useRef(subscribe);observer.current=subscribe;
 const ready=record?.data!==undefined&&!record.loading&&!record.error;
 useEffect(()=>{if(!ready||!session.user||!session.client?.subscribe)return;let alive=true,stop,unavailable=false,previous=JSON.stringify(record.data);
  Promise.resolve().then(()=>{if(!alive)return;return observer.current(state=>{if(!alive)return;if(state.status==='ready'){const next=JSON.stringify(state.data);if(next!==previous){previous=next;refresh();}}if(state.status==='error'&&state.error?.status===404&&!unavailable){unavailable=true;refresh();}});}).then(release=>{if(alive)stop=release;else release?.();}).catch(()=>{});
  return()=>{alive=false;stop?.();};
 },[session.user?.uid,session.client,key,ready]);
}
