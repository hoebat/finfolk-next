import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { collectInstagramDM, processInstagramPublicDM, processInstagramDM, reconcileInstagramDM } from '../backend/messaging-engine.mjs';
import { seal } from '../backend/messaging-config.mjs';

const pg = new PGlite();
const q = async (sql, values = []) => (await pg.query(sql, values)).rows;
const db = { query:q, transaction:fn=>pg.transaction(tx=>fn(async(sql,values=[]) => (await tx.query(sql,values)).rows)) };
const scope = 'instagram-facebook:777:900';
let queued=[], direct=[], messages=[], failSend=false;
const env = {
  ENVIRONMENT:'next', DB_BACKBONE_ENABLED:'true', DB_SQL_SHA:'fixture',
  HYPERDRIVE:{connectionString:'fixture'}, LEGACY_AUTH_BASE_URL:'https://fixture.auth.test/auth',
  INSTAGRAM_NEXT_INGRESS_ENABLED:'true', INSTAGRAM_MESSAGING_WEBHOOK_SECRET:'webhook-fixture',
  MESSAGING_ENCRYPTION_KEY:Buffer.alloc(32,9).toString('base64'),
  INSTAGRAM_MESSAGING_META_APP_ID:'777', INSTAGRAM_MESSAGING_META_APP_SECRET:'fixture',
  INSTAGRAM_MESSAGING_PAGE_ID:'555', INSTAGRAM_MESSAGING_ACCOUNT_ID:'900',
  INSTAGRAM_DM_FEEDBACK_ENABLED:'true', INSTAGRAM_QUEUE:{send:async message=>queued.push(message)},
};
const fetcher = async (input, options) => {
  assert.equal(new URL(input).pathname,'/v26.0/900/messages','Public commands make only the text delivery call');
  assert.equal(options.method,'POST');
  const body = JSON.parse(options.body);
  assert.equal(body.sender_action,undefined);
  messages.push(body.message.text);
  if(failSend)throw new DOMException('Ambiguous delivery','TimeoutError');
  return Response.json({message_id:'reply-'+messages.length});
};
const incoming = async(text='/ping',extra={}) => {
  const mid=randomUUID();
  await collectInstagramDM({sender:{id:'100'},recipient:{id:'900'},timestamp:Date.now(),message:{mid,text},...extra},env,q,{onPublicCommand:id=>direct.push(id)});
  return 'dm:'+scope+':'+mid;
};
const result = async id => (await q('SELECT * FROM finfolk.messaging_outbox WHERE event_id=$1',[id]))[0];
const reset = async () => {
  queued=[]; direct=[]; messages=[]; failSend=false;
  await q('DELETE FROM finfolk.instagram_dm_events');
  await q('DELETE FROM finfolk.instagram_dm_limits');
  await q(`UPDATE finfolk.messaging_accounts SET mode='live',generation=1,enabled_commands='["ping","help","connect","status","points"]',
    provider_scope='instagram-facebook:777:900',pilot_sender_ids='[]',backoff_until=null,token_expires_at=null,checks='{"authorization":true,"subscription":true}'`);
};
const savedLog=console.log;
console.log=()=>{};
try {
  await pg.exec('CREATE SCHEMA legacy_auth; CREATE TABLE legacy_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean); CREATE ROLE finfolk_api;');
  for(const name of (await readdir('backend/migrations')).filter(n=>n.endsWith('.sql')).sort())
    await pg.exec((await readFile('backend/migrations/'+name,'utf8')).replaceAll('neon_auth','legacy_auth'));
  await q(`UPDATE finfolk.messaging_accounts SET account_id='900',provider_scope=$1,credential_ciphertext=$2`,[scope,seal({accessToken:'fixture'},env,scope)]);
  await reset();
  for(const text of ['/ping','/help','/menu','help','/help account','/help diagnostics','/site','/privacy','/disconnect','/ping extra','/madeup','/claim']) {
    const id=await incoming(text);
    assert.equal(direct.at(-1),id); assert.equal(queued.length,0);
    await processInstagramPublicDM(id,env,db,{fetcher});
    assert.equal((await result(id)).state,'provider_accepted');
    assert.ok(messages.at(-1).length>0);
    await Promise.all([processInstagramPublicDM(id,env,db,{fetcher}),processInstagramDM(id,env,db,{fetcher})]);
    assert.equal(messages.length,direct.length,'Direct and queued duplicates cannot reply twice');
  }
  await reset();
  const greeting=await incoming('hello');
  await processInstagramPublicDM(greeting,env,db,{fetcher});
  const secondGreeting=await incoming('hello again');
  await processInstagramPublicDM(secondGreeting,env,db,{fetcher});
  assert.equal(messages.length,1,'The existing daily greeting throttle remains intact');
  assert.equal(await result(secondGreeting),undefined);
  for(const text of ['/connect','/points'])await incoming(text);
  assert.deepEqual(queued.map(m=>m.kind),['instagram-dm','instagram-dm'],'Member commands retain the queue');
  assert.equal(direct.length,2);
  assert.equal(await processInstagramPublicDM(queued[0].id,env,db,{fetcher}),false,'Public executor cannot claim a member command');

  // Account reads/cancellation need no current follower lookup. Cancellation
  // stays within sender/scope and never removes a consumed code or a link.
  await reset();
  const accountEnv={...env,INSTAGRAM_DM_FEEDBACK_ENABLED:'false'};
  const codeEvent=await incoming('/connect');
  const accountFetcher=async(input,options={})=>options.method==='POST'?fetcher(input,options):Response.json({id:'100',username:'diver',is_user_follow_business:true});
  await processInstagramDM(codeEvent,accountEnv,db,{fetcher:accountFetcher});
  assert.equal((await q('SELECT invalidated FROM finfolk.instagram_connect_codes'))[0].invalidated,false);
  let accountId=await incoming('/status');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.match((await result(accountId)).body,/code is waiting/);
  accountId=await incoming('/cancel');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.match((await result(accountId)).body,/has been cancelled/);
  assert.equal((await q('SELECT invalidated FROM finfolk.instagram_connect_codes'))[0].invalidated,true);
  accountId=await incoming('/status');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.match((await result(accountId)).body,/not connected/);
  accountId=await incoming('/cancel');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.match((await result(accountId)).body,/No unused connection code/);
  // Only this sender's scope can be cancelled; a consumed code remains intact.
  await q("UPDATE finfolk.instagram_connect_codes SET invalidated=false,sender_id='200'");
  accountId=await incoming('/cancel');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.equal((await q('SELECT invalidated FROM finfolk.instagram_connect_codes'))[0].invalidated,false);

  await q(`INSERT INTO legacy_auth."user" VALUES('shared-member','Member',true,false)`);
  await q("INSERT INTO finfolk.members(user_id) VALUES('shared-member')");
  await q("UPDATE finfolk.instagram_connect_codes SET sender_id='100',consumed_by='shared-member'");
  await q("INSERT INTO finfolk.instagram_connections(user_id,handle,sender_id,status,provider_scope) VALUES('shared-member','diver','100','connected',$1)",[scope]);
  accountId=await incoming('/cancel');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.equal((await q('SELECT invalidated FROM finfolk.instagram_connect_codes'))[0].invalidated,false,'Consumed codes are never cancelled');
  const disconnectId=await incoming('/disconnect');
  await processInstagramPublicDM(disconnectId,accountEnv,db,{fetcher});
  assert.match((await result(disconnectId)).body,/confirm Remove link/);
  assert.equal((await q('SELECT status FROM finfolk.instagram_connections'))[0].status,'connected','Disconnect command only guides website confirmation');
  accountId=await incoming('/status');
  await processInstagramDM(accountId,accountEnv,db,{fetcher});
  assert.match((await result(accountId)).body,/is connected/);
  await q("DELETE FROM finfolk.instagram_connections WHERE user_id='shared-member'");

  // Concurrent workers compete for the same event and outbox reservations.
  await reset();
  let id=await incoming();
  await Promise.all([processInstagramPublicDM(id,env,db,{fetcher}),processInstagramPublicDM(id,env,db,{fetcher})]);
  assert.equal(messages.length,1);
  // The transaction rolls back a preparation failure; the receipt is recoverable.
  await reset(); id=await incoming();
  const broken={...db,transaction:fn=>db.transaction(tx=>fn(async(sql,values)=>{
    if(sql.includes('INSERT INTO finfolk.messaging_outbox'))throw Error('fixture interruption');
    return tx(sql,values);
  }))};
  await assert.rejects(processInstagramPublicDM(id,env,broken,{fetcher}),/fixture interruption/);
  assert.equal((await q('SELECT processing_state FROM finfolk.instagram_dm_events WHERE id=$1',[id]))[0].processing_state,'received');
  await reconcileInstagramDM(env,q);
  assert.ok(queued.some(m=>m.id===id && m.publicCommand===true),'Reconciliation recovers a direct task using the public executor');
  await processInstagramPublicDM(id,env,db,{fetcher});
  assert.equal(messages.length,1);

  for(const change of [
    "mode='disabled'", "generation=2", "mode='pilot',pilot_sender_ids='[]'",
    "enabled_commands='[\"help\"]'", "checks='{}'", "token_expires_at=now()-interval '1 minute'",
    "backoff_until=now()+interval '1 minute'", "provider_scope='wrong-account'",
  ]) {
    await reset(); id=await incoming();
    await q('UPDATE finfolk.messaging_accounts SET '+change);
    await processInstagramPublicDM(id,env,db,{fetcher});
    assert.equal(messages.length,0,'No delivery after '+change);
  }
  await reset(); id=await incoming('/ping',{timestamp:Date.now()-86400001});
  await processInstagramPublicDM(id,env,db,{fetcher}); assert.equal(messages.length,0);
  await reset(); id=await incoming();
  await q(`INSERT INTO finfolk.instagram_dm_limits(sender_id,count) SELECT rate_limit_key,30 FROM finfolk.instagram_dm_events WHERE id=$1`,[id]);
  await processInstagramPublicDM(id,env,db,{fetcher}); assert.equal(messages.length,0,'Rate limits still apply');
  await reset(); failSend=true; id=await incoming();
  await processInstagramPublicDM(id,env,db,{fetcher});
  assert.equal((await result(id)).state,'uncertain');
  await processInstagramPublicDM(id,env,db,{fetcher});
  assert.equal(messages.length,1,'Ambiguous provider POSTs are never repeated');

  savedLog('INSTAGRAM_PUBLIC_FAST_PATH_PASS: public/member dispatch, durable recovery, duplicate/concurrent fencing, greeting throttle, rollout/auth/rate/expiry guards and ambiguous-send protection.');
} finally {console.log=savedLog; await pg.close();}
