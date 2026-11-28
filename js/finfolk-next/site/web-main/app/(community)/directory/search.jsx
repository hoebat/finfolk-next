'use client';
import SearchAutocomplete from '../search-autocomplete.jsx';
import {readPublicPageModel} from '../../../lib/public-page-client.js';
import {useAppRouter} from '../../../lib/use-app-router.js';
export default function PageSearch({value='',site=''}){const router=useAppRouter();return <SearchAutocomplete label="Search pages" value={value} load={async(q,signal)=>{const data=await readPublicPageModel('directory','listings',{}, {signal},{query:{q}});return data.listings.map(page=>({id:page.id,name:page.name,detail:[page.category,page.locality,page.state].filter(Boolean).join(' · '),href:'/directory/'+encodeURIComponent(page.id)}));}} onSearch={q=>{const params=new URLSearchParams();if(q)params.set('q',q);if(site)params.set('site',site);router.push('/directory'+(params.size?'?'+params:''));}}/>;}
