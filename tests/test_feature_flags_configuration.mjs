import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createServer} from 'node:http';import {once} from 'node:events';
import {configure,validateSettings} from '../scripts/configure_feature_flags.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'flag-config-'));let server;
try{
 const token='fixture-existing-management-token-32-characters';
 const tokenFile=path.join(root,'credential');await writeFile(tokenFile,token,{mode:0o600});
 server=createServer((req,res)=>{assert.equal(req.headers.authorization,'Bearer '+token);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({environment:'test',flags:[{id:'shop'}]}));});server.listen(0,'127.0.0.1');await once(server,'listening');
 const apiOrigin='http://127.0.0.1:'+server.address().port;
 const setup=await configure({root,apiOrigin,tokenFile});assert.equal(setup.connected,false);assert.ok(!JSON.stringify(setup).includes(token));
 const file=path.join(root,'config/feature-flags.local.json'),raw=JSON.parse(await readFile(file,'utf8'));assert.equal(raw.managementToken,token);assert.equal((await stat(file)).mode&0o777,0o600);
 await assert.rejects(configure({root,apiOrigin,generate:true}),/already exists/);
 assert.equal((await configure({root,check:true})).connected,true);
 for(const apiOrigin of ['http://public.example','https://user:password@private.example','https://private.example/path'])assert.throws(()=>validateSettings({apiOrigin,managementToken:token}));
 assert.throws(()=>validateSettings({apiOrigin,managementToken:token+'\n'}));
 console.log('Private feature flag setup: secure file, startup settings, existing token preservation, authenticated check and secret-safe output passed.');
}finally{if(server)await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
