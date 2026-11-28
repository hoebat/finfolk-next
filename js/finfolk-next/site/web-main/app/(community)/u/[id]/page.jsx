import {notFound,redirect} from 'next/navigation';
import Profile from '../../profile/screen.jsx';
import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../../lib/public-page.js';
const validHandle=id=>/^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$/i.test(id);
export async function generateMetadata({params}){const {id}=await params;if(!validHandle(id))return {title:'Profile unavailable'};const {profile}=await loadPublicPage('public-profile',{id});return {title:profile?.restricted?'Profile unavailable':profile?.displayName||'Profile unavailable',description:profile?.restricted?undefined:profile?.bio,alternates:{canonical:'https://finfolk.com.au/u/'+(profile?.handle||id)}};}
export default async function PublicProfile({params}){
 const {id}=await params;if(!validHandle(id))notFound();const {profile}=await loadPublicPage('public-profile',{id});if(!profile)notFound();
 if(id!==profile.handle)redirect('/u/'+encodeURIComponent(profile.handle));
 const {catalog:sites}=await loadPublicPage('community-catalog');
 return <><PublicDataCache name="siteCatalog" data={sites} values={{}}/><PublicDataCache name="publicProfileByHandle" data={profile} values={{handle:id}}/><Profile sites={sites.beaches||[]} target={profile.id} initialPublic={profile}/></>;
}
