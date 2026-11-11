import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import * as kernel from '../js/finfolk-next/site/web-main/src/workers/kernel.js';
const previousOnMessage = globalThis.onmessage;
const scopeId='transport-test|alice';
const messages=[];
function client(id,respond=false){const c={id,environment:'transport-test',scopes:new Set([scopeId]),subscriptions:new Map(),port:{postMessage(message){messages.push({client:id,...message});if(respond&&message.type==='http')queueMicrotask(()=>kernel.handle(c,{type:'http-result',id:message.id,result:{actor:'alice',name:message.name}}));}}};return c;}
const old=client('old'),next=client('next',true),scope={id:scopeId,clients:new Set([old,next])};
kernel.SCOPES.set(scopeId,scope);kernel.CLIENTS.add(old);kernel.CLIENTS.add(next);
try {
 const pending=kernel.transport(scope,'me',{}, {client:'old'});pending.catch(()=>{});
 kernel.detach(old);
 const result=await Promise.race([pending,delay(40).then(()=>({waiting:true}))]);
 assert.equal(result.waiting,undefined,'A departed tab must not strand an account read until the 30-second timeout');
 assert.deepEqual(result,{actor:'alice',name:'me'});
 assert.equal(kernel.HTTP.size,0);
 assert.ok(messages.some(m=>m.client==='old'&&m.type==='http-abort'));
 const writer=client('writer');scope.clients.add(writer);kernel.CLIENTS.add(writer);
 const write=kernel.transport(scope,'preferences',{profile:{}},{client:'writer'});write.catch(()=>{});
 const before=messages.filter(m=>m.client==='next'&&m.type==='http').length;
 kernel.detach(writer);
 await assert.rejects(write,e=>e.name==='AbortError'&&e.mutationOutcomeUnknown===true);
 assert.equal(messages.filter(m=>m.client==='next'&&m.type==='http').length,before,'Unconfirmed mutations must never be forwarded or replayed');
 const lone=client('lone');scope.clients.clear();scope.clients.add(lone);kernel.CLIENTS.add(lone);
 const read=kernel.transport(scope,'me',{}, {client:'lone'});read.catch(()=>{});kernel.detach(lone);
 await assert.rejects(read,e=>e.name==='AbortError');
 assert.equal(kernel.HTTP.size,0);
 console.log('KERNEL_TRANSPORT_LIFECYCLE_PASS: detached-tab reads recover on a remaining same-actor tab; unconfirmed writes never replay; orphan requests settle without timeout.');
}finally {
 for(const [id,task] of kernel.HTTP){clearTimeout(task.timer);task.reject(new Error('Test cleanup'));kernel.HTTP.delete(id);}
 kernel.SCOPES.delete(scopeId);for(const c of [old,next])kernel.CLIENTS.delete(c);globalThis.onmessage=previousOnMessage;
}

// A back/forward-cache page cannot service fetch requests while suspended.
// The coordinator must detach it so the kernel can settle/reroute its HTTP.
const originalInterval=globalThis.setInterval;
globalThis.setInterval=(...args)=>{const timer=originalInterval(...args);timer.unref();return timer;};
let coordinator;
try {coordinator=await import('../js/finfolk-next/site/web-main/src/workers/finfolk.sharedworker.js');}
finally {globalThis.setInterval=originalInterval;}
const events=[],suspended={active:true,scopes:new Set(),writes:new Map(),kernel:{postMessage:m=>events.push({target:'kernel',...m}),close(){}},port:{postMessage:m=>events.push({target:'page',...m})}},remaining={active:true,writes:new Map(),port:{postMessage(){}}};
try {
 coordinator.Clients.add(suspended);coordinator.Clients.add(remaining);
 coordinator.message(suspended,{data:{type:'yield'}});
 assert.equal(coordinator.Clients.has(suspended),false,'A suspended page must not remain a fetch owner');
 assert.ok(events.some(e=>e.target==='kernel'&&e.type==='detach'));
 coordinator.message(suspended,{data:{type:'ping'}});
 assert.equal(coordinator.Clients.has(suspended),true);
 assert.ok(events.some(e=>e.target==='page'&&e.type==='restarting'),'Restoring a suspended page reconnects its actor scopes');
}finally{coordinator.Clients.clear();}
