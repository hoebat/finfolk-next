import {loadPublicPage} from '../../../../lib/public-page.js';
import EventDetail from './screen.jsx';
// Crawler metadata can use anonymous data only after a public release. Tester
// access is resolved in the browser and never lends identity to a server read.
export async function generateMetadata({params}){
 const unavailable={title:'Event',robots:{index:false,follow:false}};
 try{
  const response=await fetch(new URL('/v1/features',process.env.FINFOLK_API_ORIGIN||'https://api.finfolk.com.au'),{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok||(await response.json()).flags?.events!==true)return unavailable;
  const {id}=await params,{event}=await loadPublicPage('event-public',{id});
  return event?{title:event.document.title}:unavailable;
 }catch{return unavailable;}
}
export default async function Event({params}){const {id}=await params;return <EventDetail id={id}/>;}
