// Read-only inventory. This command never deletes files, users or cloud resources.
import {readFile,writeFile,mkdir,stat,readdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';

const signals=[
 ['sdk',/@legacy\/[a-z-]+/],
 ['configuration',/\bLEGACY_AUTH_[A-Z_]+\b|legacy-account-config\.json|legacy-account-client\.js/],
 ['database',/\blegacy_auth\b/],
 ['build-tool',/migrate_legacy_fixtures\.mjs/],
];
const scopes=['backend','src','src-app','scripts','depth_explorer','js/finfolk-next/site/web-main','tests','test','test-app','ops','.github'];
const exclude=['!**/node_modules/**','!**/public/**','!**/.next/**','!**/.cache/**','!**/__pycache__/**','!**/generated/**','!**/.env*','!**/*.pem','!**/*.key'];
export function fileCategory(file){
 if(file.startsWith('backend/migrations/'))return 'immutable-history';
 if(/^(tests|test|test-app)\//.test(file))return 'tests';
 if(file.startsWith('js/'))return 'frontend';
 if(file.startsWith('backend/'))return 'backend';
 return 'build-and-operations';
}
export async function inventory(root=process.cwd()){
 let names=[];
 const present=[];for(const name of scopes)try{await stat(resolve(root,name));present.push(name);}catch{}
 if(present.length)try{names=execFileSync('rg',['--files','--hidden',...exclude.flatMap(p=>['--glob',p]),...present],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);}catch(error){if(error.status!==1)throw error;}
 for(const name of await readdir(root))if(['Makefile','.env.example','next.environment.json'].includes(name)||/^wrangler.*\.jsonc?$/.test(name))names.push(name);
 const references=[];
 for(const file of names.sort()){
  if(['scripts/native_stack_status.mjs','tests/test_native_stack_status.mjs'].includes(file))continue;
  if(!['Makefile','.env.example'].includes(file)&&!/\.(?:mjs|js|jsx|ts|tsx|clj|py|json|jsonc|yml|yaml|sql)$/.test(file))continue;
  const body=await readFile(resolve(root,file),'utf8');
  const found=signals.filter(([,pattern])=>pattern.test(body)).map(([kind])=>kind);
  if(found.length)references.push({file,category:fileCategory(file),signals:found});
 }
 let dependencies=[];
 try{const pkg=JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));dependencies=['dependencies','devDependencies'].flatMap(scope=>Object.keys(pkg[scope]||{}).filter(name=>name.startsWith('@legacy/')).map(name=>({name,scope})));}catch(error){if(error.code!=='ENOENT')throw error;}
 return {references,dependencies,counts:Object.fromEntries([...new Set(references.map(r=>r.category))].sort().map(category=>[category,references.filter(r=>r.category===category).length]))};
}
export function summarizePublicConfiguration(response,config){
 const service='https://supabase.finfolk.com.au';
 const consistent=!config?.authUrl||config.authUrl===service;
 return {status:response.status,redirected:response.redirected,provider:config?.authProvider||'unknown',
  native:response.ok&&config?.enabled===true&&config.authProvider==='supabase'&&config.supabaseUrl===service&&consistent};
}
export async function publicChecks(){
 const result={};
 for(const [name,url]of [['frontend','https://finfolk.com.au/api/account-config'],['api','https://api.finfolk.com.au/health']]){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'}),body=await response.json();
   result[name]=name==='api'?{status:response.status,native:response.ok&&body.ready===true&&body.databaseProvider==='supabase'}:summarizePublicConfiguration(response,body);
  }catch(error){result[name]={native:false,error:error.name};}
 }
 return result;
}
async function main(){
 const args=process.argv.slice(2);let live=false,output;
 for(let i=0;i<args.length;i++){if(args[i]==='--live')live=true;else if(args[i]==='--output'&&args[i+1])output=args[++i];else throw Error('Use [--live] [--output path]');}
 const repository=await inventory(),hosted=live?await publicChecks():null;
 const report={checkedAt:new Date().toISOString(),readOnly:true,repository,hosted,
  cleanupAuthorizedByThisReport:false,
  note:'This inventory is not migration acceptance. The owner authorized fresh Supabase users; verify hosted native journeys, background retirement and recovery. Cloud project/data deletion remains separate. Archived compatibility fixtures are local-only.'};
 const json=JSON.stringify(report,null,2)+'\n';if(output){await mkdir(dirname(resolve(output)),{recursive:true});await writeFile(output,json);}console.log(json);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
