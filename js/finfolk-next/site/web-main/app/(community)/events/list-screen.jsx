"use client";
import {useEffect,useState} from 'react';
import {useAppSearchParams} from '../../../lib/use-app-router.js';
import {readPublicPageModel} from '../../../lib/public-page-client.js';
import EventsView from './view.jsx';
export default function EventList(){
 const params=useAppSearchParams(),query=params.toString(),[record,setRecord]=useState(null),[retry,setRetry]=useState(0);
 useEffect(()=>{let alive=true;setRecord(null);readPublicPageModel('events','events',{},undefined,{query:Object.fromEntries(new URLSearchParams(query))}).then(data=>alive&&setRecord({data})).catch(error=>alive&&setRecord({error}));return()=>{alive=false;};},[query,retry]);
 if(!record)return <p role="status">Loading events…</p>;
 if(record.error)return <p role="alert">Events unavailable. <button onClick={()=>setRetry(v=>v+1)}>Try again</button></p>;
 return <EventsView data={record.data} params={new URLSearchParams(query)}/>;
}
