import {userId} from './db/fixtures/messaging.mjs';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT,jwtVerify} from 'jose';
import {createMessagingAccessPolicy,messagingWorkerConfiguration} from '../backend/messaging-worker.mjs';
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
// This policy belongs to the independent messaging library, not the production worker.
const {privateKey,publicKey}=await generateKeyPair('EdDSA');
const active=new Set(['admin','member'].map(userId));let queries=0;
const policy=createMessagingAccessPolicy({db:{async query(_sql,[id]){queries++;return [{value:active.has(id)}];}},applications:[{id:'finfolk',administrators:[userId('admin')]}],verify:async token=>(await jwtVerify(token,publicKey,{issuer:'https://auth.example.test',algorithms:['EdDSA']})).payload});
const sign=(id,key=privateKey,expiry='5m')=>new SignJWT({}).setProtectedHeader({alg:'EdDSA'}).setSubject(userId(id)).setIssuer('https://auth.example.test').setExpirationTime(expiry).sign(key);
const request=token=>new Request('https://api.example.test/messages?actor=admin',{headers:{Authorization:'Bearer '+token}});
const adminScope={application:'finfolk',action:'admin'},memberScope={application:'finfolk',action:'messages'};
assert.deepEqual(await policy.authorize(request(await sign('member')),memberScope),{id:userId('member')});
assert.equal(await policy.authorize(request(await sign('member')),adminScope),null,'A query parameter cannot promote the signed subject');
assert.deepEqual(await policy.authorize(request(await sign('admin')),adminScope),{id:userId('admin')});
const before=queries,otherKeys=await generateKeyPair('EdDSA');
for(const token of [await sign('admin',privateKey,1),await sign('admin',otherKeys.privateKey),'malformed'])assert.equal(await policy.authorize(request(token),adminScope),null);
assert.equal(queries,before,'Invalid credentials must fail before querying membership');
assert.equal(await policy.authorize(request(await sign('admin')),{...adminScope,application:'other'}),null);
active.delete(userId('admin'));assert.equal(await policy.authorize(request(await sign('admin')),adminScope),null);assert.equal(await policy.authorizeCallback(userId('admin'),adminScope),false,'Callbacks recheck current membership');
console.log('MESSAGING_CONFIGURATION_PASS: registered handlers/operators, HTTPS issuers, bound secrets, signed-subject authority and membership rechecks.');
