import assert from 'node:assert/strict';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {pageRoutes} from '../js/finfolk-next/site/web-main/lib/page-routes.generated.js';
const defaultRoot=fileURLToPath(new URL('../js/finfolk-next/site/web-main/app/',import.meta.url));
const normalize=path=>path.replace(/\[[^/]+\]/g,':param').replace(/:[^/?]+/g,':param');
export async function verifyPageRoutes(root=defaultRoot,manifest=pageRoutes){
 const actual={};
 async function walk(directory,parts=[]){
  for(const entry of await readdir(directory,{withFileTypes:true})){
   if(entry.isDirectory()){await walk(directory+'/'+entry.name,[...parts,entry.name]);continue;}
   if(!/^(page|route)\.[jt]sx?$/.test(entry.name))continue;
   const path='/'+parts.filter(part=>!/^\(.*\)$/.test(part)).join('/');
   assert.ok(!actual[path],'Duplicate Next route: '+path);
   actual[path]={source:[...parts,entry.name].join('/'),type:entry.name.startsWith('page.')?'page':'handler'};
  }
 }
 await walk(root);
 assert.deepEqual(Object.keys(actual).sort(),Object.keys(manifest.routes).sort(),'Next route inventory differs from generated page coverage; run make generate');
 const offline=new Set([...Object.keys(manifest.offlineTemplates),...manifest.offlineStaticRoutes,...Object.keys(manifest.offlineDynamicTemplates)].map(normalize));
 for(const [path,entry]of Object.entries(manifest.routes)){
  assert.equal(entry.source,actual[path].source,'Stale route source: '+path);
  assert.equal(entry.type,actual[path].type,'Stale route type: '+path);
  assert.ok(['screen','compatibility','resource','internal'].includes(entry.kind),'Unclassified route: '+path);
  if(entry.kind==='screen'){assert.equal(entry.type,'page');assert.ok(offline.has(normalize(path)),'Page has no offline policy: '+path);}
  if(entry.kind==='compatibility')assert.ok(entry.adapters?.length,'Compatibility route has no adapter: '+path);
  if(['resource','internal'].includes(entry.kind))assert.ok(entry.reason,'Infrastructure route needs a reason: '+path);
 }
 const registered=new Set(Object.keys(actual).map(normalize));
 for(const path of offline)assert.ok(registered.has(path),'Offline policy has no source: '+path);
 for(const rule of manifest.legacyRedirects)assert.ok(registered.has(normalize(rule.destination.split('?')[0])),'Alias destination has no source: '+rule.destination);
 return Object.keys(actual).length;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('PAGE_ROUTES_PASS:',await verifyPageRoutes(),'Next routes have explicit generated page, offline and compatibility coverage.');
