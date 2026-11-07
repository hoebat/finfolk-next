'use client';
import {useSession} from '../../../../lib/use-session.js';
import {EventNavigation,EventGate,useEventAction} from '../tools.jsx';
export default function Invitation({token}){const session=useSession();return <InvitationBody key={session.user?.uid||'guest'} session={session} token={token}/>;}
function InvitationBody({session,token}){const {run,busy,error}=useEventAction(session,'event-invitation',{token});return <><h1>Private event invitation</h1><EventNavigation/><EventGate session={session} record={{loading:false}}/>{session.user&&<><p>Sign in with the verified email the organiser invited. Accepting gives you access; RSVP separately to reserve a place.</p><button className="profile-action" disabled={busy} onClick={()=>run('accept',{token},result=>window.location.assign('/events/'+result.id)).catch(()=>{})}>Accept invitation</button>{error&&<p role="alert">{error}</p>}</>}</>}
