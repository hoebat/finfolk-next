'use client';
import {useFeatureFlags} from './feature-flags.jsx';
import Link from 'next/link';
import {useSession} from '../lib/use-session.js';
import {usePathname} from 'next/navigation';
import './community-navigation.css';
export default function CommunityNavigation(){const {flags}=useFeatureFlags(),session=useSession(),path=usePathname(),section=path==='/community'?'overview':path.startsWith('/pages')?'pages':path.startsWith('/people')?'people':path.startsWith('/directory')?'directory':path.startsWith('/shop')?'shop':null;if(!section)return null;return <nav className="community-sections" aria-label="Community sections">{[['overview','Overview','/community'],['people','People','/people'],['directory','Groups & outlets','/directory'],['shop','FinFolk Coop','/shop'],['pages','My pages','/pages']].filter(([key])=>(key!=='shop'||flags.shop)&&(key!=='pages'||session.status==='ready'&&session.user)).map(([key,label,url])=><Link key={key} prefetch={false} href={url} aria-current={section===key?'page':undefined}>{label}</Link>)}</nav>;}
