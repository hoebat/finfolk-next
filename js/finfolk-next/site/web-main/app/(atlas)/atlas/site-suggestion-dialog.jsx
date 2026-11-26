'use client';
import {useEffect,useRef,useState} from 'react';
import {pageActions} from '../../../lib/page-models.js';
import SiteForm from '../account/sites/form.jsx';
import GuestAccount from '../account/guest.jsx';
import '../account/account.css';
import './site-suggestion-dialog.css';
export default function SiteSuggestionDialog({session,onClose}){
 const dialog=useRef(null),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{const previous=document.activeElement,element=dialog.current;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{element.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
 return <dialog ref={dialog} className="fm-site-dialog ff-account-workspace" aria-labelledby="site-suggestion-title" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget){const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}}>
  <header className="fm-site-dialog-heading"><div><p className="acct-eyebrow">SHARE A LOCAL SPOT</p><h2 id="site-suggestion-title">Suggest a dive site</h2></div><button type="button" aria-label="Close suggestion" onClick={onClose}>×</button></header>
  <div className="fm-site-dialog-body acct-panel">{session.status==='loading'?<p role="status">Restoring your sign-in…</p>:session.error?<p role="alert">{session.error.message}<button type="button" onClick={session.retry}>Retry sign-in</button></p>:!session.user?<><p>Sign in to share a place with the community.</p><GuestAccount session={session}/></>:session.user.recovery?<p>Finish resetting your password in <a href="/account">your account</a> before submitting a site.</p>:submitted?<div className="fm-site-submitted" role="status"><h3>Thanks for sharing your spot.</h3><p>Your suggestion has been submitted for review.</p><button type="button" onClick={onClose}>Back to the map</button></div>:<><p>Tell us about a new spot. It will appear on the map once it has been reviewed.</p><SiteForm key={session.user.uid} session={session} save={async(site,requestId)=>{const actor=session.user.uid;await pageActions(session.client,'site-submissions').save({site,requestId});if(session.client.user?.uid===actor)setSubmitted(true);}}/></>}</div>
 </dialog>;
}
