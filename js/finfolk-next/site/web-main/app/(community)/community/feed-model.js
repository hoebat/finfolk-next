export function communityItems({trips=[],listings=[],events=[]},now=Date.now()){
 return [
  ...trips.map(row=>({id:'trip:'+row.id,kind:'trips',title:row.title,description:row.beachName,byline:row.authorName||'Community trip',date:row.publishedAt,site:row.beachId,href:'/reports/'+encodeURIComponent(row.id),label:'Trip report',detail:Number.isFinite(row.total?.dives)?row.total.dives+' logged dives':null})),
  ...events.filter(row=>Date.parse(row.starts_at)>=now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at)).map(row=>({id:'event:'+row.id,kind:'events',title:row.document?.title,description:row.document?.description,byline:row.organiser,date:row.starts_at,href:'/events/'+encodeURIComponent(row.id),label:'Upcoming event',detail:row.document?.location})),
  ...listings.map(row=>({id:'page:'+row.id,kind:'groups',title:row.name,description:row.description,byline:[row.locality,row.state].filter(Boolean).join(' · '),href:'/directory/'+encodeURIComponent(row.id),label:row.category||'Community page',image:row.image}))
 ].filter(row=>row.title);
}
export function popularPlaces(data,catalog=[]){return (data?.places||data?.sites||data?.beaches||[]).map(place=>typeof place==='string'?catalog.find(site=>site.id===place):place).filter(place=>place?.id);}
