// Explicitly scoped fresh application rebuild on the recorded isolated candidate.
// Managed identity is retained. Serving branches and bindings are never modified.
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {connectCloudDatabase} from './lib/cloud_database.mjs';
import {installFreshDatabase,importReferenceRelease,verifyReferenceDatabase,verifyManifest,canonical} from './lib/rebuild_reference.mjs';
const mode=process.argv[2];if(!['plan','install','import','inspect'].includes(mode))throw Error('Use plan|install|import|inspect');
const p=JSON.parse(await readFile('.cache/cloud-rebuild/admin.json','utf8')),
 manifest=JSON.parse(await readFile('.cache/cloud-rebuild/manifest.json','utf8'));
const list=JSON.parse(execFileSync('neon',['branches','list','--project-id',p.project,'--output','json'],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}));
const branch=list.find(b=>b.id===p.branch);
if(p.project!=='odd-voice-85400108'||p.name!=='finfolk-native-cloud'||!branch||branch.name!==p.name||branch.default||branch.parent_id!=='br-sparkling-sun-a7dpot05'||p.database!=='finfolk_next')throw Error('Refusing unexpected cloud candidate');
const url=new URL(p.url);
const endpointResult=JSON.parse(execFileSync('neon',['api',`/projects/${p.project}/endpoints`,'--output','json'],{stdio:['ignore','pipe','pipe'],encoding:'utf8'}));
const endpoints=(endpointResult.endpoints||endpointResult).filter(e=>e.branch_id===p.branch);
if(!endpoints.some(e=>e.host===url.hostname)||url.pathname!=='/'+p.database||url.hostname.includes('-pooler'))throw Error('Candidate endpoint does not match the recorded branch');
await verifyManifest(process.cwd(),manifest);
if(manifest.rows.DataAsset.some(a=>!a.uri.startsWith('https://finfolk-reference-assets.')))throw Error('Cloud release requires reference asset HTTPS URIs');
const db=await connectCloudDatabase(p.url);
const authIdentity=async()=>(await db.query('SELECT count(*)::int AS count,md5(coalesce(string_agg(id::text,\'\' ORDER BY id::text),\'\')) AS fingerprint FROM neon_auth."user"')).rows[0];
try{
 if(!(await db.query("SELECT pg_try_advisory_lock(hashtext('finfolk:cloud-rebuild')) AS locked")).rows[0].locked)throw Error('Another cloud rebuild owns this candidate');
 const before=await authIdentity();
 if(mode==='plan')console.log(JSON.stringify({branch:p.branch,name:p.name,database:p.database,managedAuthUsers:before.count,release:manifest.id,counts:manifest.counts}));
 if(mode==='install'){
  const ready=(await db.query("SELECT to_regclass('finfolk.\"DatabaseRelease\"') IS NOT NULL AS native")).rows[0].native;
  if(ready)throw Error('Candidate already has a native schema. Inspect it; this command never resets an installed native release.');
  // Only the application schemas copied onto this freshly created candidate.
  // The original parent and provider-owned neon_auth schema are untouched.
  await db.query('DROP SCHEMA IF EXISTS finfolk_rpc CASCADE; DROP SCHEMA IF EXISTS finfolk CASCADE; DROP SCHEMA IF EXISTS finfolk_shop CASCADE');
  await installFreshDatabase(db,{manifest});
  if(JSON.stringify(await authIdentity())!==JSON.stringify(before))throw Error('Managed identity changed during application rebuild');
  await writeFile('.cache/cloud-rebuild/installed.json',JSON.stringify({branch:p.branch,release:manifest.id,installedAt:new Date().toISOString(),managedAuth:before})+'\n',{mode:0o600});
  console.log('Fresh native candidate installed; managed identity retained.');
 }
 if(mode==='import'){
  const published=JSON.parse(await readFile('.cache/cloud-rebuild/assets-published.json','utf8'));
  for(const asset of manifest.rows.DataAsset){const proof=published.assets[asset.checksum];if(!proof?.verified||proof.bytes!==asset.bytes||proof.url!==asset.uri)throw Error('Cloud asset has not been verified: '+asset.metadata.path);}
  let n=0;const result=await importReferenceRelease(db,manifest,{onBatch:kind=>{if(++n%100===0)console.log('Cloud import batch',n,kind);}});
  await writeFile('.cache/cloud-rebuild/imported.json',JSON.stringify({...result,branch:p.branch,importedAt:new Date().toISOString()})+'\n',{mode:0o600});
  console.log('Cloud reference import committed:',manifest.id);
 }
 if(mode==='inspect'||mode==='import'){
  const result=await verifyReferenceDatabase(db,manifest);
  const installed=JSON.parse(await readFile('.cache/cloud-rebuild/installed.json','utf8'));
  if(JSON.stringify(await authIdentity())!==JSON.stringify(installed.managedAuth))throw Error('Managed identity differs from candidate install');
  const localManifest=JSON.parse(await readFile('.cache/rebuild/manifest.json','utf8'));
  const localProof=JSON.parse(await readFile('.cache/rebuild/acceptance.json','utf8'));
  const semanticRows=m=>({...m.rows,DataAsset:m.rows.DataAsset.map(({uri,...r})=>r)});
  if(localProof.release.id!==localManifest.id||canonical(semanticRows(localManifest))!==canonical(semanticRows(manifest))||canonical(localManifest.features)!==canonical(manifest.features)||canonical(localManifest.implementation)!==canonical(manifest.implementation))throw Error('Local acceptance proof does not describe this cloud reference release');
  const contracts=JSON.parse(await readFile('resources/finfolkdb/rebuild-contract.json','utf8'));
  const quote=s=>'"'+s.replaceAll('"','""')+'"',fingerprints={};
  for(const [table,columns]of Object.entries(contracts)){
   if(['DatabaseRelease','DataAsset'].includes(table))continue;
   const projection=columns.flatMap(c=>["'"+c+"'",quote(c)]).join(',');
   const actual=(await db.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS checksum FROM (SELECT md5(jsonb_build_object(${projection})::text) AS h FROM finfolk.${quote(table)}) s`)).rows[0];
   if(canonical(actual)!==canonical(localProof.fingerprints[table]))throw Error('Cloud data differs from the accepted local rebuild: '+table);
   fingerprints[table]=actual;
  }
  const sample=(await db.query(`SELECT b.id,p.payload->>'name' AS name,a.id AS area FROM finfolk."Beach" b JOIN finfolk."SiteProfile" p ON p.beach_id=b.id JOIN finfolk."SiteLocation" l ON l.beach_id=b.id JOIN finfolk."GeoArea" a ON a.id=l.area_id WHERE p.status='published' ORDER BY b.id LIMIT 1`)).rows[0];
  if(!sample?.id)throw Error('Native site/reference read failed');
  const report={...result,localSemanticParity:true,fingerprints,sample,branch:p.branch,verifiedAt:new Date().toISOString(),databaseBytes:(await db.query('SELECT pg_database_size(current_database())::text AS bytes')).rows[0].bytes,managedAuthPreserved:true,liveTrafficChanged:false};
  await writeFile('.cache/cloud-rebuild/database-acceptance.json',JSON.stringify(report)+'\n',{mode:0o600});
  console.log(JSON.stringify(report));
 }
}finally{await db.end();}
