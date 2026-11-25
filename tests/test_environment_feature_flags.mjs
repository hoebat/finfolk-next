import {test} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {once} from 'node:events';import net from 'node:net';
import {Controller,serve} from '../ref/foundation/resources/assets/app.manage/environments/controller.mjs';
import {environmentFeatureFlags} from '../scripts/lib/environment_feature_flags.mjs';
import {createAPI} from '../backend/api.mjs';
async function port(){const s=net.createServer().listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('environment flags isolate previews, guard writes, and survive lifecycle/controller restarts',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'env-flags-')),p=await port();
 const cfg={platform:'Fixture',port:0,versions:[{id:'checkout',path:'.'}],feature_flags:{definitions:[{id:'shop',label:'Shop'},{id:'events',label:'Events'}]},resources:[{id:'app',start:[process.execPath,'-e',`require('node:http').createServer(async(q,r)=>{const v=await(await fetch(process.env.APP_MANAGE_FEATURE_FLAGS_URL)).json();r.end(JSON.stringify(v))}).listen(${p},'127.0.0.1')`],probes:[{type:'http',url:'http://127.0.0.1:'+p}],ready_timeout_ms:10000}],environments:[{id:'dev',kind:'local',version:'checkout',resources:['app'],feature_flags:{resources:['app']}},{id:'test',kind:'local',version:'checkout',resources:[],feature_flags:{resources:[],defaults:{shop:true}}}]};
 const {server,controller:c}=await serve(root,cfg);const origin='http://127.0.0.1:'+server.address().port;
 try{
  const {token}=await(await fetch(origin+'/session')).json();
  const save=(body,headers={})=>fetch(origin+'/flags',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  assert.deepEqual(c.featureValues('dev').flags,{shop:false,events:false});assert.equal(c.featureValues('test').flags.shop,true);
  assert.equal((await save({id:'dev',revision:0,values:{shop:true}})).status,403);
  assert.equal((await save({id:'dev',revision:0,values:{shop:true}},{'X-Token':token,Origin:'https://outside.invalid'})).ok,false);
  assert.equal((await save({id:'dev',revision:0,values:{shop:true}},{'X-Token':token})).status,200);
  assert.equal((await save({id:'dev',revision:0,values:{events:true}},{'X-Token':token})).status,409);
  assert.equal((await save({id:'dev',revision:1,values:{unknown:true}},{'X-Token':token})).status,400);
  assert.equal(c.featureValues('dev').flags.events,false);assert.equal(c.featureValues('test').revision,0);
  c.enqueue('start','dev');await c.queue;assert.equal(c.state.operations.at(-1).status,'ok');
  assert.equal((await(await fetch('http://127.0.0.1:'+p)).json()).flags.shop,true,'preview receives its environment');
  c.setFlags({id:'dev',revision:1,values:{shop:false}});
  assert.equal((await(await fetch('http://127.0.0.1:'+p)).json()).flags.shop,false,'running preview sees changes');
  c.enqueue('stop','dev');await c.queue;assert.equal(c.owned(c.state.app),false);
  assert.equal((await fetch(origin+'/state')).status,200,'control plane survives preview stop');
  assert.equal(new Controller(root,cfg).featureValues('dev').flags.shop,false);
  c.enqueue('start','dev');await c.queue;assert.equal(c.state.operations.at(-1).status,'ok');
  assert.equal((await(await fetch('http://127.0.0.1:'+p)).json()).flags.shop,false,'restart retains flags');
  const provider=environmentFeatureFlags({env:{APP_MANAGE_FEATURE_FLAGS_URL:origin+'/features?id=dev'}});assert.equal((await provider()).environment,'dev');
  const api=createAPI({db:{query:()=>{throw Error('Unexpected database access');},transaction:()=>{throw Error('Unexpected transaction');}},verify:async()=>{throw Error('No identity');},previewFeatureFlags:provider});
  const apiRequest=(route,options={})=>api.fetch(new Request('http://localhost'+route,options),{FINFOLK_FEATURE_ENVIRONMENT:'development',FINFOLK_FEATURE_FLAGS_DEFAULT:'everyone',SUPABASE_URL:'http://auth.example.test',SUPABASE_PUBLISHABLE_KEY:'fixture'});
  assert.equal((await(await apiRequest('/v1/features')).json()).flags.shop,false,'environment values override standalone preview defaults');
  assert.equal((await apiRequest('/shop/items')).status,403);
  assert.equal((await apiRequest('/v1/native/account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'publicEvents',values:{}})})).status,403);
  c.setFlags({id:'dev',revision:2,values:{shop:true}});
  assert.equal((await(await apiRequest('/v1/features')).json()).flags.shop,true);
  assert.equal((await apiRequest('/v1/me/finnies')).status,401,'enabling a preview flag preserves authorization');
  assert.equal(environmentFeatureFlags({env:{}}),null);assert.throws(()=>environmentFeatureFlags({env:{APP_MANAGE_FEATURE_FLAGS_URL:'https://api.finfolk.com.au/features?id=production'}}),/loopback/);
 }finally{c.enqueue('stop','dev');await c.queue;await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
test('remote flag mutation and shared flag consumers are refused',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'env-flags-invalid-'));
 try{
  const cfg={versions:[],resources:[],environments:[{id:'production',kind:'remote',resources:[],feature_flags:{resources:[]}}]};assert.throws(()=>new Controller(root,cfg),/local environment/);
  const shared={versions:[{id:'checkout',path:'.'}],resources:[{id:'app',start:['node','app.mjs']}],environments:['dev','test'].map(id=>({id,kind:'local',version:'checkout',resources:['app'],feature_flags:{resources:['app']}}))};
  assert.throws(()=>new Controller(root,shared),/multiple environments/);
  delete shared.environments[1].feature_flags;
  assert.throws(()=>new Controller(root,shared),/multiple environments/,'an unconfigured environment must not reuse another environment’s flag consumer');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('direct dev launches read the configured default environment and fail closed without a controller',async()=>{
 const {localPreviewFeatureFlags}=await import('../scripts/lib/environment_feature_flags.mjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'direct-preview-flags-')),file=path.join(root,'environments.json');
 const cfg={platform:'Fixture',port:0,versions:[{id:'checkout',path:'.'}],resources:[],feature_flags:{definitions:[{id:'shop',label:'Shop'}]},environments:[{id:'development',kind:'local',version:'checkout',resources:[],feature_flags:{resources:[]}}],default_environment:'development'};
 const {server,controller:c}=await serve(root,cfg);cfg.port=server.address().port;fs.writeFileSync(file,JSON.stringify(cfg));
 try{
  const provider=localPreviewFeatureFlags({env:{},configFile:file});
  assert.equal((await provider()).flags.shop,false);
  c.setFlags({id:'development',revision:0,values:{shop:true}});assert.equal((await provider()).flags.shop,true);
  c.setFlags({id:'development',revision:1,values:{shop:false}});assert.equal((await provider()).flags.shop,false);
  const explicit=localPreviewFeatureFlags({env:{APP_MANAGE_FEATURE_FLAGS_URL:'http://127.0.0.1:'+cfg.port+'/features?id=development'},configFile:'unused'});assert.equal((await explicit()).environment,'development');
  assert.deepEqual((await localPreviewFeatureFlags({env:{},configFile:path.join(root,'missing')})()).flags,{});
  await new Promise(r=>server.close(r));assert.deepEqual((await provider()).flags,{});
 }finally{if(server.listening)await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
