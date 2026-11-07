import assert from 'node:assert/strict';
import {accountReturnDestination as target} from '../js/finfolk-next/site/web-main/app/(atlas)/account/routing.js';
assert.equal(target('/pages?create=1&locality=Bondi&site=bondi'),'/pages?create=1&locality=Bondi&site=bondi');
assert.equal(target('/directory/example'),'/directory/example');
assert.equal(target('/pages?returnTo=https%3A%2F%2Fevil.example'),'/pages');
for(const value of ['https://evil.example','//evil.example/pages','/\\evil.example/pages','/pages\n','/account','/pages/../../account','/%2F%2Fevil.example',null])assert.equal(target(value),null);
console.log('ACCOUNT_RETURN_PASS: local page context preserved; external and recursive destinations rejected.');
