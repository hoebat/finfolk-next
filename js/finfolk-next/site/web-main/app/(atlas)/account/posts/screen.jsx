'use client';
import {useAppSearchParams as useSearchParams} from '../../../../lib/use-app-router.js';
import {useState} from 'react';

import PostManager from './post-manager.jsx';
import TripManager from './trip-manager.jsx';
import Discovery from './discovery.jsx';
import {pageActions} from '../../../../lib/page-models.js';
import {Button,useLogbookAction} from '../../logbook/tools.jsx';
export default function Posts({session,sites,status}){const query=useSearchParams(),report=query.get('reportTrip');return <>{report&&<ReportIssue key={report} id={report} session={session}/>}<Discovery session={session} sites={sites}/><PostManager session={session} sites={sites} status={status}/><TripManager session={session} sites={sites}/></>}
function ReportIssue({id,session}){const [reason,setReason]=useState(''),[sent,setSent]=useState(false),{run,busy,message}=useLogbookAction(session,{formatError:e=>e.message});return <section className="account-card">{sent?<p>Report sent. Thank you.</p>:<><label>Describe the trip report issue<input name="trip-report-reason" value={reason} onChange={e=>setReason(e.target.value)}/></label><Button disabled={busy} onClick={()=>run(()=>pageActions(session.client,'trip-report').tripReport({id,reason}),()=>setSent(true))}>Send trip report</Button>{message&&<p role="status">{message}</p>}</>}</section>}
