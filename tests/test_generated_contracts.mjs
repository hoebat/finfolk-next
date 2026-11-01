import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {operations} from '../js/finfolk-next/packages/edge/operations.js';
const baseline=JSON.parse(await readFile('resources/migration/http-contracts.json','utf8'));
assert.deepEqual(operations,baseline,'The extraction must preserve every deployed HTTP binding, ownership flag and invalidation domain');
console.log('GENERATED_CONTRACTS_PASS: all 103 Clojure-generated operations match the extraction baseline.');
