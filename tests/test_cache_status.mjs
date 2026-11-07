import assert from 'node:assert/strict';
import {receive} from '../js/finfolk-next/packages/edge/worker-bridge.js';

const events=[];
const previous=globalThis.dispatchEvent;
globalThis.dispatchEvent=event=>{if(event.type==='finfolk:cache-status')events.push(event.detail);};
try {
  const facade={snapshots:new Map(),subscriptions:new Map()};
  const ctx={scopes:new Map([['public',facade]])};
  const update=(key,state)=>receive(ctx,{type:'snapshot',scope:'public',key,state});
  await update('sites',{status:'stale',cached:true,savedAt:100,data:[]});
  await update('sites',{status:'loading',cached:true,savedAt:100,data:[]});
  assert.deepEqual(events,[],'Startup cache reads must not announce that the app is offline');
  await update('sites',{status:'ready',cached:true,savedAt:100,data:[]});
  assert.deepEqual(events.at(-1),{cached:true,savedAt:100});
  await update('directory',{status:'ready',cached:false,data:[]});
  assert.equal(events.at(-1).cached,true,'An unrelated successful request cannot hide a failed read');
  await update('events',{status:'ready',cached:true,savedAt:200,data:[]});
  await update('sites',{status:'ready',cached:false,data:[]});
  assert.deepEqual(events.at(-1),{cached:true,savedAt:200});
  await update('events',{status:'ready',cached:false,data:[]});
  assert.equal(events.at(-1).cached,false,'Recovery must clear the warning without waiting for a browser online event');
  console.log('CACHE_STATUS_PASS: startup, failed reads, independent models and network recovery.');
} finally {globalThis.dispatchEvent=previous;}
