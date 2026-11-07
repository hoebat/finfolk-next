import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,chmodSync} from 'node:fs';
const project='odd-voice-85400108',name='finfolkdb-test',database='finfolkdb_test';
const cli=(args,json=true)=>{const out=execFileSync('neon',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});return json?JSON.parse(out):out.trim();};
const branches=cli(['branches','list','--project-id',project,'--output','json']);
let branch=branches.find(b=>b.name===name);
if(!branch){cli(['branches','create','--project-id',project,'--name',name,'--parent','br-sparkling-sun-a7dpot05','--schema-only','--no-secrets','--output','json']);branch=cli(['branches','list','--project-id',project,'--output','json']).find(b=>b.name===name);}
if(!branch||branch.default)throw Error('Invalid test branch');
const databases=cli(['databases','list','--project-id',project,'--branch',branch.id,'--output','json']);
if(!databases.some(d=>d.name===database))cli(['databases','create','--project-id',project,'--branch',branch.id,'--name',database,'--owner-name','neondb_owner','--output','json']);
const url=cli(['connection-string',branch.id,'--project-id',project,'--database-name',database,'--ssl','verify-full'],false);
mkdirSync('.cache/neon-test',{recursive:true,mode:0o700});
writeFileSync('.cache/neon-test/config.json',JSON.stringify({project,branch:branch.id,name,database,url}),{mode:0o600});chmodSync('.cache/neon-test/config.json',0o600);
console.log('Configured '+name+' / '+database+' (direct TLS JDBC)');
