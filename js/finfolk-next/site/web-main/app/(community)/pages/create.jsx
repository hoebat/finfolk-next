'use client';
import {useRef,useState} from 'react';
import {useAppSearchParams} from '../../../lib/use-app-router.js';
import {pageActions} from '../../../lib/page-models.js';
import PageEditor from './editor.jsx';
const states=['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'];
export default function CreatePage({session,refresh,compact=false}){
 const params=useAppSearchParams(),request=useRef(null),[open,setOpen]=useState(params.get('create')==='1'),[created,setCreated]=useState(null);
 const defaults={category:'Group',state:states.includes(params.get('state'))?params.get('state'):'',locality:(params.get('locality')||'').slice(0,160)};
 const returnTo='/directory?'+new URLSearchParams({create:'1',...defaults,...(params.get('site')?{site:params.get('site')}:{})});
 return <section className={"page-create-panel"+(compact?" is-compact":"")+(!open&&!created?" is-closed":"")} aria-label="Create a group or page">{(!compact||open)&&<><h2>Create a group or page</h2><p>Submit a group, club or outlet for review. You can edit your page while it awaits approval.</p></>}
  {session.status==='loading'?<p role="status">Restoring your session…</p>:session.error?<p role="alert">{session.error.message}<button onClick={session.retry}>Retry account</button></p>:created?<div><p role="status">Your page was submitted for review.</p><a className="profile-action" href={'/directory?manage=1#page-'+encodeURIComponent(created.id)}>Manage submitted page</a></div>:!session.user?<a className="profile-action" href={'/account?returnTo='+encodeURIComponent(returnTo)}>Sign in to create a page</a>:!open?<button className="profile-action" onClick={()=>setOpen(true)}>Create a page</button>:<>
   <p>Add a website or source link to help us review the page. Linked social identities require separate verification.</p>
   <PageEditor creating row={{document:defaults}} save={async body=>{
    const actor=session.user.uid;request.current||=crypto.randomUUID();
    const result=await pageActions(session.client,'pages').create({requestId:request.current,document:body.document});
    if(session.client.user?.uid===actor){setCreated(result);refresh();}
   }}/>
   <button className="profile-action" onClick={()=>{setOpen(false);request.current=null;}}>Cancel creation</button>
  </>}
  {params.get('site')&&<a className="profile-action" href={'/map?'+new URLSearchParams({site:params.get('site')})}>Back to dive site</a>}
 </section>;
}
