import assert from 'node:assert/strict';
import test from 'node:test';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {useActorData} from '../js/finfolk-next/site/web-main/lib/use-actor-data.js';

test('page snapshots fence input, actor, replacement client, readiness and unmount races',async()=>{
 const window=new Window();const previous=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]));
 Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host),pending=[],renders=[];
 let snapshot;
 function Probe({session,input}){snapshot=useActorData(session,input,()=>new Promise(resolve=>pending.push({input,client:session.client,resolve})));renders.push(snapshot.record);return React.createElement('span',null,snapshot.record?.data?.label||'empty');}
 const a={uid:'alice'},b={uid:'bob'},clientA={},clientB={};
 const render=async(user,client,input,status='ready')=>act(async()=>{root.render(React.createElement(Probe,{session:{user,client,status},input}));});
 const resolve=async(index,label)=>act(async()=>{pending[index].resolve({label});});
 try{
 await render(a,clientA,'one');await resolve(0,'old input');assert.equal(host.textContent,'old input');
 await render(a,clientA,'two');assert.equal(host.textContent,'empty');
 await render(b,clientB,'two');await resolve(1,'late alice');assert.equal(host.textContent,'empty');
 await resolve(2,'bob data');assert.equal(host.textContent,'bob data');
 await render(b,clientA,'two');assert.equal(host.textContent,'empty','Same uid with replacement SDK must not expose the previous record');
 await resolve(3,'replacement');assert.equal(host.textContent,'replacement');
 await render(b,clientA,'two','loading');assert.equal(host.textContent,'empty');
 await render(b,clientA,'two');await render(null,clientA,'two');await resolve(4,'late signed-out');assert.equal(host.textContent,'empty');
 await render(a,clientA,'three');const count=renders.length;await act(async()=>root.unmount());await resolve(5,'late unmounted');assert.equal(renders.length,count);
 }finally{await window.happyDOM.close();for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});

test('live page models isolate errors, release subscriptions and fence client replacement callbacks',async()=>{
 const {usePageModels}=await import('../js/finfolk-next/site/web-main/lib/use-page-models.js');
 const window=new Window(),previous=Object.fromEntries(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,globalThis[key]]));
 Object.assign(globalThis,{window,document:window.document,IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let snapshot;
 const makeClient=()=>{const subscriptions=[],pending=[];return {user:{uid:'alice'},subscriptions,pending,subscribe(name,values,callback){const entry={name,callback,stopped:false};subscriptions.push(entry);return ()=>{entry.stopped=true;};},call(name){return new Promise((resolve,reject)=>pending.push({name,resolve,reject}));}};};
 const a=makeClient(),b=makeClient();
 function Probe({client,status='ready'}){snapshot=usePageModels({user:client.user,client,status},'account-privacy');return React.createElement('span',null,JSON.stringify(Object.keys(snapshot.models)));}
 const render=async(client,status)=>act(async()=>root.render(React.createElement(Probe,{client,status})));
 try{
 await render(a);assert.equal(a.subscriptions.length,2);
 await act(async()=>{a.subscriptions.find(x=>x.name==='connections').callback({status:'ready',data:['friend']});a.pending.find(x=>x.name==='connections').resolve(['friend']);a.pending.find(x=>x.name==='blocks').reject(Error('Blocks unavailable'));});
 assert.deepEqual(snapshot.models.connections.data,['friend']);assert.equal(snapshot.models.blocks.error.message,'Blocks unavailable');
 await render(b);assert.ok(a.subscriptions.every(x=>x.stopped));assert.equal(snapshot.models.connections.data,undefined);
 await act(async()=>a.subscriptions[0].callback({status:'ready',data:['stale client']}));assert.equal(snapshot.models.connections.data,undefined);
 await act(async()=>{b.subscriptions.find(x=>x.name==='connections').callback({status:'ready',data:['new client']});});assert.deepEqual(snapshot.models.connections.data,['new client']);
 await render(b,'loading');assert.deepEqual(snapshot.models,{});assert.ok(b.subscriptions.every(x=>x.stopped));
 await act(async()=>root.unmount());
 }finally{await window.happyDOM.close();for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
