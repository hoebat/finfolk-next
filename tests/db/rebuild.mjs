import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {connect,quote} from './harness.mjs';
import {prepareReferenceRelease,verifyManifest,installFreshDatabase,importReferenceRelease,verifyReferenceDatabase,canonical,digest} from '../../scripts/lib/rebuild_reference.mjs';
const db=await connect(),root=await realpath(await mkdtemp(join(tmpdir(),'finfolk-rebuild-')));
const put=async(p,value)=>{await mkdir(join(root,p,'..'),{recursive:true});await writeFile(join(root,p),typeof value==='string'?value:JSON.stringify(value));};
const seal=body=>{const {id,...rest}=body;return {...rest,id:digest(canonical(rest))};};
async function projection(){
 const contracts=JSON.parse(await readFile('resources/finfolkdb/rebuild-contract.json','utf8')),out={};
 for(const [table,columns]of Object.entries(contracts)){
  if(table==='DatabaseRelease')continue;
  const rows=(await db.query(`SELECT ${columns.map(quote)} FROM finfolk.${quote(table)}`)).rows;
  // pg returns bigint as text; compare a consistent database-side projection.
  out[table]=rows.map(canonical).sort();
 }return out;
}
async function fingerprints(){
 const contracts=JSON.parse(await readFile('resources/finfolkdb/rebuild-contract.json','utf8')),out={};
 for(const [table,columns]of Object.entries(contracts)){
  if(table==='DatabaseRelease')continue;
  const projection=columns.flatMap(c=>["'"+c+"'",quote(c)]).join(',');
  out[table]=(await db.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS checksum FROM (SELECT md5(jsonb_build_object(${projection})::text) AS h FROM finfolk.${quote(table)}) s`)).rows[0];
 }return out;
}
try{
 await mkdir(join(root,'resources/finfolkdb'),{recursive:true});
 for(const name of ['entity-schema.sql','rebuild.sql','rebuild-contract.json','messaging-grants.sql','site-notes-grants.sql','shop.sql'])await copyFile('resources/finfolkdb/'+name,join(root,'resources/finfolkdb',name));
 const features={type:'FeatureCollection',features:[{type:'Feature',id:7,geometry:{type:'LineString',coordinates:[[151,-33],[151.1,-33.1]]},properties:{depth_m:10,datum:'unverified'}}]};
 await put('resources/atlas/coastline.geojson',features);
 const geo=JSON.stringify(features),path='datasets/processed/test.geojson';await put(path,geo);
 await put('datasets/inventory.json',{contours:{test:{file:'processed/test.geojson',count:1,sha256:digest(geo),query_bbox:[150,-34,152,-32],source_revision:1,datum:'unverified'}},context_contours:{}});
 const nativePath='datasets/raw/ocean/test/part.bin',nativeBytes='TEST_NATIVE_FIXTURE',nativeHash=digest(nativeBytes);
 await put(nativePath,nativeBytes);
 await put('datasets/ocean/records/test-ocean.json',{id:'test-ocean',source_url:'https://example.test/data',licence:'CC BY 4.0',review:{quality:'unverified',datum_verified:false,acquisition_status:'partial'},observed:{assets:[{path,sha256:digest(geo),role:'processed'}]},acquisitions:[{id:'test-native',filename:'test.tif',sha256:nativeHash,bytes:nativeBytes.length,numeric_validation:'pending',parts:[{path:nativePath,sha256:nativeHash,bytes:nativeBytes.length}]}]});
 const inspectionPath='datasets/ocean/provenance/native-inspections/test-native.json',inspection={asset_id:'test-native',sha256:nativeHash,raster_headers:[{crs:'EPSG:4326',bounds:[150,-34,152,-32],nodata:-9999,units:[null]}]};
 await put(inspectionPath,inspection);
 await put('datasets/ocean/provenance/test.json',{validation:'fixture'});await put('datasets/ocean/acquisition-manifest.json',{sources:[]});
 await put('config/areas.json',{note:'Curated test region; not an administrative boundary.',areas:[{id:'test-area',name:'Test region'}]});await put('config/site-examples.json',[]);
 const beach={id:'test-beach',name:'Test Beach',state_id:'NSW',area_id:'test-area',area_name:'Test region',point:[151,-33],source_id:'test-ocean',source_url:'https://example.test/data'};
 await put('.cache/next-site/data/area-regions.json',{type:'FeatureCollection',attribution:'Test boundary attribution',licence:'CC BY 4.0',features:[{...features.features[0],properties:{id:'test-area'}}]});
 await put('.cache/next-site/beaches.json',{area_regions_file:'data/area-regions.json',sources:[],areas:[{id:'test-area',name:'Test region'}],beaches:[beach]});
 const manifest=await prepareReferenceRelease({root});
 assert.equal(manifest.counts.GeoFeature,1);assert.equal(manifest.counts.SiteDepthDataset,1);assert.equal(manifest.rows.DepthDataset[0].status,'staged');
 assert.equal(manifest.rows.SiteDepthDataset[0].relationship,'candidate');assert.equal(manifest.rows.DataSource[0].enabled,false);
 assert.deepEqual(await prepareReferenceRelease({root}),manifest,'Preparation is reproducible');
 await put(inspectionPath,{...inspection,sha256:'0'.repeat(64)});await assert.rejects(prepareReferenceRelease({root}),/Native inspection checksum mismatch/);await put(inspectionPath,inspection);
 await assert.rejects(verifyManifest(root,seal({...manifest,implementation:{}})),/implementation changed/);
 // Provisioning managed auth is an external prerequisite. Only this disposable
 // local test uses a fixture table; the actual installer never invents one.
 await assert.rejects(installFreshDatabase(db,{root,manifest}),/Provision finfolk_api and managed authentication first/);
 assert.equal((await db.query("SELECT to_regclass('finfolk.\"Beach\"') AS t")).rows[0].t,null);
 await db.query(`DO $$ BEGIN CREATE ROLE finfolk_api NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
 CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean,email text);`);
 await db.query('CREATE SCHEMA finfolk_shop; CREATE TABLE finfolk_shop.existing(id integer)');
 await assert.rejects(installFreshDatabase(db,{root,manifest}),/empty finfolk_shop/);
 assert.equal((await db.query("SELECT to_regclass('finfolk.\"Beach\"') AS t")).rows[0].t,null);
 await db.query('DROP SCHEMA finfolk_shop CASCADE');
 // A failure late in installation also rolls the entire native schema back.
 const shop=await readFile(join(root,'resources/finfolkdb/shop.sql'),'utf8');await put('resources/finfolkdb/shop.sql',shop+'\nINVALID INSTALL STATEMENT;');
 await assert.rejects(installFreshDatabase(db,{root}),/syntax error/);
 assert.equal((await db.query("SELECT to_regclass('finfolk.\"Beach\"') AS t")).rows[0].t,null);
 await put('resources/finfolkdb/shop.sql',shop);await installFreshDatabase(db,{root,manifest});
 await assert.rejects(installFreshDatabase(db,{root,manifest}),/requires empty application schemas/);
 await assert.rejects(importReferenceRelease(db,manifest,{root,onBatch:()=>{throw Error('Injected batch failure');}}),/Injected batch failure/);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."DataSource"')).rows[0].n,0,'Failed import rolls back earlier batches');
 await put(path,geo+' ');await assert.rejects(importReferenceRelease(db,manifest,{root}),/Source changed/);await put(path,geo);
 const invalid=structuredClone(manifest);invalid.rows.DataAsset[0].kind='unsupported';await assert.rejects(importReferenceRelease(db,seal(invalid),{root}),e=>e.code==='22P02');
 const missing=structuredClone(manifest);missing.rows.DataAsset[0].source_id='missing';await assert.rejects(importReferenceRelease(db,seal(missing),{root}),e=>e.code==='23503');
 const imported=await importReferenceRelease(db,manifest,{root});assert.equal(imported.counts.GeoFeature,1);
 assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk."GeoBoundary" WHERE area_id='test-area'`)).rows[0].n,1);
 assert.ok(manifest.rows.DataAsset.some(a=>a.metadata.attribution==='Test boundary attribution'));
 assert.equal((await db.query(`SELECT metadata->'native_inspections'->0->'raster_headers'->0->>'crs' AS crs FROM finfolk."DepthDataset" WHERE upstream_id='test-native'`)).rows[0].crs,'EPSG:4326');
 const snapshot=await projection();await importReferenceRelease(db,manifest,{root});assert.deepEqual(await projection(),snapshot,'Repeated release has identical semantic rows');
 assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."DatabaseRelease"')).rows[0].n,1);
 const conflict=structuredClone(manifest);conflict.rows.Beach[0].name='Changed identity';await assert.rejects(importReferenceRelease(db,seal(conflict),{root}),e=>e.code==='23505');assert.deepEqual(await projection(),snapshot);
 const linked=(await db.query(`SELECT b.id,d.status,f.properties->>'depth_m' AS depth FROM finfolk."Beach" b JOIN finfolk."SiteLocation" l ON l.beach_id=b.id JOIN finfolk."GeoArea" a ON a.id=l.area_id JOIN finfolk."SiteRevision" r ON r.site_id=b.id JOIN finfolk."SiteDepthDataset" sd ON sd.revision_id=r.id JOIN finfolk."DepthDataset" d ON d.id=sd.dataset_id JOIN finfolk."GeoFeature" f ON f.dataset_id=d.id`)).rows;
 assert.deepEqual(linked,[{id:'test-beach',status:'staged',depth:'10'}]);
 assert.equal((await db.query("SELECT has_function_privilege('finfolk_api','finfolk_rpc.import_reference_batch(text,jsonb)','EXECUTE') AS allowed")).rows[0].allowed,false,'Importer is owner-only');
 await db.query('SET ROLE finfolk_api');await assert.rejects(db.query("SELECT finfolk_rpc.import_reference_batch('DataSource','[]')"),e=>e.code==='42501');await db.query('RESET ROLE');
 // This explicit destructive reset is restricted by harness.connect to a local
 // randomly named disposable database. Production orchestration has no reset.
 await db.query('DROP SCHEMA finfolk_rpc CASCADE; DROP SCHEMA finfolk CASCADE; DROP SCHEMA finfolk_shop CASCADE');
 await installFreshDatabase(db,{root,manifest});await importReferenceRelease(db,manifest,{root});assert.deepEqual(await projection(),snapshot,'A second fresh rebuild reproduces the same semantic records');
 // Bad geometry and missing files fail preparation, before database writes.
 await put(path,{...features,features:[{...features.features[0],geometry:{type:'Point',coordinates:[500,-33]}}]});
 const source=JSON.parse(await readFile(join(root,'datasets/ocean/records/test-ocean.json'),'utf8'));
 source.observed.assets[0].sha256=digest(await readFile(join(root,path)));await put('datasets/ocean/records/test-ocean.json',source);
 await assert.rejects(prepareReferenceRelease({root}),/WGS84/);await rm(join(root,path));await assert.rejects(prepareReferenceRelease({root}),/ENOENT/);
 if(process.env.FINFOLK_REBUILD_REAL_DATA==='1'){
  const real=JSON.parse(await readFile('.cache/rebuild/manifest.json','utf8'));
  await db.query('DROP SCHEMA finfolk_rpc CASCADE; DROP SCHEMA finfolk CASCADE; DROP SCHEMA finfolk_shop CASCADE');
  console.log('REAL_REBUILD: validating pinned source files and installing fresh native schema');
  await installFreshDatabase(db,{manifest:real});let batches=0;
  const result=await importReferenceRelease(db,real,{onBatch:kind=>{if(++batches%100===0)console.log('REAL_REBUILD batches',batches,kind);}});
  for(const [table,count]of Object.entries(real.counts))assert.equal((await db.query(`SELECT count(*)::int AS n FROM finfolk.${quote(table)}`)).rows[0].n,count);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM finfolk."MessagingAccount"')).rows[0].n,0);
  const first=await fingerprints();
  console.log('REAL_REBUILD: replaying the same release');
  await importReferenceRelease(db,real);assert.deepEqual(await fingerprints(),first,'Real-data replay is semantically unchanged');
  console.log('REAL_REBUILD: installing and importing a second clean database schema');
  await db.query('DROP SCHEMA finfolk_rpc CASCADE; DROP SCHEMA finfolk CASCADE; DROP SCHEMA finfolk_shop CASCADE');
  await installFreshDatabase(db,{manifest:real});await importReferenceRelease(db,real);
  assert.deepEqual(await fingerprints(),first,'Two complete real-data rebuilds have identical semantic fingerprints');
  const verified=await verifyReferenceDatabase(db,real);
  await mkdir('.cache/rebuild',{recursive:true});
  await writeFile('.cache/rebuild/acceptance.json',JSON.stringify({verified_at:new Date().toISOString(),scope:'disposable local PostgreSQL; not deployed',replay_verified:true,clean_rebuilds:2,fingerprints:first,release:verified,warnings:result.warnings,unavailable_sources:real.unavailable_sources,postgres:(await db.query('SHOW server_version')).rows[0].server_version})+'\n');
  console.log('REAL_REBUILD_PASS',JSON.stringify({id:result.id,counts:result.counts,warnings:result.warnings.length}));
 }
 console.log('REBUILD_PASS: fresh install, atomic rollback, file integrity, native FK/enums, owner permissions, immutable replay and reproducible rebuild.');
}finally{await db.end();await rm(root,{recursive:true,force:true});}
