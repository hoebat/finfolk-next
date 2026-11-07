import PublicDataCache from '../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../lib/public-page.js';
import Profile from './screen.jsx';
export const metadata={title:'My profile',robots:{index:false,follow:false}};
export default async function ProfilePage({searchParams}){const p=await searchParams,{catalog:sites}=await loadPublicPage('community-catalog');return <><PublicDataCache name="siteCatalog" data={sites} values={{}}/><Profile sites={sites.beaches||[]} location={typeof p.location==='string'?p.location:''}/></>}
