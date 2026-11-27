import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {chromium} from '@playwright/test';
import {inspectPage,discoverRoutes} from '../scripts/check_pages.mjs';
test('page audit detects handled render failures, console errors, exceptions and failed HTTP',async()=>{
 const server=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html');
  if(req.url==='/failed'){res.writeHead(503);res.end('Unavailable');return;}
  if(req.url==='/broken'){res.end('<h1>Could not load this page</h1><script>console.error("script warning");fetch("/failed");setTimeout(()=>{throw Error("render exploded")},10)</script>');return;}
  res.end('<h1>Settings</h1><p>Ready</p>');
 });
 let browser;
 try{
  server.listen(0,'127.0.0.1');await once(server,'listening');browser=await chromium.launch();
  const origin='http://127.0.0.1:'+server.address().port;
  for(const [route,broken]of [['/healthy',false],['/broken',true]]){
   const {context,result}=await inspectPage(browser,origin+route,{settleMs:150});
   try{
    if(!broken)assert.deepEqual(result.issues,[]);
    else for(const kind of ['render','console','exception','http'])assert.ok(result.issues.some(issue=>issue.kind===kind),kind+' must be flagged');
   }finally{await context.close();}
  }
  const discovered=await discoverRoutes();assert.ok(discovered.routes.includes('/account/settings'));assert.ok(discovered.skipped.includes('/members/[id]'));assert.ok(discovered.routes.every(route=>!route.includes('(')&&!route.includes('[')));
 }finally{await browser?.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
});
