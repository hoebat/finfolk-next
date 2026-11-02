import {execFileSync} from 'node:child_process';
import {readdir,stat,readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {resolve,relative,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {addSocialMetadata} from '../backend/social-metadata.mjs';
const environment=JSON.parse(await readFile('next.environment.json','utf8'));
if(environment.environment!=='next' || environment.database!=='finfolk_next' || environment.authUrl.includes('crimson-queen') || !environment.authUrl.includes('.neonauth.'))throw Error('Refusing non-isolated Next build.');
execFileSync(process.execPath,['scripts/generate_db.mjs','--check'],{stdio:'inherit'});
const sqlSha=createHash('sha256').update(await readFile('resources/finfolkdb/pilot.sql')).digest('hex');
const apiConfig=JSON.parse(await readFile('wrangler.next-api.jsonc','utf8'));
if(sqlSha!==environment.sqlSha || apiConfig.vars.DB_SQL_SHA!==sqlSha)throw Error('Next release hashes do not match the generated SQL.');
execFileSync(process.execPath,['scripts/bundle_backbone.mjs'],{stdio:'inherit'});
const root=resolve('.cache/next-site');
execFileSync(process.env.PYTHON || '.venv/bin/python',['-m','depth_explorer','build-static','--output',root],{stdio:'inherit',env:{...process.env,NEON_AUTH_BASE_URL:environment.authUrl,NEON_API_URL:'https://finfolk.com.au/'}});
await writeFile(resolve(root,'CNAME'),'finfolk.com.au\n');
await writeFile(resolve(root,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: https://finfolk.com.au/sitemap.xml\n');
await writeFile(resolve(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://finfolk.com.au/</loc></url></urlset>');
await writeFile(resolve(root,'_headers'),'/sw.js\n  Cache-Control: no-cache\n/neon-config.json\n  Cache-Control: no-store\n/workers/finfolk.sharedworker.js\n  Cache-Control: no-cache\n');
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
await compress(root);
const config=JSON.parse(await readFile(resolve(root,'neon-config.json'),'utf8'));
if(!config.enabled || config.authUrl!==environment.authUrl || config.apiUrl!=='https://finfolk.com.au/')throw Error('Production binding verification failed.');
config.instagram={...config.instagram,enabled:true};config.backbone=true;config.googleEnabled=true;config.environment='next';config.sqlSha=environment.sqlSha;
config.cacheBackend=process.env.NEXT_CACHE_BACKEND==='memory'?'memory':'sqlite';
await writeFile(resolve(root,'neon-config.json'),JSON.stringify(config));
console.log('FinFolk production built with isolated account access and substrate models.');
