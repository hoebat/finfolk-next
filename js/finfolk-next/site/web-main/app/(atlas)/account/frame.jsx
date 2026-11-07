'use client';
import {useAppRouter as useRouter,useAppSearchParams as useSearchParams} from '../../../lib/use-app-router.js';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useSession} from '../../../lib/use-session.js';
import {usePageData} from '../../../lib/use-page-data.js';
import {Button} from '../logbook/tools.jsx';
import Checkin from './checkin/screen.jsx';
import Posts from './posts/screen.jsx';
import InstagramTools from './instagram/screen.jsx';
import SiteSubmissions from './sites/screen.jsx';
import Review from './review/screen.jsx';
import ThemeSettings from './theme-settings.jsx';
import MessagingSettings from './messaging-settings.jsx';
import Privacy from './privacy/screen.jsx';
import MemberTour,{tourSeen} from './member-tour.jsx';
import GuestAccount from './guest.jsx';
import AccountFailure from './failure.jsx';
import {accountURL,accountReturnDestination} from './routing.js';
import {useAtlas} from '../atlas/runtime.jsx';
export const accountTabs=[['checkin','Check in'],['posts','Your posts'],['instagram','Instagram tools'],['profile','Profile & buddies'],['settings','Settings'],['sites','Dive sites']];

export default function AccountFrame({sites,children}){
 const session=useSession(),path=usePathname(),query=useSearchParams(),router=useRouter();
 const target=accountReturnDestination(query.get('returnTo'));
 const tab=path.endsWith('/instagram')?'instagram':path.endsWith('/review')?'admin':path.endsWith('/sites')?'sites':path.endsWith('/posts')?'posts':path.endsWith('/privacy')?'profile':path.endsWith('/settings')?'settings':'checkin',site=query.get('site')||'';
 useEffect(()=>{if(session.status==='ready'&&session.user&&target)router.replace(target);},[session.status,session.user?.uid,target,router]);
 if(session.status==='ready'&&session.user&&target)return <p role="status">Returning to your page…</p>;
 return <section id="account-page" className={'account-page'+(session.status==='ready'&&!session.user?' account-page-guest':'')} tabIndex={-1} aria-label="Your FinFolk account"><AccountBody key={session.user?.uid||'guest'} session={session} tab={tab} sites={sites} site={site} requestTour={query.get('tour')==='1'}/>{children}</section>;
}
function AccountBody({session,tab:requested,sites,site,requestTour}){const {activateAccountIntegration,revokeAccountIntegration}=useAtlas();const router=useRouter(),requestedTour=useRef(false),focusTab=useRef(false),[hydrated,setHydrated]=useState(false);useEffect(()=>setHydrated(true),[]);const {record,refresh}=usePageData(session,'account'),[tour,setTour]=useState(false),tab=requested==='admin'&&record?.data&&!record.data.status.admin?'checkin':requested,tabs=record?.data?.status.admin?[...accountTabs,['admin','Review']]:accountTabs;
 useEffect(()=>{if(!session.user)return;if(record?.data)activateAccountIntegration(session.user);else if(record?.error&&(record.error.status===401||record.error.status===403||record.error.message==='Account has been deleted.'))revokeAccountIntegration(session.user);},[session.user,record?.data,record?.error,activateAccountIntegration,revokeAccountIntegration]);
 useEffect(()=>{if(!session.user||!record?.data)return;if(requestTour&&!requestedTour.current){requestedTour.current=true;setTour(true);return;}const key='finfolk:member-tour:3:'+session.user.uid;let seen=false;try{seen=!!localStorage.getItem(key);}catch{}if(!seen&&!tourSeen.has(key))setTour(true);},[session.user?.uid,!!record?.data,requestTour]);
 useEffect(()=>{if(focusTab.current){document.getElementById('account-tab-'+tab)?.focus();focusTab.current=false;}},[tab]);
 if(session.status==='ready'&&!session.user)return <GuestAccount session={session}/>;
 return <><h1>Your FinFolk</h1><p className="account-intro">Your spots. Your people. Your kind of water.</p><Button disabled={!hydrated} onClick={()=>setTour(true)}>How FinFolk works</Button><Button disabled={!hydrated} onClick={()=>router.push('/logbook')}>My sessions</Button><a href="/shop">Finfolk Coop</a>{session.status==='loading'||session.user&&(!record||record.loading)?<p role="status">Loading your account…</p>:session.error||record?.error?<AccountFailure session={session} error={session.error||record.error} retry={session.error?session.retry:refresh}/>:!session.user?<p><a href={'/account?returnTo='+encodeURIComponent('/account/'+(tab==='profile'?'privacy':tab))}>Sign in to continue.</a></p>:record?.data&&<><div className="account-tabs" role="tablist" aria-label="Your account" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const buttons=[...e.currentTarget.children],current=buttons.indexOf(document.activeElement),index=e.key==='Home'?0:e.key==='End'?buttons.length-1:(current+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;focusTab.current=true;buttons[index].click();}}>{tabs.map(([key,label])=><Button key={key} className="account-tab" id={'account-tab-'+key} data-tab={key} role="tab" aria-controls={'account-'+key} aria-selected={tab===key} tabIndex={tab===key?0:-1} onClick={()=>{if(key!==tab){if(['checkin','settings','profile','posts','sites','admin','instagram'].includes(key))router.push(accountURL(key));else location.assign(accountURL(key));}}}>{label}</Button>)}</div>{tabs.map(([key])=><div key={key} id={'account-'+key} role="tabpanel" aria-labelledby={'account-tab-'+key} hidden={key!==tab}>{key==='checkin'?<Checkin session={session} sites={sites} site={site}/>:key==='settings'?<><ThemeSettings/><MessagingSettings session={session}/></>:key==='instagram'?<InstagramTools session={session} sites={sites}/>:key==='sites'?<SiteSubmissions session={session} sites={sites}/>:key==='admin'?<Review session={session} sites={sites}/>:key==='posts'?<Posts session={session} sites={sites} status={record.data.status}/>:key==='profile'?<Privacy session={session} initial={record.data.me.profile} sites={sites}/>:null}</div>)}</>}{tour&&<MemberTour session={session} close={()=>setTour(false)}/>}</>;
}
