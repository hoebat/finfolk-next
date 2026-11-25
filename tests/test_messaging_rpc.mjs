import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMessagingRPC} from '../backend/messaging-rpc.mjs';
const application='11111111-1111-4111-a111-111111111111',account='22222222-2222-4222-a222-222222222222';
test('provider ISO times cross the generated microsecond RPC boundary without changing metadata',async()=>{
 const start='2026-11-26T00:00:00.123Z',deadline='2026-11-26T01:00:00.123Z';let received;
 const envelope={eventId:'fixture',sentAt:start,deadline,metadata:{deadline:42}};
 const call=createMessagingRPC(async(sql,values)=>{received={sql,values};return [{value:{receipt:{deadline:Date.parse(deadline)*1000},message:{time_created:Date.parse(start)*1000,metadata:{deadline:42}}}}];});
 const result=await call('receive_message',[application,account,envelope]);
 assert.match(received.sql,/\$1::uuid,\$2::uuid,\$3::jsonb/);
 assert.deepEqual(JSON.parse(received.values[2]),{...envelope,sentAt:Date.parse(start)*1000,deadline:Date.parse(deadline)*1000});
 assert.equal(envelope.sentAt,start);assert.equal(result.receipt.deadline,deadline);assert.equal(result.message.time_created,start);assert.deepEqual(result.message.metadata,{deadline:42});
});
test('credential expiries use the declared bigint type; invalid RPCs and times never reach SQL',async()=>{
 let queries=0,expiry;
 const call=createMessagingRPC(async(_sql,values)=>{queries++;expiry=values[4];return [{value:null}];});
 await call('set_messaging_authorization',[application,account,1,'encrypted','2026-11-26T00:00:00Z',{}]);
 assert.equal(expiry,1795651200000000);
 await assert.rejects(call('set_messaging_authorization',[application,account,1,'encrypted','invalid',{}]),/timestamp/);
 await assert.rejects(call('unregistered_rpc',[]),{code:'native_rpc_contract'});assert.equal(queries,1);
});
