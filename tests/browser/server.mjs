import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('js/finfolk-next/site/web-main/src');
createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  if(path==='/__test'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>FinFolk worker tests</title>');return;}
  const file=resolve(root,'.'+path);if(!file.startsWith(root+'/')||!(await stat(file)).isFile())throw Error();
  res.setHeader('Content-Type',({'.js':'text/javascript','.wasm':'application/wasm','.json':'application/json','.html':'text/html'})[extname(file)]||'application/octet-stream');
  res.setHeader('Cache-Control','no-store');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
}).listen(8137,'127.0.0.1');
