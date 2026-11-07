import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),site=new URL('js/finfolk-next/site/web-main/',root),out=new URL('public/',site),built=new URL('.cache/next-site/',root);
await rm(out,{recursive:true,force:true});await mkdir(new URL('legacy/',out),{recursive:true});
for(const entry of await readdir(built)){if(['index.html','app.html','profiles.html','events.html','directory.html','landing.html','sw.js','_headers','sitemap.xml','robots.txt'].includes(entry))continue;await cp(new URL(entry,built),new URL(entry,out),{recursive:true});}
for(const name of ['app','profiles','events','landing','directory']){let html=await readFile(new URL(name+'.html',built),'utf8');html=html.replace('<head>','<head><base href="/">');await writeFile(new URL('legacy/'+name+'.html',out),html);}
// The production Next build emits the integrity-checked native service worker.
// Development deliberately does not register a worker.
await import('./prepare_netlify_assets.mjs');
console.log('Next.js public assets prepared; legacy routes preserved.');
