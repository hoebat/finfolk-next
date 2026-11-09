import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {IDBFactory} from 'fake-indexeddb';
import {StaticData} from '../js/finfolk-next/site/web-main/src/data-client.js';
import {DatasetCache} from '../js/finfolk-next/site/web-main/src/dataset-cache.js';
import {AtlasStore} from '../js/finfolk-next/site/web-main/src/offline-store.js';
import {DATASET_RELEASE_BASE} from '../js/finfolk-next/site/web-main/app/(atlas)/atlas/dataset-release.js';
const base=new URL(DATASET_RELEASE_BASE),id=base.pathname.split('/').at(-2);
const root=new URL('../datasets/runtime/releases/'+id+'/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
test('pinned release loads catalog and contours and survives an offline restart',async()=>{
 const factory=new IDBFactory(),store=new AtlasStore(factory),oldNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 let offline=false,requests=0;
 const fetcher=async url=>{
  assert.equal(new URL(url).origin,base.origin);assert(new URL(url).pathname.startsWith(base.pathname));
  requests++;if(offline)throw Error('Offline');
  const path=new URL(url).pathname.slice(base.pathname.length),entry=manifest.files[path];assert(entry,path);
  const bytes=await readFile(new URL('files/'+entry.storage.path,root));
  return new Response(entry.storage.encoding?gunzipSync(bytes):bytes);
 };
 const client=()=>{const data=new StaticData(base,fetcher);data.downloads=new DatasetCache(base,fetcher,store);return data;};
 try{
  const data=client(),catalog=await data.catalog('port-phillip');
  assert.equal(catalog.regions.length,79);assert.equal(catalog.regions.reduce((n,r)=>n+r.rasters.length,0),manifest.rasterCount);
  const contours=await data.contours('port-phillip');assert.equal(contours.features.length,1518);
  await data.downloads.saveRegion('port-phillip');
  assert.equal((await data.downloads.availableSaved())[0].complete,true);
  offline=true;Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
  const restarted=client();assert.deepEqual(await restarted.catalog('port-phillip'),catalog);assert.deepEqual(await restarted.contours('port-phillip'),contours);
  assert(requests>2);
 }finally{
  if(oldNavigator)Object.defineProperty(globalThis,'navigator',oldNavigator);else delete globalThis.navigator;
  (await store.db())?.close();
 }
});
test('valid JSON with the wrong hash is rejected before caching',async()=>{
 const store=new AtlasStore(new IDBFactory());
 const fetcher=async url=>new URL(url).pathname.endsWith('downloads.json')?Response.json({version:1,files:{'data/catalog.json':{hash:manifest.files['data/catalog.json'].hash,bytes:2}},regions:{}}):Response.json({});
 const data=new StaticData(base,fetcher);data.downloads=new DatasetCache(base,fetcher,store);
 try{await assert.rejects(data.catalog(),/Dataset changed during download/);assert.deepEqual(await store.all(),[]);}finally{(await store.db())?.close();}
});
