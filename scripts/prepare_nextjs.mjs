import {cp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url),site=new URL('js/finfolk-next/site/web-main/',root),out=new URL('public/',site),built=new URL('.cache/next-site/',root);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const entry of await readdir(built)){if(['app.js','logbook.js','profiles.js','community.js','index.html','app.html','profiles.html','events.html','directory.html','landing.html','sw.js','_headers','sitemap.xml','robots.txt'].includes(entry))continue;await cp(new URL(entry,built),new URL(entry,out),{recursive:true});}
// Explore vector tiles are delivered from the pinned dataset release. Keeping
// thousands of duplicate files here makes every frontend publish unnecessarily slow.
await rm(new URL('data/explore-contours/',out),{recursive:true,force:true});
// The production Next build emits the integrity-checked native service worker.
// Development deliberately does not register a worker.
await import('./prepare_netlify_assets.mjs');
console.log('Next.js public assets prepared; legacy routes preserved.');
