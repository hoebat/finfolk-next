import {createServer} from 'node:http';
import {readFile,stat,access} from 'node:fs/promises';
import {watch,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
if(!process.env.JAVA_HOME && existsSync('/opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home'))process.env.JAVA_HOME='/opt/homebrew/opt/openjdk@27/libexec/openjdk.jdk/Contents/Home';
const source=resolve('js/finfolk-next/site/web-main/src'),built=resolve('.cache/next-site');
if(!existsSync(built+'/data/catalog.json'))execFileSync(process.execPath,['scripts/build_next.mjs'],{stdio:'inherit'});
const types={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.jpeg':'image/jpeg','.png':'image/png'};
const server=createServer(async(req,res)=>{
 try {
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname),name=path==='/'?'/index.html':path;
  if(name==='/neon-client.js'){
   res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});res.end(execFileSync(process.execPath,['scripts/bundle_neon.mjs']));return;
  }
  const first=/\.(?:js|css|html|svg|jpeg|png)$/.test(name)||name==='/neon-config.json'?source:built;
  for(const base of [first,first===source?built:source]){
   const file=resolve(base,'.'+name);if(!file.startsWith(base+'/'))continue;
   try {if(!(await stat(file)).isFile())continue;res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));return;}catch{}
  }
  if(name.startsWith('/data/')){
   const gzip=resolve(built,'__compressed'+name+'.gz');if(gzip.startsWith(built+'/__compressed/')){
    try{await access(gzip);res.writeHead(200,{'Content-Type':types[extname(name)]||'application/octet-stream','Content-Encoding':'gzip'});res.end(await readFile(gzip));return;}catch{}
   }
  }
  res.writeHead(404);res.end('Not found');
 }catch{res.writeHead(500);res.end('Development response failed.');}
});
let timer;
for(const directory of ['src','src-app'])watch(directory,{recursive:true},(_event,name)=>{
 if(!name?.endsWith('.clj'))return;clearTimeout(timer);timer=setTimeout(()=>{
  try{execFileSync('lein',['generate'],{stdio:'inherit'});execFileSync(process.execPath,['scripts/bundle_backbone.mjs'],{stdio:'inherit'});console.log('Regenerated. Reload the browser.');}catch{console.error('Generation failed; fix the source and save again.');}
 },500);
});
server.listen(Number(process.env.WEB_PORT||8000),'127.0.0.1',()=>console.log('FinFolk Next: http://127.0.0.1:'+(process.env.WEB_PORT||8000)+' · edits to Clojure regenerate; DOM/CSS edits are served directly.'));
