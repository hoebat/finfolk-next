'use client';
import {AccountIcon} from '../presentation.jsx';
import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import {useFeatureFlags} from '../../../feature-flags.jsx';
import {usePageData} from '../../../../lib/use-page-data.js';
import {EditorForm} from '../../../(community)/profile/edit/screen.jsx';
import ThemeSettings from '../theme-settings.jsx';
import MessagingSettings from '../messaging-settings.jsx';
import {AccountAccess,VisibilitySettings} from './settings-controls.jsx';
import './settings.css';
const groups=[
 {title:'App preferences',items:[{id:'appearance',title:'Appearance',description:'Choose your theme and map colors.',icon:'settings'}]},
 {title:'Privacy & safety',items:[{id:'privacy',title:'Visibility & sharing',description:'Choose how other divers find you and what they see.',icon:'profile'},{id:'connections',title:'Buddies & blocked people',description:'Manage your connections, requests and blocked profiles.',icon:'profile'}]},
 {title:'Your account',items:[{id:'account',title:'Account access',description:'Email verification, sign out and account deletion.',icon:'admin'}]}
];
function ProfileEditor({session,sites}){const {record,refresh}=usePageData(session,'profile-editor');return record?.error?<div role="alert"><p>{record.error.message}</p><button onClick={refresh}>Try again</button></div>:!record?.data?<p role="status">Loading your profile…</p>:<EditorForm key={session.user.uid} session={session} sites={sites} {...record.data} category="profile"/>;}
export default function Settings({session,sites,account,retry}){
 const category=usePathname().replace(/\/+$/,'').split('/')[3]||'',{flags}=useFeatureFlags();
 const legacy=category==='profile'||category==='messaging',admin=account?.data?.status.admin;
 const current=groups.flatMap(group=>group.items).find(item=>item.id===category),home=!category;
 const title=home?'Settings':category==='profile'?'Edit profile':category==='messaging'?'Messaging administration':current?.title||'Settings unavailable';
 const href=item=>item.id==='connections'?(flags.buddies?'/buddies':'/account/privacy#social-buddies'):'/account/settings/'+item.id;
 useEffect(()=>{if(!document.activeElement?.closest('.ff-utility-menu'))document.getElementById('settings-title')?.focus();},[category]);
 const loading=session.status==='loading'||session.user&&(!account||account.loading),error=session.error||account?.error;
 return <div className={'ff-settings'+(home?' settings-home':' settings-detail')+(legacy?' settings-standalone':'')}>
  <header className="settings-heading">{!home&&<a className="settings-back" href={category==='profile'?'/profile':category==='messaging'?'/admin':'/account/settings'}><span aria-hidden="true">←</span> Back to {category==='profile'?'Profile':category==='messaging'?'administration':'Settings'}</a>}<h1 id="settings-title" tabIndex={-1}>{title}</h1><p>{home?'Your preferences, privacy and account, all in one place.':category==='profile'?'Your identity and life in the water.':current?.description}</p></header>
  <div className="settings-layout">{!legacy&&<nav className="settings-navigation" aria-label="Settings sections"><a className="settings-overview-link" href="/account/settings" aria-current={home?'page':undefined}>All settings</a>{groups.map(group=><div className="settings-nav-group" key={group.title}><h2>{group.title}</h2>{group.items.map(item=><a key={item.id} href={href(item)} aria-current={category===item.id?'page':undefined}>{item.title}</a>)}</div>)}</nav>}
   <section className="settings-content" aria-label={title}>{loading?<p role="status">Loading settings…</p>:error?<div role="alert"><p>{error.message}</p><button onClick={session.error?session.retry:retry}>Try again</button></div>:home?<div className="settings-groups">{groups.map(group=><section className="settings-group" key={group.title}><h2>{group.title}</h2><div className="settings-group-list">{group.items.map(item=><a className="settings-row" href={href(item)} key={item.id}><span className="settings-row-icon"><AccountIcon name={item.icon}/></span><span className="settings-row-copy"><strong>{item.title}</strong><small>{item.description}</small></span><AccountIcon name="arrow"/></a>)}</div></section>)}</div>:category==='appearance'?<ThemeSettings/>:category==='privacy'?<VisibilitySettings key={session.user.uid} session={session} profile={account.data.me.profile} connectionsHref={flags.buddies?'/buddies':'/account/privacy#social-buddies'}/>:category==='account'?<AccountAccess session={session}/>:category==='profile'?<ProfileEditor session={session} sites={sites}/>:category==='messaging'&&admin?<MessagingSettings session={session}/>:<p>{category==='messaging'?'Administration access is required.':'This settings section is unavailable.'}</p>}</section>
  </div>
 </div>;
}
