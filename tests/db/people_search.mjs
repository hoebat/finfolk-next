import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {connect} from './harness.mjs';
import {installEntities,user} from './fixtures/entities.mjs';
const db=await connect(),actor=randomUUID(),members=Array.from({length:9},()=>randomUUID()),closed=randomUUID(),blocked=randomUUID(),other=randomUUID();
const search=async values=>(await db.query('SELECT finfolk_rpc.discover_community_people($1,$2::jsonb) value',[actor,JSON.stringify({mode:'discover',seed:'search-test-123',...values})])).rows[0].value;
try{
 await installEntities(db);await user(db,actor,{displayName:'Maya Viewer',open:true});
 for(const [i,id]of members.entries())await user(db,id,{displayName:i===0?'Maya_%':'Maya '+i,open:true});
 await user(db,closed,{displayName:'Maya Closed',open:false});await user(db,blocked,{displayName:'Maya Blocked',open:true});await user(db,other,{displayName:'Kai',open:true});
 await db.query('SELECT finfolk_rpc.set_account_block($1,$2,true)',[actor,blocked]);
 const first=await search({q:'  mAyA  '});assert.equal(first.people.length,6);assert(first.cursor);assert(first.people.every(p=>p.displayName.toLowerCase().includes('maya')));assert(!first.people.some(p=>[actor,closed,blocked,other].includes(p.id)));
 const second=await search({q:'mAyA',cursor:first.cursor});assert.equal(second.people.length,3);assert.equal(second.cursor,null);assert.equal(new Set([...first.people,...second.people].map(p=>p.id)).size,9);
 await assert.rejects(search({q:'Kai',cursor:first.cursor}),/mix changed/);
 assert.deepEqual((await search({q:'_%'})).people.map(p=>p.id),[members[0]],'wildcard characters are literal');
 assert.deepEqual((await search({q:'Kai'})).people.map(p=>p.id),[other]);assert.equal((await search({q:'not-a-member'})).people.length,0);await assert.rejects(search({q:'a'.repeat(81)}));
 console.log('PEOPLE_SEARCH_DB_PASS: server-side matching, trimming, case, literal search, pagination, cursor isolation, Closed profiles, blocks and self exclusion.');
}finally{await db.end();}
