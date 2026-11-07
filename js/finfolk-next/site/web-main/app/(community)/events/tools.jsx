'use client';
import {useEffect,useRef,useState} from 'react';
import {pageActions} from '../../../lib/page-models.js';
export function EventNavigation(){return <><a className="profile-action" href="/events">Browse events</a><a className="profile-action" href="/events/my">My events</a><a className="profile-action" href="/pages">My pages</a></>}
export function EventCard({event:e}){return <article className="profile-empty"><h2><a className="profile-action" href={'/events/'+e.id}>{e.document.title}</a></h2><p>{e.organiser} · {e.document.location}</p><p>{new Date(e.starts_at).toLocaleString(undefined,{timeZone:e.timezone})} · {e.timezone}</p>{e.state&&<p>{e.state} · {e.visibility}</p>}</article>}
export function EventGate({session,record,retry}){return session.status==='loading'||session.user&&(!record||record.loading)?<p role="status">Loading events…</p>:session.error||record?.error?<p role="alert">{(session.error||record.error).message}<button className="profile-action" onClick={session.error?session.retry:retry}>Try again</button></p>:!session.user?<><p>Sign in with a verified account to continue.</p><a className="profile-action" href="/account">Sign in</a></>:null;}
export function useEventAction(session,page,inputs={}){
 const [state,setState]=useState(null),actor=session.user?.uid,lock=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 async function run(action,body,done){if(lock.current)return;lock.current=true;setState({actor,busy:true});try{const result=await pageActions(session.client,page,inputs)[action](body);if(alive.current&&session.client.user?.uid===actor){setState({actor,busy:false});done?.(result);}return result;}catch(error){if(alive.current&&session.client.user?.uid===actor)setState({actor,busy:false,error:error.message});throw error;}finally{lock.current=false;}}
 return {run,busy:state?.actor===actor&&!!state?.busy,error:state?.actor===actor?state?.error:null};
}
