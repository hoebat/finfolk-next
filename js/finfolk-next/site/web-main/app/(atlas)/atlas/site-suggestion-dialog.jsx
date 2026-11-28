'use client';
import {useEffect,useRef,useState} from 'react';
import {usePublishedSites} from '../../../lib/use-published-sites.js';
import SiteLocationPicker from './site-location-picker.jsx';
import SiteSuggestionDetails from './site-suggestion-details.jsx';
import './site-suggestion-dialog.css';
export default function SiteSuggestionDialog({session,directory,initialPoint,onClose}){
 const published=usePublishedSites();
 const dialog=useRef(null),heading=useRef(null),[point,setPoint]=useState(initialPoint||null),[step,setStep]=useState('pin'),[submitted,setSubmitted]=useState(false);
 useEffect(()=>{const previous=document.activeElement,element=dialog.current,overflow=document.body.style.overflow;document.body.style.overflow='hidden';element.showModal();return()=>{element.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};},[]);
 useEffect(()=>{if(step==='details'||submitted)heading.current?.focus();},[step,submitted]);
 return <dialog ref={dialog} className="fm-site-dialog" aria-labelledby="site-suggestion-title" onCancel={e=>{e.preventDefault();onClose();}}><header className="fm-site-dialog-heading"><div><h2 ref={heading} tabIndex={-1} id="site-suggestion-title">Suggest a dive site</h2><p>{submitted?'Submitted for review':step==='pin'?'1. Place a pin':'2. Add site details'}</p></div><button type="button" aria-label="Close suggestion" onClick={onClose}>×</button></header>
 {submitted?<section className="fm-site-submitted" role="status"><h3>Suggestion submitted</h3><p>Your pinned site will appear on the map after review.</p><button className="primary" type="button" onClick={onClose}>Back to the map</button></section>:<>{step==='pin'&&<SiteLocationPicker directory={published.directory||directory} searchError={published.error} onRetrySearch={published.refresh} point={point} onChange={setPoint} onConfirm={()=>setStep('details')}/>}<div hidden={step!=='details'}>{point&&<SiteSuggestionDetails session={session} point={point} onMove={()=>setStep('pin')} onSubmitted={()=>setSubmitted(true)}/>}</div></>}
 </dialog>;
}
