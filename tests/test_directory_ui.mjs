import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderDirectory} from '../js/finfolk-next/site/web-main/src/directory.js';
const win=new Window({url:'https://finfolk.com.au/profiles?screen=directory'}),doc=win.document,main=doc.createElement('main');doc.body.append(main);
const original=globalThis.fetch;const requests=[];

globalThis.fetch=async url=>{requests.push(new URL(url).pathname);return Response.json({listings:[{id:'test',name:'<script>unsafe</script>',category:'School',state:'VIC',locality:'Melbourne',managed:false}],next:null});};
await renderDirectory({main,api:{},config:{backbone:true,apiUrl:'https://finfolk.com.au',authUrl:'https://auth.test'},screen:'directory',params:new URLSearchParams(),doc});
assert.equal(requests.at(-1),'/v1/directory');assert.match(main.textContent,/Unclaimed/);assert.match(main.textContent,/unsafe/);assert.equal(main.querySelector('script'),null);assert.equal(main.querySelector('[name=category]').options.length,7);
main.replaceChildren();globalThis.fetch=async url=>{requests.push(new URL(url).pathname);return Response.json({id:'test',name:'School',description:'Training',category:'School',locality:'Melbourne',state:'VIC',website:'https://school.example',socials:[],sources:[],managed:false});};
await renderDirectory({main,api:{},config:{backbone:true,apiUrl:'https://finfolk.com.au',authUrl:'https://auth.test'},screen:'listing',params:new URLSearchParams('id=test'),doc});assert.ok(requests.includes('/v1/directory/test'));assert.match(main.textContent,/Sign in to claim/);assert.equal(main.querySelector('button'),null);
main.replaceChildren();await renderDirectory({main,api:{user:{uid:'owner'},request:async()=>({admin:false,listings:[],claims:[{state:'pending',challenge:'FINFOLK-TEST',expires_at:'2027-01-01'}]})},screen:'my-listings',params:new URLSearchParams(),doc});assert.match(main.textContent,/FINFOLK-TEST/);assert.doesNotMatch(main.textContent,/Superadmin/);
globalThis.fetch=original;await win.happyDOM.close();console.log('Directory UI tests passed');
