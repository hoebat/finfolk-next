'use client';
import {useSession} from '../../lib/use-session.js';
import {usePathname} from 'next/navigation';
import CommunityNavigation from '../community-navigation.jsx';
import './pages/pages.css';
import {PrimaryNavigation,UtilityMenu} from '../app-navigation.jsx';
export default function CommunityLayout({children}){
 const path=usePathname(),session=useSession(),signedIn=session.status==='ready'&&!!session.user;
 return <>{['instagram-connect','profiles','identity','navigation','profiles-theme'].map(name=><link rel="stylesheet" precedence="app" href={'/'+name+'.css'} key={name}/>)}<div className={'next-community profile-demo finfolk-navigation-enabled'+(!signedIn?' finfolk-guest-navigation':'')}><a className="profile-skip" href="#profile-main">Skip to content</a><aside className="profile-rail"><a className="profile-home" href="/" aria-label="FinFolk home"><span className="navigation-logo" aria-hidden="true"/></a><PrimaryNavigation className="profile-nav" session={session}/><UtilityMenu session={session}/></aside><div className="profile-workspace"><p className="profile-status" role="status"/><main className="profile-main" id="profile-main" data-product={/^\/(people|profile|members|directory|pages)(\/|$)/.test(path)?'members':undefined} data-screen={path==='/people'?'people':undefined} tabIndex={-1}><CommunityNavigation/>{children}</main><footer className="profile-footer"><span>FinFolk / Freediving &amp; training</span></footer></div></div></>
}
