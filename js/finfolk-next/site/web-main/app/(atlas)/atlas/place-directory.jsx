'use client';
import {usePublicAwarePageData} from '../../../lib/use-page-data.js';
import {publicSession} from './place-media.jsx';

export function directoryLocation(beach){
 return {state:beach.state_id||beach.state||'',locality:beach.locality||beach.name.split(' · ')[0].replace(/\s+Beach$/i,'')};
}
export default function PlaceDirectory({beach,session,className='regulars-panel'}){
 const query=directoryLocation(beach),{record,refresh}=usePublicAwarePageData(publicSession(session),'directory',{query});
 const href='/directory?'+new URLSearchParams({...query,site:beach.id}),create='/pages?'+new URLSearchParams({...query,site:beach.id,create:'1'});
 const rows=record?.data?.listings?.listings||[];
 return <section className={className} aria-label="Groups and pages at this location">
  <h3>Find your folk</h3><p>Clubs, groups and freediving pages listing {query.locality} as a location. Check with the organiser before joining a session.</p>
  {!record||record.loading?<p role="status">Finding local pages…</p>:record.error?<><p>Local pages could not be loaded.</p><button type="button" onClick={refresh}>Retry local pages</button></>:rows.length?<ul>{rows.slice(0,3).map(row=><li key={row.id}><a href={'/directory/'+encodeURIComponent(row.id)}>{row.name}</a>{' · '+row.category}</li>)}</ul>:<p>No published pages match this locality yet. Browse the directory or start a group.</p>}
  <a className="profile-action" href={href}>Browse local groups and pages</a>{' '}
  {query.state&&<><a className="profile-action" href={'/directory?'+new URLSearchParams({state:query.state,site:beach.id})}>{'Browse '+query.state+' pages'}</a>{' '}</>}
  <a className="profile-action" href={create}>Create a group or page</a>
 </section>;
}
