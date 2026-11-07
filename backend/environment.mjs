import {createHash,randomUUID} from 'node:crypto';
import * as SunCalc from 'suncalc';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const finite=v=>typeof v==='number'&&Number.isFinite(v);
export function validPoint(p){return Array.isArray(p)&&p.length===2&&p.every(finite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;}
export function windowDays(date,days,zone,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 date=date||today;days=Number(days??3);
 const start=Date.parse(date+'T12:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(start)||new Date(start).toISOString().slice(0,10)!==date||!Number.isInteger(days)||days<1||days>3||date<today||start>Date.parse(today+'T12:00:00Z')+2*864e5)fail(400,'Choose today or either of the next two dates, and 1–3 days.');
 if(start+(days-1)*864e5>Date.parse(today+'T12:00:00Z')+2*864e5)fail(400,'The requested window exceeds three local dates.');
 return Array.from({length:days},(_,i)=>new Date(start+i*864e5).toISOString().slice(0,10));
}
export function daylight(point,zone,dates){
 if(!validPoint(point))return {status:'unavailable',reason:'invalid_coordinates'};
 return {status:'available',timezone:zone,calculation:'suncalc-standard-horizon-v1',days:dates.map(date=>{
  // Select events by local calendar date rather than the server timezone.
  const candidates=[-1,0,1].map(offset=>SunCalc.getTimes(new Date(Date.parse(date+'T12:00:00Z')+offset*864e5),point[1],point[0]));
  const local=d=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
  const event=key=>{const d=candidates.map(t=>t[key]).find(d=>d instanceof Date&&Number.isFinite(+d)&&local(d)===date);return d?.toISOString()||null;};
  return {date,sunrise:event('sunrise'),sunset:event('sunset'),civilDawn:event('dawn'),civilDusk:event('dusk')};
 })};
}
export function normalizeOpenMeteo(raw,product){
 const h=raw.hourly,u=raw.hourly_units;
 if(raw.error||!validPoint([raw.longitude,raw.latitude])||!Array.isArray(h?.time)||!h.time.length)throw Error('invalid_provider_response');
 const fields=product==='weather'?{temperature_2m:['temperature','°C'],wind_speed_10m:['wind','m/s'],wind_direction_10m:['windDirection','°'],weather_code:['weatherCode','wmo code']}:{wave_height:['waveHeight','m'],sea_level_height_msl:['seaLevel','m']};
 const samples=h.time.map((t,i)=>{if(!finite(t))throw Error('invalid_provider_time');const row={time:new Date(t*1000).toISOString()};for(const [k,[name,unit]]of Object.entries(fields))row[name]=u?.[k]===unit&&finite(h[k]?.[i])?h[k][i]:null;return row;});
 if(samples.some((r,i)=>i&&r.time<=samples[i-1].time)||!samples.some(r=>Object.entries(r).some(([k,v])=>k!=='time'&&v!==null)))throw Error('invalid_provider_samples');
 return {samples,point:[raw.longitude,raw.latitude],datum:product==='marine'?'global_msl':null,model:raw.model||null,kind:'forecast',attribution:'Open-Meteo and upstream model providers',sourceUrl:product==='marine'?'https://open-meteo.com/en/docs/marine-weather-api':'https://open-meteo.com/'};
}
export async function collectOpenMeteo(target,env,fetcher=fetch){
 const customer=env.OPEN_METEO_CUSTOMER==='true',marine=target.product==='marine';
 const url=new URL(`https://${customer?'customer-':''}${marine?'marine-api':'api'}.open-meteo.com/v1/${marine?'marine':'forecast'}`);
 const p=target.configuration.point;if(!validPoint(p))throw Error('invalid_target');
 url.search=new URLSearchParams({longitude:p[0],latitude:p[1],timezone:'UTC',timeformat:'unixtime',forecast_days:4,hourly:marine?'wave_height,sea_level_height_msl':'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',...(marine?{cell_selection:'sea'}:{wind_speed_unit:'ms'})});
 if(customer){if(!env.OPEN_METEO_API_KEY)throw Error('provider_not_configured');url.searchParams.set('apikey',env.OPEN_METEO_API_KEY);}
 const response=await fetcher(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error(response.status===429?'provider_rate_limit':'provider_http_error');
 return normalizeOpenMeteo(await response.json(),target.product);
}
export async function storeSnapshot(db,target,payload,now=new Date()){
 await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",['environment:'+target.id]);
 const checksum=hash(payload);if((await db.query('SELECT id FROM finfolk.environment_snapshots WHERE target_id=$1 AND checksum=$2 AND delete_after>now()',[target.id,checksum])).length)return;
 const source=(await db.query('SELECT metadata,enabled FROM finfolk.data_sources WHERE id=$1',[target.source_id]))[0];
 if(!source?.enabled||source.metadata.cacheAllowed!==true||source.metadata.redistributionAllowed!==true)throw Error('source_not_authorized');
 const samples=payload.samples||payload.events;if(!samples?.length)throw Error('empty_snapshot');
 const from=new Date(samples[0].time),to=new Date(+new Date(samples.at(-1).time)+1000);
 if(!Number.isFinite(+from)||!Number.isFinite(+to)||+to<=+from)throw Error('invalid_snapshot_window');
 const retention=Math.min(7*86400,Number(source.metadata.retentionSeconds));if(!Number.isFinite(retention)||retention<=0)throw Error('invalid_source_retention');
 const fresh=new Date(+now+(target.product==='tides'?864e5:9e5));
 await db.query('INSERT INTO finfolk.environment_snapshots(id,target_id,issued_at,retrieved_at,valid_from,valid_to,fresh_until,delete_after,checksum,payload) VALUES($1,$2,$3,$10,$4,$5,$6,$7,$8,$9::jsonb)',[randomUUID(),target.id,payload.issuedAt||null,from,to,fresh,new Date(Math.min(+to+7*864e5,+now+retention*1000)),hash(payload),JSON.stringify(payload),now]);
}
export async function refreshTarget(db,target,env,fetcher=fetch){
 const lease=randomUUID();const claimed=await db.query("UPDATE finfolk.environment_jobs SET lease_token=$2,lease_until=now()+interval '30 seconds' WHERE target_id=$1 AND next_attempt_at<=now() AND (lease_until IS NULL OR lease_until<now()) RETURNING target_id",[target.id,lease]);if(!claimed.length)return;
 try{
  const source=(await db.query('SELECT enabled,metadata FROM finfolk.data_sources WHERE id=$1',[target.source_id]))[0];if(!source?.enabled||source.metadata.cacheAllowed!==true||source.metadata.redistributionAllowed!==true)throw Error('source_not_authorized');
  if(target.source_id!=='open-meteo')throw Error('adapter_not_configured');
  const payload=await collectOpenMeteo(target,env,fetcher);
  await db.transaction(async q=>{const owned=await q('SELECT target_id FROM finfolk.environment_jobs WHERE target_id=$1 AND lease_token=$2 AND lease_until>now() FOR UPDATE',[target.id,lease]);if(!owned.length)throw Error('lease_expired');await storeSnapshot({query:q},target,payload);await q("UPDATE finfolk.environment_jobs SET lease_token=NULL,lease_until=NULL,attempts=0,last_success=now(),error_code=NULL,next_attempt_at=now()+interval '15 minutes' WHERE target_id=$1 AND lease_token=$2",[target.id,lease]);});
 }catch(e){await db.query("UPDATE finfolk.environment_jobs SET lease_token=NULL,lease_until=NULL,attempts=attempts+1,error_code=$3,next_attempt_at=now()+least(3600,60*power(2,least(attempts,6)))*interval '1 second' WHERE target_id=$1 AND lease_token=$2",[target.id,lease,/^(invalid_|provider_|source_|adapter_|lease_)/.test(e.message)?e.message:'collection_failed']);}
}
export async function scheduleEnvironment(db,env){
 if(env.CONDITIONS_ENABLED!=='true')return;
 const targets=await db.query("SELECT t.* FROM finfolk.environment_targets t JOIN finfolk.environment_jobs j ON j.target_id=t.id JOIN finfolk.data_sources s ON s.id=t.source_id WHERE s.enabled AND t.last_requested_at>now()-interval '7 days' AND j.next_attempt_at<=now() AND (j.lease_until IS NULL OR j.lease_until<now()) ORDER BY j.next_attempt_at LIMIT 20");
 for(const target of targets)await refreshTarget(db,target,env);
 await db.query('DELETE FROM finfolk.environment_snapshots WHERE delete_after<now()');
}
export function registerEnvironment(app,{db,fetcher=fetch}){
 app.get('/v1/sites/:id/depth-datasets',async c=>{
  if(c.env?.DEPTH_CATALOG_ENABLED!=='true')return c.json({error:'Depth catalog disabled.'},503);
  const sites=await db.query("SELECT id FROM finfolk.site_profiles WHERE id=$1 AND status='published'",[c.req.param('id')]);if(!sites.length)fail(404,'Dive site not found.');
  const rows=await db.query("SELECT d.*,l.relationship,l.evidence FROM finfolk.site_revisions r JOIN finfolk.site_profiles p ON p.id=r.site_id AND p.payload=r.payload AND r.base_revision=p.revision-1 JOIN finfolk.site_depth_datasets l ON l.revision_id=r.id JOIN finfolk.depth_datasets d ON d.id=l.dataset_id WHERE r.site_id=$1 AND r.status='published' AND d.status='published'",[c.req.param('id')]);return c.json({datasets:rows});
 });
 app.get('/v1/sites/:id/conditions',async c=>{
  if(c.env?.CONDITIONS_ENABLED!=='true')return c.json({error:'Conditions disabled.'},503);
  const site=(await db.query("SELECT payload,revision FROM finfolk.site_profiles WHERE id=$1 AND status='published'",[c.req.param('id')]))[0];if(!site)fail(404,'Dive site not found.');
  const s=site.payload,dates=windowDays(c.req.query('date'),c.req.query('days'),s.timezone);
  const result={siteId:s.id,siteRevision:site.revision,timezone:s.timezone,dates,daylight:daylight(s.point,s.timezone,dates)};
  for(const product of ['weather','marine','tides']){
   if(product!=='weather'&&s.waterbody!=='ocean'){result[product]={status:s.waterbody==='unknown'?'unavailable':'not_applicable'};continue;}
   let target;
   if(product==='tides')target=(await db.query("SELECT t.* FROM finfolk.site_revisions r JOIN finfolk.site_profiles p ON p.id=r.site_id AND p.payload=r.payload AND r.base_revision=p.revision-1 JOIN finfolk.site_tide_stations l ON l.revision_id=r.id JOIN finfolk.tide_stations st ON st.id=l.station_id AND st.active JOIN finfolk.environment_targets t ON t.configuration->>'stationId'=st.id AND t.product='tides' WHERE r.site_id=$1 AND r.status='published' ORDER BY r.updated_at DESC LIMIT 1",[s.id]))[0];
   else{const point=product==='marine'?s.marine_point||s.point:s.point;if(validPoint(point)){const config={point,version:1};const id=hash(['open-meteo',product,config]);await db.query('INSERT INTO finfolk.environment_targets(id,source_id,product,configuration) SELECT $1,id,$2,$3::jsonb FROM finfolk.data_sources WHERE id=$4 ON CONFLICT(id) DO UPDATE SET last_requested_at=now()',[id,product,JSON.stringify(config),'open-meteo']);target=(await db.query('SELECT * FROM finfolk.environment_targets WHERE id=$1',[id]))[0];}}
   if(!target){result[product]={status:'unavailable',reason:'no_configured_source'};continue;}
   await db.query('UPDATE finfolk.environment_targets SET last_requested_at=now() WHERE id=$1',[target.id]);
   await db.query('INSERT INTO finfolk.environment_jobs(target_id) VALUES($1) ON CONFLICT DO NOTHING',[target.id]);
   let snapshot=(await db.query("SELECT sn.* FROM finfolk.environment_snapshots sn JOIN finfolk.environment_targets t ON t.id=sn.target_id JOIN finfolk.data_sources ds ON ds.id=t.source_id WHERE sn.target_id=$1 AND ds.enabled AND ds.metadata->>'redistributionAllowed'='true' AND delete_after>now() ORDER BY retrieved_at DESC LIMIT 1",[target.id]))[0];
   if(!snapshot){await refreshTarget(db,target,c.env,fetcher);snapshot=(await db.query("SELECT sn.* FROM finfolk.environment_snapshots sn JOIN finfolk.environment_targets t ON t.id=sn.target_id JOIN finfolk.data_sources ds ON ds.id=t.source_id WHERE sn.target_id=$1 AND ds.enabled AND ds.metadata->>'redistributionAllowed'='true' AND delete_after>now() ORDER BY retrieved_at DESC LIMIT 1",[target.id]))[0];}
   const stale=snapshot&&+new Date(snapshot.fresh_until)<Date.now();
   if(!snapshot||+new Date(snapshot.valid_to)<Date.now()||(stale&&product!=='tides'&&Date.now()-+new Date(snapshot.fresh_until)>216e5)){result[product]={status:'unavailable'};continue;}
   const payload=snapshot.payload;const samples=(payload.samples||payload.events||[]).filter(p=>dates.includes(new Intl.DateTimeFormat('en-CA',{timeZone:s.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(p.time))));
   result[product]={status:!samples.length?'unavailable':stale?'stale':samples.some(r=>Object.entries(r).some(([k,v])=>k!=='time'&&v===null))?'partial':'available',sourceId:target.source_id,retrievedAt:snapshot.retrieved_at,freshUntil:snapshot.fresh_until,validFrom:snapshot.valid_from,validTo:snapshot.valid_to,...payload,samples,...(payload.events?{events:samples}:{})};
  }
  result.modelledSeaLevel=result.marine?.samples?{...result.marine,samples:result.marine.samples.map(({time,seaLevel})=>({time,height:seaLevel})),datum:'global_msl'}:{status:result.marine?.status||'unavailable'};
  return c.json(result);
 });
}
