import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from '@playwright/test';
import {mockOfflineNavigation} from './fixtures/nextjs-offline-navigation.mjs';
const upstream=process.env.NEXTJS_TEST_URL||'http://localhost:3202';assert.ok(['localhost','127.0.0.1'].includes(new URL(upstream).hostname));
const native=await readFile(new URL('../js/finfolk-next/site/web-main/public/sw.js',import.meta.url),'utf8');
const originalHTML=(await readFile(new URL('../js/finfolk-next/site/web-main/src/index.html',import.meta.url),'utf8')).replace('<head>','<head><base href="/">');
let stage='legacy',bad=false;
// Exercise the original worker implementation, with a tiny same-origin shell
// fixture instead of downloading the production illustration/data collection.
const legacy=(await readFile(new URL('../js/finfolk-next/site/web-main/src/sw-template.js',import.meta.url),'utf8')).replace('__VERSION__','fixture').replace('__SHELL__',JSON.stringify(['./bootstrap']));
const server=createServer(async(req,res)=>{try{
 if(req.url==='/sw.js'){res.writeHead(200,{'content-type':'application/javascript','cache-control':'no-store'});return res.end(stage==='legacy'?legacy:native.replace(/"version":"[^"]+"/,`"version":"fixture-${stage}"`));}
 if(req.url==='/bootstrap'){res.writeHead(200,{'content-type':'text/html'});return res.end('<html><body>Offline upgrade fixture</body></html>');}
 if(req.url.startsWith('/original-map?')){res.writeHead(200,{'content-type':'text/html'});return res.end(originalHTML);}
 if(req.url==='/map.js'&&bad){res.writeHead(200,{'content-type':'application/javascript'});return res.end('export const corrupted = true;');}
 const response=await fetch(new URL(req.url,upstream));const headers=Object.fromEntries(response.headers);delete headers['content-encoding'];delete headers['content-length'];res.writeHead(response.status,headers);res.end(Buffer.from(await response.arrayBuffer()));
 }catch(error){res.writeHead(502);res.end(error.message);}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
async function poll(read,accept){for(let i=0;i<200;i++){const value=await read();if(accept(value))return value;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('Timed out waiting for worker lifecycle');}
try{
 const context=await browser.newContext(),page=await context.newPage();
 await context.addInitScript(()=>{localStorage.setItem('finfolk:welcome','1');localStorage.setItem('finfolk:member-tour:3:alice','done');});
 await mockOfflineNavigation(page,base);await page.goto(base+'/original-map?view=maps');
 await page.evaluate(async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.getByText('2 published contours',{exact:true}).waitFor();await settings.getByRole('button',{name:'Save region offline',exact:true}).click();
 await page.waitForFunction(async()=>{const {atlasStore}=await import('/offline-store.js');return(await atlasStore.meta('saved'))?.some(item=>item.id==='example-bay'&&item.complete)});
 await page.evaluate(async()=>{const {atlasStore}=await import('/offline-store.js');await atlasStore.meta('upgrade-fixture',{keep:'saved maps'});});
 stage='broken';bad=true;
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Corrupt worker did not finish installation')),20000);r.addEventListener('updatefound',()=>{const worker=r.installing;worker.addEventListener('statechange',()=>{if(worker.state==='redundant'){clearTimeout(timer);resolve();}});},{once:true});r.update().catch(reject);});});
 assert.ok((await page.evaluate(()=>caches.keys())).includes('finfolk-shell-fixture'));
 assert.ok(!(await page.evaluate(()=>caches.keys())).includes('finfolk-next-shell-fixture-broken'));
 stage='native';bad=false;await page.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert.ok((await page.evaluate(()=>caches.keys())).includes('finfolk-shell-fixture'),'active legacy cache retained while native waits');
 const candidates=await Promise.all(context.serviceWorkers().map(async worker=>({worker,version:await worker.evaluate(()=>typeof manifest==='undefined'?null:manifest.version).catch(()=>null)}))),target=candidates.find(item=>item.version==='fixture-native').worker;
 await page.close();
 await poll(()=>target.evaluate(async()=>({waiting:!!self.registration.waiting,active:self.registration.active?.state,legacy:(await caches.keys()).includes('finfolk-shell-fixture')})),v=>!v.waiting&&v.active==='activated'&&!v.legacy);
 const fresh=await context.newPage();await fresh.goto(base+'/bootstrap');
 assert.deepEqual((await fresh.evaluate(()=>caches.keys())).filter(name=>name.startsWith('finfolk-')),['finfolk-next-shell-fixture-native']);
 assert.deepEqual(await fresh.evaluate(async()=>{const {atlasStore}=await import('/offline-store.js');return atlasStore.meta('upgrade-fixture')}),{keep:'saved maps'});
 // A document outside this build must receive its own runtime from the
 // network, even though the active worker has a cached /map.js from its build.
 bad=true;assert.equal(await fresh.evaluate(async()=>{const module=await import('/map.js');return module.corrupted;}),true);bad=false;
 stage='next-native';await fresh.evaluate(async()=>{await(await navigator.serviceWorker.getRegistration()).update();});
 await fresh.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 assert.ok((await fresh.evaluate(()=>caches.keys())).includes('finfolk-next-shell-fixture-native'));
 const nextCandidates=await Promise.all(context.serviceWorkers().map(async worker=>({worker,version:await worker.evaluate(()=>typeof manifest==='undefined'?null:manifest.version).catch(()=>null)}))),next=nextCandidates.find(item=>item.version==='fixture-next-native').worker;
 await fresh.close();
 await poll(()=>next.evaluate(async()=>({active:self.registration.active?.state,old:(await caches.keys()).includes('finfolk-next-shell-fixture-native')})),v=>v.active==='activated'&&!v.old);
 const final=await context.newPage();await final.goto(base+'/bootstrap');
 assert.deepEqual(await final.evaluate(async()=>{const {atlasStore}=await import('/offline-store.js');return atlasStore.meta('upgrade-fixture')}),{keep:'saved maps'});
 const cdp=await context.newCDPSession(final);await cdp.send('Network.clearBrowserCache');await context.setOffline(true);
 const offline=await context.newPage(),errors=[];offline.on('pageerror',error=>errors.push(error.message));
 const response=await offline.goto(base+'/map?region=example-bay&depth=20');assert.equal(response.headers()['x-finfolk-offline'],'1');
 await offline.locator('#explorer[aria-busy=false]').waitFor();await offline.locator('#place-title').filter({hasText:'Example Bay'}).waitFor({state:'attached'});
 assert.deepEqual(await offline.locator('#measure-depth option').allTextContents(),['10 m','20 m']);assert.equal(await offline.locator('#measure-depth').inputValue(),'20');assert.equal(await offline.evaluate(()=>navigator.onLine),false);
 const canvas=offline.locator('#map'),before=await canvas.evaluate(node=>node.toDataURL());await canvas.focus();await canvas.press('+');await offline.waitForFunction(before=>document.getElementById('map').toDataURL()!==before,before);assert.deepEqual(errors,[]);
 console.log('NEXT_OFFLINE_UPGRADE_PASS: real original map saves a contour package; corrupt installs roll back and both upgrades wait for old tabs; a fresh native document then renders the original saved contours and map controls with all networking disabled and HTTP cache cleared.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
