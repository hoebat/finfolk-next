import assert from 'node:assert/strict';
import {communityItems,popularPlaces} from '../js/finfolk-next/site/web-main/app/(community)/community/feed-model.js';
const now=Date.parse('2026-11-25');
const rows=communityItems({trips:[{id:'t',title:'Coast trip',beachId:'bondi',total:{dives:4}}],listings:[{id:'p',name:'Ocean club'}],events:[{id:'past',starts_at:'2020-01-01',document:{title:'Past'}},{id:'future',starts_at:'2030-01-01',document:{title:'Training'}}]},now);
assert.deepEqual(rows.map(x=>x.kind),['trips','events','groups']);assert.equal(rows[0].detail,'4 logged dives');assert.equal(rows[1].title,'Training');assert.ok(rows.every(x=>x.href.startsWith('/')));
assert.deepEqual(popularPlaces({places:['second','missing','first']},[{id:'first',name:'First'},{id:'second',name:'Second'}]).map(x=>x.id),['second','first']);assert.deepEqual(popularPlaces({places:[]}),[]);
console.log('COMMUNITY_MODEL_PASS');
