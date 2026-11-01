import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const root='.cache/next-site',files=await readdir(root),workers=await readdir(root+'/workers');
const backbone=files.find(f=>/^next-backbone\.[a-f0-9]{12}\.js$/.test(f));
const kernel=workers.find(f=>/^kernel\.[a-f0-9]{12}\.js$/.test(f)),wasm=workers.find(f=>/^sqlite3\.[a-f0-9]{12}\.wasm$/.test(f));
assert.ok(backbone&&kernel&&wasm,'publish versioned worker and WASM assets');
const browser=await readFile(root+'/'+backbone,'utf8'),code=await readFile(root+'/workers/'+kernel,'utf8'),sw=await readFile(root+'/sw.js','utf8');
assert.ok(browser.includes('./workers/'+kernel));assert.ok(browser.includes('./workers/finfolk.sharedworker.js'),'coordinator URL stays stable across builds');
assert.ok(code.includes('./'+wasm),'the kernel loads its matching WASM version');
for(const file of [kernel,wasm,'finfolk.sharedworker.js'])assert.ok(sw.includes('./workers/'+file),'offline shell includes '+file);
assert.deepEqual(await readFile(root+'/workers/'+wasm),await readFile('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'));
console.log('WORKER_PUBLICATION_PASS: versioned kernel/WASM, stable coordinator and matching offline shell.');

if(process.env.SITE_SNAPSHOT_FILE){const snapshot=files.find(f=>/^sites-snapshot\.[a-f0-9]{12}\.json$/.test(f));assert.ok(snapshot);assert.ok(sw.includes('./'+snapshot));const adapter=files.find(f=>/^site-catalog\.[a-f0-9]{12}\.js$/.test(f));assert.ok((await readFile(root+'/'+adapter,'utf8')).includes('./'+snapshot));assert.deepEqual(JSON.parse(await readFile(root+'/'+snapshot,'utf8')),JSON.parse(await readFile(process.env.SITE_SNAPSHOT_FILE,'utf8')));console.log('SITE_SNAPSHOT_PASS: public database snapshot is versioned and available in the offline shell.');}

assert.ok(sw.includes('./workers/finfolk.sharedworker.js?protocol=2'),'cache the coordinator protocol URL for offline starts');
