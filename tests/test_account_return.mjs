import assert from 'node:assert/strict';
import {accountReturnDestination as target} from '../js/finfolk-next/site/web-main/app/(atlas)/account/routing.js';
assert.equal(target('/pages?create=1&locality=Bondi&site=bondi'),'/pages?create=1&locality=Bondi&site=bondi');
assert.equal(target('/directory/example'),'/directory/example');
assert.equal(target('/pages?returnTo=https%3A%2F%2Fevil.example'),'/pages');
for(const value of ['https://evil.example','//evil.example/pages','/\\evil.example/pages','/pages\n','/account','/pages/../../account','/%2F%2Fevil.example',null])assert.equal(target(value),null);
for(const section of ['', '/appearance','/privacy','/account','/profile','/messaging'])assert.equal(target('/account/settings'+section+'/'),'/account/settings'+section);
console.log('ACCOUNT_RETURN_PASS: local page context preserved; external and recursive destinations rejected.');

assert.equal(target('/u/alice-dives'),'/u/alice-dives');
assert.equal(target('/u/alice-dives?returnTo=https://evil.test'),'/u/alice-dives');
