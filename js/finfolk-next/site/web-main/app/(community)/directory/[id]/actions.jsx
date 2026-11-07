'use client';
import {useState} from 'react';
import {useSession} from '../../../../lib/use-session.js';
import {usePageModel} from '../../../../lib/use-page-model.js';
import {pageActions} from '../../../../lib/page-models.js';
export function ListingNavigation(){const session=useSession();return <><a className="profile-action" href="/directory">← Freediving directory</a>{session.user&&<a className="profile-action" href="/pages">My pages</a>}</>}
export default function ListingActions({id,managed}){
 const session=useSession();return <Actions key={session.user?.uid||'guest'} session={session} id={id} managed={managed}/>;
}
function Actions({session,id,managed}){
 const {record}=usePageModel(session,'listing','mine',{id}),[message,setMessage]=useState(null),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),actor=session.user?.uid;
 const notice=message?.actor===actor?message?.text:'';
 async function send(path,body,success){if(busy)return;const expected=actor;setBusy(true);try{const result=await pageActions(session.client,'listing',{id})[path.endsWith('/claim')?'claim':'report'](body);if(session.client.user?.uid===expected)setMessage({actor:expected,text:success(result)});}catch(e){if(session.client.user?.uid===expected)setMessage({actor:expected,text:e.message});}finally{setBusy(false);}}
 if(session.status==='loading')return <p role="status">Restoring your session…</p>;
 if(session.error)return <p role="alert">{session.error.message}<button onClick={session.retry}>Try again</button></p>;
 if(!actor)return <><p>Sign in to claim this page or request a correction.</p><a href={'/account?returnTo='+encodeURIComponent('/directory/'+id)}>Sign in</a></>;
 return <>{record?.data?.listings.some(p=>p.id===id&&p.status==='published'&&p.owner_id)&&<a className="profile-action" href={'/events/new?page='+id}>Create event</a>}{!managed&&<button className="profile-action" disabled={busy} onClick={()=>send('/v1/me/directory/claim',{id},claim=>'Send this challenge from a listed social account to @finfolk.com.au on the same platform. Superadmin will review your message: '+claim.challenge+' · Expires '+new Date(claim.expires_at).toLocaleString())}>Claim this page</button>}<label>Correction or removal request<input value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="profile-action" disabled={busy} onClick={()=>send('/v1/me/directory/report',{id,message:reason},()=> 'Request sent for review.')}>Submit request</button>{notice&&<p role="status">{notice}</p>}</>;
}
