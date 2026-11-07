import assert from 'node:assert/strict';
import {chromium,expect} from '@playwright/test';
import {mockOfflineNavigation} from './fixtures/nextjs-offline-navigation.mjs';
const base=process.env.NEXTJS_TEST_URL||'http://localhost:3202';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch();
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.stack||e.message));
 await context.addInitScript(()=>localStorage.setItem('finfolk:welcome','1'));
 await mockOfflineNavigation(page,base);
 await page.goto(base+'/map');
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
 const shell=await page.evaluate(async()=>{const names=(await caches.keys()).filter(name=>name.startsWith('finfolk-next-shell-'));return {names,paths:await Promise.all(names.map(async name=>(await(await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)))};});
 assert.equal(shell.names.length,1);assert.ok(shell.paths[0].includes('/offline/map.json'));assert.ok(shell.paths[0].some(path=>path.startsWith('/_next/static/')));
 assert.ok(shell.paths[0].includes('/neon-config.json'));
 assert.ok(shell.paths[0].every(path=>!path.startsWith('/v1/')&&!path.startsWith('/api/')&&!path.startsWith('/data/')&&!path.startsWith('/auth/')));
 const settings=page.getByRole('dialog',{name:'Settings',exact:true});
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('link',{name:'Settings',exact:true}).click();
 await settings.getByText('2 published contours',{exact:true}).waitFor();
 await settings.getByRole('button',{name:'Save region offline',exact:true}).click();
 await expect.poll(()=>page.evaluate(async()=>{const {atlasStore}=await import('/offline-store.js');return !!(await atlasStore.meta('saved'))?.some(item=>item.id==='example-bay'&&item.complete);}),{timeout:20000}).toBe(true);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.clearBrowserCache');
 await context.setOffline(true);
 // New document, no route fixtures and empty HTTP cache: app HTML, chunks,
 // dynamic imports, worker code and datasets must all come from device storage.
 const offline=await context.newPage();offline.setDefaultTimeout(20000);offline.on('pageerror',e=>errors.push(e.stack||e.message));
 const response=await offline.goto(base+'/map?region=example-bay&depth=20');
 assert.equal(response.headers()['x-finfolk-offline'],'1');
 await offline.locator('#explorer[aria-busy=false]').waitFor();
 await offline.locator('#place-title').filter({hasText:'Example Bay'}).waitFor({state:'attached'});
 assert.deepEqual(await offline.locator('#measure-depth option').allTextContents(),['10 m','20 m']);
 assert.equal(await offline.locator('#measure-depth').inputValue(),'20');
 assert.equal(await offline.evaluate(()=>navigator.onLine),false);
 const canvas=offline.locator('#map'),before=await canvas.evaluate(node=>node.toDataURL());
 await canvas.focus();await canvas.press('+');
 await offline.waitForFunction(before=>document.getElementById('map').toDataURL()!==before,before);
 // These documents have never been visited in this context. Their public
 // shells must reopen without persisting API data or a user's rendered page.
 // A client-router link must use document navigation while offline. Its
 // normal bubbling handler stands in for an RSC transition that needs a server.
 await offline.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await offline.evaluate(()=>{const anchor=document.createElement('a');anchor.href='/pages?offline-link=1';anchor.textContent='Open saved pages';anchor.addEventListener('click',event=>{event.preventDefault();sessionStorage.setItem('offline-rsc-attempt','yes');});document.body.append(anchor);});
 await offline.getByRole('link',{name:'Open saved pages',exact:true}).click();
 await offline.waitForURL('**/pages?offline-link=1');await offline.getByRole('heading',{name:'My pages',exact:true}).waitFor();
 assert.equal(await offline.evaluate(()=>sessionStorage.getItem('offline-rsc-attempt')),null);
 for(const [path,title] of [['/pages','My pages'],['/pages/review','Directory superadmin'],['/members','Choose a diver'],['/events/my','My events']]){
  const document=await context.newPage();document.setDefaultTimeout(20000);document.on('pageerror',e=>errors.push(e.stack||e.message));
  const response=await document.goto(base+path+'?offline-check=1');assert.equal(response.headers()['x-finfolk-offline'],'1',path);
  await document.waitForFunction(()=>document.querySelector('select[aria-label="Theme"]')?.disabled===false);
  assert.match(await document.title(),new RegExp(title));assert.equal(new URL(document.url()).search,'?offline-check=1');
  await document.getByLabel('Theme',{exact:true}).selectOption('cobalt');await document.waitForFunction(()=>document.documentElement.dataset.theme==='cobalt');
  await document.close();
 }
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}])for(const theme of ['yellow','cobalt','navy-light','navy'])for(const [path,selector] of [['/?utm_source=offline','#landing-title'],['/discover?section=index&region=example-bay','#discover-page'],['/logbook?session=never-saved','#logbook-page'],...['','/checkin','/instagram','/posts','/privacy','/review','/settings','/sites'].map(path=>['/account'+path+'?site=example-beach','#account-page'])]){
  await page.evaluate(theme=>localStorage.setItem('finfolk-theme',theme),theme);const document=await context.newPage();await document.setViewportSize(viewport);await document.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>true}));document.setDefaultTimeout(20000);document.on('pageerror',e=>errors.push(e.stack||e.message));document.on('console',message=>{if(message.type()==='error'&&/Minified React error|ChunkLoadError|Hydration failed/.test(message.text()))errors.push(message.text());});const response=await document.goto(base+path);
  assert.equal(response.headers()['x-finfolk-offline'],'1',path);assert.equal(await document.evaluate(()=>navigator.onLine),true);await document.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);try{await document.locator(selector).waitFor();}catch(error){console.error({path,errors,body:await document.locator('body').innerText()});throw error;}
  if(path.startsWith('/discover')){await document.getByRole('tab',{name:'All dive sites',exact:true}).waitFor();await document.locator('#index-panel').waitFor();await document.evaluate(()=>window.offlineMap=document.getElementById('map'));await document.getByRole('tab',{name:'Suggested',exact:true}).click();try{await document.locator('#suggested-panel').waitFor();}catch(error){console.error({url:document.url(),errors,body:(await document.locator('body').innerText()).slice(0,1400)});throw error;}assert.equal(new URL(document.url()).searchParams.get('section'),'suggested');await document.goBack();try{await document.locator('#index-panel').waitFor();}catch(error){console.error('AFTER_BACK',{url:document.url(),body:(await document.locator('body').innerText()).slice(0,1500)});throw error;}assert.equal(new URL(document.url()).searchParams.get('section'),'index');assert.equal(await document.evaluate(()=>window.offlineMap===document.getElementById('map')),true);for(const [label,panel]of [['Directory','directory'],['Events','events']]){await document.getByRole('tab',{name:label,exact:true}).click();await document.locator('#'+panel+'-panel').getByRole('alert').filter({hasText:'Please check your connection and try again.'}).waitFor();}}
  else if(path.startsWith('/?')){await document.waitForFunction(()=>document.querySelectorAll('.feature-demo-phone').length===8);await document.getByLabel('Theme',{exact:true}).selectOption(theme);await document.waitForFunction(theme=>document.documentElement.dataset.theme===theme,theme);}
  else await document.getByRole('heading',{name:path.startsWith('/logbook')?'Logbook':'Your FinFolk',exact:true}).waitFor();
  if(path.startsWith('/account/settings')){await document.getByRole('button',{name:'My sessions',exact:true}).click();await document.waitForURL('**/logbook');await document.locator('#logbook-page').waitFor();}
  await document.close();
 }
 const legacy=await context.newPage();legacy.setDefaultTimeout(20000);legacy.on('pageerror',e=>errors.push(e.stack||e.message));await legacy.goto(base+'/app?view=discover&section=index');await legacy.waitForURL('**/discover?*');await legacy.locator('#index-panel').waitFor();await legacy.close();
 const legacyMap=await context.newPage();legacyMap.setDefaultTimeout(20000);legacyMap.on('pageerror',e=>errors.push(e.stack||e.message));await legacyMap.goto(base+'/app?view=maps&region=example-bay&depth=20');await legacyMap.waitForURL('**/map?*');await legacyMap.locator('#explorer[aria-busy=false]').waitFor();await legacyMap.waitForFunction(()=>document.getElementById('measure-depth')?.value==='20');assert.equal(await legacyMap.locator('#measure-depth').inputValue(),'20');await legacyMap.close();
 const resume=await context.newPage();resume.setDefaultTimeout(20000);resume.on('pageerror',e=>errors.push(e.stack||e.message));await resume.goto(base+'/account/settings?site=example-beach');await resume.locator('#account-page').waitFor();await resume.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const reconnected=resume.waitForNavigation({waitUntil:'domcontentloaded'});await context.setOffline(false);const onlineResponse=await reconnected;assert.equal(onlineResponse.status(),200);assert.equal(onlineResponse.headers()['x-finfolk-offline'],undefined);assert.equal(new URL(resume.url()).pathname,'/account/settings');assert.equal(new URL(resume.url()).searchParams.get('site'),'example-beach');await resume.close();
 assert.deepEqual(errors,[]);
 console.log('NEXT_OFFLINE_SHELL_PASS: fresh native document starts with all networking disabled and HTTP cache cleared; real saved contours, query selection, map controls and static/dynamic native documents remain usable offline, including landing demos, discovery, logbook, account routes and compatibility links; dynamic routes checked in all four themes at desktop/mobile sizes; API/auth/datasets excluded from shell storage.');
}finally{await browser.close();}
