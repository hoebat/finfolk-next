import {redirect} from 'next/navigation';
import {definition,runCompatibility} from '../lib/page-models.js';
import Landing from './landing-view.jsx';
import {homeDestination} from '../lib/legacy-redirects.js';
export const metadata={alternates:{canonical:'https://finfolk.com.au/'}};
export default async function Home({searchParams}){const destination=runCompatibility('home','homeDestination',homeDestination,['https://finfolk.com.au/',await searchParams]);if(destination)redirect(destination.pathname+destination.search);return <>{definition('home').styles.map(name=><link rel="stylesheet" href={'/'+name+'.css'} key={name}/>)}<Landing/></>;}
