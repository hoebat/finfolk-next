import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('js/finfolk-next/site/web-main/src');
let upgradeRequests=0;
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/__landing/')){
   res.setHeader('Cache-Control','no-store');
   if(path.endsWith('/sw.js')){
    res.setHeader('Content-Type','text/javascript');res.end((await readFile(root+'/sw-template.js','utf8')).replaceAll('__VERSION__','landing-test').replace('__SHELL__',JSON.stringify(['./index.html','./app'])));return;
   }
   if(path.endsWith('/index.html')){res.writeHead(302,{Location:'/__landing/'});res.end();return;}
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>'+ (path.endsWith('/app')?'FinFolk app':'FinFolk landing')+'</h1>');return;
  }
  if(path.startsWith('/__redirect/')){
   res.setHeader('Cache-Control','no-store');
   if(path.endsWith('/sw.js')){
    res.setHeader('Content-Type','text/javascript');res.end((await readFile(root+'/sw-template.js','utf8')).replaceAll('__VERSION__','redirect-test').replace('__SHELL__',JSON.stringify(['./index.html'])));return;
   }
   if(path.endsWith('/index.html')){res.writeHead(302,{Location:'/__redirect/'});res.end();return;}
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>Offline FinFolk shell</h1>');return;
  }
  if(path==='/__upgrade/account'){
   res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type','application/json');
   res.writeHead(401);res.end(JSON.stringify({request:++upgradeRequests}));return;
  }
  if(path.startsWith('/__upgrade/')){
   const version=new URL(req.url,'http://localhost').searchParams.get('version')==='substrate'?'substrate':'legacy';
   res.setHeader('Cache-Control','no-store');
   if(path.endsWith('/sw.js')){
    res.setHeader('Content-Type','text/javascript');
    res.end((await readFile(root+'/sw-template.js','utf8')).replaceAll('__VERSION__',version).replace('__SHELL__',JSON.stringify(['./index.html?version='+version])));return;
   }
   res.setHeader('Content-Type','text/html');res.end('<!doctype html><h1>'+version+'</h1>');return;
  }
  if(path==='/__test'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>FinFolk worker tests</title>');return;}
  const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!(await stat(file)).isFile())throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png'})[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
}).listen(8137,'127.0.0.1');
