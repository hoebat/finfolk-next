// Dedicated Next catalog release. Credentials remain in ignored files and never reach logs.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import pg from 'pg';
import {siteDocument} from '../backend/sites.mjs';
const mode=process.argv[2];if(!['rehearse','seed','snapshot'].includes(mode))throw Error('Use rehearse, seed, or snapshot.');
const environment=JSON.parse(await readFile('next.environment.json','utf8'));
const rehearsal=mode==='rehearse',file=rehearsal?'.cache/site-rehearsal-url':'.cache/site-next-url';
const connectionString=(await readFile(file,'utf8')).trim().replace(/^'|'$/g,'');const target=new URL(connectionString);
const expected=new URL(environment.authUrl).hostname.split('.')[0]+'.ap-southeast-2.aws.neon.tech';
if(target.pathname!=='/finfolk_next'||target.hostname.includes('-pooler')||environment.environment!=='next')throw Error('Refusing non-Next catalog release.');
if(rehearsal){const info=JSON.parse(await readFile('.cache/site-neon-branch.json','utf8'));if(info.branch?.parent_id!=='br-sparkling-sun-a7dpot05'||!info.endpoints?.some(e=>target.hostname.startsWith(e.host||e.id+'.')))throw Error('Rehearsal endpoint does not match the temporary branch.');}
else if(target.hostname!==expected)throw Error('Refusing catalog changes outside the dedicated Next database.');
if(mode!=='snapshot'){
 const result=spawnSync(process.execPath,['scripts/migrate_neon.mjs'],{stdio:'inherit',env:{...process.env,DATABASE_URL_UNPOOLED:connectionString}});if(result.status!==0)throw Error('Migration failed.');
}
const db=new pg.Client({connectionString});await db.connect();
try{
 if(mode!=='snapshot'){
  const root=resolve(process.env.SITE_BUILD_DIRECTORY||'.cache/next-site');const catalog=JSON.parse(await readFile(join(root,'beaches.json'),'utf8'));
  const details=new Map();for(const area of catalog.areas)if(area.detail_file){try{const areaData=JSON.parse(await readFile(join(root,area.detail_file),'utf8'));for(const s of areaData.beaches||[])details.set(s.id,s);}catch{throw Error('Missing area details: '+area.id);}}
  const zones={VIC:'Australia/Melbourne',NSW:'Australia/Sydney',JBT:'Australia/Sydney',QLD:'Australia/Brisbane',SA:'Australia/Adelaide',WA:'Australia/Perth',NT:'Australia/Darwin',TAS:'Australia/Hobart',ACT:'Australia/Sydney'};
  const rows=new Map();for(const light of catalog.beaches){const site={...light,...details.get(light.id)};const legacy=site.entry?.verified?{name:site.entry.label||'Documented entry',mode:'shore',point:site.entry.point,source_url:site.entry.source_url||site.source_url,verified:true}:null;
   const doc=siteDocument({...site,timezone:site.timezone||(site.area_id?.includes('lord-howe')?'Australia/Lord_Howe':site.area_id?.includes('christmas')?'Indian/Christmas':site.area_id?.includes('cocos')?'Indian/Cocos':zones[site.state_id]||'Australia/Sydney'),waterbody:site.waterbody||'unknown',access_mode:site.access_mode||(legacy?'shore':'unknown'),access_points:site.access_points||(legacy?[legacy]:[]),features:site.features||['beach']});rows.set(doc.id,doc);
  }
  for(const raw of JSON.parse(await readFile('config/site-examples.json','utf8'))){const doc=siteDocument(raw);rows.set(doc.id,doc);}
  const metadata={...catalog};delete metadata.beaches;delete metadata.revision;metadata.sources=[...(metadata.sources||[]),{id:'finfolk-reviewed-sites',publisher:'FinFolk reviewed location records',url:'https://next.finfolk.com.au/',attribution:'Sources and access requirements are listed on each site record.'}];
  await db.query('BEGIN');try{
   await db.query("SELECT pg_advisory_xact_lock(hashtext('finfolk:site-catalog'))");let count=0;
   for(const doc of rows.values()){
    await db.query('INSERT INTO finfolk.beaches(id,name,timezone,area_name,state) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO NOTHING',[doc.id,doc.name,doc.timezone,doc.area_name,doc.state_id]);
    const inserted=await db.query("INSERT INTO finfolk.site_profiles(id,revision,waterbody,access_mode,status,payload) VALUES($1,1,$2,$3,'published',$4::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id",[doc.id,doc.waterbody,doc.access_mode,JSON.stringify(doc)]);
    if(inserted.rowCount){const revision=(await db.query("INSERT INTO finfolk.site_revisions(site_id,base_revision,status,payload,reason) VALUES($1,0,'published',$2::jsonb,'Initial sourced catalog import') RETURNING id",[doc.id,JSON.stringify(doc)])).rows[0].id;for(const a of doc.access_points)await db.query('INSERT INTO finfolk.site_access_points(revision_id,mode,payload) VALUES($1,$2,$3::jsonb)',[revision,a.mode,JSON.stringify(a)]);for(const d of doc.depth_evidence)await db.query('INSERT INTO finfolk.site_depth_evidence(revision_id,kind,payload) VALUES($1,$2,$3::jsonb)',[revision,d.kind,JSON.stringify(d)]);count++;}
   }
   await db.query("UPDATE finfolk.site_catalog SET metadata=CASE WHEN metadata ? 'states' THEN metadata ELSE $1::jsonb END,revision=revision+$2 WHERE id=1",[JSON.stringify(metadata),count>0?1:0]);
   await db.query('COMMIT');console.log('Catalog seeded:',count,'new sites;',rows.size,'input records. Reviewed records preserved.');
  }catch(e){await db.query('ROLLBACK');throw e;}
 }
 const snapshot=(await db.query('SELECT finfolk_rpc.site_catalog_read() AS value')).rows[0].value;if(!snapshot)throw Error('Catalog is not initialized.');
 const output='.cache/site-published-snapshot.json';await writeFile(output,JSON.stringify(snapshot));console.log('Published snapshot:',snapshot.beaches.length,'sites; revision',snapshot.revision);
 // Validate legacy references and rerunnable seed behavior without exposing member data.
 const missing=(await db.query('SELECT count(*)::int AS n FROM finfolk.checkins c LEFT JOIN finfolk.beaches b ON b.id=c.beach_id WHERE b.id IS NULL')).rows[0].n;if(missing)throw Error('Legacy location references were lost.');
}finally{await db.end();}
