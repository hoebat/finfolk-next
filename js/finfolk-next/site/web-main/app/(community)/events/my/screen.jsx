'use client';
import {useSession} from '../../../../lib/use-session.js';
import {usePageModel} from '../../../../lib/use-page-model.js';
import {EventNavigation,EventCard,EventGate} from '../tools.jsx';
export default function MyEvents(){const session=useSession(),{record,refresh}=usePageModel(session,'my-events','events');return <><h1>My events</h1><EventNavigation/><EventGate session={session} record={record} retry={refresh}/>{session.user&&record?.data&&<>{record.data.events.map(e=><EventCard key={e.id} event={e}/>)}{!record.data.events.length&&<p>Your organised and attended events will appear here.</p>}</>}</>}
