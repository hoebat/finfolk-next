import assert from 'node:assert/strict';
import {accountReturnDestination,spotSignInURL} from '../js/finfolk-next/site/web-main/app/(atlas)/account/routing.js';
assert.equal(accountReturnDestination('/map?site=bondi#notes-bondi'),'/map?site=bondi#notes-bondi');
for(const value of ['//evil.test/map','https://evil.test/map','/map/elsewhere','/\\evil.test/map'])assert.equal(accountReturnDestination(value),null);
globalThis.location={origin:'https://finfolk.test',pathname:'/map',search:'?q=reef&listing=school&site=old&previewActor=guest'};
const href=spotSignInURL('bondi',true),target=new URL(href,location.origin).searchParams.get('returnTo');
assert.equal(target,'/map?q=reef&site=bondi#notes-bondi');assert.equal(accountReturnDestination(target),target);
delete globalThis.location;
console.log('GUEST_ROUTING_PASS');
