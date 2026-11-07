import ListingView from './view.jsx';
import PublicDataCache from '../../../../lib/public-page-cache.jsx';
import {notFound} from 'next/navigation';
import {loadPublicPage} from '../../../../lib/public-page.js';
export async function generateMetadata({params}){const {id}=await params;const {listing:item}=await loadPublicPage('listing',{id});return {title:item?.name||'Page unavailable',description:item?.description,alternates:{canonical:'https://finfolk.com.au/directory/'+id}};}
export default async function Listing({params}){const {id}=await params;const {listing:row,events:future}=await loadPublicPage('listing',{id});if(!row)notFound();return <><PublicDataCache name="publicDirectoryDetail" data={row} values={{id}}/><PublicDataCache name="publicEvents" data={future} values={{page:id}}/><ListingView row={row} future={future}/></>}
