import DirectoryView from './view.jsx';
import DirectoryHub from './hub.jsx';
import PublicDataCache from '../../../lib/public-page-cache.jsx';
import {loadPublicPage} from '../../../lib/public-page.js';
export const metadata={title:'Pages',alternates:{canonical:'https://finfolk.com.au/directory'}};
export default async function Directory({searchParams}){
 const values=await searchParams;const query=new URLSearchParams();for(const key of ['q','category','state','locality','offset','site'])if(typeof values[key]==='string')query.set(key,values[key]);
 const {listings:data}=await loadPublicPage('directory',{query:Object.fromEntries(query)});
 return <><PublicDataCache name="publicDirectory" data={data} values={Object.fromEntries(query)}/><DirectoryHub managing={values.manage==='1'} creating={values.create==='1'} filters={Object.fromEntries(query)}><DirectoryView data={data} query={query}/></DirectoryHub></>;
}
