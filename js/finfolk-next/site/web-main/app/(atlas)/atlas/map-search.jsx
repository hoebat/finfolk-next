'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import './map-search.css';
import {searchBeachRows,searchMapRows,validPoint} from './explore-model.js';

export default function MapSearch({directory,rows,businessesLoading=false,businessesError,onRetryBusinesses,resultsLabel='Beach search results',query,onQuery,onSearch,onSelect,id='explore-query',className='',label='Search beaches and dive spots',placeholder='Search beaches and dive spots…',submitLabel='Search map',error,onRetry}){
 const suggestionId=id==='explore-query'?'explore':id;
 const host=useRef(null),input=useRef(null),[open,setOpen]=useState(false),[index,setIndex]=useState(-1);
 const matches=useMemo(()=>rows?searchMapRows(rows,query):searchBeachRows(directory,query),[directory,rows,query]),suggestions=matches.slice(0,8);
 const businessCount=matches.filter(row=>row.kind==='business').length,spotCount=matches.length-businessCount;
 const summary=businessCount?[spotCount?`${spotCount} ${spotCount===1?'dive spot':'dive spots'}`:'',`${businessCount} ${businessCount===1?'business':'businesses'}`].filter(Boolean).join(' · ')+ ' · All Australia':matches.length?`${matches.length} ${matches.length===1?'beach':'beaches'} · All Australia`:businessesLoading?'Searching businesses…':rows?'No places found. Try another name or location.':'No beaches found. Try another name or location.';
 const expanded=open&&!!query.trim(),active=expanded&&index>=0&&index<suggestions.length?index:-1;
 useEffect(()=>{const dismiss=event=>{if(!host.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[]);
 useEffect(()=>{if(active>=0)document.getElementById(suggestionId+'-suggestion-'+active)?.scrollIntoView({block:'nearest'});},[active,suggestionId]);
 function select(row){setOpen(false);setIndex(-1);input.current?.blur();onSelect(row);}
 function submit(event){event.preventDefault();setOpen(false);setIndex(-1);onSearch(event);}
 function keyDown(event){
  if(event.nativeEvent.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);setIndex(-1);}
  else if((event.key==='ArrowDown'||event.key==='ArrowUp')&&suggestions.length){event.preventDefault();setOpen(true);setIndex(event.key==='ArrowDown'?(active+1)%suggestions.length:(active<0?suggestions.length-1:(active-1+suggestions.length)%suggestions.length));}
  else if(event.key==='Enter'&&active>=0){event.preventDefault();select(suggestions[active]);}
 }
 return <form ref={host} className={'fm-search-form '+className} role="search" aria-label={label} action="/map" method="get" onSubmit={submit} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>
  <label className="sr-only" htmlFor={id}>{label}</label>
  <input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded?suggestionId+'-suggestions':undefined} aria-activedescendant={active>=0?suggestionId+'-suggestion-'+active:undefined} name="q" placeholder={placeholder} value={query} onChange={event=>{onQuery(event.target.value);setOpen(true);setIndex(-1);}} onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onKeyDown={keyDown} autoComplete="off"/>
  <button type="submit" aria-label={submitLabel}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>
  {expanded&&<div className="fm-search-suggestions">
   <p className="fm-search-summary" role="status">{matches.length?summary:error&&!directory?'Beach search unavailable. You can still search the map.':!directory?(rows?'Loading places…':'Loading beaches…'):summary}</p>
   {error&&onRetry&&<button type="button" className="fm-search-retry" onClick={onRetry}>Retry beach search</button>}
   {businessesError&&<div className="fm-search-summary" role="status">Business search is unavailable. Beach search still works.{onRetryBusinesses&&<button type="button" className="fm-search-retry" onClick={onRetryBusinesses}>Retry business search</button>}</div>}
   <ul id={suggestionId+'-suggestions'} role="listbox" aria-label={resultsLabel}>{suggestions.map((row,i)=><li key={row.id} id={suggestionId+'-suggestion-'+i} role="option" aria-selected={active===i} onPointerDown={event=>event.preventDefault()} onPointerMove={()=>setIndex(i)} onClick={()=>select(row)}>
    <span className="fm-search-pin" aria-hidden="true"><svg viewBox="0 0 24 24">{row.kind==='business'?<path d="M4 10h16v11H4zM2 10l3-7h14l3 7M9 21v-7h6v7"/>:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>}</svg></span>
    <span className="fm-search-place"><strong>{row.name}</strong><small>{row.kind==='business'?'Business · ':''}{row.area||'Australia'}{!validPoint(row.point)?' · Location not mapped':''}</small></span>
    <svg className="fm-search-result-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
   </li>)}</ul>
   {matches.length>0&&<button className="fm-search-all" type="button" onPointerDown={event=>event.preventDefault()} onClick={submit}>See all {matches.length} {matches.length===1?'result':'results'} <span aria-hidden="true">↗</span></button>}
  </div>}
 </form>;
}
