import {loadPublicPage} from '../../../lib/public-page.js';
import EventsView from './view.jsx';
import PublicDataCache from '../../../lib/public-page-cache.jsx';
export const metadata={title:'Events'};
export default async function Events({searchParams}){const query=await searchParams,params=new URLSearchParams(Object.entries(query).filter(([key,value])=>['q','location','category','from','offset','page'].includes(key)&&typeof value==='string')),{events:data}=await loadPublicPage('events',{query:Object.fromEntries(params)});return <><PublicDataCache name="publicEvents" data={data} values={Object.fromEntries(params)}/><EventsView data={data} params={params}/></>}
