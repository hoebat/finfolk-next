import assert from 'node:assert/strict';
import test from 'node:test';
import {createBackbone} from '../js/finfolk-next/site/web-main/src/next-backbone.js';
import {operations} from '../js/finfolk-next/packages/edge/operations.js';
import {loadPublicPage,publicSeed} from '../js/finfolk-next/site/web-main/lib/public-page.js';

test('public SSR hydration shares canonical input identity, publishes and persists without transport',()=>{
 let requests=0;const rows=new Map(),states=[];
 const app=createBackbone('public',()=>{requests++;},{storage:{get:key=>rows.get(key),put:(key,data)=>rows.set(key,{data}),remove:key=>rows.delete(key),clear:()=>rows.clear()}});
 const stop=app.subscribe('publicDirectory',{state:'VIC',category:'Group'},state=>states.push(state));
 const data={listings:[{id:'group'}]};
 assert.equal(app.hydrate('publicDirectory',{category:'Group',state:'VIC'},data,100).applied,true);
 assert.deepEqual(app.read('publicDirectory',{state:'VIC',category:'Group'}),data);
 assert.equal(states.at(-1).origin,'ssr');assert.equal(requests,0);
 stop();app.close();
});

test('newer SSR wins over older SSR and saved cache; live reads, invalidation and eviction win over SSR',async()=>{
 const app=createBackbone('public',async()=>({network:true}));
 app.hydrate('publicDirectory',{}, {version:1},100);
 assert.equal(app.hydrate('publicDirectory',{}, {version:0},99).applied,false);
 assert.equal(app.hydrate('publicDirectory',{}, {version:2},101).applied,true);
 await app.call('publicDirectory',{});
 assert.equal(app.hydrate('publicDirectory',{}, {version:3},102).applied,false);
 assert.deepEqual(app.read('publicDirectory',{}),{network:true});
 app.clearCache();assert.equal(app.hydrate('publicDirectory',{}, {version:4},103).applied,false);app.close();
 const rows=new Map([['publicDirectory:{}',{data:{old:true}}]]);
 const saved=createBackbone('public',()=>assert.fail('No fetch during seed'),{storage:{get:key=>rows.get(key),put:(key,data)=>rows.set(key,{data}),remove:key=>rows.delete(key),clear:()=>rows.clear()}});
 assert.equal(saved.hydrate('publicDirectory',{}, {fresh:true},100).applied,true);assert.deepEqual(saved.read('publicDirectory',{}),{fresh:true});
 await saved.invalidate(['directoryPublic']);assert.equal(saved.hydrate('publicDirectory',{}, {old:true},101).applied,false);saved.close();
});

test('in-flight reads cannot be overwritten by a server seed',async()=>{
 let release;const app=createBackbone('public',()=>new Promise(resolve=>{release=resolve;}));
 const request=app.call('publicDirectory',{});await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(app.hydrate('publicDirectory',{}, {old:true},100).applied,false);
 release({fresh:true});await request;assert.deepEqual(app.read('publicDirectory',{}),{fresh:true});app.close();
});

test('hydration rejects every private, write, admin and uncached operation, member scope and malformed payload',()=>{
 const app=createBackbone('public',()=>assert.fail('Hydration must not call transport'));
 for(const spec of Object.values(operations))if(spec.auth||spec.write||spec.admin||spec.cache===false)assert.throws(()=>app.hydrate(spec.name,{}, {secret:true},100),/Only cacheable public reads/);
 for(const [data,stamp]of [[null,100],['invalid',100],[{},NaN],[{},0]])assert.throws(()=>app.hydrate('publicDirectory',{},data,stamp),/Invalid public hydration payload/);
 const member=createBackbone('alice',()=>{});assert.throws(()=>member.hydrate('publicDirectory',{}, {},100),/Only cacheable public reads/);member.close();app.close();assert.throws(()=>app.hydrate('publicDirectory',{}, {},100),/closed/);
});

test('only matching public loader results have server hydration provenance',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({listings:[]})});
 try{
 const {listings:directory}=await loadPublicPage('directory',{query:{state:'VIC'}});
 assert.ok(directory,'The public read must resolve its declared result');
 assert.equal(publicSeed('publicDirectory',{state:'VIC'},directory).name,'publicDirectory');
 assert.throws(()=>publicSeed('publicDirectory',{},directory),/matching public loader/);
 assert.throws(()=>publicSeed('publicDirectory',{state:'VIC'},{...directory}),/matching public loader/);
 assert.throws(()=>publicSeed('me',{},directory),/matching public loader/);
 }finally{globalThis.fetch=old;}
});

test('rolling worker upgrades fall back only for unsupported hydration messages',async()=>{
 const {createScope,receive}=await import('../js/finfolk-next/packages/edge/worker-bridge.js');
 const sent=[];let failure='Unknown worker operation.';
 const ctx={ready:Promise.resolve(),scopes:new Map(),pending:new Map(),sequence:0,port:{postMessage(message){sent.push(message.type);queueMicrotask(()=>receive(ctx,{type:'result',id:message.id,...(message.type==='hydrate'?{error:{message:failure}}:{result:message.type==='attach'?'fixture|public':message.type==='call'?{legacy:true}:true})}));}}};
 const scope=createScope(ctx,'public',()=>assert.fail('The bridge must preserve worker call ownership'));await scope.ready;
 assert.deepEqual(await scope.hydrate('publicDirectory',{}, {seed:true},100),{applied:false,legacy:true,data:{legacy:true}});
 assert.equal(sent.filter(type=>type==='call').length,1);
 failure='Storage unavailable';await assert.rejects(()=>scope.hydrate('publicDirectory',{}, {seed:true},101),/Storage unavailable/);
 assert.equal(sent.filter(type=>type==='call').length,1,'A storage error must not trigger an extra read');
 await assert.rejects(()=>scope.hydrate('me',{}, {private:true},101),/Only cacheable public reads/);
 assert.equal(sent.filter(type=>type==='hydrate').length,2,'Private payloads must not reach the worker');
});
