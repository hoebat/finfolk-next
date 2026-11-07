'use client';
import {useEffect,useRef,useState} from 'react';
import {useSession} from '../../../lib/use-session.js';
import {useActorData} from '../../../lib/use-actor-data.js';
import './shop.css';
const number=value=>new Intl.NumberFormat('en-AU').format(value);
export default function Shop(){
 const session=useSession(),{record,refresh}=useActorData(session,'finnies',api=>api.request('/v1/me/finnies'));
 const [catalogue,setCatalogue]=useState(null),[failure,setFailure]=useState(''),[reload,setReload]=useState(0),[selected,setSelected]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState(null);
 const inFlight=useRef(false),keys=useRef(new Map()),identity=useRef(null);identity.current=session.user?.uid||null;
 useEffect(()=>{const controller=new AbortController();setFailure('');fetch('/shop/items',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('Finfolk Coop is temporarily unavailable.');return r.json();}).then(value=>setCatalogue(value.items)).catch(e=>{if(e.name!=='AbortError')setFailure(e.message);});return()=>controller.abort();},[reload]);
 useEffect(()=>{setSelected(null);setNotice(null);keys.current.clear();},[session.user?.uid]);
 async function redeem(){
  if(inFlight.current||!selected||!session.user)return;
  const actor=session.user.uid,item=selected;
  inFlight.current=true;setBusy(true);setNotice(null);
  const storageKey='finfolk:finnies-pending:'+actor+':'+item.id;
  let key=keys.current.get(item.id);try{key ||= sessionStorage.getItem(storageKey);}catch{}
  if(!key)key=crypto.randomUUID();keys.current.set(item.id,key);try{sessionStorage.setItem(storageKey,key);}catch{}
  try{const result=await session.client.request('/v1/me/finnies/redeem',{method:'POST',body:{itemId:item.id,expectedCost:item.cost,requestKey:key},idempotencyKey:key});
   if(identity.current!==actor)return;
   keys.current.delete(item.id);try{sessionStorage.removeItem(storageKey);}catch{}setNotice({actor,message:'Your reward is ready. Find the claim code in Your rewards below.'});setSelected(null);refresh();setReload(n=>n+1);
  }catch(e){if(identity.current===actor){if(e.status>=400&&e.status<500){keys.current.delete(item.id);try{sessionStorage.removeItem(storageKey);}catch{}setSelected(null);}setNotice({actor,error:true,message:e.message});refresh();setReload(n=>n+1);}}
  finally{inFlight.current=false;setBusy(false);}
 }
 const wallet=record?.data,balance=wallet?.balance||0;
 return <section className="finnie-shop"><div className="finnie-heading"><p className="finnie-eyebrow">GOOD THINGS FOR OUR WATER PEOPLE</p><h1>Finfolk Coop</h1><p>Turn your participation into something good. Spend your Finnies on rewards from FinFolk outlets.</p></div>
 <section className="finnie-wallet" aria-label="Your Finnies"><div><span>Your balance</span><strong><span className="finnie-symbol" aria-hidden="true"/>{session.user?record?.loading||!record?'…':number(balance):'—'} <small>Finnies</small></strong></div>{session.user?<p>Earn through participation and verified referrals. Choose a reward below to spend your Finnies.</p>:<p><a href="/account?returnTo=%2Fshop">Sign in</a> to see your Finnies and claim rewards.</p>}</section>
 {session.error&&<p role="alert">{session.error.message}<button onClick={session.retry}>Retry sign-in</button></p>}
 {record?.error&&<p role="alert">{record.error.message} <button onClick={refresh}>Retry balance</button></p>}
 {notice&&notice.actor===session.user?.uid&&<p role={notice.error?'alert':'status'}>{notice.message}</p>}
 {failure?<p role="alert">{failure} <button onClick={()=>setReload(n=>n+1)}>Retry shop</button></p>:!catalogue?<p role="status">Loading rewards…</p>:!catalogue.length?<section className="finnie-empty"><h2>Good things are on their way</h2><p>Our outlets haven’t published any rewards yet. Your Finnies will be here when they do.</p></section>:<section aria-label="Rewards" className="finnie-grid">{catalogue.map(item=><article className="finnie-card" key={item.id}><span className="finnie-eyebrow">{item.outlet}</span><h2>{item.title}</h2><p>{item.description}</p><strong><span className="finnie-symbol" aria-hidden="true"/>{number(item.cost)} Finnies</strong><p className="finnie-availability">{item.stock===0?'Sold out':item.stock===null?'Available':`${item.stock} available`}{item.expires_at&&` · Available until ${new Date(item.expires_at).toLocaleDateString('en-AU')}`}</p>{!session.user?<a className="finnie-button" href="/account?returnTo=%2Fshop">Sign in to redeem</a>:<button disabled={busy||item.stock===0||!wallet||!!record.error||balance<item.cost} onClick={()=>{setNotice(null);setSelected(item);}}>{balance<item.cost?`${number(item.cost-balance)} more Finnies needed`:'Redeem reward'}</button>}</article>)}</section>}
 {selected&&session.user&&<section className="finnie-confirm" role="region" aria-label="Confirm reward"><h2>Redeem {selected.title}?</h2><p>You’ll spend <strong><span className="finnie-symbol" aria-hidden="true"/>{number(selected.cost)} Finnies</strong>. Your remaining balance will be {number(Math.max(0,balance-selected.cost))} Finnies.</p><p>{selected.instructions}</p><button disabled={busy} onClick={redeem}>{busy?'Claiming your reward…':'Confirm redemption'}</button><button disabled={busy} onClick={()=>setSelected(null)}>Cancel</button></section>}
 {session.user&&wallet&&<section className="finnie-history"><h2>Your rewards</h2>{!wallet.redemptions.length?<p>Your claimed rewards and fulfilment instructions will appear here.</p>:wallet.redemptions.map(claim=><article className="finnie-card" key={claim.id}><span className="finnie-eyebrow">{claim.item.outlet} · {claim.status==='claimed'?'Ready to use':claim.status==='fulfilled'?'Used':'Refunded'}</span><h3>{claim.item.title}</h3><p>{number(claim.cost)} Finfolk Coop · {new Date(claim.created_at).toLocaleDateString('en-AU')}</p>{claim.status==='claimed'&&<><p>{claim.item.instructions}</p><p>Show this claim code to the outlet:</p><code className="finnie-code">{claim.code}</code></>}</article>)}</section>}
 <p className="finnie-footer"><a href="/directory">Explore FinFolk outlets</a> · <a href="/shop/manage">Manage shop</a></p></section>;
}
