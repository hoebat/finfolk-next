'use client';
import {useEffect,useState} from 'react';
import {AccountIcon} from '../presentation.jsx';
import {usePageRead} from '../../../../lib/use-page-data.js';
import {pageActions} from '../../../../lib/page-models.js';
import {Button,useInstagramAction} from './tools.jsx';
export default function InstagramTools({session,provider='instagram'}) {
  const label=provider==='tiktok'?'TikTok':'Instagram',model=provider+'-linking';
  const {record,refresh}=usePageRead(session,model,'state');
  const action=useInstagramAction(session),[code,setCode]=useState('');
  const state=record?.data;
  useEffect(()=>{setCode('');action.notify('');},[session.user?.uid,session.client]);
  function connect(){action.run(()=>pageActions(session.client,model).connect({code}),()=>{setCode('');refresh();action.notify(label+' connected.');});}
  function disconnect(){action.run(()=>pageActions(session.client,model).disconnect({connectionId:state.connectionId,identityVersion:state.identityVersion}),()=>{refresh();action.notify(label+' disconnected.');});}
  return <section className="account-card actions-panel" id={provider==='tiktok'?'tiktok-member-actions':'member-actions'}>
    <div className="acct-card-topline"><span className="eyebrow">CONNECTED CHANNELS</span><AccountIcon name="instagram"/></div>
    <h2>Connect {label}</h2>
    <p>Link your {label} account to FinFolk. Your posts stay on {label}; connecting leaves public sharing off.</p>
    <p role="status">{action.message||record?.error?.message||(!state?'Loading your connection…':'')}</p>
    {record?.error&&<Button disabled={action.busy} onClick={refresh}>Try again</Button>}
    {state?.connected?<><p>Your {label} account{state.handle?' @'+state.handle:''} is connected.</p>
      <Button disabled={action.busy} onClick={disconnect}>Remove link</Button></>:state&&<>
      <ol><li>Follow {provider==='instagram'?<a href="https://www.instagram.com/finfolk.com.au/" target="_blank" rel="noopener noreferrer">@finfolk.com.au</a>:'FinFolk on TikTok'}.</li>
        <li>Send <strong>/connect</strong> in a {label} DM.</li><li>Enter the eight-character code below within ten minutes.</li></ol>
      <form onSubmit={event=>{event.preventDefault();if(!action.busy&&code.trim())connect();}}>
        <label>Connection code<input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={100} value={code} onChange={event=>setCode(event.target.value)}/></label>
        <button type="submit" className="secondary" disabled={action.busy||!code.trim()}>Connect {label}</button>
      </form><p>Verify your FinFolk email before connecting. Only enter your code on FinFolk.</p></>}
    <p>Send /help in {label} for currently available commands.</p>
  </section>;
}
