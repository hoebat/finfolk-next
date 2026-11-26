'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {usePublishedSites} from '../lib/use-published-sites.js';
import MapSearch from './(atlas)/atlas/map-search.jsx';
import {mapSelectionURL} from './(atlas)/atlas/explore-model.js';
const coasts=[
 {name:'Portsea Beach',state:'Victoria',site:'portsea',detail:'Start on the Mornington Peninsula.'},
 {name:'Bondi Beach',state:'New South Wales',site:'bondi',detail:'Find your water along the Sydney coast.'},
 {name:'Brighton Beach',state:'Victoria',site:'brighton',detail:'Explore the shores of Port Phillip.'}
];
export default function LandingExplore({compact=false}){
 if(compact)return <LandingSearch/>;
 return <section className="landing-map-entry" id="explore-the-coast" aria-labelledby="landing-map-title">
  <div className="landing-map-intro"><p className="landing-eyebrow">YOUR NEXT SPOT / ON THE MAP</p><h2 id="landing-map-title">Find your kind<br/>of water.</h2><p>Follow the coast, find a dive spot and discover the community around it. Switch on depth layers to take a closer look.</p><a className="landing-primary" href="/map">Explore the whole map ↗</a></div>
  <div className="landing-map-places"><p className="landing-eyebrow">START SOMEWHERE FAMILIAR</p>{coasts.map((coast,i)=><a className="landing-map-place" href={'/map?site='+coast.site} key={coast.site}><span className="landing-map-index" aria-hidden="true">0{i+1}</span><div><span className="landing-map-state">{coast.state}</span><h3>{coast.name}</h3><p>{coast.detail}</p></div><span className="landing-map-arrow" aria-hidden="true">↗</span></a>)}<p className="landing-map-note">Places, people and depth layers — together on one map.</p></div>
 </section>;
}

function LandingSearch(){
 const {directory,error,refresh}=usePublishedSites(),[query,setQuery]=useState(''),router=useRouter();
 return <div className="landing-map-search"><MapSearch id="landing-map-query" directory={directory} query={query} onQuery={setQuery} placeholder="Search a beach, place or coastline" submitLabel="Explore map" error={error} onRetry={refresh} onSearch={()=>router.push('/map'+(query.trim()?'?q='+encodeURIComponent(query.trim()):''))} onSelect={row=>router.push(mapSelectionURL(new URL('/map',location.origin),row))}/></div>;
}
