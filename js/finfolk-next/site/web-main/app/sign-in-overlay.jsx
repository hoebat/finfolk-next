'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {useSession} from '../lib/use-session.js';
import GuestAccount from './(atlas)/account/guest.jsx';
import {accountReturnDestination} from './(atlas)/account/routing.js';
import './sign-in-overlay.css';
const RETURN_KEY='finfolk:sign-in-return';
export default function SignInOverlay(){
 const session=useSession(),router=useRouter(),path=usePathname(),query=useSearchParams(),[active,setActive]=useState(null),opener=useRef(null);
 const queryMode=query.get('signin');
 function open(url,element){
  opener.current=element?.closest?.('.ff-floating-controls')?.querySelector('.ff-primary-fab')||element?.closest?.('.ff-menu-panel')?.parentElement?.querySelector('[aria-expanded="true"]')||element;
  const current=new URL(location.href);current.searchParams.delete('signin');current.searchParams.delete('returnTo');
  setActive({creating:url.searchParams.get('mode')==='create'||url.searchParams.get('signin')==='create',target:accountReturnDestination(url.searchParams.get('returnTo'))||accountReturnDestination(current.pathname+current.search+current.hash)||'/map',query:!!url.searchParams.get('signin')});
 }
 function close(){sessionStorage.removeItem(RETURN_KEY);const previous=opener.current;setActive(null);if(queryMode){const url=new URL(location.href);url.searchParams.delete('signin');url.searchParams.delete('returnTo');router.replace(url.pathname+url.search+url.hash,{scroll:false});}requestAnimationFrame(()=>{if(previous?.isConnected)previous.focus();});}
 useEffect(()=>{const click=event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||session.user)return;const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.download||anchor.target&&anchor.target!=='_self')return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||url.pathname!=='/account'||url.searchParams.has('token')||url.hash)return;event.preventDefault();event.stopPropagation();open(url,anchor);};document.addEventListener('click',click,true);return()=>document.removeEventListener('click',click,true);},[session.user]);
 useEffect(()=>{if(queryMode&&!session.user&&!session.user?.recovery)open(new URL(location.href),document.activeElement);},[queryMode,path,session.user?.uid]);
 useEffect(()=>{if(!session.user||session.user.recovery)return;if(active){const target=active.target;close();if(target!==location.pathname+location.search+location.hash)router.replace(target,{scroll:false});return;}if(path==='/account'){let saved;try{saved=JSON.parse(sessionStorage.getItem(RETURN_KEY));sessionStorage.removeItem(RETURN_KEY);}catch{}if(saved&&Date.now()-saved.at<30*60*1000){const target=accountReturnDestination(saved.target);if(target)router.replace(target);}}},[session.user?.uid,session.user?.recovery,active,path]);
 useEffect(()=>{if(active&&!queryMode)close();},[path,query.toString()]);
 if(!active||session.user)return null;
 return <SignInDialog session={session} creating={active.creating} close={close} prepareRedirect={()=>{sessionStorage.setItem(RETURN_KEY,JSON.stringify({target:active.target,at:Date.now()}));}}/>;
}
function SignInDialog({session,creating,close,prepareRedirect}){
 const dialog=useRef(null),[busy,setBusy]=useState(false),saving=useRef(false);
 const busyChanged=useCallback(value=>{saving.current=value;setBusy(value);},[]);
 useEffect(()=>{const element=dialog.current,previous=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=previous;};},[]);
 return <dialog ref={dialog} className="ff-signin-dialog" aria-label={creating?'Create account':'Sign in'} aria-labelledby="signin-title" onCancel={event=>{event.preventDefault();if(!saving.current)close();}} onClick={event=>{if(event.target===dialog.current&&!saving.current){const box=dialog.current.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}}}><button type="button" className="ff-signin-close" aria-label="Close sign in" disabled={busy} onClick={close}>×</button>{session.status==='loading'?<p role="status">Loading sign in…</p>:session.error?<div className="ff-signin-error"><h2 id="signin-title">Sign in</h2><p role="alert">{session.error.message}</p><button type="button" onClick={session.retry}>Try again</button></div>:<GuestAccount session={session} overlay initialCreating={creating} onBusyChange={busyChanged} prepareRedirect={prepareRedirect}/>}</dialog>;
}
