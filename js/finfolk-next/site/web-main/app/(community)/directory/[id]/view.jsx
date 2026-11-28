import PageInstagram from './instagram.jsx';
import UpcomingEvents from './upcoming-events.jsx';
import ListingActions,{ListingNavigation,PageSections} from './actions.jsx';
import {ProfileHero,ProfileSection} from '../../profile-layout.jsx';
import {PageMark,PageLink,pageURL} from '../../pages/presentation.jsx';
export default function ListingView({row}){
 const place=[row.locality,row.state,row.country].filter(Boolean).join(' · '),website=pageURL(row.website),socials=(row.socials||[]).map(pageURL).filter(Boolean);
 return <article className="organisation-page" aria-label={row.name+' page'}><ListingNavigation/>
  <ProfileHero id="page-overview" className="page-hero" portrait={<PageMark page={row}/>}>
   <p className="profile-privacy">{row.managed?'Managed page':'Unclaimed page'}</p><p className="profile-eyebrow">{row.category}</p><h1>{row.name}</h1>{place&&<p className="page-location">{place}</p>}{row.description&&<p className="member-bio page-summary">{row.description}</p>}
   <div className="profile-action-row page-contact-actions"><PageLink url={row.website} primary>Visit website <span aria-hidden="true">↗</span></PageLink>{socials.map(url=><PageLink key={url.href} url={url.href}>{url.hostname.endsWith('instagram.com')?'Instagram':url.hostname.endsWith('tiktok.com')?'TikTok':url.hostname.replace(/^www\./,'')} <span aria-hidden="true">↗</span></PageLink>)}</div>
   <ListingActions id={row.id} managed={row.managed}/>
  </ProfileHero>
  <PageSections instagram={socials.some(url=>url.hostname.endsWith('instagram.com'))}/>
  <div className="organisation-columns"><div className="organisation-main"><ProfileSection id="page-about" title="About"><p className="directory-description">{row.description||'This page hasn’t added an introduction yet.'}</p></ProfileSection>{socials.some(url=>url.hostname.endsWith('instagram.com'))&&<PageInstagram id={row.id}/>}<UpcomingEvents id={row.id}/>
   {(row.sources?.length||row.reviewedAt)?<details className="profile-section page-sources"><summary>Page information &amp; sources</summary>{row.reviewedAt&&<p>Last reviewed {new Date(row.reviewedAt).toLocaleDateString('en-AU',{timeZone:'Australia/Sydney'})}</p>}<div className="profile-action-row">{(row.sources||[]).map((url,i)=><PageLink key={i} url={url}>View source ↗</PageLink>)}</div></details>:null}
  </div><aside className="organisation-details" id="page-details" aria-label="Page details"><h2>Page details</h2><dl><div><dt>Page type</dt><dd>{row.category}</dd></div>{place&&<div><dt>Location</dt><dd>{place}</dd></div>}{website&&<div><dt>Website</dt><dd><a href={website.href} target="_blank" rel="noopener noreferrer">{website.hostname.replace(/^www\./,'')} ↗</a></dd></div>}<div><dt>Managed by owner</dt><dd>{row.managed?'Yes':'Not yet claimed'}</dd></div></dl>{!website&&!socials.length&&<p className="profile-small">Contact details haven’t been added yet.</p>}{['Group','Club'].includes(row.category)&&<p className="profile-small">Contact the organisers through their website or social page for membership details.</p>}</aside></div>
 </article>;
}
