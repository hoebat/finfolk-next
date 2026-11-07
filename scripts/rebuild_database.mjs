import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import pg from 'pg';
import {prepareReferenceRelease,verifyManifest,verifyReferenceDatabase,installFreshDatabase,importReferenceRelease} from './lib/rebuild_reference.mjs';
const [mode,path='.cache/rebuild/manifest.json']=process.argv.slice(2),root=process.cwd();
if(!['prepare','verify','install','import','inspect'].includes(mode))throw Error('Use prepare|verify|install|import|inspect [manifest.json].');
if(mode==='prepare'){
 const assetUris=process.env.FINFOLK_ASSET_URI_FILE?JSON.parse(await readFile(process.env.FINFOLK_ASSET_URI_FILE,'utf8')):{};
 const manifest=await prepareReferenceRelease({root,assetUris});await mkdir(dirname(resolve(path)),{recursive:true});await writeFile(path,JSON.stringify(manifest)+'\n');
 console.log(JSON.stringify({id:manifest.id,counts:manifest.counts,warnings:manifest.warnings.length,unavailable_sources:manifest.unavailable_sources.map(s=>s.id),manifest:path}));
}else{
 const manifest=JSON.parse(await readFile(path,'utf8'));await verifyManifest(root,manifest);
 if(mode==='verify')console.log('Verified release '+manifest.id);
 else{
  const connectionString=process.env.FINFOLK_REBUILD_DATABASE_URL;if(!connectionString)throw Error('Set FINFOLK_REBUILD_DATABASE_URL to the explicit candidate database.');
  const target=new URL(connectionString),expected=process.env.FINFOLK_REBUILD_EXPECTED_DATABASE;
  if(!expected||decodeURIComponent(target.pathname.slice(1))!==expected)throw Error('FINFOLK_REBUILD_EXPECTED_DATABASE must match the candidate database name.');
  if(!['localhost','127.0.0.1'].includes(target.hostname)&&manifest.rows.DataAsset.some(a=>!a.uri.startsWith('https://')))throw Error('Remote candidate requires durable HTTPS asset URIs for every asset.');
  const db=new pg.Client({connectionString});await db.connect();
  try{if(mode==='install'){await installFreshDatabase(db,{root,manifest});console.log('Fresh native schema installed. Run import with the same manifest.');}
   else if(mode==='inspect')console.log(JSON.stringify(await verifyReferenceDatabase(db,manifest)));
   else console.log(JSON.stringify(await importReferenceRelease(db,manifest,{root})));
  }finally{await db.end();}
 }
}
