'use client';
import {useEffect,useRef,useState} from 'react';
import {useSession} from '../../../../lib/use-session.js';
import {runModel,pageActions} from '../../../../lib/page-models.js';
import '../operator.css';
const evidenceFields=[['ownedHelp','Visible help reply on a FinFolk post'],['mentionHelp','Visible help reply to a mention on another account’s post'],['nonFollowerHelp','Help reply to a separate unregistered non-follower'],['privateGuidance','Account command received public DM guidance without a code']];
const confirmations=[['visibleReplies','I saw the actual TikTok comment replies.'],['ownedAndMention','I verified replies on a FinFolk post and an external mentioned post.'],['nonFollowerHelp','The separate help tester was unregistered, not following, and saw the reply.'],['noPrivateData','Account commands exposed no codes or personal details in public.']];
export default function TikTokCommentsOperator(){
  const session=useSession(),actor=session.user?.uid;
  const [record,setRecord]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[senders,setSenders]=useState(''),[events,setEvents]=useState({}),[checked,setChecked]=useState({}),[detail,setDetail]=useState(null);
  const version=useRef(0),lock=useRef(false);
  const current=()=>session.client?.user?.uid===actor;
  useEffect(()=>{version.current++;lock.current=false;setRecord(null);setDetail(null);setMessage('');setBusy(false);setSenders('');setEvents({});setChecked({});
    if(!actor)return;
    const generation=version.current;
    runModel(session.client,'tiktok-comments-operator','status').then(data=>{if(generation===version.current&&current())setRecord({actor,data});}).catch(error=>{if(generation===version.current&&current())setMessage(error.message);});
    return()=>{version.current++;};
  },[actor,session.client]);
  const data=record&&record.actor===actor&&current()?record.data:null;
  async function run(work){if(lock.current||!actor||!current())return;lock.current=true;setBusy(true);setMessage('');const generation=version.current;
    try{const result=await work(pageActions(session.client,'tiktok-comments-operator'));if(generation!==version.current||!current())return;
      if(result?.authorizationURL){const url=new URL(result.authorizationURL);if(url.protocol!=='https:'||!['www.tiktok.com','tiktok.com'].includes(url.hostname))throw Error('Unexpected authorization address');window.location.assign(url.href);return;}
      const next=await runModel(session.client,'tiktok-comments-operator','status');if(generation===version.current&&current()){setRecord({actor,data:next});setMessage('Updated.');}}
    catch(error){if(generation===version.current&&current())setMessage(error.message);}
    finally{if(generation===version.current){lock.current=false;setBusy(false);}}
  }
  const generation=data?.connection.generation;
  function inspect(id){const expected=version.current;run(async()=>{const value=await runModel(session.client,'tiktok-comments-operator','event',{id});if(current()&&expected===version.current)setDetail({actor,data:value});return {};});}
  return <main className="platform-status tiktok-operator">
    <nav className="platform-topbar"><a href="/account">FinFolk / operations</a><a href="/admin/tiktok">TikTok messages ↗</a></nav>
    <header className="platform-heading"><div><span className="platform-eyebrow">TIKTOK</span><h1>Comment operations.</h1><p>Authorize Accounts and Mentions access, verify public replies, then enable comment commands.</p></div></header>
    <p role="status">{message||(!actor?'Sign in with your verified operator account.':!data?'Loading operator access…':'')}</p>
    {actor&&<button disabled={busy} onClick={()=>run(async()=>({}))}>Refresh</button>}
    {data&&<>
      <section className="platform-panel"><h2>Connection</h2><p>Mode: <strong>{data.connection.mode}</strong></p><p>Authorization: {data.connection.checks.authorized?'Verified':'Required'} · Subscription: {data.connection.checks.subscribed?'Verified':'Required'}</p>
        <p>Use /help, /status, /site or /privacy with @finfolk.com.au. Account commands direct people to a private DM. Publishing, visits and points remain off.</p>
        <button disabled={busy} onClick={()=>run(actions=>actions.authorize({}))}>Authorize comment access</button>{' '}
        <button disabled={busy} onClick={()=>run(actions=>actions.pause({generation}))}>Pause delivery</button>
        <label>Pilot sender IDs from signed receipts<textarea value={senders} onChange={event=>setSenders(event.target.value)} placeholder="One sender ID per line"/></label>
        <button disabled={busy||!senders.trim()} onClick={()=>run(actions=>actions.activate({generation,mode:'pilot',senders:senders.split(/[\s,]+/).filter(Boolean)}))}>Start diagnostic pilot</button>
      </section>
      <section className="platform-panel"><h2>Comment-to-DM</h2><p>Automatic private replies from comments are unavailable here. TikTok currently limits this feature to eligible accounts registered in the US, Vietnam, Indonesia or Thailand. Ask people to start a DM for account commands.</p></section>
      <section className="platform-panel"><h2>Delivery health</h2><p>{data.health.pending} pending · {data.health.uncertain} uncertain · {data.health.failed} failed · {data.health.waiting} waiting</p><p>Check uncertain sends under the actual TikTok comment. They are never automatically resent.</p>
        <ul>{(data.health.events||[]).map(event=><li key={event.id}><button disabled={busy} onClick={()=>inspect(event.id)}><code>{event.id}</code></button> · {event.status}{event.error?' · '+event.error:''}</li>)}</ul>
        {detail&&detail.actor===actor&&<p>Post: <code>{detail.data.mediaId||'none'}</code> · Comment: <code>{detail.data.commentId||'none'}</code> · Command: {detail.data.command||'none'} · Signed sender ID: <code>{detail.data.senderId}</code> · Delivery: {detail.data.delivery.state||'pending'} · Provider receipt: <code>{detail.data.delivery.providerMessageId||'none'}</code></p>}
      </section>
      <section className="platform-panel"><h2>Comment acceptance</h2><p>Use fresh receipts from consenting testers in the current pilot. Provider acceptance alone does not prove a visible reply.</p>
        {evidenceFields.map(([key,label])=><label key={key}>{label}<input value={events[key]||''} onChange={event=>setEvents(value=>({...value,[key]:event.target.value.trim()}))} placeholder="Receipt UUID"/></label>)}
        {confirmations.map(([key,label])=><label key={key}><input type="checkbox" checked={!!checked[key]} onChange={event=>setChecked(value=>({...value,[key]:event.target.checked}))}/>{label}</label>)}
        <button disabled={busy||!evidenceFields.every(([key])=>events[key])||!confirmations.every(([key])=>checked[key])} onClick={()=>run(actions=>actions.acceptance({generation,...events,confirmations:checked}))}>Record actual acceptance</button>{' '}
        <button disabled={busy} onClick={()=>run(actions=>actions.activate({generation,mode:'live',senders:[]}))}>Enable public comment replies</button>
      </section>
    </>}
  </main>;
}
