import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../../lib/public-page.js';
import Profile from '../../profile/screen.jsx';
export const metadata={title:'Diver profile',robots:{index:false,follow:false}};
export default async function MemberPage({params,searchParams}){const {id}=await params,p=await searchParams,{catalog:sites}=await loadPublicPage('community-catalog');return <><PublicDataCache name="siteCatalog" data={sites} values={{}}/><Profile key={id} target={id} sites={sites.beaches||[]} location={typeof p.location==='string'?p.location:''}/></>}
