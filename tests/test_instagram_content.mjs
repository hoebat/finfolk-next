import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { contentFixture } from './fixtures/instagram-content.mjs';
import { instagramContentClient } from '../backend/instagram-content.mjs';
import { authorizationDiagnostics } from '../backend/messaging-diagnostics.mjs';
import { processCommentCommand, sendCommandReply } from '../backend/instagram-commands.mjs';
import { collectInstagramSource } from '../backend/instagram-collector.mjs';

const make = () => {
  const f = contentFixture();
  f.fetcher = async (url, options) => f.authorizationResponse(url, options) || Response.json({ data: [] });
  return f;
};
for (const [mutate, code] of [
  [f => { f.row.credential_ciphertext = null; f.env.INSTAGRAM_ACCESS_TOKEN = 'raw-token-must-not-be-used'; }, 'content_authorization_required'],
  [f => { f.row.mode = 'disabled'; }, 'content_authorization_required'],
  [f => { f.row.token_expires_at = new Date(0).toISOString(); }, 'token_expired'],
  [f => { f.row.checks.authorization = false; }, 'content_authorization_required'],
  [f => { f.row.provider_scope = 'other'; }, 'content_authorization_required'],
  [f => { f.env.INSTAGRAM_ACCOUNT_ID = '999'; }, 'content_account_mismatch'],
  [f => { f.metadata.app_id = '999'; }, 'wrong_token_type'],
  [f => { f.metadata.type = 'USER'; }, 'wrong_token_type'],
  [f => { f.metadata.is_valid = false; }, 'wrong_token_type'],
  [f => { f.metadata.expires_at = 1; }, 'token_expired'],
  [f => { f.metadata.scopes = ['instagram_manage_messages']; }, 'content_permission_missing'],
  [f => { f.metadata.scopes = {}; }, 'content_permission_missing'],
  [f => { f.page.instagram_business_account.id = '999'; }, 'content_account_mismatch'],
  [f => { f.page.instagram_business_account.username = 'someone_else'; }, 'content_account_mismatch'],
]) {
  const f = make(); mutate(f);
  await assert.rejects(instagramContentClient(f.env, f.q, { fetcher: f.fetcher }), e => e.code === code && !e.message.includes('raw-token'), code);
}
let f = make();
let client = await instagramContentClient(f.env, f.q, { capability: 'comments', fetcher: f.fetcher });
await client.request('444', { fields: 'id,permalink' });
let sent = f.calls.at(-1);
assert.equal(sent.options.headers.Authorization, 'Bearer fixture-page-token');
assert.equal(sent.url.searchParams.has('access_token'), false);
assert.equal(sent.options.redirect, 'manual');
await assert.rejects(client.request('https://untrusted.test/'), e => e.code === 'content_path_invalid');
await assert.rejects(client.request('444', { access_token: 'bad' }), e => e.code === 'content_parameter_invalid');
await assert.rejects(client.request('444/media', {}, { method: 'POST' }), e => e.code === 'content_path_invalid');
f.current = false;
await assert.rejects(client.request('444'), e => e.code === 'content_authorization_changed');

f = make();
f.metadata.scopes = ['instagram_basic', 'pages_read_engagement'];
await instagramContentClient(f.env, f.q, { fetcher: f.fetcher });
await assert.rejects(instagramContentClient(f.env, f.q, { capability: 'comments', fetcher: f.fetcher }), e => e.code === 'content_permission_missing');
let diagnostics = await authorizationDiagnostics({ query: f.q }, f.env, f.fetcher);
assert.equal(diagnostics.contentCapabilities.media.authorized, true);
assert.equal(diagnostics.contentCapabilities.comments.authorized, false);
assert.equal(diagnostics.contentCapabilities.comments.liveVerified, false);
assert.equal(diagnostics.contentCapabilities.comments.webhookSubscribed, true);
for (const secret of ['fixture-page-token', 'fixture-app-secret']) assert.ok(!JSON.stringify(diagnostics).includes(secret));

