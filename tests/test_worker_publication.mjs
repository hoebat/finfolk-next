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
const html=await readFile(root+'/index.html','utf8'),app=await readFile(root+'/app.html','utf8'),config=JSON.parse(await readFile(root+'/neon-config.json','utf8'));
assert.ok(html.includes('<title>FinFolk - Discover Freediving</title>'));assert.ok(html.includes('rel="canonical" href="https://finfolk.com.au/"'));
assert.ok(!html.includes('noindex')&&!html.includes('FinFolk Next ·'));
assert.ok(html.includes('id="landing-main"')&&html.includes('id="landing-preview"'));
assert.ok(/landing\.[a-f0-9]{12}\.js/.test(html),'homepage loads the fingerprinted landing module');
assert.ok(app.includes('<title>FinFolk</title>')&&app.includes('id="app-main"'),'keep a separate application shell');
assert.ok(sw.includes('"./app"'),'offline app shell is separate from the homepage');
assert.ok(sw.includes('"./profiles"'),'profile navigation keeps its own offline document');
const profiles=await readFile(root+'/profiles.html','utf8');assert.ok(profiles.includes('id="profile-main"')&&/profiles-page\.[a-f0-9]{12}\.js/.test(profiles));
assert.ok(html.includes('./profiles?screen=people'),'landing community preview opens People');
for(const scene of ['ningaloo','great-barrier','julian-rocks','port-phillip','bicheno','point-lowly'])for(const palette of ['acid-light','acid-dark','muted-light','muted-dark'])for(const mobile of ['', '-mobile'])assert.ok(files.includes(`scene-${scene}-${palette}${mobile}-v1.webp`),'publish all illustrated coastal palettes');
assert.equal(config.apiUrl,'https://finfolk.com.au/');assert.equal(config.backbone,true);assert.equal(config.cacheBackend,'sqlite');assert.equal(config.googleEnabled,true);
assert.ok(!(await readFile(root+'/robots.txt','utf8')).includes('Disallow: /'));
console.log('WORKER_PUBLICATION_PASS: versioned kernel/WASM, stable coordinator and matching offline shell.');

if(process.env.SITE_SNAPSHOT_FILE){const snapshot=files.find(f=>/^sites-snapshot\.[a-f0-9]{12}\.json$/.test(f));assert.ok(snapshot);assert.ok(sw.includes('./'+snapshot));const adapter=files.find(f=>/^site-catalog\.[a-f0-9]{12}\.js$/.test(f));assert.ok((await readFile(root+'/'+adapter,'utf8')).includes('./'+snapshot));assert.deepEqual(JSON.parse(await readFile(root+'/'+snapshot,'utf8')),JSON.parse(await readFile(process.env.SITE_SNAPSHOT_FILE,'utf8')));console.log('SITE_SNAPSHOT_PASS: public database snapshot is versioned and available in the offline shell.');}

assert.ok(sw.includes('./workers/finfolk.sharedworker.js?protocol=2'),'cache the coordinator protocol URL for offline starts');
