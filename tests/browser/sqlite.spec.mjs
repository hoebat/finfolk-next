import {test,expect,chromium,firefox,webkit} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
async function init(page,{account='alice',offline=false,environment='test'}={}){
 await page.goto('/__test');
 return page.evaluate(async({account,offline,environment})=>{
  const {createApplicationBackbone}=await import('/next-backbone.js');
  window.app=createApplicationBackbone({authUrl:'https://'+environment+'.invalid',apiUrl:location.origin,cacheBackend:'sqlite'});
  window.calls=0;window.offline=offline;window.version=1;window.mutations=0;
  window.transport=async(name,values,options)=>{window.calls++;if(window.offline)throw new TypeError('Network unavailable');const version=window.version;if(values?.delay)await new Promise(r=>setTimeout(r,150));if(name==='preferences'){window.mutations++;window.version++;return {saved:true};}if(options?.signal?.aborted)throw new DOMException('Aborted','AbortError');return {actor:account,name,version};};
  window.app.setPublicTransport(window.transport);window.member=window.app.member(account,window.transport);
  await window.member.ready;return window.app.storage?.stats();
 },{account,offline,environment});
}
test('SQLite uses actual storage and excludes mutations and administrative responses',async({page})=>{
 const stats=await init(page);expect(['persistent','memory']).toContain(stats.mode);
 await page.evaluate(async()=>{await member.call('me');await member.call('preferences',{profile:{secretFixture:'MUTATION_SECRET'}});await member.call('messagingSettings',{__rest:true,path:'/v1/admin/messaging/instagram'});});
 const state=await page.evaluate(async()=>({value:member.read('me'),stats:await app.storage.stats()}));
 expect(state.value.actor).toBe('alice');expect(state.stats.entries.some(e=>e.id.includes('me:{}'))).toBeTruthy();
 expect(JSON.stringify(state.stats.entries)).not.toContain('MUTATION_SECRET');expect(state.stats.entries.some(e=>e.id.includes('messagingSettings'))).toBeFalsy();
});
test('two tabs deduplicate reads, share subscriptions, and clear together on sign-out',async({page,context,browserName})=>{
 await init(page);test.skip(!await page.evaluate(()=>typeof SharedWorker!=='undefined'),'Dedicated-worker fallback is intentionally per tab.');
 const other=await context.newPage();await init(other);
 await other.evaluate(()=>{window.states=[];window.stop=member.subscribe('me',{},s=>states.push(s));});
 await expect.poll(()=>other.evaluate(()=>states.length)).toBeGreaterThan(1);
 await page.evaluate(()=>member.call('me'));
 await expect.poll(()=>other.evaluate(()=>member.read('me')?.actor)).toBe('alice');
 await page.evaluate(()=>member.call('preferences',{profile:{displayName:'Changed'}}));
 await expect.poll(()=>other.evaluate(()=>states.at(-1)?.data?.version)).toBe(2);
 expect(await other.evaluate(()=>window.calls)).toBe(0);
 await page.evaluate(()=>app.clearMember());
 await expect.poll(()=>other.evaluate(()=>states.at(-1)?.status)).toBe('closed');
 expect(await other.evaluate(()=>member.read('me'))).toBeUndefined();
 expect((await other.evaluate(()=>app.storage.stats())).entries.some(e=>e.id.includes('|alice|'))).toBeFalsy();
});
test('persistent reads survive browser restart; unavailable OPFS reports memory fallback',async({browserName})=>{
 const directory=await mkdtemp(join(tmpdir(),'finfolk-sqlite-')),engine={chromium,firefox,webkit}[browserName];let context;
 try{
  context=await engine.launchPersistentContext(directory,{headless:true,baseURL:'http://127.0.0.1:8137'});let page=context.pages()[0]||await context.newPage();
  const initial=await init(page);await page.evaluate(()=>member.call('me'));await context.close();context=null;
  if(browserName!=='webkit')expect(initial.mode).toBe('persistent');
  context=await engine.launchPersistentContext(directory,{headless:true,baseURL:'http://127.0.0.1:8137'});page=context.pages()[0]||await context.newPage();
  await init(page,{offline:true});
  if(initial.mode==='persistent'){
   expect(await page.evaluate(()=>member.call('me'))).toEqual({actor:'alice',name:'me',version:1});
   await page.evaluate(()=>app.clearMember());
  }else{
   expect(initial.mode).toBe('memory');await expect(page.evaluate(()=>member.call('me'))).rejects.toThrow(/Network unavailable/);
  }
 }finally{await context?.close();await rm(directory,{recursive:true,force:true});}
});
test('account and environment isolation, cancellation, and no offline writes',async({page,context})=>{
 await init(page);await page.evaluate(()=>member.call('me'));
 const other=await context.newPage();await init(other,{account:'bob',offline:true});
 await expect(other.evaluate(()=>member.call('me'))).rejects.toThrow(/Network unavailable/);
 await other.close();const isolated=await context.newPage();await init(isolated,{offline:true,environment:'different'});
 await expect(isolated.evaluate(()=>member.call('me'))).rejects.toThrow(/Network unavailable/);
 await page.evaluate(()=>{window.offline=true;});
 expect((await page.evaluate(()=>member.call('me'))).actor).toBe('alice');
 await expect(page.evaluate(()=>member.call('preferences',{profile:{}}))).rejects.toThrow(/Network unavailable/);
 expect(await page.evaluate(()=>window.mutations)).toBe(0);
 const cancelled=await page.evaluate(async()=>{const c=new AbortController();c.abort();try{await member.call('me',{}, {signal:c.signal});return false;}catch(e){return e.name==='AbortError';}});expect(cancelled).toBeTruthy();
});
test('IndexedDB saved regions survive shared cache clearing and member sign-out',async({page})=>{
 await init(page);await page.evaluate(()=>member.call('me'));
 const result=await page.evaluate(async()=>{
  const {AtlasStore}=await import('/offline-store.js'),{deviceStorage}=await import('/device-storage.js');
  const store=new AtlasStore(),device=deviceStorage(store,async()=>app);
  await store.put({key:'saved-depth',bytes:16,used:1,data:new Uint8Array([1,2,3]).buffer});
  await store.meta('saved',[{id:'bondi',complete:true,keys:['saved-depth']}]);
  await store.put({key:'recent-depth',bytes:10,used:2,data:new Uint8Array([4]).buffer});
  await device.clearRecent();await app.clearMember();
  return {saved:!!await store.get('saved-depth'),recent:!!await store.get('recent-depth'),sql:(await app.storage.stats()).entries.length};
 });
 expect(result).toEqual({saved:true,recent:false,sql:0});
});
test('missing SharedWorker uses SQLite in a dedicated in-memory worker',async({page})=>{
 await page.addInitScript(()=>{window.SharedWorker=undefined;});const stats=await init(page);
 expect(stats.mode).toBe('memory');expect((await page.evaluate(()=>member.call('me'))).actor).toBe('alice');
});
test('closing the host tab elects a new writer and restores another tab',async({page,context})=>{
 const initial=await init(page);test.skip(!await page.evaluate(()=>typeof SharedWorker!=='undefined'),'SharedWorker unsupported');
 await page.evaluate(()=>member.call('me'));
 const other=await context.newPage();await init(other);await other.bringToFront();
 await page.close();
 await expect.poll(async()=>{
  return other.evaluate(async()=>Promise.race([member.call('me').then(v=>v.actor).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),1500))]));
 },{timeout:30000}).toBe('alice');
 expect((await other.evaluate(()=>app.storage.stats())).mode).toBe(initial.mode);
});

