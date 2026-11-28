"use client";
import {useEffect,useState} from 'react';
import {readPublicPageModel} from '../../../../lib/public-page-client.js';
import {usePageModel} from '../../../../lib/use-page-model.js';
import {pageActions} from '../../../../lib/page-models.js';
import {ProfileSection} from '../../profile-layout.jsx';
import './instagram.css';
function Posts({items,review,busy}){return <div className="page-instagram-grid">{items.map(post=><Post key={post.id} post={post} review={review} busy={busy}/>)}</div>}
function Post({post,review,busy}){
 const [embed,setEmbed]=useState(false),safe=/^https:\/\/(www\.)?instagram\.com\/(p|reel)\/[A-Za-z0-9_-]+\/?$/.test(post.permalink),embedURL=safe?post.permalink.replace(/\/?$/,'/')+'embed/captioned/':null;
 return <article className="page-instagram-card"><a href={'https://www.instagram.com/'+encodeURIComponent(post.handle)+'/'} target="_blank" rel="noopener noreferrer">@{post.handle}</a><time dateTime={new Date(post.publishedAt).toISOString()}>{new Date(post.publishedAt).toLocaleDateString('en-AU')}</time><p>{post.caption||'Instagram '+post.mediaType.toLowerCase()}</p>{safe&&<><button className="profile-action" aria-expanded={embed} onClick={()=>setEmbed(!embed)}>{embed?'Close post':'View post here'}</button>{embed&&<iframe title={'Instagram post by @'+post.handle} src={embedURL} loading="lazy" referrerPolicy="no-referrer" allow="encrypted-media; fullscreen" allowFullScreen/>}<a className="profile-action" href={post.permalink} target="_blank" rel="noopener noreferrer">Open original post ↗</a></>}{review&&<><small>Publication: {post.state}</small><div className="profile-action-row">{['published','hidden'].filter(state=>state!==post.state).map(state=><button key={state} className="profile-action" disabled={busy} onClick={()=>review(post.id,state)}>{state==='published'?'Publish':'Hide'}</button>)}</div></>}</article>
}
export default function PageInstagram({id}){
 const [after,setAfter]=useState(null),[data,setData]=useState(null),[attempt,retry]=useState(0);
 useEffect(()=>{let alive=true;setData(null);readPublicPageModel('listing','instagram',{after},undefined,{id}).then(value=>alive&&setData(value)).catch(()=>alive&&setData({error:true}));return()=>{alive=false}},[id,after,attempt]);
 return <ProfileSection id="page-instagram" title="Instagram">{!data?<p role="status">Loading posts…</p>:data.error?<p>Posts unavailable. <button className="profile-action" onClick={()=>retry(x=>x+1)}>Try again</button></p>:<>{data.items.length?<Posts items={data.items}/>:<p className="profile-small">No published Instagram posts yet.</p>}{data.next&&<button className="profile-action" onClick={()=>setAfter(data.next)}>Older posts</button>}{after&&<button className="profile-action" onClick={()=>setAfter(null)}>Latest posts</button>}</>}</ProfileSection>
}
export function PageInstagramManager({id,session}){const [open,setOpen]=useState(false);return <details className="page-instagram-management" onToggle={event=>setOpen(event.currentTarget.open)}><summary>Instagram posts</summary>{open&&<Manager id={id} session={session}/>}</details>}
function Manager({id,session}){
 const [after,setAfter]=useState(null);
 const {record,refresh}=usePageModel(session,'page-owner','instagram',{id},{payload:{after}}),data=record?.data,[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function run(action,values){if(busy)return;const actor=session.user?.uid;setBusy(true);setMessage('');try{await pageActions(session.client,'page-owner',{id})[action](values);if(session.client.user?.uid===actor){refresh();setMessage('Saved.')}}catch(error){if(session.client.user?.uid===actor)setMessage(error.message)}finally{setBusy(false)}}
 return <div><p>Collect posts from this page’s reviewed Instagram accounts. Public Business and Creator accounts are supported. Choose whether posts appear on the public page.</p>{record?.error&&<p role="alert">{record.error.message} <button onClick={refresh}>Try again</button></p>}{!record&&<p role="status">Loading Instagram settings…</p>}{data&&<>{!data.handles.length&&<p>Add an Instagram link to the page and have it reviewed before collecting posts.</p>}{data.handles.map(handle=><Source key={handle} handle={handle} source={data.accounts.find(source=>source.handle===handle)} save={values=>run('instagram-save',values)} busy={busy}/>)}{!!data.accounts.length&&<button className="profile-action" disabled={busy} onClick={()=>run('instagram-refresh',{})}>Check for new posts</button>}<Posts items={data.items} busy={busy} review={(post,state)=>run('instagram-review',{post,state})}/>{data.next&&<button className="profile-action" onClick={()=>setAfter(data.next)}>Older posts</button>}{after&&<button className="profile-action" onClick={()=>setAfter(null)}>Latest posts</button>}</>}{message&&<p role="status">{message}</p>}</div>
}
function Source({handle,source,save,busy}){
 const [enabled,setEnabled]=useState(!!source?.enabled),[publicEnabled,setPublic]=useState(!!source?.publicEnabled);
 useEffect(()=>{setEnabled(!!source?.enabled);setPublic(!!source?.publicEnabled)},[source?.revision]);
 return <form className="page-instagram-source" onSubmit={event=>{event.preventDefault();save({handle,enabled,publicEnabled,expected:source?.revision||0})}}><h3>@{handle}</h3><label><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.target.checked)}/> Collect posts</label><label><input type="checkbox" checked={publicEnabled} onChange={event=>setPublic(event.target.checked)}/> Show published posts and automatically publish new posts</label><p className="profile-small">{(source?.status||'Not connected').replaceAll('_',' ')}{source?.lastError?' · '+source.lastError:''}</p><button className="profile-action" disabled={busy}>Save Instagram settings</button></form>
}
