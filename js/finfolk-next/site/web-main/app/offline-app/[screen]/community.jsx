'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useAppSearchParams} from '../../../lib/use-app-router.js';
import {usePublicData} from '../../../lib/public-data-cache.jsx';
import CommunityLayout from '../../(community)/layout.jsx';
import DirectoryView from '../../(community)/directory/view.jsx';
import DirectoryHub from '../../(community)/directory/hub.jsx';
import ListingView from '../../(community)/directory/[id]/view.jsx';
import EventsView from '../../(community)/events/view.jsx';
import EventDetail from '../../(community)/events/[id]/screen.jsx';
import EventEditor from '../../(community)/events/new/screen.jsx';
import EventInvitation from '../../(community)/events/invitation/screen.jsx';
import PageInvitation from '../../(community)/pages/invitation/screen.jsx';
import ErrorPage from '../../error.jsx';
import People from '../../(community)/people/screen.jsx';
import Profile from '../../(community)/profile/screen.jsx';
import ProfileEditor from '../../(community)/profile/edit/screen.jsx';
function selected(query,keys){const values=new URLSearchParams();for(const key of keys){const all=query.getAll(key);if(all.length===1)values.set(key,all[0]);}return values;}
function identifier(path){const id=path.split('/').at(-1);try{return decodeURIComponent(id);}catch{return id;}}
function PublicResult({record,retry,children}){return record?.data?children(record.data):record?.error?<ErrorPage reset={retry}/>:<p role="status">Loading published data…</p>;}
export function PublicHandleProfile(){const id=identifier(usePathname()),data=usePublicData('publicProfileByHandle',{handle:id});if(data.record&&!data.record.loading&&data.record.data===null)return <section><h1>Profile unavailable</h1><a href="/people">Meet the folk</a></section>;return <PublicResult {...data}>{member=><Profile target={member.id} initialPublic={member}/>}</PublicResult>;}
export function Directory({values}={}){const params=useAppSearchParams(),selectedQuery=selected(params,['q','category','state','locality','offset','site']),query=values?new URLSearchParams(values):selectedQuery,data=usePublicData('publicDirectory',Object.fromEntries(query));return <DirectoryHub managing={params.get('manage')==='1'} creating={params.get('create')==='1'} filters={Object.fromEntries(query)}><PublicResult {...data}>{value=><DirectoryView data={value} query={query}/>}</PublicResult></DirectoryHub>;}
function Listing(){const id=identifier(usePathname()),listing=usePublicData('publicDirectoryDetail',{id}),events=usePublicData('publicEvents',{page:id});useEffect(()=>{if(listing.record?.data)document.title=listing.record.data.name+' · FinFolk';},[listing.record?.data]);return <PublicResult {...listing}>{row=><PublicResult {...events}>{future=><ListingView row={row} future={future}/>}</PublicResult>}</PublicResult>;}
export function Events({values}={}){const selectedQuery=selected(useAppSearchParams(),['q','location','category','from','offset','page']),params=values?new URLSearchParams(values):selectedQuery,data=usePublicData('publicEvents',Object.fromEntries(params));return <PublicResult {...data}>{value=><EventsView data={value} params={params}/>}</PublicResult>;}
function Event(){const id=identifier(usePathname()),data=usePublicData('publicEvent',{id});useEffect(()=>{if(data.record?.data)document.title=data.record.data.document.title+' · FinFolk';},[data.record?.data]);return <PublicResult {...data}>{value=><EventDetail id={id} publicEvent={value}/>}</PublicResult>;}
function ProfileScreen({screen}){const query=useAppSearchParams(),path=usePathname(),catalog=usePublicData('siteCatalog',{}),location=query.getAll('location').length===1?query.get('location'):'';return <PublicResult {...catalog}>{data=>screen==='people'?<People sites={data.beaches||[]} filters={Object.fromEntries(['q','location','availability','experience'].map(key=>[key,query.getAll(key).length===1?query.get(key):'']))}/>:screen==='profile-edit'?<ProfileEditor sites={data.beaches||[]}/>:<Profile key={path} sites={data.beaches||[]} location={location} target={screen==='member'?identifier(path):null}/>}</PublicResult>;}
function PrivateScreen({screen}){const query=useAppSearchParams();if(screen==='event-editor')return <EventEditor values={Object.fromEntries(['id','duplicate','page'].map(key=>[key,query.getAll(key).length===1?query.get(key):'']))}/>;const token=query.getAll('token').length===1?query.get('token'):'';return screen==='event-invitation'?<EventInvitation token={token}/>:<PageInvitation token={token}/>;}
// A shared offline template has a different build-time pathname. Mount the
// route-aware frame only on the client, where the actual destination is known.
export default function CommunityDocument({screen}){const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);return ready? <CommunityLayout>{screen==='directory'?<Directory/>:screen==='public-profile'?<PublicHandleProfile/>:screen==='listing'?<Listing/>:screen==='events'?<Events/>:screen==='event'?<Event/>:['people','profile','profile-edit','member'].includes(screen)?<ProfileScreen screen={screen}/>:<PrivateScreen screen={screen}/>}</CommunityLayout>:null;}
