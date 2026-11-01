import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
await mkdir('.cache',{recursive:true});
await build({stdin:{contents:"export * from './js/finfolk-next/packages/edge/sqlite.js';export {createBackbone} from './js/finfolk-next/packages/edge/backbone.js';",resolveDir:process.cwd()},outfile:'.cache/sqlite-test.mjs',bundle:true,platform:'node',format:'esm',external:['@sqlite.org/sqlite-wasm']});
const {openStore,initializeStore,adapter,storageStats,rows,removeIds,createBackbone}=await import('../.cache/sqlite-test.mjs');
const store=await openStore('/test',true,{wasmBinary:await readFile('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm')});
try{
 const alice=adapter(store,'next|alice'),bob=adapter(store,'next|bob');
 alice.put('unmounted',{old:true},{domain:'member'});store.memory.clear();alice.invalidate(['member']);assert.equal(alice.get('unmounted'),undefined,'Invalidation includes persisted reads whose models have not mounted');
 alice.put('me:{}',{old:true},{domain:'member'});store.memory.clear();
 let refreshFails=true;
 const committed=createBackbone('alice',async name=>{if(name==='me'&&refreshFails)throw new TypeError('Refresh offline');return {saved:true};},{storage:alice,offlineReads:true});
 await assert.rejects(committed.call('preferences',{}),e=>e.mutationCommitted===true&&e.result.saved===true);
 await assert.rejects(committed.call('preferences',{}),/Reload before/);assert.equal(await committed.recover(),false);refreshFails=false;assert.equal(await committed.recover(),true);assert.equal((await committed.call('preferences',{})).saved,true);committed.close();
 for(const [i,value] of [{text:"O'Hara\n🦈",nested:{list:[true,null,0]}},[1,2],false,null,'text'].entries()){
  alice.put('value'+i,value,{domain:'member'});store.memory.clear();assert.deepEqual(alice.get('value'+i).data,value);assert.equal(bob.get('value'+i),undefined);
 }
 alice.put('admin', {secret:'ADMIN_SECRET'}, {admin:true,domain:'admin'});
 alice.put('mutation', {secret:'MUTATION_SECRET'}, {write:true,domain:'member'});
 assert.ok(!JSON.stringify(rows(store,'SELECT * FROM Result')).includes('SECRET'));
 store.memory.clear();assert.equal(alice.get('admin'),undefined);assert.equal(alice.get('mutation'),undefined);
 let offline=false,mutations=0;
 const b=createBackbone('alice',async(name)=>{if(offline)throw new TypeError('Network failed');if(name==='preferences')mutations++;return {name};},{storage:alice,offlineReads:true});
 assert.deepEqual(await b.call('me'),{name:'me'});offline=true;assert.deepEqual(await b.call('me'),{name:'me'});
 await assert.rejects(b.call('preferences',{}),/Network failed/);assert.equal(mutations,0);
 const unsub=b.subscribe('me',{},()=>{});unsub();
 b.close();assert.equal(alice.get('me:{}'),undefined);assert.equal(storageStats(store).entries.length,0);
 bob.put('example',{v:1},{domain:'member'});removeIds(store,storageStats(store).entries.map(r=>r.id));assert.equal(bob.get('example'),undefined);
 bob.put('old-schema',{v:1},{domain:'member'});store.db.exec('PRAGMA user_version=0');initializeStore(store);store.memory.clear();assert.equal(storageStats(store).entries.length,0);
 store.db.exec('DROP TABLE Result');initializeStore(store);assert.match(store.reason,/rebuilt/);assert.equal(storageStats(store).entries.length,0);
 const raw=store.impl.client.raw;
 store.impl.client.raw={exec(){throw new DOMException('No storage available','QuotaExceededError');}};
 bob.put('quota',{v:2},{domain:'member'});assert.deepEqual(bob.get('quota').data,{v:2});assert.match(store.reason,/could not be saved/);store.impl.client.raw=raw;
 console.log('SQLITE_PASS: actual SQLite/xt.db, JSON round trips, actor isolation, excluded secrets, offline reads, rejected writes and erasure.');
}finally{store.db.close();}
const newer=await openStore('/test',true,{wasmBinary:await readFile('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm')});
newer.db.exec('PRAGMA user_version=99');assert.throws(()=>initializeStore(newer),/newer version/);