// Real SQL and runtime permissions exercise the command/outbox state machine,
// including failures before a send is claimed and ambiguous POST responses.
const pg = new PGlite();
const q = async (sql, values = []) => (await pg.query(sql, values)).rows;
const db = { query: q, transaction: fn => pg.transaction(tx => fn(async (sql, values = []) => (await tx.query(sql, values)).rows)) };
const originalFetch = globalThis.fetch;
try {
  await pg.exec('CREATE SCHEMA neon_auth; CREATE TABLE neon_auth."user"(id text PRIMARY KEY,name text,"emailVerified" boolean,banned boolean); CREATE ROLE finfolk_api; GRANT USAGE ON SCHEMA neon_auth TO finfolk_api; GRANT SELECT ON neon_auth."user" TO finfolk_api;');
  for (const name of (await readdir('backend/migrations')).filter(n => n.endsWith('.sql')).sort())
    await pg.exec(await readFile('backend/migrations/' + name, 'utf8'));
  await pg.exec('GRANT USAGE ON SCHEMA finfolk TO finfolk_api; SET ROLE finfolk_api');
  f = make();
  Object.assign(f.env, { INSTAGRAM_COMMAND_REPLIES_ENABLED: 'true', INSTAGRAM_COMMENT_MODE: 'public', INSTAGRAM_COMMENT_ACTIVE_SINCE: new Date(Date.now()-60000).toISOString(), INSTAGRAM_DISCOVERY_ENABLED: 'true' });
  await q(`UPDATE finfolk.messaging_accounts SET account_id='333',provider_scope=$1,credential_ciphertext=$2,mode='pilot',generation=1,checks=$3::jsonb`,
    [f.scope, f.row.credential_ciphertext, JSON.stringify(f.row.checks)]);
  let posts = 0, ambiguous = false;
  const replyPaths = [];
  const fetcher = async (url, options = {}) => {
    const authorization = f.authorizationResponse(url, options);
    if (authorization) return authorization;
    if (options.method === 'POST') {
      posts++;
      const path = new URL(url).pathname;
      replyPaths.push(path);
      assert.ok(/\/\d+\/replies$/.test(path) || path.endsWith('/333/mentions'));
      assert.ok(options.body.get('message').includes('/help'));
      if (ambiguous) throw Error('fixture-page-token must never appear in diagnostics');
      return Response.json({ id: '444' });
    }
    return Response.json({ error: { code: 4, message: 'fixture-page-token' } }, { status: 429, headers: { 'retry-after': '300' } });
  };
  const comment = { id: '123', text: '/help @finfolk.com.au', from: { id: '555', username: 'diver' }, media: { id: '888', owner: { id: '333' } }, timestamp: new Date().toISOString() };
  await processCommentCommand(comment, 'owned', f.env, db, { fetcher });
  assert.equal((await q("SELECT send_state FROM finfolk.instagram_commands WHERE id='123'"))[0].send_state, 'sent');
  assert.equal(posts, 1);
  await processCommentCommand(comment, 'owned', f.env, db, { fetcher });
  assert.equal(posts, 1, 'Duplicate delivery does not resend a comment reply');
  await q("UPDATE finfolk.instagram_commands SET send_state='pending'");
  f.metadata.scopes = [];
  await assert.rejects(sendCommandReply('123', f.env, db, fetcher), e => e.code === 'content_permission_missing');
  assert.equal((await q("SELECT send_state FROM finfolk.instagram_commands WHERE id='123'"))[0].send_state, 'pending');
  f.metadata.scopes = ['instagram_basic', 'pages_read_engagement', 'instagram_manage_comments'];
  ambiguous = true;
  await sendCommandReply('123', f.env, db, fetcher);
  assert.equal((await q("SELECT send_state FROM finfolk.instagram_commands WHERE id='123'"))[0].send_state, 'uncertain');
  await sendCommandReply('123', f.env, db, fetcher);
  assert.equal(posts, 2, 'Uncertain replies are never automatically resent');
  ambiguous = false;
  await processCommentCommand({...comment,id:'124',media:{...comment.media,owner:{id:'999'}}}, 'mention', f.env, db, {fetcher});
  assert.ok(replyPaths.at(-1).endsWith('/333/mentions'), 'External mentions retain the mention reply route');
  assert.equal((await q("SELECT send_state,owner_id,reply FROM finfolk.instagram_commands WHERE id='124'"))[0].send_state,'sent');
  const publicRow = (await q("SELECT owner_id,reply FROM finfolk.instagram_commands WHERE id='124'"))[0];
  assert.equal(publicRow.owner_id,null);
  assert.ok(!publicRow.reply.includes('/checkin'));
  await processCommentCommand({...comment,id:'125',text:'/publish Bondi @finfolk.com.au'},'owned',f.env,db,{fetcher});
  assert.equal((await q("SELECT command FROM finfolk.instagram_commands WHERE id='125'"))[0].command,'help');
  await processCommentCommand({...comment,id:'126'}, 'mention', f.env, db, {fetcher});
  assert.ok(replyPaths.at(-1).endsWith('/126/replies'), 'A mention on verified brand-owned media must use the owned-comment route');
  assert.equal((await q("SELECT context FROM finfolk.instagram_commands WHERE id='126'"))[0].context,'owned');
  const afterOwnedMention = posts;
  await processCommentCommand({...comment,id:'126'}, 'owned', f.env, db, {fetcher});
  assert.equal(posts,afterOwnedMention,'The second webhook context must not create another reply');
  const beforePause = posts;
  await q("UPDATE finfolk.instagram_commands SET send_state='pending' WHERE id='124'");
  f.env.INSTAGRAM_COMMENT_MODE='paused';
  await sendCommandReply('124',f.env,db,fetcher);
  assert.equal(posts,beforePause);
  assert.equal((await q("SELECT send_state FROM finfolk.instagram_commands WHERE id='124'"))[0].send_state,'skipped');
  f.env.INSTAGRAM_COMMENT_MODE='public';
  await q('DELETE FROM finfolk.instagram_commands');
  f.env.INSTAGRAM_COMMENT_MODE='pilot';
  f.env.INSTAGRAM_COMMENT_TEST_POSTS='888';
  f.env.INSTAGRAM_COMMENT_COMMANDS='help,status,ping,site,privacy';
  let sharedPosts=0, sharedAmbiguous=false, delivered='';
  const sharedFetcher=async(url,options={})=>{
    const authorization=f.authorizationResponse(url,options);if(authorization)return authorization;
    assert.equal(options.method,'POST','Shared comments require no follower/profile API request');
    sharedPosts++; delivered=options.body.get('message');
    assert.ok(!delivered.includes('never-store-this'));
    if(sharedAmbiguous)throw Error('ambiguous fixture send');
    return Response.json({id:'777'});
  };
  const publicQuery=async(sql,values)=>{
    assert.ok(!/instagram_comment_identities|instagram_connections|instagram_connect_codes|finfolk\.checkins/.test(sql),'Shared comment commands must not resolve private identities');
    return q(sql,values);
  };
  const publicDB={query:publicQuery,transaction:fn=>db.transaction(tx=>fn(async(sql,values)=>{
    assert.ok(!/instagram_comment_identities|instagram_connections|instagram_connect_codes|finfolk\.checkins/.test(sql));return tx(sql,values);
  }))};
  let sharedId=500;
  for(const [text,expected] of [
    ['/help',/Available comment commands/],['/menu',/Available comment commands/],['/ping',/Pong!/],
    ['/site',/https:\/\/finfolk.com.au/],['/privacy',/api.finfolk.com.au\/privacy/],
    ['/help account',/in a DM/],['/help diagnostics',/Comment \/ping/],
    ['/connect never-store-this',/in a DM/],['/cancel',/in a DM/],['/disconnect',/in a DM/],
    ['/points',/in a DM/],['/in Bondi',/in a DM/],['/out',/in a DM/],['/status',/post has not been published/],
  ]){
    const incoming={...comment,id:String(sharedId++),text,from:{id:String(sharedId+1000),username:'diver'}};
    const before=sharedPosts;
    await processCommentCommand(incoming,'owned',f.env,publicDB,{fetcher:sharedFetcher});
    assert.equal(sharedPosts,before+1,text); assert.match(delivered,expected);
    const row=(await q('SELECT * FROM finfolk.instagram_commands WHERE id=$1',[incoming.id]))[0];
    assert.equal(row.owner_id,null);assert.equal(row.send_state,'sent');assert.ok(!JSON.stringify(row.args).includes('never-store-this'));
    await processCommentCommand(incoming,'mention',f.env,publicDB,{fetcher:sharedFetcher});
    assert.equal(sharedPosts,before+1,'Owned and mention deliveries cannot repeat a reply');
  }
  const beforeGuards=sharedPosts;
  await processCommentCommand({...comment,id:'600',text:'/ping',media:{id:'889',owner:{id:'333'}}},'owned',f.env,publicDB,{fetcher:sharedFetcher});
  assert.equal(sharedPosts,beforeGuards,'Unapproved pilot posts do not get replies');
  assert.equal(await processCommentCommand({...comment,id:'601',text:'/ping',media:{id:'888',owner:{id:'999'}}},'owned',f.env,publicDB,{fetcher:sharedFetcher}),false,'Request context alone cannot authorize unmentioned commands');
  await processCommentCommand({...comment,id:'602',text:'/ping',from:{id:'333'}},'owned',f.env,publicDB,{fetcher:sharedFetcher});
  assert.equal(sharedPosts,beforeGuards,'Brand echoes are ignored');
  sharedAmbiguous=true;
  await processCommentCommand({...comment,id:'603',text:'/ping'},'owned',f.env,publicDB,{fetcher:sharedFetcher});
  assert.equal((await q("SELECT send_state FROM finfolk.instagram_commands WHERE id='603'"))[0].send_state,'uncertain');
  await sendCommandReply('603',f.env,publicDB,sharedFetcher);
  assert.equal(sharedPosts,beforeGuards+1,'An ambiguous shared-comment reply is never automatically repeated');
  assert.equal((await q('SELECT count(*)::int AS n FROM finfolk.instagram_connect_codes'))[0].n,0,'Public account commands do not issue or cancel codes');
  f.env.INSTAGRAM_COMMENT_MODE='public';
  globalThis.fetch = fetcher;
  await q("UPDATE finfolk.instagram_sources SET status='queued',lease_until=now()+interval '5 minutes' WHERE key='tags'");
  await collectInstagramSource('tags', f.env, q);
  assert.equal((await q("SELECT status FROM finfolk.instagram_sources WHERE key='tags'"))[0].status, 'rate_limited');
  assert.ok(new Date((await q("SELECT backoff_until FROM finfolk.messaging_accounts"))[0].backoff_until) > new Date());
  client = await assert.rejects(instagramContentClient(f.env, q, { fetcher }), e => e.code === 'provider_rate_limited');
  console.log('INSTAGRAM_CONTENT_PASS: managed encrypted Page credentials, app/Page/brand binding, per-capability permissions, safe diagnostics, real SQL comment replies, duplicate and uncertain-send protection, account-wide backoff.');
} finally { globalThis.fetch = originalFetch; await pg.close(); }
