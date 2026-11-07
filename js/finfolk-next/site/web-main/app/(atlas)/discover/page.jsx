import Sections from './sections.jsx';
import Directory from '../../(community)/directory/page.jsx';
import Events from '../../(community)/events/page.jsx';
export const metadata={title:'Discover dive sites',alternates:{canonical:'https://finfolk.com.au/discover'}};
export default async function Page({searchParams}){const query=await searchParams;return <Sections directoryPage={query.section==='directory'?<Directory searchParams={Promise.resolve({})}/>:null} eventsPage={query.section==='events'?<Events searchParams={Promise.resolve({})}/>:null}/>}
