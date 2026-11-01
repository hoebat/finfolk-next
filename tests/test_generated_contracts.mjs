import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {operations} from '../js/finfolk-next/packages/edge/operations.js';
const baseline=JSON.parse(await readFile('resources/migration/http-contracts.json','utf8'));
const retired=new Set(['instagramClaimCreate','instagramClaimRequest','instagramClaimRequestReview','instagramClaimReview','instagramClaimStart','instagramConnect','instagramVerify','messagingClaimDecision']);
const expected=Object.fromEntries(Object.entries(baseline).filter(([name])=>!retired.has(name)));
assert.deepEqual(operations,expected,'The extraction must preserve every deployed HTTP binding, ownership flag and invalidation domain');
console.log('GENERATED_CONTRACTS_PASS: active Clojure operations preserve the baseline except the explicitly retired claim mutations.');
