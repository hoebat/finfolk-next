'use client';
import {useEffect,useId,useRef,useState} from 'react';
export default function SessionCreateButton({onSchedule,onStart}){
 const [open,setOpen]=useState(false),host=useRef(null),toggle=useRef(null),menu=useRef(null),id=useId(),last=useRef(false);
 useEffect(()=>{if(!open)return;const items=menu.current?.querySelectorAll('[role=menuitem]');items?.[last.current?items.length-1:0]?.focus();const outside=e=>{if(!host.current?.contains(e.target))setOpen(false);};document.addEventListener('pointerdown',outside);document.addEventListener('focusin',outside);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',outside);};},[open]);
 function choose(action){setOpen(false);action();}
 return <div className="session-create-split" role="group" aria-label="Create session" ref={host}>
  <button type="button" className="primary session-create-main" onClick={onSchedule}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="4.5" width="14" height="13" rx="2"/><path d="M6.5 2v5m7-5v5M3 9h14m-10 4h6"/></svg>Schedule session</button>
  <button type="button" className="primary session-create-toggle" ref={toggle} aria-label="Session options" aria-haspopup="menu" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>{last.current=false;setOpen(value=>!value);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();last.current=e.key==='ArrowUp';setOpen(true);}}}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg></button>
  {open&&<div id={id} className="session-create-menu" role="menu" aria-label="Create session" ref={menu} onKeyDown={e=>{const items=[...e.currentTarget.querySelectorAll('[role=menuitem]')],index=items.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);toggle.current?.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}else if(e.key==='Tab'){e.preventDefault();setOpen(false);(e.shiftKey?toggle.current:host.current?.nextElementSibling)?.focus();}}}>
   <button type="button" role="menuitem" onClick={()=>choose(onSchedule)}><span>Schedule session</span><small>Choose a future day and time</small></button>
   <button type="button" role="menuitem" onClick={()=>choose(onStart)}><span>Start session</span><small>Start a current session now</small></button>
  </div>}
 </div>;
}
