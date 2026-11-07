import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {operations} from '../js/finfolk-next/packages/edge/operations.js';
const baseline=JSON.parse(await readFile('resources/migration/http-contracts.json','utf8'));
const retired=new Set(['instagramClaimCreate','instagramClaimRequest','instagramClaimRequestReview','instagramClaimReview','instagramClaimStart','instagramConnect','instagramVerify','messagingClaimDecision']);
const expected=Object.fromEntries(Object.entries(baseline).filter(([name])=>!retired.has(name)));
expected.messagingAuthorizationDiagnostics={admin:true,auth:true,domain:'admin',method:'GET',name:'messagingAuthorizationDiagnostics',path:'/v1/admin/messaging/instagram/authorization/diagnostics',transport:'rest',write:false};
const added=Object.fromEntries(Object.entries(operations).filter(([name])=>Object.hasOwn(expected,name)));
for(const [name,spec]of Object.entries(operations)){
 assert.equal(spec.name,name,'Operation name must match its registry key');
 assert.equal(typeof spec.auth,'boolean',name+' must declare its authentication boundary');
 assert.equal(typeof spec.write,'boolean',name+' must classify reads versus writes');
 assert.ok(['rest','action'].includes(spec.transport),name+' has an unknown transport');
 if(spec.admin)assert.equal(spec.auth,true,name+' admin access must require authentication');
}
assert.equal(operations.siteDraftPublish.admin,true);assert.equal(operations.siteCatalog.auth,false);
assert.deepEqual(added,expected,'The extraction must preserve every deployed HTTP binding, ownership flag and invalidation domain');
console.log('GENERATED_CONTRACTS_PASS: active Clojure operations preserve the baseline except the explicitly retired claim mutations.');
