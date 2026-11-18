import {build} from 'esbuild';
import {resolve} from 'node:path';
import {mkdir,copyFile} from 'node:fs/promises';
const root=resolve(process.argv[2]||'.'),base=resolve(root,'js/finfolk-next'),site=resolve(base,'site/web-main/src');
const plugin={name:'generated-workspaces',setup(b){b.onResolve({filter:/^@(finfolk\/edge|xtalk\/)/},args=>{
 if(args.path.startsWith('@finfolk/edge'))return {path:resolve(base,'packages/edge',args.path.slice(14)||'index.js')};
 const [,family,...path]=args.path.split('/');return {path:resolve(base,'packages/libs/xt-'+family,...path)};
});}};
await build({entryPoints:[resolve(base,'packages/edge/index.js')],outfile:resolve(site,'next-backbone.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',plugins:[plugin]});
await build({entryPoints:[resolve(base,'packages/edge/browser.js')],outfile:resolve(site,'app-backbone.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',external:['./next-backbone.js'],plugins:[plugin]});
await mkdir(resolve(site,'workers'),{recursive:true});
for(const [entry,name] of [['kernel','kernel'],['sharedworker','finfolk.sharedworker']])
 await build({entryPoints:[resolve(base,'packages/edge',entry+'.js')],outfile:resolve(site,'workers',name+'.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',plugins:[plugin]});
await copyFile(resolve('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm'),resolve(site,'workers/sqlite3.wasm'));
// Next serves these modules directly from public in development. Keep the
// runtime synchronized without rebuilding unrelated atlas/reference assets.
const publicRuntime=resolve(base,'site/web-main/public');
await mkdir(resolve(publicRuntime,'workers'),{recursive:true});
for(const file of ['next-backbone.js','app-backbone.js','workers/kernel.js','workers/finfolk.sharedworker.js','workers/sqlite3.wasm'])
 await copyFile(resolve(site,file),resolve(publicRuntime,file));
console.log('Bundled the Clojure-generated FinFolk backbone and browser adapter.');

// Authored map adapter: parity builds emit into a temporary tree, while this
// source stays in the workspace just like the shared WASM input above.
await copyFile(resolve('js/finfolk-next/site/web-main/src/site-catalog.js'),resolve(publicRuntime,'site-catalog.js'));
