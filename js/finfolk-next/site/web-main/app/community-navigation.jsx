'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import './community-navigation.css';
export default function CommunityNavigation(){const path=usePathname(),section=path.startsWith('/people')?'people':path.startsWith('/directory')?'directory':path.startsWith('/shop')?'shop':null;if(!section)return null;return <nav className="community-sections" aria-label="Community sections">{[['overview','Overview','/community'],['people','People','/people'],['directory','Groups & outlets','/directory'],['shop','Finfolk Coop','/shop']].map(([key,label,url])=><Link key={key} prefetch={false} href={url} aria-current={section===key?'page':undefined}>{label}</Link>)}</nav>;}
