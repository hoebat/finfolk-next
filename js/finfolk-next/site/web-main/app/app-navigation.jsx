'use client';
import './account-widget.css';
import './mobile-navigation.css';
import {accountPresentation,requestedPresentationActor} from '../lib/account-presentation.js';
import BuddyBadge from './buddy-badge.jsx';
import ThemeSettings from './(atlas)/account/theme-settings.jsx';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {usePathname} from 'next/navigation';
import {useSession} from '../lib/use-session.js';
import {usePageModel} from '../lib/use-page-model.js';
import {Portrait} from './(community)/profile/components.jsx';
import {useFeatureFlags} from './feature-flags.jsx';
import {paths} from './(community)/navigation-icons.js';
export const primarySections=[['explore','Explore','/map'],['community','Community','/community'],['buddies','Buddies','/buddies'],['events','Events','/events'],['sessions','Sessions','/logbook']];
export function sectionForPath(path){if(/^\/buddies(?:\/|$)/.test(path))return 'buddies';if(/^\/account(?:\/checkin)?\/?$/.test(path))return 'sessions';if(/^\/(map|discover)(\/|$)/.test(path))return 'explore';if(/^\/events(\/|$)/.test(path))return 'events';if(/^\/(practice|logbook|reports)(\/|$)/.test(path))return 'sessions';if(/^\/(you|profile|account)(\/|$)/.test(path))return 'you';if(/^\/(u|community|people|members|directory|shop|pages)(\/|$)/.test(path))return 'community';return null;}
const icons={explore:'discover',community:'people',buddies:'chat',events:'events',sessions:'logbook',pages:'pages',you:'me'};
export function NavigationIcon({name}){return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{(paths[icons[name]||name]||paths.more).map(d=><path key={d} d={d}/>)}</svg>;}
export function PrimaryNavigation({className='',session,onNavigate}){const path=usePathname(),{flags}=useFeatureFlags();const visible=primarySections.filter(([key])=>(key!=='events'||flags.events)&&(key!=='buddies'||flags.buddies&&session?.status==='ready'&&session.user)&&(key!=='sessions'||session?.status==='ready'&&session.user));return <nav style={{'--nav-count':visible.length}} className={className+' ff-primary-nav'} aria-label="Main navigation">{visible.map(([key,label,href])=><a key={key} className="ff-nav-item" href={href} onClick={onNavigate} aria-current={sectionForPath(path)===key?'page':undefined}><NavigationIcon name={key}/><span>{label}</span>{key==='buddies'&&<BuddyBadge key={session.user.uid} session={session}/>}</a>)}</nav>;}
function useAccountIdentity(session){
 const {record}=usePageModel(session,'account-identity','me'),available=record?.data?.profile,fresh=record?.cached?null:available;
 const cached=useSyncExternalStore(accountPresentation.subscribe,accountPresentation.getSnapshot,accountPresentation.getServerSnapshot),restoring=session.status==='loading',requested=requestedPresentationActor();
 const saved=cached&&(!session.user||cached.actor===session.user.uid)&&(!requested||requested===cached.actor)?cached:null;
 useEffect(()=>{if(session.status!=='ready')return;if([401,403,404,410].includes(record?.error?.status)){accountPresentation.clear(session.user?.uid);return;}if(!session.user)accountPresentation.clear();else if(fresh)accountPresentation.save(session.user.uid,fresh);else{const previous=accountPresentation.getSnapshot();if(previous&&previous.actor!==session.user.uid)accountPresentation.clear(previous.actor);}},[session.status,session.user?.uid,fresh,record?.error?.status]);
 const showIdentity=session.status==='ready'&&!!session.user||restoring&&!!saved;
 return {member:showIdentity?((record?.cached&&saved?saved:available)||saved):null,identityId:session.user?.uid||saved?.actor,showIdentity,restoring};
}
function ContextNavigation({session,onNavigate}){
 const path=usePathname(),{flags}=useFeatureFlags(),section=sectionForPath(path);
 const groups={explore:[['Map','/map'],['Discover places','/discover']],community:[['Overview','/community'],['People','/people'],['Pages','/directory'],...(flags.shop?[['FinFolk Coop','/shop']]:[])],sessions:session.user?[['Sessions','/logbook'],['History','/logbook?section=history'],['Statistics','/logbook?section=statistics']]:[]};
 const links=groups[section]||[];
 return links.length?<section className="ff-context-section"><p className="ff-menu-eyebrow">{section==='sessions'?'Sessions':section==='community'?'Community':'Explore'}</p><div className="ff-menu-actions">{links.map(([label,href])=><a key={href} href={href} onClick={onNavigate}>{label}<span aria-hidden="true">↗</span></a>)}</div></section>:null;
}
export function UtilityMenu({session,accountLabel,menuPlacement='above',idPrefix='local-menu'}){
 const signedIn=session.status==='ready'&&!!session.user,{member,identityId,showIdentity,restoring}=useAccountIdentity(session),floating=idPrefix==='mobile-menu';
 const path=usePathname(),[pane,setPane]=useState(null),[interactive,setInteractive]=useState(false),[signingOut,setSigningOut]=useState(false),[error,setError]=useState('');
 const host=useRef(null),toggle=useRef(null),opener=useRef(null),open=pane!==null;
 const {record:adminRecord}=usePageModel(session,'account','status');
 const close=()=>setPane(null),activate=(name,event)=>{opener.current=event.currentTarget;setPane(current=>current===name?null:name);};
 useEffect(()=>{setPane(null);setInteractive(true);},[path]);
 useEffect(()=>{
  if(!open)return;
  const panel=host.current.querySelector('.ff-menu-panel'),items=()=>[...panel.querySelectorAll('a,button:not(:disabled):not(.ff-panel-close),input:checked')].filter(item=>item.getClientRects().length);
  const focus=()=>items()[0]?.focus(),observer=new MutationObserver(()=>{if(items().length){focus();observer.disconnect();}});
  if(items().length)focus();else observer.observe(panel,{childList:true,subtree:true});
  const dismiss=event=>{if(!host.current?.contains(event.target))setPane(null);};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setPane(null);(opener.current||toggle.current)?.focus();}else if(!event.target.matches('input[type=radio]')&&['ArrowUp','ArrowDown'].includes(event.key)){const links=items(),index=links.indexOf(document.activeElement);if(index>=0){event.preventDefault();links[(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length]?.focus();}}};
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',dismiss);document.addEventListener('focusin',dismiss);
  return()=>{observer.disconnect();document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',dismiss);document.removeEventListener('focusin',dismiss);};
 },[pane]);
 async function logout(){if(signingOut)return;setSigningOut(true);setError('');try{await session.client.signOut();accountPresentation.clear(session.user?.uid);setPane(null);}catch(error){setError(error.message||'Could not log out. Please try again.');}finally{setSigningOut(false);}}
 const portrait=member?<Portrait member={{...member,id:identityId,displayName:member.displayName||'Account'}}/>:<NavigationIcon name="you"/>;
 const panelId=idPrefix+'-panel',title=pane==='primary'?'Navigation':pane==='account'?'Your account':'Page options';
 const pointsDown=menuPlacement==='below'?!open:open;
 return <div className={'ff-utility-menu ff-navigation-controls'+(floating?' ff-floating-controls':'')+(!showIdentity?' ff-guest-account':'')+(restoring?' ff-account-restoring':'')} ref={host}>
  <div className="ff-account-widget" aria-busy={restoring||undefined}>
   <button type="button" className={'ff-account-profile ff-avatar-toggle'+(signedIn?' ff-account-mobile-link':' ff-signin')} disabled={!interactive} aria-label={pane==='account'?'Close account menu':'Open account menu'} aria-expanded={pane==='account'} aria-controls={panelId} onClick={event=>activate('account',event)} onContextMenu={event=>{event.preventDefault();activate('context',event);}}>
    {portrait}<span className="ff-account-copy"><strong>{accountLabel||member?.displayName||(restoring?'Loading account…':signedIn?'Your account':'Sign in')}</strong></span>
   </button>
   <button type="button" className="ff-context-toggle" disabled={!interactive} aria-label={pane==='context'?'Close page options':'Open page options'} aria-expanded={pane==='context'} aria-controls={panelId} onClick={event=>activate('context',event)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg></button>
  </div>
  {floating&&<button ref={toggle} type="button" id={idPrefix+'-toggle'} className="ff-menu-toggle ff-primary-fab" disabled={!interactive} aria-label={pane==='primary'?'Close menu':'Open menu'} aria-expanded={pane==='primary'} aria-controls={panelId} onClick={event=>activate('primary',event)}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d={pane==='primary'?'m6 6 12 12M18 6 6 18':'M4 6h16M4 12h16M4 18h16'}/></svg></button>}
  <nav id={panelId} className={'ff-menu-panel ff-layered-menu ff-pane-'+(pane||'closed')} data-placement={menuPlacement} aria-label={title} hidden={!open}>
   <div className="ff-menu-heading"><span className="ff-menu-eyebrow">{title}</span><button type="button" className="ff-panel-close" aria-label="Close navigation panel" onClick={()=>{close();opener.current?.focus();}}>×</button></div>
   {pane==='primary'&&<PrimaryNavigation className="ff-mobile-destinations" session={session} onNavigate={close}/>}
   {pane==='account'&&<>
    <div className="ff-menu-identity">{portrait}<div><strong>{member?.displayName||(restoring?'Restoring your account…':signedIn?'Your account':'Make it your coast')}</strong><span>{restoring?'Your menu is ready while your account loads.':signedIn?'Account & preferences':'Sign in to save places and sessions.'}</span></div></div>
    <div className="ff-menu-actions">{signedIn?<><a href="/account/settings" onClick={close}><NavigationIcon name="settings"/><span>Settings</span><span aria-hidden="true">↗</span></a>{adminRecord?.data?.admin&&<a href="/admin/businesses" onClick={close}><NavigationIcon name="pages"/><span>Superadmin</span><span aria-hidden="true">↗</span></a>}<button type="button" disabled={signingOut} onClick={logout}><span>{signingOut?'Logging out…':'Log out'}</span><span aria-hidden="true">↗</span></button></>:!restoring&&<a href="/account" onClick={close}><span>Sign in</span><span aria-hidden="true">↗</span></a>}</div>
   </>}
   {pane==='context'&&<><ContextNavigation session={session} onNavigate={close}/><ThemeSettings compact/></>}
   {error&&<p className="ff-menu-error" role="status">{error}</p>}
  </nav>
 </div>;
}
export function MobileNavigation(){const session=useSession();return <div className="ff-mobile-navigation"><UtilityMenu session={session} idPrefix="mobile-menu"/></div>;}
