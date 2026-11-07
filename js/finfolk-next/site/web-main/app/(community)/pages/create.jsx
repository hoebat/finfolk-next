'use client';
import {useRef,useState} from 'react';
import {useAppSearchParams} from '../../../lib/use-app-router.js';
import {pageActions} from '../../../lib/page-models.js';
import PageEditor from './editor.jsx';
const states=['VIC','NSW','QLD','SA','WA','TAS','NT','ACT'];
export default function CreatePage({session,refresh}){
 const params=useAppSearchParams(),request=useRef(null),[open,setOpen]=useState(params.get('create')==='1'),[created,setCreated]=useState(null);
 const defaults={category:'Group',state:states.includes(params.get('state'))?params.get('state'):'',locality:(params.get('locality')||'').slice(0,160)};
 const returnTo='/pages?'+new URLSearchParams({create:'1',...defaults,...(params.get('site')?{site:params.get('site')}:{})});
 return <section aria-label="Create a group or page"><h2>Create a group or page</h2>
  <p>Anyone with a verified FinFolk account can submit a group, club or personal page. You will own the page and can edit it while it awaits review.</p>
  {session.status==='loading'?<p role="status">Restoring your session…</p>:session.error?<p role="alert">{session.error.message}<button onClick={session.retry}>Retry account</button></p>:created?<p role="status">Your page was submitted for review. It is in My pages below and will appear in the directory after approval.</p>:!session.user?<a className="profile-action" href={'/account?returnTo='+encodeURIComponent(returnTo)}>Sign in to create a page</a>:!open?<button className="profile-action" onClick={()=>setOpen(true)}>Create a page</button>:<>
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
