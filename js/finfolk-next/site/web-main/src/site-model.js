// Shared public site contract. Unknown access and water types are never inferred.
export const WATERBODIES=['ocean','lake','river','quarry','sinkhole','pool','unknown'];
export const ACCESS_MODES=['shore','boat_only','shore_or_boat','unknown'];
export const SITE_FEATURES=['beach','reef','wreck','wall','training'];
export const accessLabel=mode=>({shore:'Shore access',boat_only:'Boat only',shore_or_boat:'Shore or boat',unknown:'Access unconfirmed'}[mode]||'Access unconfirmed');
export const waterLabel=kind=>kind==='unknown'?'Waterbody unconfirmed':kind?kind[0].toUpperCase()+kind.slice(1):'Waterbody unconfirmed';
export const isInland=site=>site.waterbody&& !['ocean','unknown'].includes(site.waterbody);
export const isShore=site=>site.access_mode==='shore'||site.access_mode==='shore_or_boat'||(!site.access_mode&&(site.entry_documented||site.entry?.verified));
export const canAutoMeasure=site=>!isInland(site)&&site.access_mode!=='boat_only';
export function reportedDepth(site){return (site.depth_evidence||[]).filter(d=>Number.isFinite(d.depth_m)&&d.depth_m>0);}
export function siteMatches(site,{waterbody='',access=''}={}){return (!waterbody||(site.waterbody||'unknown')===waterbody)&&(!access||(site.access_mode||'unknown')===access);}
export function siteAreaID(state,name){return state.toLowerCase()+'-'+String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
export function hydrateSiteCatalog(directory,atlas){
 const states=new Map((directory.states||[]).map(s=>[s.id,s.name]));
 const areas=new Map((directory.areas||[]).map(a=>[a.id,{...a}]));
 for(const site of directory.beaches||[]){
  const area=areas.get(site.area_id)||{id:site.area_id,name:site.area_name,state_id:site.state_id,depth_count:0,max_distance_km:50};areas.set(area.id,area);
  site.state=states.get(site.state_id)||site.state||site.state_id;site.region_name=site.area_name;
  // Inland locations never inherit a coastal package from their nearest region.
  if(isInland(site)||!atlas.regions.some(r=>r.id===site.region))site.region='site-'+site.id;
  if(!atlas.regions.some(r=>r.id===site.region))atlas.regions.push({id:site.region,name:site.name,state:site.state,center:site.point,bbox:[site.point[0]-.03,site.point[1]-.03,site.point[0]+.03,site.point[1]+.03],zoom:14,rasters:[],tiles:{},contours:null,contour_file:null,status:'empty',notes:'No surveyed depth data is published for this dive site.',attribution:'See the site source records.',licence:'See source records'});
 }
 for(const area of areas.values()){
  const sites=directory.beaches.filter(s=>s.area_id===area.id);if(!sites.length)continue;
  const xs=sites.map(s=>s.point[0]),ys=sites.map(s=>s.point[1]);
  area.bbox=[Math.min(...xs)-.03,Math.min(...ys)-.03,Math.max(...xs)+.03,Math.max(...ys)+.03];area.center=[(Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2];area.beach_count=sites.length;
  if(!atlas.regions.some(r=>r.id===area.map_region))area.map_region=sites[0].region;
 }
 directory.areas=[...areas.values()].filter(a=>directory.beaches.some(s=>s.area_id===a.id));return directory;
}
