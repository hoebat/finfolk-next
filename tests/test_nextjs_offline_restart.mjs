import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {mockOfflineNavigation} from './fixtures/nextjs-offline-navigation.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const profile=await mkdtemp('.cache/offline-restart-');let context;
try{
 context=await chromium.launchPersistentContext(profile,{headless:true});
 await context.addInitScript(()=>localStorage.setItem('finfolk:welcome','1'));
 const page=await context.newPage();page.setDefaultTimeout(20000);
 await mockOfflineNavigation(page,base);const config=JSON.parse(await readFile('js/finfolk-next/site/web-main/public/neon-config.json','utf8'));await page.route('**/neon-config.json*',route=>route.fulfill({json:config}));await page.goto(base+'/map');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();
 const settings=page.getByRole('dialog',{name:'Settings',exact:true});await settings.getByText('2 published contours',{exact:true}).waitFor();
 await settings.getByRole('button',{name:'Save region offline',exact:true}).click();
 await page.waitForFunction(async()=>{const {atlasStore}=await import('/offline-store.js');return(await atlasStore.meta('saved'))?.some(item=>item.id==='example-bay'&&item.complete)});
 const seeded=await page.evaluate(async config=>{const {applicationBackbone}=await import('/app-backbone.js'),app=await applicationBackbone(config);await app.ready;app.setPublicTransport(async name=>{if(name==='siteDetail')return {id:'offline-restart-fixture',name:'Saved public location'};throw new TypeError('Fixture transport unavailable');});const value=await app.public.call('siteDetail',{id:'offline-restart-fixture'});return {value,health:await app.storage.health(),stats:await app.storage.stats()};},config);
 assert.equal(seeded.value.name,'Saved public location');assert.equal(seeded.health.kernel,true);assert.equal(seeded.stats.mode,'persistent');assert.ok(seeded.stats.entries.length>0);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.clearBrowserCache');
 // Closing a persistent context terminates its browser. Only on-disk browser
 // storage survives; pages, module instances and workers cannot be reused.
 await context.close();context=null;
 context=await chromium.launchPersistentContext(profile,{headless:true,offline:true});
 const offline=await context.newPage(),errors=[];offline.setDefaultTimeout(30000);
 offline.on('pageerror',error=>errors.push(error.message));
 offline.on('console',message=>{if(message.type()==='error'&&/Minified React error|ChunkLoadError|Hydration failed/.test(message.text()))errors.push(message.text());});
 const response=await offline.goto(base+'/map?region=example-bay&depth=20');
 assert.equal(response.headers()['x-finfolk-offline'],'1');
 await offline.waitForFunction(()=>document.getElementById('measure-depth')?.value==='20');
 assert.deepEqual(await offline.locator('#measure-depth option').allTextContents(),['10 m','20 m']);
 const restored=await offline.evaluate(async()=>{const {applicationBackbone}=await import('/app-backbone.js'),app=await applicationBackbone();await app.ready;let timer;try{return await Promise.race([Promise.all([app.storage.health(),app.storage.stats(),app.public.call('siteDetail',{id:'offline-restart-fixture'})]),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Cold SQLite worker could not restore its public cache.')),15000);})]);}finally{clearTimeout(timer);}});
 assert.equal(restored[0].kernel,true);assert.equal(restored[1].mode,'persistent');assert.equal(restored[2].name,'Saved public location');
 const saved=await offline.evaluate(async()=>{const {atlasStore}=await import('/offline-store.js');return atlasStore.meta('saved');});
 assert.ok(saved.some(item=>item.id==='example-bay'&&item.complete));
 const canvas=offline.locator('#map'),before=await canvas.evaluate(node=>node.toDataURL());await canvas.focus();await canvas.press('+');
 await offline.waitForFunction(before=>document.getElementById('map').toDataURL()!==before,before);
 await offline.goto(base+'/discover?section=index');await offline.getByRole('tab',{name:'All dive sites',exact:true}).waitFor();await offline.locator('#index-panel').waitFor();
 assert.deepEqual(errors,[]);
 console.log('NEXT_OFFLINE_RESTART_PASS: browser terminates after saving contours and clearing HTTP cache; a separate browser process restores the profile entirely offline, selected contour, canvas controls, saved metadata, persistent Clojure/SQLite public model cache and discovery.');
}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
