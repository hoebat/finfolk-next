import {build} from 'esbuild';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]||'.'),base=resolve(root,'js/finfolk-next'),site=resolve(base,'site/web-main/src');
const plugin={name:'generated-workspaces',setup(b){b.onResolve({filter:/^@(finfolk\/edge|xtalk\/)/},args=>{
 if(args.path.startsWith('@finfolk/edge'))return {path:resolve(base,'packages/edge',args.path.slice(14)||'index.js')};
 const [,family,...path]=args.path.split('/');return {path:resolve(base,'packages/libs/xt-'+family,...path)};
});}};
await build({entryPoints:[resolve(base,'packages/edge/index.js')],outfile:resolve(site,'next-backbone.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',plugins:[plugin]});
await build({entryPoints:[resolve(base,'packages/edge/browser.js')],outfile:resolve(site,'app-backbone.js'),bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'inline',external:['./next-backbone.js'],plugins:[plugin]});
console.log('Bundled the Clojure-generated FinFolk backbone and browser adapter.');
