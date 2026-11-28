'use client';
import {useFeatureFlags} from './feature-flags.jsx';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import './community-navigation.css';
export default function CommunityNavigation(){const {flags}=useFeatureFlags(),path=usePathname(),section=path==='/community'?'overview':path.startsWith('/pages')?'directory':path.startsWith('/people')?'people':path.startsWith('/directory')?'directory':path.startsWith('/shop')?'shop':null;if(!section)return null;return <nav className="community-sections" aria-label="Community sections">{[['overview','Overview','/community'],['people','People','/people'],['directory','Pages','/directory'],['shop','FinFolk Coop','/shop']].filter(([key])=>key!=='shop'||flags.shop).map(([key,label,url])=><Link key={key} prefetch={false} href={url} aria-current={section===key?'page':undefined}>{label}</Link>)}</nav>;}
