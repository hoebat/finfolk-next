import {createHash} from 'node:crypto';
import {validPoint,storeSnapshot} from './environment.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const https=v=>{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password)throw Error('invalid_source_url');return v;};
export function validateBundle(bundle){
 if(bundle.version!==1||!Array.isArray(bundle.sources)||!Array.isArray(bundle.datasets||[])||!Array.isArray(bundle.stations||[])||!Array.isArray(bundle.predictions||[]))throw Error('invalid_bundle');
 for(const s of bundle.sources){if(!s.id||!s.metadata?.attribution||!s.metadata?.licence)throw Error('source_provenance_required');https(s.metadata.url);}
 for(const d of bundle.datasets||[]){if(!d.id||!d.source_id||!d.upstream_id||!d.version||!d.checksum||!d.metadata?.datum||!['measured_raster','published_contour','derived_contour','reported','context'].includes(d.metadata.kind)||!Array.isArray(d.metadata.assets)||!d.metadata.assets.length)throw Error('invalid_dataset');for(const a of d.metadata.assets)if(!a.path||!a.checksum||a.path.includes('..')||/^[a-z]+:/i.test(a.path))throw Error('invalid_asset');}
 for(const s of bundle.stations||[]){if(!s.id||!s.source_id||!s.upstream_id||!validPoint(s.metadata?.point)||!Array.isArray(s.metadata.datums))throw Error('invalid_station');new Intl.DateTimeFormat('en',{timeZone:s.metadata.timezone});}
 for(const p of bundle.predictions||[]){if(!p.stationId||!p.source_id||!p.payload?.datum||!p.payload.issuedAt||!p.payload.attribution)throw Error('invalid_prediction');const rows=p.payload.samples||p.payload.events;if(!Array.isArray(rows)||!rows.length)throw Error('empty_prediction');for(const [i,r]of rows.entries())if(!Number.isFinite(Date.parse(r.time))||typeof r.height!=='number'||!Number.isFinite(r.height)||(i&&Date.parse(r.time)<=Date.parse(rows[i-1].time))||(p.payload.events&&!['high','low'].includes(r.type)))throw Error('invalid_prediction_samples');}
 return bundle;
}
export async function importBundle(db,input){
 const b=validateBundle(input);
 return db.transaction(async q=>{
  for(const s of b.sources)await q('INSERT INTO finfolk.data_sources(id,metadata,enabled) VALUES($1,$2::jsonb,$3) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata,enabled=excluded.enabled',[s.id,JSON.stringify(s.metadata),s.enabled===true]);
  for(const d of b.datasets||[]){const old=(await q('SELECT checksum,metadata FROM finfolk.depth_datasets WHERE id=$1',[d.id]))[0];if(old&&(old.checksum!==d.checksum||digest(old.metadata)!==digest(d.metadata)))throw Error('immutable_dataset_conflict');await q("INSERT INTO finfolk.depth_datasets(id,source_id,upstream_id,version,checksum,status,metadata) VALUES($1,$2,$3,$4,$5,'published',$6::jsonb) ON CONFLICT(id) DO NOTHING",[d.id,d.source_id,d.upstream_id,d.version,d.checksum,JSON.stringify(d.metadata)]);}
  for(const s of b.stations||[])await q('INSERT INTO finfolk.tide_stations(id,source_id,upstream_id,metadata) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata',[s.id,s.source_id,s.upstream_id,JSON.stringify(s.metadata)]);
  for(const p of b.predictions||[]){const station=(await q('SELECT * FROM finfolk.tide_stations WHERE id=$1 AND source_id=$2 AND active',[p.stationId,p.source_id]))[0];if(!station||!station.metadata.datums.includes(p.payload.datum))throw Error('station_datum_mismatch');const configuration={stationId:p.stationId,version:1},id=digest([p.source_id,'tides',configuration]);await q("INSERT INTO finfolk.environment_targets(id,source_id,product,configuration) VALUES($1,$2,'tides',$3::jsonb) ON CONFLICT(id) DO NOTHING",[id,p.source_id,JSON.stringify(configuration)]);await storeSnapshot({query:q},{id,source_id:p.source_id,product:'tides'},p.payload);}
  return {datasets:b.datasets?.length||0,stations:b.stations?.length||0,predictions:b.predictions?.length||0};
 });
}

export async function assignEnvironmentLinks(q,revisionId,{datasets=[],stationId=null,evidence={}}){
 const revision=(await q('SELECT status FROM finfolk.site_revisions WHERE id=$1 FOR UPDATE',[revisionId]))[0];
 if(!revision||!['draft','submitted'].includes(revision.status))throw Error('editable_revision_required');
 await q('DELETE FROM finfolk.site_depth_datasets WHERE revision_id=$1',[revisionId]);
 for(const d of datasets){if(!['candidate','confirmed'].includes(d.relationship))throw Error('invalid_relationship');await q('INSERT INTO finfolk.site_depth_datasets(revision_id,dataset_id,relationship,evidence) VALUES($1,$2,$3,$4::jsonb)',[revisionId,d.id,d.relationship,JSON.stringify(d.evidence||{})]);}
 await q('DELETE FROM finfolk.site_tide_stations WHERE revision_id=$1',[revisionId]);
 if(stationId){if(!evidence.reason||!evidence.sourceUrl)throw Error('station_assignment_evidence_required');https(evidence.sourceUrl);await q('INSERT INTO finfolk.site_tide_stations(revision_id,station_id,evidence) VALUES($1,$2,$3::jsonb)',[revisionId,stationId,JSON.stringify(evidence)]);}
 await q('UPDATE finfolk.site_revisions SET version=version+1,updated_at=now() WHERE id=$1',[revisionId]);
}

export function coverageCandidates(sites,datasets){
 return sites.flatMap(site=>{
  if(!validPoint(site.point)||!['ocean','unknown',undefined].includes(site.waterbody))return [];
  return datasets.filter(d=>{const b=d.metadata.bounds||d.metadata.query_bbox||d.metadata.bbox;return Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&site.point[0]>=b[0]&&site.point[0]<=b[2]&&site.point[1]>=b[1]&&site.point[1]<=b[3];}).map(d=>({siteId:site.id,datasetId:d.id,relationship:'candidate',reason:'Dataset envelope intersects reference position; actual sample coverage requires verification.'}));
 });
}
