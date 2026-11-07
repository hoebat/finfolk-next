'use client';
import {useEffect} from 'react';
import {useSession} from '../../lib/use-session.js';
import AtlasRuntime from './atlas/runtime.jsx';
import '../community-navigation.css';
import {PrimaryNavigation,UtilityMenu} from '../app-navigation.jsx';
export default function AtlasLayout({children}){
 const session=useSession();
 useEffect(()=>{const viewport=()=>document.documentElement.style.setProperty('--app-height',`${window.visualViewport?.height||window.innerHeight}px`);viewport();window.visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);const classes=['finfolk-navigation-enabled','finfolk-app-navigation'];document.body.classList.add(...classes);return()=>{document.body.classList.remove(...classes);window.visualViewport?.removeEventListener('resize',viewport);window.removeEventListener('resize',viewport);};},[]);
 useEffect(()=>{document.body.classList.toggle('finfolk-guest-navigation',!session.user);return()=>document.body.classList.remove('finfolk-guest-navigation');},[session.user?.uid]);

 return <>{['style','glass','mobile','logbook','finfolk','community','instagram-connect','identity','appearance','filters','navigation','profiles'].map(name=><link rel="stylesheet" href={'/'+name+'.css'} key={name}/>)}<aside className="sidebar app-rail"><a className="brand" href="/" aria-label="FinFolk home"><span className="navigation-logo" aria-hidden="true"/><span className="sr-only">FinFolk coastal atlas</span></a><PrimaryNavigation className="primary-nav"/><UtilityMenu signedIn={!!session.user}/></aside><main id="app-main"><AtlasRuntime session={session}>{children}</AtlasRuntime></main></>;
}
