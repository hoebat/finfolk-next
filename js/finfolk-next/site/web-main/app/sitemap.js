import {publicAPI,siteOrigin} from '../lib/public-api.js';
export const dynamic='force-dynamic';
export default async function sitemap(){const origin=siteOrigin(),urls=['/','/directory','/events'];let offset=0;do{const data=await publicAPI('directory?offset='+offset);urls.push(...data.listings.map(x=>'/directory/'+x.id));if(data.next===null)break;if(data.next<=offset)throw Error('Invalid directory pagination');offset=data.next;}while(offset<=100000);return urls.map(path=>({url:origin+path}));}
