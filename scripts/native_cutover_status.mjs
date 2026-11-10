// Read-only inventory. A failing exit status means production is NOT ready to switch.
import {readFile,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {nativeReleaseContract,inspectNativeRelations} from './lib/native_cutover.mjs';
import {neon} from '@neondatabase/serverless';

const args=process.argv.slice(2);
if(args.some(arg=>arg!=='--candidate'))throw Error('Use native_cutover_status.mjs [--candidate]');
const contract=await nativeReleaseContract();
const dependencies=[];
for(const file of (await readdir('backend')).filter(name=>name.endsWith('.mjs')).sort()){
  const source=await readFile('backend/'+file,'utf8');
  const pattern=/\b(?:FROM|JOIN|UPDATE|INTO|TABLE)\s+(finfolk(?:_shop)?)\.([a-z][a-z_0-9]*)\b/gi;
  for(const match of source.matchAll(pattern)){
    if(match[2]!==match[2].toLowerCase())continue;
    dependencies.push({file:'backend/'+file,line:source.slice(0,match.index).split('\n').length,table:match[1]+'.'+match[2]});
  }
}
let candidate=null;
if(args.includes('--candidate')){
  const target=JSON.parse(await readFile('.cache/cloud-rebuild/admin.json','utf8'));
  const serving=JSON.parse(await readFile('next.environment.json','utf8'));
  const url=new URL(target.url);
  if(target.project!==serving.projectId||target.branch===serving.branchId||target.database!==decodeURIComponent(url.pathname.slice(1)))
    throw Error('Candidate identity is not an isolated FinFolk target');
  const metadata=JSON.parse(execFileSync('neon',['api',`/projects/${target.project}/endpoints`,'--output','json'],
    {encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000}));
  if(!(metadata.endpoints||metadata).some(e=>e.branch_id===target.branch&&e.host===url.hostname))
    throw Error('Candidate endpoint does not belong to the recorded branch');
  const sql=neon(target.url);
  const db={query:async(text,values=[])=>({rows:await sql.query(text,values)})};
  try{
    const name=(await db.query('SELECT current_database() AS name')).rows[0].name;
    if(name!==target.database)throw Error('Candidate database identity mismatch');
    candidate={branch:target.branch,...await inspectNativeRelations(db.query.bind(db),contract)};
  }catch(error){
    if(/HTTP status 402|exceeded the quota/.test(String(error.message||'')))
      throw Error('Neon candidate quota exceeded (HTTP 402); no database writes were attempted.');
    throw Error('Candidate inspection failed; no database writes were attempted.');
  }
}
const ready=dependencies.length===0&&candidate?.ready===true;
console.log(JSON.stringify({ready,contract,legacyReferences:dependencies,candidate,
  note:'Relation/source checks are necessary, not sufficient: RPC, grants, data, auth and browser acceptance must also pass.'},null,2));
if(!ready)process.exitCode=1;
