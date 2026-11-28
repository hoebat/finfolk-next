'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {useSession} from '../../lib/use-session.js';
import AtlasRuntime from './atlas/runtime.jsx';
import '../community-navigation.css';
import {PrimaryNavigation,UtilityMenu} from '../app-navigation.jsx';
export default function AtlasLayout({children}){
 const session=useSession(),path=usePathname(),standalone=path.startsWith('/account')&&(!session.user||!!session.user.recovery);
 useEffect(()=>{const viewport=()=>document.documentElement.style.setProperty('--app-height',`${window.visualViewport?.height||window.innerHeight}px`);viewport();window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);const classes=['finfolk-navigation-enabled','finfolk-app-navigation'];if(!standalone)document.body.classList.add(...classes);document.body.classList.toggle('finfolk-auth-layout',standalone);return()=>{document.body.classList.remove(...classes,'finfolk-auth-layout');window.visualViewport?.removeEventListener('resize',viewport);window.removeEventListener('resize',viewport);};},[standalone]);
 useEffect(()=>{document.body.classList.toggle('finfolk-guest-navigation',!session.user);return()=>document.body.classList.remove('finfolk-guest-navigation');},[session.user?.uid]);

 return <>{['style','glass','mobile','logbook','finfolk','community','instagram-connect','identity','filters','navigation','profiles'].map(name=><link rel="stylesheet" precedence="app" href={'/'+name+'.css'} key={name}/>)}{!standalone&&<aside className="sidebar app-rail"><a className="brand" href="/" aria-label="FinFolk home"><span className="navigation-logo" aria-hidden="true"/><span className="sr-only">FinFolk coastal atlas</span></a><PrimaryNavigation className="primary-nav" session={session}/><UtilityMenu session={session}/></aside>}<main id="app-main" className={standalone?'ff-auth-main':undefined}><AtlasRuntime session={session}>{children}</AtlasRuntime></main></>;
}
