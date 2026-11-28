'use client';
import {createContext,useContext} from 'react';
import Link from 'next/link';
import {useSession} from '../../../lib/use-session.js';
import {usePageModels} from '../../../lib/use-page-models.js';
import ManagedPages from '../pages/screen.jsx';
import CreatePage from '../pages/create.jsx';
const Management=createContext(new Set());
export function DirectoryCardActions({id,name}){const managed=useContext(Management);return <div className="directory-card-actions"><a className="profile-action" href={'/directory/'+id} aria-label={'View '+name}>View page ↗</a>{managed.has(id)&&<a className="profile-action" href={'/directory?manage=1#page-'+encodeURIComponent(id)} aria-label={'Manage '+name}>Manage</a>}</div>;}
export default function DirectoryHub({children,managing=false,creating=false,filters={}}){
 const session=useSession(),{models,refresh}=usePageModels(session,'pages'),record=models.mine;
 const managed=new Set((record?.data?.listings||[]).filter(row=>row.owner_id===session.user?.uid||['owner','admin'].includes(row.role)).map(row=>row.id));
 const browse='/directory'+(Object.keys(filters).length?'?'+new URLSearchParams(filters):'');
 return <Management.Provider value={managed}><header className="directory-hub-heading"><h1>Pages</h1><CreatePage key={(session.user?.uid||'guest')+':'+creating+':'+JSON.stringify(filters)} session={session} refresh={refresh} compact/></header>
  <nav className="directory-scope" aria-label="Pages view"><Link prefetch={false} href={browse} aria-current={!managing?'page':undefined}>All pages</Link>{session.user&&<Link prefetch={false} href={'/directory?'+new URLSearchParams({...filters,manage:'1'})} aria-current={managing?'page':undefined}>You manage</Link>}</nav>
  {managing?<ManagedPages session={session} record={record} refresh={refresh}/>:children}
 </Management.Provider>;
}
