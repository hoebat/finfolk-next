'use client';
import {useEffect,useState} from 'react';
import {Feature} from '../../../feature-flags.jsx';
import {readPublicPageModel} from '../../../../lib/public-page-client.js';
import {ProfileSection} from '../../profile-layout.jsx';
function eventDate(event){const date=new Date(event.starts_at);if(!Number.isFinite(date.getTime()))return null;return date.toLocaleDateString('en-AU',{month:'short',day:'numeric',year:'numeric',timeZone:event.timezone||'Australia/Sydney'});}
function Collection({id}){
 const [data,setData]=useState(null),[attempt,retry]=useState(0);
 useEffect(()=>{let alive=true;setData(null);readPublicPageModel('listing','events',{},undefined,{id}).then(value=>alive&&setData(value)).catch(()=>alive&&setData({error:true}));return()=>{alive=false;};},[id,attempt]);
 return <ProfileSection id="page-events" title="Upcoming events">{!data?<p className="profile-small" role="status">Loading events…</p>:data.error?<p className="profile-small">Events unavailable. <button className="profile-action" onClick={()=>retry(attempt+1)}>Try again</button></p>:data.events.length?<div className="page-events-grid">{data.events.map(event=><a className="page-event-card" href={'/events/'+event.id} key={event.id}>{eventDate(event)&&<small>{eventDate(event)}</small>}<h3>{event.document.title}</h3>{event.document.location&&<p>{event.document.location}</p>}<span>View event <span aria-hidden="true">↗</span></span></a>)}</div>:<p className="profile-small">No upcoming public events.</p>}</ProfileSection>;
}
export default function UpcomingEvents({id}){return <Feature name="events"><Collection id={id}/></Feature>;}
