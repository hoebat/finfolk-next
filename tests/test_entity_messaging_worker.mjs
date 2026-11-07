import assert from 'node:assert/strict';
import {createNextWorker} from '../backend/next-api-worker.mjs';
import {messagingWorkerConfiguration} from '../backend/messaging-worker.mjs';
const env={ENTITY_MESSAGING_ENABLED:'true',ENTITY_MESSAGING_HYPERDRIVE:{connectionString:'native'},ENTITY_MESSAGING_DATABASE_NAME:'finfolk_entities',ENTITY_MESSAGING_AUTH_BASE_URL:'https://auth.test/auth',ENTITY_MESSAGING_AUTH_JWKS_URL:'https://auth.test/jwks',ENTITY_MESSAGING_CONFIG:JSON.stringify({applications:[{id:'finfolk',administrators:['admin']}],apps:[],connections:[{application:'finfolk',handler:'finfolk'}],allowedOrigins:['https://finfolk.com.au']})};
assert.equal(messagingWorkerConfiguration(env).expectedDatabase,'finfolk_entities');
assert.throws(()=>messagingWorkerConfiguration({...env,ENTITY_MESSAGING_ENABLED:'false'}),/disabled/);
assert.throws(()=>messagingWorkerConfiguration({...env,ENTITY_MESSAGING_AUTH_JWKS_URL:'http://unsafe.test'}),/HTTPS/);
const config=JSON.parse(env.ENTITY_MESSAGING_CONFIG);
for(const change of [
 {...config,connections:[{application:'other',handler:'finfolk'}]},
 {...config,connections:[{application:'finfolk',handler:'body-supplied'}]},
 {...config,applications:[{id:'finfolk',administrators:[]}]},
 {...config,apps:[{key:'ig',provider:'instagram',secretEnv:'MISSING',verifyTokenEnv:'MISSING'}]},
 {...config,apps:[{key:'ig',provider:'instagram',appSecret:'inline',secretEnv:'SECRET'}]},
])assert.throws(()=>messagingWorkerConfiguration({...env,ENTITY_MESSAGING_CONFIG:JSON.stringify(change)}));
let opened=[],closed=0,drains=0,legacyCalls=0;
const worker=createNextWorker({openDatabase:value=>{opened.push(value);return {query:async()=>[{database:'finfolk_next',sql_sha:'legacy-sha'}],pool:{end:async()=>closed++}};},
 verifierFactory:()=>async()=>({sub:'admin'}),
 messagingFactory:()=>({fetch:async()=>Response.json({native:true}),drain:async()=>{drains++;throw Error('native unavailable');}}),
 apiFactory:()=>({fetch:async()=>{legacyCalls++;return Response.json({legacy:true});}})});
const route=new Request('https://api.finfolk.com.au/v1/messaging/connections/chat/status');
assert.equal((await worker.fetch(route,{})).status,503);assert.equal(opened.length,0);
assert.equal((await worker.fetch(route,{...env,ENTITY_MESSAGING_DATABASE_NAME:'finfolk_next'})).status,503);assert.equal(opened.length,0);
assert.equal((await worker.fetch(route,{...env,HYPERDRIVE:{connectionString:'native'}})).status,503);assert.equal(opened.length,0);
assert.equal((await worker.fetch(route,env)).status,200);assert.deepEqual(opened,['native']);
let retried=0;await worker.queue({messages:[{body:{kind:'entity-messaging',connectionKey:'chat'},ack:()=>assert.fail('failed drain must not acknowledge'),retry:()=>retried++}]},env);
assert.equal(retried,1);assert.equal(drains,1);
const legacyEnv={...env,ENVIRONMENT:'next',HYPERDRIVE:{connectionString:'legacy'},NEON_AUTH_BASE_URL:'https://isolated.auth.test/auth',NEON_AUTH_JWKS_URL:'https://isolated.auth.test/jwks',DB_BACKBONE_ENABLED:'true',DB_SQL_SHA:'legacy-sha'};
assert.equal((await worker.fetch(new Request('https://api.finfolk.com.au/v1/me'),legacyEnv)).status,200);assert.equal(legacyCalls,1);
assert.equal(opened.at(-1),'legacy','Existing API continues through its own database gate');
assert.equal(closed,opened.length);
console.log('ENTITY_MESSAGING_WORKER_PASS: explicit native binding, disabled and isolation gates, trusted registry, queue recovery, independent legacy routes and connection cleanup.');
