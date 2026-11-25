 'use client';
import {usePathname} from 'next/navigation';
import {useEffect} from 'react';
import {usePageData} from '../../../../lib/use-page-data.js';
import {EditorForm} from '../../../(community)/profile/edit/screen.jsx';
import ThemeSettings from '../theme-settings.jsx';
import MessagingSettings from '../messaging-settings.jsx';
import Privacy from '../privacy/screen.jsx';
import './settings.css';
const categories=[['profile','Profile','Your identity and life in the water.'],['privacy','Privacy & connections','Choose what you share and who you connect with.'],['appearance','Appearance','Make FinFolk feel like you.'],['account','Account','Manage your account and access.']];
export default function Settings({session,sites,account,retry}){
 const path=usePathname(),category=path.split('/')[3]||'appearance',{record,refresh}=usePageData(session,'profile-editor');
 const admin=account?.data?.status.admin,items=admin?[...categories,['messaging','Messaging administration','Instagram messaging controls.']]:categories,current=items.find(x=>x[0]===category);
 useEffect(()=>{document.getElementById('settings-title')?.focus();},[category]);
 return <div className="ff-settings"><header><p className="settings-eyebrow">YOUR FINFOLK</p><h1>Settings</h1><p>A little more you. Settle in and make yourself at home.</p></header><div className="settings-layout"><nav aria-label="Settings categories">{items.map(([id,title])=><a key={id} href={'/account/settings/'+id} aria-current={category===id?'page':undefined}>{title}<span aria-hidden="true">↗</span></a>)}</nav><section className="settings-content" aria-labelledby="settings-title"><h2 id="settings-title" tabIndex={-1}>{current?.[1]||'Settings unavailable'}</h2><p className="settings-description">{current?.[2]}</p>{session.status==='loading'||session.user&&(!account||account.loading)?<p role="status">Loading settings…</p>:session.error||account?.error?<div role="alert"><p>{(session.error||account.error).message}</p><button onClick={session.error?session.retry:retry}>Try again</button></div>:!current?<p>This settings category is unavailable.</p>:category==='appearance'?<ThemeSettings/>:category==='messaging'?<MessagingSettings session={session}/>:category==='account'?<><section className="account-card"><h3>Your account</h3><p>{session.user?.email}</p></section><Privacy session={session} initial={account.data.me.profile} sites={sites} mode="account"/></>:record?.error?<div role="alert"><p>{record.error.message}</p><button onClick={refresh}>Try again</button></div>:!record?.data?<p role="status">Loading your profile…</p>:<><EditorForm key={session.user.uid+category} session={session} sites={sites} {...record.data} category={category}/>{category==='privacy'&&<Privacy session={session} initial={record.data.profile} sites={sites} mode="privacy"/>}</>}</section></div></div>;
}
