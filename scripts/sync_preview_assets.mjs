// Serve current authored assets alongside Next's live React pages in development.
import {cp,mkdir,readdir,stat,rm,rename} from 'node:fs/promises';
import {watch} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
const excluded=new Set(['index.html','app.html','profiles.html','events.html','directory.html','landing.html','app.js','logbook.js','profiles.js','community.js','sw.js','_headers','sitemap.xml','robots.txt']);
export async function syncPreviewAssets({root=resolve('.'),watchChanges=false}={}){
 const source=resolve(root,'js/finfolk-next/site/web-main/src'),output=resolve(root,'js/finfolk-next/site/web-main/public');
 const allowed=file=>!file.split('/').some(part=>part.startsWith('.'))&&!excluded.has(file.split('/')[0])&&/\.(css|js|mjs|json|svg|png|webp|jpe?g|woff2?|ttf|otf|wasm|ico|gz|txt)$/.test(file);
 async function copy(file){if(!allowed(file))return;const to=resolve(output,file);try{if(!(await stat(resolve(source,file))).isFile())return;await mkdir(dirname(to),{recursive:true});const temporary=to+'.preview-'+randomUUID();try{await cp(resolve(source,file),temporary);await rename(temporary,to);}finally{await rm(temporary,{force:true});}}catch(e){if(e.code==='ENOENT')await rm(to,{force:true});else throw e;}}
 await mkdir(output,{recursive:true});for(const file of await readdir(source,{recursive:true}))await copy(file);
 if(!watchChanges)return ()=>{};
 const pending=new Map(),watcher=watch(source,{recursive:true},(_,name)=>{if(!name)return;const file=String(name);clearTimeout(pending.get(file));pending.set(file,setTimeout(()=>{pending.delete(file);copy(file).catch(e=>console.error('Preview asset sync:',e.message));},100));});
 return ()=>{watcher.close();for(const timer of pending.values())clearTimeout(timer);};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){await syncPreviewAssets({watchChanges:process.argv.includes('--watch')});console.log('Current preview assets synchronized.');}
