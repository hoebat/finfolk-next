import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,mkdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
await mkdir('.cache',{recursive:true});const root=await mkdtemp(resolve('.cache/generate-check-'));
try {
 execFileSync('lein',['generate',root],{stdio:'inherit'});
 execFileSync(process.execPath,['scripts/bundle_backbone.mjs',root],{stdio:'inherit'});
 const files=JSON.parse(await readFile(root+'/resources/generated-files.json','utf8'));
 files.push('js/finfolk-next/site/web-main/src/next-backbone.js','js/finfolk-next/site/web-main/src/app-backbone.js');
 for(const file of files){const expected=await readFile(root+'/'+file);let actual;try{actual=await readFile(file);}catch{throw Error('Missing generated file: '+file);}if(!expected.equals(actual))throw Error('Stale generated file: '+file+'; run make generate.');}
 console.log('Generated SQL, contracts, workspace modules and browser bundles match Clojure sources.');
} finally {await rm(root,{recursive:true,force:true});}
