'use client';
import {useEffect,useRef,useState} from 'react';
import {usePageModel} from '../../../../lib/use-page-model.js';
import GuestAccount from '../guest.jsx';
import AccountFailure from '../failure.jsx';
import MemberTour,{tourSeen} from '../member-tour.jsx';
import Checkin from './screen.jsx';
export default function CheckinAccount({session,sites,site,requestTour}){
 const {record,refresh}=usePageModel(session,'account-identity','me'),[tour,setTour]=useState(false),requested=useRef(false);
 useEffect(()=>{if(!session.user||!record?.data)return;const key='finfolk:member-tour:3:'+session.user.uid;if(requestTour&&!requested.current){requested.current=true;setTour(true);return;}let seen=false;try{seen=!!localStorage.getItem(key)}catch{}if(!seen&&!tourSeen.has(key))setTour(true)},[session.user?.uid,!!record?.data,requestTour]);
 if(session.status==='ready'&&!session.user)return <GuestAccount session={session}/>;
 const denied=record?.error&&([401,403,410].includes(record.error.status)||record.error.message==='Account has been deleted.');
 return <><header className="acct-header"><div className="acct-header-copy"><p className="acct-eyebrow">YOUR SIDE OF THE COAST</p><h1>Check in</h1><p className="account-intro">Your spots. Your people. Your kind of water.</p></div></header>{session.status==='loading'?<p role="status">Restoring your sign-in…</p>:session.error||denied?<AccountFailure session={session} error={session.error||record.error} retry={session.error?session.retry:refresh}/>:session.user&&<div id="account-checkin" className="acct-panel" role="region" aria-label="Check in"><Checkin session={session} sites={sites} site={site} profile={record?.data?.profile}/></div>}{tour&&session.user&&<MemberTour session={session} close={()=>setTour(false)}/>}</>;
}
