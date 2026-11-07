import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../../lib/public-page.js';
import EventDetail from './screen.jsx';
export async function generateMetadata({params}){const {id}=await params,{event}=await loadPublicPage('event-public',{id});return event?{title:event.document.title}:{title:'Event',robots:{index:false,follow:false}};}
export default async function Event({params}){const {id}=await params,{event}=await loadPublicPage('event-public',{id});return <><PublicDataCache name="publicEvent" data={event} values={{id}}/><EventDetail id={id} publicEvent={event}/></>;}
