// Presentation-only adaptation of published catalogues. Missing coordinates stay missing.
export const MAP_CATEGORIES={spot:{label:'Dive spot',color:'#087f83'},business:{label:'Business & group',color:'#6745a1'},people:{label:'People by spot',color:'#b75067'},event:{label:'Event',color:'#9b5e13'}};
export function validPoint(point){return Array.isArray(point)&&point.length===2&&point.every(Number.isFinite)&&Math.abs(point[0])<=180&&Math.abs(point[1])<=85;}
const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const countryAU=value=>!value||['au','aus','australia'].includes(normalize(value));
export function localityReference(locality,state,directory){
 const name=normalize(locality);if(name.length<4)return null;
 const sameState=row=>!state||normalize(row.state_id)===normalize(state)||normalize(row.state)===normalize(state);
 const sites=(directory?.beaches||[]).filter(row=>sameState(row)&&validPoint(row.point)&&[row.name,...(row.aliases||[])].some(value=>normalize(value)===name));
 // Repeated place names have no unique reference; do not pick one arbitrarily.
 if(sites.length===1)return {point:sites[0].point,label:sites[0].name+' · place reference'};
 const areas=(directory?.areas||[]).filter(row=>sameState(row)&&validPoint(row.center)&&(` ${normalize(row.name)} `).includes(` ${name} `));
 if(!areas.length)return null;
 return {point:[0,1].map(axis=>areas.reduce((sum,a)=>sum+a.center[axis],0)/areas.length),label:locality+' · approximate area'};
}
export function mapRows(directory,listings=[],events=[],popular=[]){
 const sites=(directory?.beaches||[]).filter(s=>validPoint(s.point));
 const rows=sites.map(site=>({id:'spot:'+site.id,sourceId:site.id,kind:'spot',name:site.name,area:[site.area_name,site.state_id].filter(Boolean).join(' · '),point:site.point,reference:site.reference_label||'Published place reference',description:site.description||'',tags:[site.waterbody&&site.waterbody!=='unknown'?site.waterbody:'',site.access_mode==='shore'?'Shore access':site.access_mode==='boat_only'?'Boat only':''].filter(Boolean),site}));
 for(const listing of listings){const ref=countryAU(listing.country)?localityReference(listing.locality,listing.state,directory):null;rows.push({id:'business:'+listing.id,sourceId:listing.id,kind:'business',name:listing.name,area:[listing.locality,listing.state,listing.country&&listing.country!=='Australia'?listing.country:''].filter(Boolean).join(' · '),point:ref?.point,reference:ref?ref.label+' · premises unconfirmed':'Location not mapped',description:listing.description||'',tags:[listing.category,listing.managed?'Managed page':'Unclaimed'].filter(Boolean),href:'/directory/'+encodeURIComponent(listing.id)});}
 for(const event of events){const doc=event.document||{},ref=localityReference(doc.location,'',directory);rows.push({id:'event:'+event.id,sourceId:event.id,kind:'event',name:doc.title||'Event',area:doc.location||'',point:ref?.point,reference:ref?ref.label+' · confirm venue with organiser':'Venue not mapped',description:doc.description||'',tags:[doc.category,event.starts_at?new Date(event.starts_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'Australia/Sydney'}):''].filter(Boolean),href:'/events/'+encodeURIComponent(event.id)});}
 const knownPopular=new Set(popular);
 for(const site of sites.filter(s=>knownPopular.has(s.id)))rows.push({id:'people:'+site.id,sourceId:site.id,kind:'people',name:'The folk at '+site.name,area:[site.area_name,site.state_id].filter(Boolean).join(' · '),point:site.point,reference:'Shared spot · not live positions',description:'Discover divers associated with this spot. Profiles and visit information follow each member’s sharing choices.',tags:['Shared spot'],href:'/people?location='+encodeURIComponent(site.id)});
 return rows;
}
export function filterMapRows(rows,{category='all',query='',bounds=null}={}){const q=normalize(query);return rows.filter(row=>(category==='all'||row.kind===category)&&(!q||normalize([row.name,row.area,...row.tags].join(' ')).includes(q))&&(!bounds||validPoint(row.point)&&bounds.contains(row.point)));}
export function mapPointCollection(rows){const groups=new Map();for(const row of rows){if(!validPoint(row.point))continue;const key=row.point.join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}return {type:'FeatureCollection',features:[...groups.values()].map(group=>({type:'Feature',geometry:{type:'Point',coordinates:group[0].point},properties:{id:group[0].id,count:group.length,kind:group[0].kind,label:group[0].name}}))};}
export function surveyMode(params){return params.get('mode')==='survey'||params.has('region')||params.has('depth');}
export function surveyHref(site=''){return '/map?mode=survey'+(site?'&site='+encodeURIComponent(site):'');}
export function mapSelectionURL(current,row){const url=new URL(current);for(const key of ['site','listing','event','folk'])url.searchParams.delete(key);if(row)url.searchParams.set({spot:'site',business:'listing',event:'event',people:'folk'}[row.kind],row.sourceId);return url.pathname+url.search;}
export function selectedMapID(params){for(const [key,kind]of [['site','spot'],['listing','business'],['event','event'],['folk','people']])if(params.get(key))return kind+':'+params.get(key);return '';}
