"use client";
import {useEffect,useState} from 'react';
import {Feature} from '../../../feature-flags.jsx';
import {readPublicPageModel} from '../../../../lib/public-page-client.js';
function Collection({id}){
 const [data,setData]=useState(null);
 useEffect(()=>{let alive=true;readPublicPageModel('listing','events',{},undefined,{id}).then(value=>alive&&setData(value)).catch(()=>alive&&setData({error:true}));return()=>{alive=false;};},[id]);
 return <section><h2>Upcoming events</h2>{!data?<p role="status">Loading events…</p>:data.error?<p>Events unavailable.</p>:data.events.length?data.events.map(event=><a className="profile-action" href={'/events/'+event.id} key={event.id}>{event.document.title}</a>):<p>No upcoming public events.</p>}</section>;
}
export default function UpcomingEvents({id}){return <Feature name="events"><Collection id={id}/></Feature>;}
