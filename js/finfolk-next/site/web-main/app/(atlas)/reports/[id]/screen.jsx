'use client';
import {useState} from 'react';
import ReportBody from '../body.jsx';
import {Button} from '../../logbook/tools.jsx';
export default function Report({report,id,error}){const [copy,setCopy]=useState('Copy report link');return <section id="trip-page" className="trip-page" aria-label="Trip report">{report?<><Button onClick={()=>location.assign('/app?view=maps&site='+encodeURIComponent(report.beachId))}>Explore this beach</Button><Button onClick={async()=>{try{await navigator.clipboard.writeText(new URL('/reports/'+id,location.origin).href);setCopy('Link copied');}catch{setCopy('Copy the address from your browser');}}}>{copy}</Button><ReportBody report={report}/><a href={'/account/posts?reportTrip='+encodeURIComponent(id)}>Report a problem</a></>:<><h1>Trip report unavailable</h1><p>{error}</p></>}</section>}
