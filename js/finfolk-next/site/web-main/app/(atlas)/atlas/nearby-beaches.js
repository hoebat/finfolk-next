import {validPoint} from './explore-model.js';
const radians=value=>value*Math.PI/180;
export function beachDistance(a,b){const lat=radians(b[1]-a[1]),lon=radians(b[0]-a[0]),h=Math.sin(lat/2)**2+Math.cos(radians(a[1]))*Math.cos(radians(b[1]))*Math.sin(lon/2)**2;return 6371*2*Math.asin(Math.sqrt(Math.min(1,h)));}
export function nearbyBeaches(rows,results,{origin,selectedID='',radiusKm=50,limit=5}={}){
 if(results.length>=5||!validPoint(origin))return [];
 const excluded=new Set([...results.map(row=>row.id),selectedID]);
 const unique=new Map();
 for(const row of rows){const site=row.site||{};
  if(row.kind!=='spot'||excluded.has(row.id)||unique.has(row.sourceId||row.id)||!validPoint(row.point))continue;
  if(site.waterbody&&site.waterbody!=='unknown'&&site.waterbody!=='ocean')continue;
  const beach=site.features?.includes('beach')||/\bbeach\b/i.test(row.name)||(site.waterbody==='ocean'&&site.access_mode==='shore');
  if(!beach||site.access_mode==='boat_only')continue;
  const distanceKm=beachDistance(origin,row.point);if(distanceKm<=radiusKm)unique.set(row.sourceId||row.id,{...row,distanceKm});
 }
 return [...unique.values()].sort((a,b)=>a.distanceKm-b.distanceKm||a.name.localeCompare(b.name)).slice(0,limit);
}
