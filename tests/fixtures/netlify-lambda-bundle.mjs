// Executes inside the unchanged function zip mounted at Lambda's /var/task.
import assert from 'node:assert/strict';
import handler from './___netlify-server-handler.mjs';
const work=[];
const context={account:{id:'local-check'},deploy:{id:'0'},site:{id:'finfolklocal'},requestId:'local-check',waitUntil:promise=>work.push(promise)};
const get=path=>handler(new Request('http://localhost:3204'+path),context);
for(const [path,content] of [['/account',/Sign in|Account/],['/directory',/Melbourne Freedivers/],['/map',/id="explorer"/]]){
 const response=await get(path);assert.equal(response.status,200,path);assert.match(await response.text(),content,path);
}
const legacy=await get('/app?view=maps');assert.equal(legacy.status,200);const html=await legacy.text();assert.match(html,/<base href="\/">/);assert.ok(!html.includes('self.__next_f'));
for(const [path,target] of [['/app?view=account&tab=posts','/account/posts'],['/app?view=discover','/discover'],['/app?view=logbook','/logbook']]){
 const response=await get(path);assert.ok([302,307,308].includes(response.status),path);assert.equal(new URL(response.headers.get('location'),'http://localhost:3204').pathname,target);await response.arrayBuffer();
}
await Promise.allSettled(work);
console.log('NETLIFY_LAMBDA_BUNDLE_PASS: unchanged SSR zip initializes at /var/task on Node 22 with official local Blobs; native pages, staged legacy map and compatibility redirects render correctly.');
