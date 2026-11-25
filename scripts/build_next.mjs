import {execFileSync} from 'node:child_process';
import {readdir,stat,readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {resolve,relative,dirname} from 'node:path';
import {buildExploreContours} from './build_explore_contours.mjs';
import {addSocialMetadata} from '../backend/social-metadata.mjs';
const environment=JSON.parse(await readFile('production.environment.json','utf8'));
if(environment.authProvider!=='supabase'||environment.supabaseUrl!=='https://supabase.finfolk.com.au'||environment.apiOrigin!=='https://api.finfolk.com.au')throw Error('Unexpected production services');
execFileSync(process.execPath,['scripts/generate_db.mjs','--check'],{stdio:'inherit'});
const apiConfig=JSON.parse(await readFile('wrangler.supabase-api.jsonc','utf8'));
if(apiConfig.vars.NATIVE_SCHEMA_SHA!==environment.schemaSha)throw Error('Native API release does not match production configuration');
if(process.env.FINFOLK_BACKBONE_PREPARED!=='1')execFileSync(process.execPath,['scripts/bundle_backbone.mjs'],{stdio:'inherit'});
const root=resolve('.cache/next-site');
execFileSync(process.env.PYTHON || '.venv/bin/python',['-m','depth_explorer','build-static','--output',root],{stdio:'inherit',env:{...process.env,FINFOLK_AUTH_PROVIDER:'supabase',FINFOLK_SUPABASE_URL:environment.supabaseUrl,FINFOLK_API_ORIGIN:environment.apiOrigin}});
const depthManifest=execFileSync(process.execPath,['scripts/environment_inventory.mjs','datasets',root],{encoding:'utf8',maxBuffer:8*1024*1024});
await writeFile(resolve(root,'data/depth-manifest.json'),depthManifest);
await writeFile(resolve(root,'CNAME'),'finfolk.com.au\n');
await writeFile(resolve(root,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://finfolk.com.au/sitemap.xml\n');
await writeFile(resolve(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://finfolk.com.au/</loc></url><url><loc>https://finfolk.com.au/directory</loc></url></urlset>');
await writeFile(resolve(root,'_headers'),'/sw.js\n  Cache-Control: no-cache\n/account-config.json\n  Cache-Control: no-store\n/workers/finfolk.sharedworker.js\n  Cache-Control: no-cache\n');
const index=resolve(root,'index.html');
const app=addSocialMetadata(await readFile(index,'utf8'),'https://finfolk.com.au/app');
await writeFile(resolve(root,'app.html'),app.replace('</head>','<meta name="robots" content="noindex,follow"></head>'));
let html=addSocialMetadata(await readFile(resolve(root,'landing.html'),'utf8'),'https://finfolk.com.au/');
html=html.replace('</head>','<link rel="canonical" href="https://finfolk.com.au/"></head>');
await writeFile(index,html);
await writeFile(resolve(root,'landing.html'),html);
const profiles=resolve(root,'profiles.html');
await writeFile(profiles,addSocialMetadata(await readFile(profiles,'utf8'),'https://finfolk.com.au/profiles?screen=people'));
// Cache the application separately from the public homepage. /app is the
// extensionless static URL, avoiding the host's HTML canonical redirects.
const sw=resolve(root,'sw.js');
await writeFile(sw,(await readFile(sw,'utf8')).replace('SHELL = [','SHELL = ["./app","./profiles",'));
async function compress(directory) {
 for(const entry of await readdir(directory,{withFileTypes:true})) {
  if(entry.name==='__compressed')continue;
  const path=resolve(directory,entry.name);
  if(entry.isDirectory()){await compress(path);continue;}
  if((await stat(path)).size <= 25*1024**2)continue;
  if(!relative(root,path).startsWith('data/'))throw Error('Oversized asset outside data: '+path);
  const packed=gzipSync(await readFile(path),{level:9});
  if(packed.length>25*1024**2)throw Error('Compressed asset still exceeds upload limit: '+path);
  const target=resolve(root,'__compressed',relative(root,path)+'.gz');
  await mkdir(dirname(target),{recursive:true});await writeFile(target,packed);await unlink(path);
 }
}
await buildExploreContours(root);
await compress(root);
const config=JSON.parse(await readFile(resolve(root,'account-config.json'),'utf8'));
if(config.authProvider!=='supabase'||config.supabaseUrl!==environment.supabaseUrl)throw Error('Production account configuration does not match Supabase');
console.log('FinFolk built with native Supabase account access.');
