'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {definition} from '../../../lib/page-models.js';
import {usePublicData} from '../../../lib/public-data-cache.jsx';
import Report from '../../(atlas)/reports/[id]/screen.jsx';

import Landing from '../../landing-view.jsx';
import AtlasLayout from '../../(atlas)/layout.jsx';
import {useAtlas} from '../../(atlas)/atlas/runtime.jsx';
import AccountFrame from '../../(atlas)/account/frame.jsx';
import Logbook from '../../(atlas)/logbook/screen.jsx';
import Sections from '../../(atlas)/discover/sections.jsx';
import {OfflineDocumentContext,useAppSearchParams as useSearchParams} from '../../../lib/use-app-router.js';
import CommunityDocument,{Directory,Events} from './community.jsx';
const directory=<Directory values={{}}/>,events=<Events values={{}}/>;
export default function OfflineDocument({screen}){
 // After reconnect, replace the offline template's routing tree with the
 // server's real route before client navigation or account actions resume.
 useEffect(()=>{document.documentElement.dataset.finfolkOffline='true';const path=location.pathname,reconnect=()=>location.reload(),traverse=event=>{if(location.pathname===path){event.stopImmediatePropagation();window.dispatchEvent(new CustomEvent('finfolk:offline-navigation',{detail:{traversal:true}}));}};window.addEventListener('online',reconnect);window.addEventListener('popstate',traverse,true);return()=>{delete document.documentElement.dataset.finfolkOffline;window.removeEventListener('online',reconnect);window.removeEventListener('popstate',traverse,true);};},[]);
 if(screen==='home')return <>{definition('home').styles.map(name=><link key={name} rel="stylesheet" href={'/'+name+'.css'}/>)}<Landing/></>;
 if(['directory','listing','events','event','event-editor','event-invitation','page-invitation','people','profile','profile-edit','member'].includes(screen))return <OfflineDocumentContext.Provider value={true}><CommunityDocument screen={screen}/></OfflineDocumentContext.Provider>;
 return <OfflineDocumentContext.Provider value={true}><AtlasLayout><AtlasDocument screen={screen}/></AtlasLayout></OfflineDocumentContext.Provider>;
}
function AtlasDocument({screen}){
 const {state}=useAtlas(),query=useSearchParams(),sites=state.directory?.beaches||[];
 if(screen==='report')return <OfflineReport/>;
 if(screen==='account')return <AccountFrame sites={sites}/>;
 if(screen==='logbook')return <Logbook sites={sites} values={{create:query.get('new')||'',session:query.get('session')||'',profile:query.get('profile')||''}}/>;
 return <Sections directoryPage={query.get('section')==='directory'?directory:null} eventsPage={query.get('section')==='events'?events:null}/>;
}

function OfflineReport(){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);const path=usePathname();let id=path.split('/').at(-1);try{id=decodeURIComponent(id);}catch{}const valid=/^[a-f0-9-]{36}$/.test(id),{record}=usePublicData('publicTrip',{id},{enabled:valid&&ready});useEffect(()=>{document.title=(record?.data?.title||'Trip report unavailable')+' · FinFolk';},[record?.data]);return !ready?null:valid&&!record?.data&&!record?.error?<p role="status">Loading trip report…</p>:<Report key={id} id={id} report={record?.data||null} error={!valid?'Choose a valid trip report.':record?.error?.message}/>;}
