import {access,cp,mkdtemp,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {delimiter,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createNextAPIFixture} from './fixtures/nextjs-api-server.mjs';
// Run after `netlify build`. No account, credentials or deployed service is used.
// The CLI's macOS server cannot relocate this monorepo's absolute Lambda paths.
const root=resolve('.'),site=join(root,'js/finfolk-next/site/web-main'),candidates=[...process.env.PATH.split(delimiter).map(path=>join(path,'netlify')),join(root,'.cache/netlify-tools/node_modules/.bin/netlify')];
let cli;
for(const path of candidates){try{await access(path);cli=await realpath(path);break;}catch{}}
if(!cli)throw Error('Install netlify-cli or run with `npx --yes --package netlify-cli -c "node tests/test_netlify_lambda_bundle.mjs"`.');
const require=createRequire(cli);
const {BlobsServer}=await import(pathToFileURL(require.resolve('@netlify/blobs/server')));
const {getDeployStore}=await import(pathToFileURL(require.resolve('@netlify/blobs')));
const scratch=await mkdtemp(join(root,'.cache/netlify-lambda-')),bundle=join(scratch,'bundle');
execFileSync('python3',['-c','import pathlib,sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert all(not pathlib.PurePosixPath(p).is_absolute() and ".." not in pathlib.PurePosixPath(p).parts for p in z.namelist()); z.extractall(sys.argv[2])',join(site,'.netlify/functions/___netlify-server-handler.zip'),bundle],{stdio:'inherit'});
await cp(new URL('./fixtures/netlify-lambda-bundle.mjs',import.meta.url),join(bundle,'check.mjs'));
const token='finfolk-local-package-check',siteID='finfolklocal',deployID='0';
const server=new BlobsServer({directory:join(scratch,'blobs'),token});
const api=createNextAPIFixture();
try{
 await new Promise(resolve=>api.listen(0,resolve));
 const {port}=await server.start(),store=getDeployStore({apiURL:`http://localhost:${port}`,siteID,deployID,token,region:'us-east-2'});
 const blobs=join(site,'.netlify/deploy/v1/blobs/deploy');
 for(const key of await readdir(blobs))await store.set(key,await readFile(join(blobs,key)));
 const edgeURL=`http://host.docker.internal:${port}`,env={...process.env,FINFOLK_API_ORIGIN:`http://host.docker.internal:${api.address().port}`,NETLIFY_BLOBS_CONTEXT:Buffer.from(JSON.stringify({deployID,siteID,token,edgeURL,uncachedEdgeURL:edgeURL,primaryRegion:'us-east-2'})).toString('base64')};
 const name='finfolk-lambda-check-'+process.pid;
 const child=spawn('docker',['run','--rm','--name',name,...(process.platform==='linux'?['--add-host','host.docker.internal:host-gateway']:[]),'-e','NODE_ENV=production','-e','FINFOLK_API_ORIGIN','-e','NETLIFY_BLOBS_CONTEXT','-v',bundle+':/var/task:ro','-w','/var/task','node:22-bookworm-slim','node','/var/task/check.mjs'],{stdio:'inherit',env});
 const timer=setTimeout(()=>{try{execFileSync('docker',['stop','--time','3',name],{stdio:'ignore'});}catch{}child.kill('SIGTERM');},120000);
 try{const code=await new Promise((resolve,reject)=>{child.on('exit',resolve);child.on('error',reject);});if(code!==0)throw Error('Packaged Lambda validation failed: '+code);}finally{clearTimeout(timer);}
 await writeFile(join(scratch,'passed.json'),JSON.stringify({passed:true,node:22,unmodifiedBundle:true}));
}finally{await server.stop();await new Promise(resolve=>api.close(resolve));}
