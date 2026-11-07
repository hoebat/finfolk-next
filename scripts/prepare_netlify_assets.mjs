import {readdir,writeFile} from 'node:fs/promises';
const root=new URL('../js/finfolk-next/site/web-main/public/',import.meta.url);
let packed=[];try{packed=(await readdir(new URL('__compressed/',root),{recursive:true})).filter(path=>path.endsWith('.gz')).sort();}catch(error){if(error.code!=='ENOENT')throw error;}
const redirects=[],headers=['/offline/*\n  Cache-Control: no-store\n  X-Robots-Tag: noindex','/sw.js\n  Cache-Control: no-cache','/neon-config.json\n  Cache-Control: no-cache','/workers/*\n  Cache-Control: no-cache'];
for(const path of packed){
 if(!path.startsWith('data/')||/[\s#?]/.test(path)||path.includes('..'))throw Error('Unexpected compressed atlas path: '+path);
 redirects.push('/'+path.slice(0,-3)+' /__compressed/'+path+' 200');
 // Netlify applies headers against the incoming URL, before a static rewrite.
 // Keep the packed URL correct when it is requested directly as well.
 for(const url of ['/'+path.slice(0,-3),'/__compressed/'+path])headers.push(url+'\n  Content-Encoding: gzip\n  Content-Type: '+(path.endsWith('.geojson.gz')?'application/geo+json':'application/octet-stream')+'\n  X-Robots-Tag: noindex');
}
await writeFile(new URL('_redirects',root),redirects.join('\n')+'\n');
await writeFile(new URL('_headers',root),headers.join('\n\n')+'\n');
console.log(`Prepared ${packed.length} Netlify CDN atlas rewrites with encoded-data headers.`);
