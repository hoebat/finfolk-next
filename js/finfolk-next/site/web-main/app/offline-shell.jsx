'use client';
import {useEffect} from 'react';
import {offlineDocumentPath} from '../lib/offline-documents.js';
// Registration is independent of account initialization and dataset availability.
export default function OfflineShell(){useEffect(()=>{
 if(!('serviceWorker' in navigator)||!window.isSecureContext||process.env.NODE_ENV!=='production')return;
 let alive=true,registration,documents=new Set(),patterns={};const status=message=>{if(alive)window.dispatchEvent(new CustomEvent('finfolk:cache-status',{detail:{message}}));};
 const installed=()=>{if(registration?.waiting)status('Application update ready. Close FinFolk tabs and reopen to apply it.');};
 const check=()=>registration?.update().catch(()=>{});
 const identify=()=>{const worker=navigator.serviceWorker.controller;if(!worker)return;worker.postMessage({type:'FINFOLK_SHELL_CLIENT',scripts:[...document.scripts].map(script=>script.src).filter(Boolean).map(src=>new URL(src)).filter(url=>url.origin===location.origin&&url.pathname.startsWith('/_next/static/')).map(url=>url.pathname)});const channel=new MessageChannel();channel.port1.onmessage=event=>{if(alive){documents=new Set(event.data?.documents||[]);patterns=event.data?.patterns||{};}channel.port1.close();};worker.postMessage({type:'FINFOLK_SHELL_STATUS'},[channel.port2]);};
 // Next's RSC navigation needs the server. Saved public documents can instead
 // start normally from the worker, preserving the destination and query.
 const navigate=event=>{if(navigator.onLine&&document.documentElement.dataset.finfolkOffline!=='true'||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.hasAttribute('download')||anchor.target&&anchor.target!=='_self')return;const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||!documents.has(url.pathname)&&!offlineDocumentPath(url.pathname,{},patterns)||url.pathname===location.pathname&&url.search===location.search)return;event.preventDefault();event.stopPropagation();location.assign(url.href);};
 navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(value=>{
  if(!alive)return;registration=value;installed();identify();registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',installed);});
 }).catch(()=>status('Application could not be saved for offline startup. Reconnect and reopen FinFolk to retry.'));
 window.addEventListener('online',check);
 document.addEventListener('click',navigate,true);
 navigator.serviceWorker.addEventListener('controllerchange',identify);
 return()=>{alive=false;window.removeEventListener('online',check);document.removeEventListener('click',navigate,true);navigator.serviceWorker.removeEventListener('controllerchange',identify);};
 },[]);return null;}