test('concurrent tabs deduplicate and invalidation fences stale read responses',async({page,context})=>{
 await init(page);test.skip(!await page.evaluate(()=>typeof SharedWorker!=='undefined'),'SharedWorker unsupported');
 const other=await context.newPage();await init(other);
 const result=await Promise.all([page.evaluate(()=>member.call('stats',{delay:true})),other.evaluate(()=>member.call('stats',{delay:true}))]);
 expect(result[0]).toEqual(result[1]);expect(await page.evaluate(()=>calls)+await other.evaluate(()=>calls)).toBe(1);
 const before=await page.evaluate(()=>calls);
 await page.evaluate(()=>{window.delayed=member.call('stats',{delay:true,beachId:'bondi'});});
 await expect.poll(()=>page.evaluate(()=>calls)).toBe(before+1);
 await page.evaluate(()=>member.call('preferences',{profile:{displayName:'Updated'}}));
 expect((await page.evaluate(()=>window.delayed)).version).toBe(1);
 expect(await page.evaluate(()=>member.read('stats',{delay:true,beachId:'bondi'}))).toBeUndefined();
});
test('a writer restart never replays an uncertain mutation',async({page,context})=>{
 await init(page);test.skip(!await page.evaluate(()=>typeof SharedWorker!=='undefined'),'SharedWorker unsupported');
 const other=await context.newPage();await init(other);await other.bringToFront();
 const observer=await context.newPage();await init(observer);
 await other.evaluate(()=>{
  window.writeAttempts=0;
  member.setTransport(async(name,_values,{signal})=>{if(name!=='preferences')return {actor:'alice',name};window.writeAttempts++;await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));});
  window.write=member.call('preferences',{profile:{displayName:'Changing'}}).catch(e=>{window.writeError={message:e.message,unknown:e.mutationOutcomeUnknown};});
 });
 await expect.poll(()=>other.evaluate(()=>writeAttempts)).toBe(1);await page.close();
 await expect.poll(()=>other.evaluate(()=>window.writeError?.unknown),{timeout:30000}).toBe(true);
 await expect(other.evaluate(()=>member.call('preferences',{profile:{}}))).rejects.toThrow(/Reload before/);
 await expect(observer.evaluate(()=>member.call('preferences',{profile:{}}))).rejects.toThrow(/Reload before/);
 expect(await other.evaluate(()=>writeAttempts)).toBe(1);
 await expect.poll(()=>observer.evaluate(async()=>Promise.race([member.call('me').then(v=>v.actor).catch(()=>null),new Promise(r=>setTimeout(()=>r(null),1500))])),{timeout:20000}).toBe('alice');
});
test('combined storage limit preserves pinned depth files and handles persistence denial',async({page})=>{
 await init(page);await page.evaluate(()=>member.call('me'));
 const result=await page.evaluate(async()=>{
  const {AtlasStore}=await import('/offline-store.js'),{deviceStorage}=await import('/device-storage.js');
  const store=new AtlasStore(),device=deviceStorage(store,async()=>app);
  await store.meta('limit',128);
  await store.put({key:'saved',bytes:512,used:1,data:new Uint8Array([1]).buffer});
  await store.meta('saved',[{id:'saved',keys:['saved']}]);
  // Save a pinned entry directly: the download code pins packages before saving them.
  await store.run('files','readwrite',s=>s.put({key:'saved',bytes:512,used:1,data:new Uint8Array([1]).buffer}));
  await store.put({key:'recent',bytes:80,used:2,data:new Uint8Array([2]).buffer});
  await device.enforce();
  Object.defineProperty(navigator.storage,'persist',{value:async()=>false,configurable:true});
  return {saved:!!await store.get('saved'),recent:!!await store.get('recent'),sql:(await app.storage.stats()).entries.length,keep:await device.keep()};
 });expect(result).toEqual({saved:true,recent:false,sql:1,keep:false});
});
test('disabled worker capability keeps the existing application usable',async({page})=>{
 await page.addInitScript(()=>{window.Worker=class{constructor(){throw Error('Workers blocked');}};window.SharedWorker=class{constructor(){throw Error('Workers blocked');}};});
 await init(page);expect((await page.evaluate(()=>member.call('me'))).actor).toBe('alice');
});
test('reload recovers a committed-write refresh failure while old tabs remain blocked',async({page,context})=>{
 await init(page);await page.evaluate(()=>member.call('me'));
 const other=await context.newPage();await init(other);
 const error=await page.evaluate(async()=>{
  member.setTransport(async name=>{if(name==='me')throw new TypeError('Refresh failed');return {saved:true};});
  try{await member.call('preferences',{profile:{displayName:'Saved'}});}catch(e){return {committed:e.mutationCommitted,saved:e.result.saved};}
 });expect(error).toEqual({committed:true,saved:true});
 await expect(other.evaluate(()=>member.call('preferences',{profile:{}}))).rejects.toThrow(/Reload before/);
 await init(page);expect((await page.evaluate(()=>member.call('preferences',{profile:{displayName:'New'}}))).saved).toBe(true);
 await expect(other.evaluate(()=>member.call('preferences',{profile:{}}))).rejects.toThrow(/Reload before/);
});
