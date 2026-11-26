import assert from 'node:assert/strict';import {cachedReadClient} from '../js/finfolk-next/site/web-main/lib/cached-read-client.js';
let release,updates=0,stopped=0;const client={subscribe(n,v,fn){fn({status:'stale',data:{name:'Saved'},cached:true});return()=>stopped++},call(){return new Promise(r=>release=r)}};
const proxy=cachedReadClient(client,()=>updates++);assert.deepEqual(await proxy.call('me',{}),{name:'Saved'});await Promise.resolve();release({name:'Fresh'});await new Promise(r=>setTimeout(r,0));assert.equal(updates,1);assert.equal(stopped,1);
console.log('CACHED_READ_CLIENT_PASS: composite loaders receive saved snapshots before network and request a refresh when data changes.');
