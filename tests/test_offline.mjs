import assert from 'node:assert/strict';
import { indexedDB } from 'fake-indexeddb';
import { AtlasStore } from '../js/finfolk-next/site/web-main/src/offline-store.js';
import { DatasetCache } from '../js/finfolk-next/site/web-main/src/dataset-cache.js';
import { createHash } from 'node:crypto';
const bytes = new TextEncoder().encode('{"regions":[1]}').buffer,
  hash = createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const manifest = {
  version: 1,
  revision: 'one',
  files: { 'data/a.json': { hash, bytes: bytes.byteLength, label: 'A' } },
  regions: {
    a: { name: 'A', files: ['data/a.json'], bytes: bytes.byteLength },
  },
};
const store = new AtlasStore(indexedDB);
let calls = 0,
  offline = false;
const fetcher = async (url) => {
  calls++;
  if (offline) throw Error('Offline');
  return String(url).endsWith('downloads.json')
    ? Response.json(manifest)
    : new Response(bytes);
};
const cache = new DatasetCache('https://example.test/atlas/', fetcher, store);
assert.deepEqual(await cache.read('data/a.json', { read: 'json' }), {
  regions: [1],
});
const before = calls;
assert.deepEqual(await cache.read('data/a.json', { read: 'json' }), {
  regions: [1],
});
assert.equal(calls, before);
await cache.saveRegion('a');
assert.equal((await store.meta('saved'))[0].complete, true);
offline = true;
const restarted = new DatasetCache(
  'https://example.test/atlas/',
  fetcher,
  store,
);
assert.deepEqual(await restarted.read('data/a.json', { read: 'json' }), {
  regions: [1],
});
offline = false;
const nextBytes = new TextEncoder().encode('{"regions":[2]}').buffer,
  nextHash = createHash('sha256')
    .update(new Uint8Array(nextBytes))
    .digest('hex');
const nextManifest = {
  ...manifest,
  revision: 'two',
  files: { 'data/a.json': { hash: nextHash, bytes: nextBytes.byteLength } },
  regions: manifest.regions,
};
const update = new DatasetCache(
  'https://example.test/atlas/',
  async (url) =>
    String(url).endsWith('downloads.json')
      ? Response.json(nextManifest)
      : new Response('Unavailable', { status: 503 }),
  store,
);
await update.manifest();
await new Promise((r) => setTimeout(r, 20));
await assert.rejects(update.saveRegion('a'), /503/);
const retained = (await store.meta('saved'))[0];
assert.equal(retained.complete, true);
assert.equal(retained.version, 'one');
assert.deepEqual(await update.read('data/a.json', { read: 'json' }), {
  regions: [1],
});
const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
Object.defineProperty(globalThis, 'navigator', {
  value: { onLine: false },
  configurable: true,
});
try {
  const cold = new DatasetCache(
    'https://example.test/atlas/',
    async () => {
      throw Error('Offline');
    },
    store,
  );
  assert.deepEqual(await cold.read('data/a.json', { read: 'json' }), {
    regions: [1],
  });
  assert.equal(cold.offlineRegion, 'a');
  const originalSaved = await store.meta('saved');
  const damaged = {...originalSaved[0], id:'damaged', keys:['https://example.test/atlas/missing#hash'], manifest:{...manifest,regions:{damaged:manifest.regions.a}}};
  await store.meta('saved',[null,{...damaged,keys:[17]},damaged,...originalSaved]);
  await store.meta('lastRegion','damaged');
  const recovered = new DatasetCache('https://example.test/atlas/', async()=>{throw Error('Offline');}, store);
  await recovered.manifest();
  assert.equal(recovered.offlineRegion,'a');
  assert.deepEqual((await recovered.availableSaved()).map(item=>item.id),['a']);
  await recovered.useRegion('a');
  assert.equal(recovered.offlineRegion,'a');
  await store.meta('saved',originalSaved);
  const racing = new DatasetCache('https://example.test/atlas/', fetcher, store), resolvers=[];
  const a=originalSaved[0], b={...a,id:'b',manifest:{...a.manifest,revision:'b'}};
  racing.availableSaved=()=>new Promise(resolve=>resolvers.push(resolve));
  const earlier=racing.useRegion('a'),later=racing.useRegion('b');
  resolvers[1]([a,b]);await later;resolvers[0]([a,b]);await earlier;
  assert.equal(racing.offlineRegion,'b');assert.equal((await racing.manifest()).revision,'b');


} finally {
  if (oldNavigator)
    Object.defineProperty(globalThis, 'navigator', oldNavigator);
  else delete globalThis.navigator;
}
await restarted.removeRegion('a');
assert.equal((await store.all()).length, 0);
const noStorage = new DatasetCache(
  'https://x.test/',
  async (url) =>
    String(url).endsWith('downloads.json')
      ? Response.json(manifest)
      : new Response(bytes),
  new AtlasStore(null),
);
assert.deepEqual(await noStorage.read('data/a.json', { read: 'json' }), {
  regions: [1],
});
await assert.rejects(noStorage.saveRegion('a'), /not saved offline/);
const broken = new DatasetCache(
  'https://broken.test/',
  async (url) =>
    String(url).endsWith('downloads.json')
      ? Response.json(manifest)
      : new Response('not json'),
  store,
);
await assert.rejects(broken.read('data/a.json', { read: 'json' }));
assert.equal((await store.all()).length, 0);
await store.meta('limit', 5);
await store.put({
  key: 'recent1',
  path: 'a',
  buffer: bytes,
  bytes: 4,
  used: 1,
});
await store.put({
  key: 'recent2',
  path: 'b',
  buffer: bytes,
  bytes: 4,
  used: 2,
});
assert.equal(await store.get('recent1'), undefined);
const cancelled = new DatasetCache(
  'https://cancel.test/',
  async (url, { signal } = {}) => {
    if (String(url).endsWith('downloads.json')) return Response.json(manifest);
    return new Promise((resolve, reject) =>
      signal.addEventListener('abort', () =>
        reject(new DOMException('Cancelled', 'AbortError')),
      ),
    );
  },
  store,
);
const controller = new AbortController(),
  request = cancelled.read('data/a.json', { signal: controller.signal });
await new Promise((r) => setTimeout(r, 20));
controller.abort();
await assert.rejects(request, { name: 'AbortError' });
console.log(
  'Offline storage passed: reuse, restart offline, complete packages, fallback, corrupt files, LRU and cancellation.',
);
(await store.db()).close();
