'use client';
import {useEffect,useState} from 'react';
import {AccountIcon} from '../presentation.jsx';
import {usePageRead} from '../../../../lib/use-page-data.js';
import {pageActions} from '../../../../lib/page-models.js';
import {Button,useInstagramAction} from './tools.jsx';
export default function InstagramTools({session}) {
  const {record,refresh}=usePageRead(session,'instagram-linking','state');
  const action=useInstagramAction(session),[code,setCode]=useState('');
  const state=record?.data;
  useEffect(()=>{setCode('');action.notify('');},[session.user?.uid,session.client]);
  function connect(){action.run(()=>pageActions(session.client,'instagram-linking').connect({code}),()=>{setCode('');refresh();action.notify('Instagram connected.');});}
  function disconnect(){action.run(()=>pageActions(session.client,'instagram-linking').disconnect({connectionId:state.connectionId,identityVersion:state.identityVersion}),()=>{refresh();action.notify('Instagram disconnected.');});}
  return <section className="account-card actions-panel" id="member-actions">
    <div className="acct-card-topline"><span className="eyebrow">CONNECTED CHANNELS</span><AccountIcon name="instagram"/></div>
    <h2>Connect Instagram</h2>
    <p>Link your Instagram account to FinFolk. Your posts stay on Instagram; connecting leaves public sharing off.</p>
    <p role="status">{action.message||record?.error?.message||(!state?'Loading your connection…':'')}</p>
    {record?.error&&<Button disabled={action.busy} onClick={refresh}>Try again</Button>}
    {state?.connected?<><p>Your Instagram account{state.handle?' @'+state.handle:''} is connected.</p>
      <Button disabled={action.busy} onClick={disconnect}>Remove link</Button></>:state&&<>
      <ol><li>Follow <a href="https://www.instagram.com/finfolk.com.au/" target="_blank" rel="noopener noreferrer">@finfolk.com.au</a>.</li>
        <li>Send <strong>/connect</strong> in an Instagram DM.</li><li>Enter the eight-character code below within ten minutes.</li></ol>
      <form onSubmit={event=>{event.preventDefault();if(!action.busy&&code.trim())connect();}}>
        <label>Connection code<input autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={100} value={code} onChange={event=>setCode(event.target.value)}/></label>
        <button type="submit" className="secondary" disabled={action.busy||!code.trim()}>Connect Instagram</button>
      </form><p>Verify your FinFolk email before connecting. Only enter your code on FinFolk.</p></>}
    <p>Send /help in Instagram for currently available commands.</p>
  </section>;
}
