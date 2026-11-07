// Auth-aware FinFolk candidate, following Foundation's Neon scaffold pattern.
// CLI secrets are captured privately; no existing .env or serving binding changes.
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,chmod} from 'node:fs/promises';
import {connectCloudDatabase} from './lib/cloud_database.mjs';
const project='odd-voice-85400108',parent='br-sparkling-sun-a7dpot05',name='finfolk-native-cloud',database='finfolk_next';
const directory='.cache/cloud-rebuild';await mkdir(directory,{recursive:true,mode:0o700});
const cli=(args,json=true)=>{
 let output;try{output=execFileSync('neon',[...args,...(json?['--output','json']:[])],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:45000}).trim();}
 catch{throw Error('Candidate provisioning failed during '+args.slice(0,2).join(' '));}
 return json?JSON.parse(output):output;
};
let saved;try{saved=JSON.parse(await readFile(directory+'/provision.json','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const branches=cli(['branches','list','--project-id',project]);
const origin=branches.find(b=>b.id===parent);if(origin?.name!=='finfolk-next')throw Error('Working auth parent is unavailable');
let branch=branches.find(b=>b.name===name);
if(saved&&(!branch||saved.branch!==branch.id||saved.project!==project))throw Error('Recorded candidate is unavailable; refusing a silent replacement');
if(!branch){const response=cli(['branches','create','--project-id',project,'--parent',parent,'--name',name,'--no-secrets']);branch=response.branch||response;}
if(branch.default||branch.parent_id!==parent)throw Error('Refusing candidate with unexpected lineage');
const auth=cli(['neon-auth','status','--project-id',project,'--branch',branch.id]);
if(auth.auth_provider!=='better_auth'||auth.db_name!==database||auth.branch_id!==branch.id||!auth.base_url||!auth.jwks_url)throw Error('Candidate did not inherit managed Better Auth');
const url=cli(['connection-string',branch.id,'--project-id',project,'--database-name',database,'--ssl','verify-full'],false);
const record={project,branch:branch.id,parent,name,database,createdFor:'fresh-native-cloud-rollout'};
const db=await connectCloudDatabase(url);
try{if(!(await db.query("SELECT to_regclass('neon_auth.\"user\"') IS NOT NULL AS ready")).rows[0].ready)throw Error('Managed user table is unavailable');}finally{await db.end();}
for(const [file,value]of [['provision.json',record],['admin.json',{...record,url}],['auth-status.json',auth]]){
 await writeFile(directory+'/'+file,JSON.stringify(value)+'\n',{mode:0o600});await chmod(directory+'/'+file,0o600);
}
console.log(JSON.stringify({branch:branch.id,name,database,managedAuth:true,servingTrafficChanged:false}));
