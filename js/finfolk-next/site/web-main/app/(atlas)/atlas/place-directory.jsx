'use client';
import {usePublicAwarePageData} from '../../../lib/use-page-data.js';
import {publicSession} from './place-media.jsx';
import {directoryLocation,businessesAtBeach} from './place-directory-model.js';
export {directoryLocation} from './place-directory-model.js';
export default function PlaceDirectory({beach,session,className='regulars-panel'}){
 const query=directoryLocation(beach),{record}=usePublicAwarePageData(publicSession(session),'directory',{query});
 const rows=businessesAtBeach(record?.data?.listings?.listings||[],beach);
 if(record?.loading||record?.error||!rows.length)return null;
 return <section className={className} aria-label="Businesses at this beach"><h3>Businesses</h3><ul>{rows.map(row=><li key={row.id}><a href={'/directory/'+encodeURIComponent(row.id)}>{row.name}</a>{row.category&&' · '+row.category}</li>)}</ul></section>;
}
