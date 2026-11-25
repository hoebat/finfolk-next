import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEmailDelivery} from '../backend/email-delivery.mjs';

test('missing credentials leave email unavailable',()=>assert.equal(createEmailDelivery({}),null));
test('gateway configuration cannot send the token over plaintext or URL credentials',()=>{
 for(const url of ['http://mail.finfolk.com.au/v1/send','https://user:pass@mail.finfolk.com.au/v1/send'])
  assert.throws(()=>createEmailDelivery({MAIL_GATEWAY_URL:url,MAIL_GATEWAY_TOKEN:'key'}),/Invalid mail gateway URL/);
});
const invitation={to:'owner@example.test',title:'Beach meetup\r\nExtra header',url:'https://finfolk.com.au/events/invitation?token=test',idempotencyKey:'invite-uuid'};
test('delivery forwards cancellation and the database idempotency key without exposing credentials in the body',async()=>{
 const signal=new AbortController().signal;
 const deliver=createEmailDelivery({MAIL_GATEWAY_URL:'https://mail.finfolk.com.au/v1/send',MAIL_GATEWAY_TOKEN:'private-test-key'},async(url,options)=>{
  assert.equal(url,'https://mail.finfolk.com.au/v1/send');
  assert.equal(options.signal,signal);
  assert.equal(options.headers['Idempotency-Key'],'invite-uuid');
  assert.equal(options.headers.Authorization,'Bearer private-test-key');
  const body=JSON.parse(options.body);
  assert.equal(body.to,'owner@example.test');
  assert.equal(body.url,invitation.url);
  assert.equal(body.title,invitation.title);
  assert.ok(!options.body.includes('private-test-key'));
  return Response.json({id:'provider-receipt'});
 });
 assert.deepEqual(await deliver(invitation,{signal}),{id:'provider-receipt'});
});
test('provider failures and missing receipts never count as delivery and never retry implicitly',async()=>{
 for(const response of [new Response('sensitive provider diagnostic',{status:429}),Response.json({})]){
  let calls=0;
  const deliver=createEmailDelivery({MAIL_GATEWAY_URL:'https://mail.finfolk.com.au/v1/send',MAIL_GATEWAY_TOKEN:'key'},async()=>{calls++;return response;});
  await assert.rejects(()=>deliver(invitation),error=>!error.message.includes('sensitive'));
  assert.equal(calls,1);
 }
});
