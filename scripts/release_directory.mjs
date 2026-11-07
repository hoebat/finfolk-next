// Publish reviewed directory content through the existing operation; never migrate the database.
// Defaults to a rollback rehearsal. Credentials stay in an ignored operator context file.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import pg from 'pg';
const mode=process.argv[2]||'rehearse';
if(!['rehearse','publish'].includes(mode))throw Error('Use rehearse or publish.');
const contextFile=process.env.DIRECTORY_RELEASE_CONTEXT;
if(!contextFile)throw Error('DIRECTORY_RELEASE_CONTEXT must identify an ignored operator context containing nextDatabase and nextEnv.INSTAGRAM_ADMIN_IDS.');
const root=new URL('../',import.meta.url),config=JSON.parse(await readFile(new URL('next.environment.json',root))),context=JSON.parse(await readFile(contextFile));
const target=new URL(context.nextDatabase),endpoint=new URL(config.authUrl).hostname.split('.')[0];
if(config.environment!=='next'||config.database!=='finfolk_next'||target.pathname!=='/finfolk_next'||target.hostname!==endpoint+'.ap-southeast-2.aws.neon.tech')throw Error('Refusing a database outside the FinFolk production environment.');
target.searchParams.set('sslmode','verify-full');
const rows=JSON.parse(await readFile(new URL('config/directory-australia.json',root)));
const keys=new Set();
for(const row of rows){
 if(!row.key||keys.has(row.key)||!/^\d{4}-\d{2}-\d{2}$/.test(row.researchedAt)||!row.document.sources?.length)throw Error('Invalid directory release manifest.');
 keys.add(row.key);
 for(const source of row.document.sources)if(new URL(source).protocol!=='https:')throw Error('HTTPS research sources required.');
}
const db=new pg.Client({connectionString:target.href});await db.connect();
try{
 await db.query('BEGIN');await db.query("SELECT pg_advisory_xact_lock(hashtext('finfolk.directory-australia-release'))");
 const release=(await db.query('SELECT sql_sha FROM finfolk.backbone_release WHERE id=1')).rows[0];
 if(release?.sql_sha!==config.sqlSha)throw Error('Live API/database release does not match the checked-out application.');
 const ids=String(context.nextEnv.INSTAGRAM_ADMIN_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
 const admins=(await db.query('SELECT user_id FROM finfolk.members WHERE user_id=ANY($1) AND NOT deleted ORDER BY user_id',[ids])).rows;
 if(!admins.length)throw Error('An existing configured directory administrator is required.');
 await db.query("SELECT set_config('finfolk.actor_id',$1,true),set_config('finfolk.directory_admin','true',true)",[admins[0].user_id]);
 let inserted=0,skipped=0;
 for(const row of rows){
  const hex=createHash('sha256').update('finfolk/directory/australia/'+row.key).digest('hex').slice(0,32);
  const id=[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
  const existing=await db.query("SELECT id FROM finfolk.directory_listings WHERE id=$1 OR (lower(document->>'name')=lower($2) AND lower(document->>'locality')=lower($3))",[id,row.document.name,row.document.locality]);
  if(existing.rowCount){skipped++;continue;}
  await db.query('SELECT finfolk_rpc.directory_operation($1,$2::jsonb)',['admin-save',JSON.stringify({id,document:row.document,status:'published',notes:'Public-source directory seed; researched '+row.researchedAt+'. No owner assigned; affiliation not verified.',outreach:'Not contacted'})]);
  inserted++;
 }
 await db.query(mode==='publish'?'COMMIT':'ROLLBACK');
 console.log(JSON.stringify({mode,inserted,skipped,total:rows.length,committed:mode==='publish'}));
}catch(error){await db.query('ROLLBACK');throw Error('Directory release failed: '+(error.code||'validation')+'; transaction rolled back.',{cause:undefined});}
finally{await db.end();}
