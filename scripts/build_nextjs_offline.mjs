import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {verifyPageRoutes} from './verify_page_routes.mjs';
import {createHash} from 'node:crypto';
import {offlineTemplates,offlineStaticRoutes,offlineDynamicTemplates,offlineDocumentPath} from '../js/finfolk-next/site/web-main/lib/offline-documents.js';
import {legacyRedirects,legacyDestination,homeDestination,profileDestination} from '../js/finfolk-next/site/web-main/lib/legacy-redirects.js';
const site=new URL('../js/finfolk-next/site/web-main/',import.meta.url),publicRoot=new URL('public/',site);
const digest=body=>createHash('sha256').update(body).digest('hex');
await verifyPageRoutes();
const assets=[];
async function collect(directory,prefix,accept){for(const entry of await readdir(directory,{withFileTypes:true})){const path=prefix+entry.name;if(entry.isDirectory())await collect(new URL(entry.name+'/',directory),path+'/',accept);else if(accept(path)){const body=await readFile(new URL(entry.name,directory));assets.push({path:path.split('/').map(encodeURIComponent).join('/'),hash:digest(body)});}}}
// Cache only build-authored code, styles, fonts and branding. Dataset downloads
// remain owned by AtlasStore; API responses, RSC requests and auth never enter here.
await collect(new URL('.next/static/',site),'/_next/static/',()=>true);
await collect(publicRoot,'/',path=>!path.startsWith('/offline/')&&path!=='/sw.js'&&(path==='/vendor/proj4.js'||/^\/[^/]+\.(?:js|css|svg|woff2?)$/.test(path)||/^\/workers\/[^/]+\.(?:js|wasm)$/.test(path)||/^\/(?:demo|scene|animal|habitat|freediver)-[^.]+\.webp$/.test(path)));
// This is a build-authored public binding (also shipped in the legacy shell),
// never a session/token response. Accounts still verify their session normally.
const config=await readFile(new URL('neon-config.json',publicRoot));
assets.push({path:'/neon-config.json',hash:digest(config)});
const buildId=(await readFile(new URL('.next/BUILD_ID',site),'utf8')).trim();
const prerender=JSON.parse(await readFile(new URL('.next/prerender-manifest.json',site),'utf8'));
const documents={},documentPatterns={};
await mkdir(new URL('offline/',publicRoot),{recursive:true});
// Netlify adds hosting comments to HTML responses. A JSON envelope preserves
// the exact public build document without weakening the worker's integrity check.
await rm(new URL('offline/map.html',publicRoot),{force:true});
async function saveDocument(route,source,path){
 const entry=prerender.routes[source];
 if(!entry||entry.routeType!=='page'||entry.initialStatus&&entry.initialStatus!==200||entry.initialRevalidateSeconds!==false)throw Error('Offline document must be permanently prerendered: '+source);
 const html=await readFile(new URL('.next/server/app/'+(source==='/'?'index':source.slice(1))+'.html',site),'utf8');
 const document=JSON.stringify({buildId,html});
 await mkdir(new URL(path.slice(1,path.lastIndexOf('/')+1),publicRoot),{recursive:true});
 await writeFile(new URL(path.slice(1),publicRoot),document);
 documents[route]=path;if(!assets.some(asset=>asset.path===path))assets.push({path,hash:digest(document)});
}
for(const route of offlineStaticRoutes)await saveDocument(route,route,'/offline/'+route.slice(1)+'.json');
for(const [route,screen] of Object.entries(offlineTemplates))await saveDocument(route,'/offline-app/'+screen,'/offline/templates/'+screen+'.json');
for(const [route,screen] of Object.entries(offlineDynamicTemplates)){await saveDocument(route,'/offline-app/'+screen,'/offline/templates/'+screen+'.json');documentPatterns[route]=documents[route];delete documents[route];}
assets.sort((a,b)=>a.path.localeCompare(b.path));
const configFile=JSON.parse(await readFile(new URL('.next/required-server-files.json',site),'utf8')),deploymentId=configFile.config.deploymentId||null;
const compatibility=`const legacyRedirects=${JSON.stringify(legacyRedirects)},legacyDestination=${legacyDestination.toString()},homeDestination=${homeDestination.toString()},profileDestination=${profileDestination.toString()},offlineDocumentPath=${offlineDocumentPath.toString()};`;
const template=await readFile(new URL('nextjs_sw_template.js',import.meta.url),'utf8'),version=digest(template+compatibility+buildId+deploymentId+JSON.stringify(documents)+JSON.stringify(documentPatterns)+JSON.stringify(assets)).slice(0,24);
await writeFile(new URL('sw.js',publicRoot),template.replace('__MANIFEST__',JSON.stringify({version,buildId,deploymentId,documents,documentPatterns,assets})).replace('__COMPATIBILITY__',()=>compatibility));
console.log(`Native offline shell ${version}: ${assets.length} verified assets.`);
