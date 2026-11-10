import assert from 'node:assert/strict';
import {offlineTemplates,offlineDynamicTemplates} from '../js/finfolk-next/site/web-main/lib/offline-documents.js';
import {readFile,readdir,stat} from 'node:fs/promises';import {createHash} from 'node:crypto';
const site=new URL('../js/finfolk-next/site/web-main/',import.meta.url),output=new URL('.netlify/',site),staticRoot=new URL('static/',output);
const json=async path=>JSON.parse(await readFile(new URL(path,site),'utf8'));
const routes=await json('.next/routes-manifest.json');assert.equal(routes.rewrites.fallback.length,0,'Netlify must use CDN compressed-file rules instead of unsupported public-file rewrites');assert.ok(!routes.rewrites.beforeFiles.some(rule=>rule.destination.startsWith('/legacy/')));
assert.ok((await readFile(new URL('.next/server/app/app.body',site),'utf8')).includes('<base href="/">'),'staged /app must be prerendered independently of unsupported rewrites');
const worker=await readFile(new URL('sw.js',staticRoot),'utf8'),manifest=JSON.parse(worker.match(/^const manifest=(.*),CACHE=/m)[1]);
assert.equal(manifest.buildId,(await readFile(new URL('.next/BUILD_ID',site),'utf8')).trim(),'Offline assets must come from this Next build');
assert.ok(manifest.assets.some(asset=>asset.path==='/vendor/proj4.js'),'Numeric raster projection library must be available after an offline reload');
for(const asset of manifest.assets){const body=await readFile(new URL(asset.path.slice(1),staticRoot));assert.equal(createHash('sha256').update(body).digest('hex'),asset.hash,'Netlify published a mismatched offline asset: '+asset.path);}
const required=await json('.next/required-server-files.json');assert.equal(manifest.deploymentId,required.config.deploymentId||null);
for(const route of Object.keys(offlineTemplates))assert.ok(manifest.documents[route],'Missing public offline template: '+route);
assert.ok(manifest.documents['/map']);assert.ok(manifest.documents['/pages']);
for(const route of Object.keys(offlineDynamicTemplates))assert.ok(manifest.documentPatterns[route]);
for(const [route,path] of Object.entries({...manifest.documents,...manifest.documentPatterns})){const templates={...offlineTemplates,...offlineDynamicTemplates};const source=templates[route]?'/offline-app/'+templates[route]:route,document=JSON.parse(await readFile(new URL(path.slice(1),staticRoot),'utf8'));assert.equal(document.buildId,manifest.buildId);assert.equal(document.html,await readFile(new URL('.next/server/app/'+(source==='/'?'index':source.slice(1))+'.html',site),'utf8'));}
const offline=JSON.parse(await readFile(new URL('offline/map.json',staticRoot),'utf8'));assert.equal(offline.buildId,manifest.buildId);assert.equal(offline.html,await readFile(new URL('.next/server/app/map.html',site),'utf8'));
if(manifest.deploymentId){const skew=await json('.netlify/deploy-config/deploy-config.json');assert.ok(skew.skew_protection.sources.some(source=>source.type==='query'&&source.name==='dpl'));assert.ok(offline.html.includes('?dpl='+manifest.deploymentId));}
const functions=await json('.netlify/functions/manifest.json'),location=functions.functions.find(fn=>fn.name==='location'),ssr=functions.functions.find(fn=>fn.name==='___netlify-server-handler');assert.ok(location,'custom location function must be bundled alongside SSR');assert.ok(location.routes.some(route=>route.literal==='/api/location'&&route.methods.includes('GET')));assert.ok(location.priority>ssr.priority,'Platform location must take precedence over the Next fallback');await stat(new URL('functions/location.zip',output));assert.ok((await readdir(new URL('functions-internal/',output))).includes('___netlify-server-handler'));
const redirects=await readFile(new URL('_redirects',staticRoot),'utf8'),headers=await readFile(new URL('_headers',staticRoot),'utf8');assert.ok(!redirects.includes('/* /index.html'));
let packed=[];try{packed=(await readdir(new URL('__compressed/',staticRoot),{recursive:true})).filter(path=>path.endsWith('.gz'));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const path of packed){assert.ok(redirects.includes('/'+path.slice(0,-3)+' /__compressed/'+path+' 200'));assert.ok(headers.includes('/__compressed/'+path+'\n  Content-Encoding: gzip'));assert.ok(headers.includes('/'+path.slice(0,-3)+'\n  Content-Encoding: gzip'),'Encoded-data headers must match the incoming URL before its CDN rewrite');
 assert.ok((await stat(new URL('__compressed/'+path,staticRoot))).size<=25*1024**2);}
console.log(`NETLIFY_OUTPUT_PASS: real SSR/custom-function bundles, prerendered legacy entry, ${packed.length} CDN atlas rewrites, and ${manifest.assets.length} exact offline assets${manifest.deploymentId?' with deployment-tagged chunks':''}.`);
