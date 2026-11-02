import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const adapter=await readFile('backend/directory.mjs','utf8'),ui=await readFile('js/finfolk-next/site/web-main/src/directory.js','utf8');
assert.doesNotMatch(adapter,/\b(?:FROM|INTO|UPDATE|DELETE FROM)\s+finfolk\.directory_/i);
assert.doesNotMatch(ui,/\bfetch\s*\(/);assert.doesNotMatch(ui,/location\.reload/);
assert.match(adapter,/finfolk_rpc\.directory_operation/);assert.match(ui,/app\.public\.call/);
console.log('Directory architecture boundaries passed');
