import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Window} from 'happy-dom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
await build({entryPoints:['js/finfolk-next/site/web-main/lib/use-page-model.js'],outfile:'.cache/cached-model-test.mjs',bundle:true,platform:'node',format:'esm',external:['react'],plugins:[{name:'controlled-model-transport',setup(b){b.onResolve({filter:/^\.\/page-models\.js$/},()=>({path:'models',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const resolveModel=(p,n)=>({name:n,values:{},nativeValues:{}});export const runModel=(c,p,n)=>c.call(n);'}))}}]});
const {usePageModel}=await import('../.cache/cached-model-test.mjs');
const w=new Window();globalThis.window=w;globalThis.document=w.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let listener,resolve,view;const order=[];
const client={authProvider:'supabase',subscribe(name,values,fn){order.push('subscribe');listener=fn;fn({status:'stale',data:{name:'Saved'},cached:true,savedAt:123});return()=>{listener=null}},call(){order.push('call');return new Promise(r=>resolve=r)}};
function Probe({uid='alice'}){view=usePageModel({status:'ready',user:{uid},client},'account','me');return React.createElement('p',null,view.record?.data?.name||'Loading')}
const host=w.document.createElement('div');w.document.body.append(host);const root=createRoot(host);
await act(async()=>root.render(React.createElement(Probe)));
assert.deepEqual(order,['subscribe','call']);assert.equal(host.textContent,'Saved');assert.equal(view.record.cached,true);
await act(async()=>{listener({status:'ready',data:{name:'Fresh'},cached:false});resolve({name:'Fresh'})});assert.equal(host.textContent,'Fresh');
await act(async()=>root.render(React.createElement(Probe,{uid:'bob'})));assert.equal(view.record.actor,'bob');
await act(async()=>root.unmount());assert.equal(listener,null);await w.happyDOM.close();
console.log('CACHED_PAGE_MODEL_PASS: subscribes before network, renders saved data before response, refreshes and releases observers.');
