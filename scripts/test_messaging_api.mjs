// Real SQL and real finfolk_api permissions; Meta transport is deliberately mocked.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import SwaggerParser from "@apidevtools/swagger-parser";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { database } from "../backend/db.mjs";
import { createAPI } from "../backend/api.mjs";
import { instagramWebhook } from "../backend/instagram-webhook.mjs";
import {
  processInstagramDM,
  reconcileInstagramDM,
  sendOutbox,
} from "../backend/messaging-engine.mjs";
import { messagingConfig, digest, unseal, idempotent } from "../backend/messaging-config.mjs";
import { followRequiredReply } from '../backend/instagram-dm-commands.mjs';
import { completeMessagingAuthorization } from "../backend/messaging-authorization.mjs";
const project = "odd-voice-85400108",
  branch = "finfolk-community-pilot-test";
const connection = (role) =>
  execFileSync(
    "neon",
    [
      "connection-string",
      branch,
      "--project-id",
      project,
      ...(role ? ["--role-name", role] : []),
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
const url = connection();
assert.ok(
  new URL(url).hostname.startsWith("ep-little-thunder-a7s1soji"),
  "Refusing non-test endpoint",
);
execFileSync(process.execPath, ["scripts/migrate_neon.mjs"], {
  env: { ...process.env, DATABASE_URL_UNPOOLED: url },
  stdio: ["ignore", "pipe", "pipe"],
});
const db = database(url),
  runtime = database(connection("finfolk_api")),
  q = db.query;
const original = (
  await q("SELECT * FROM finfolk.messaging_accounts WHERE id='instagram'")
)[0];
const owner = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  unverified = randomUUID(),
  users = [owner, other, admin, unverified];
const base = String(Date.now()),
  sender = base + "1",
  otherSender = base + "2",
  stranger = base + "3",
  brand = "99999999",
  queued = [],
  replies = [];
const env = {
  INSTAGRAM_ACCOUNT_ID: brand,
  INSTAGRAM_APP_ID: "778",
  INSTAGRAM_APP_SECRET: "fixture-signature",
  INSTAGRAM_VERIFY_TOKEN: "fixture-verify",
  INSTAGRAM_ADMIN_IDS: admin,
  MESSAGING_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  INSTAGRAM_MESSAGING_PROVIDER: "instagram-facebook",
  INSTAGRAM_MESSAGING_PAGE_ID: "222",
  INSTAGRAM_MESSAGING_WEBHOOK_SECRET: "fixture-signature",
  INSTAGRAM_MESSAGING_META_APP_ID: "777",
  INSTAGRAM_MESSAGING_META_APP_SECRET: "fixture-client-secret",
  INSTAGRAM_MESSAGING_GRAPH_VERSION: "v26.0",
  INSTAGRAM_MESSAGING_ACCOUNT_ID: brand,
  INSTAGRAM_QUEUE: {
    send: async (job) => {
      if (queueError) throw Error("queue unavailable");
      queued.push(job);
    },
  },
};
let assignedMissing = false,
  businessExchanges = 0;
let follows = true,
  profileError = false,
  sendFailure = null,
  queueError = false,
  serial = 0,
  profileCalls = 0;
const fetcher = async (input, options = {}) => {
  const url = new URL(input);
  assert.equal(url.hostname,'graph.facebook.com','Only the Facebook Graph transport is supported');
  const ok=data=>({ok:true,status:200,headers:new Headers(),json:async()=>data});
  if(url.pathname.endsWith('/oauth/access_token')){
    if(url.searchParams.has('code'))businessExchanges++;
    return ok({access_token:'fixture-user',expires_in:3600});
  }
  if(url.pathname.endsWith('/debug_token'))return ok({data:{is_valid:true,app_id:env.INSTAGRAM_MESSAGING_META_APP_ID,type:'PAGE',expires_at:0,data_access_expires_at:0,scopes:['instagram_basic','instagram_manage_messages','instagram_manage_comments']}});
  if(url.pathname.endsWith('/me'))return ok({id:env.INSTAGRAM_MESSAGING_PAGE_ID});
  if(url.pathname.endsWith('/'+env.INSTAGRAM_MESSAGING_PAGE_ID)){
    const exchanging=url.searchParams.get('fields')?.includes('access_token');
    return ok({id:env.INSTAGRAM_MESSAGING_PAGE_ID,...(!assignedMissing||exchanging?{instagram_business_account:{id:brand,username:'finfolk.com.au'}}:{}),...(exchanging?{access_token:'fixture-page'}:{})});
  }
  if(url.pathname.endsWith('/subscribed_apps'))return ok(options.method==='POST'?{success:true}:{data:[{id:env.INSTAGRAM_MESSAGING_META_APP_ID,subscribed_fields:['messages','comments','mentions']}]});
  assert.equal(options.headers.Authorization,'Bearer fixture-page');
  assert.ok(!url.href.includes('fixture-page'));
  if (options.method === "POST") {
    const sent = JSON.parse(options.body);
    assert.ok([sender, otherSender, stranger].includes(sent.recipient.id));
    if (sendFailure === "timeout") throw Error("network disconnected");
    if (sendFailure === "rate")
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "1" }),
        json: async () => ({ error: { code: 4 } }),
      };
    if (sendFailure === "server")
      return {
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({
          error: { message: "private provider internals" },
        }),
      };
    replies.push(sent);
    return ok({ message_id: "provider-" + serial++ });
  }
  profileCalls++;
  if (profileError)
    return ok({
      id: url.pathname.split("/").pop(),
      username: "missing.follow",
    });
  return ok({
    id: url.pathname.split("/").pop(),
    username: url.pathname.endsWith("/" + sender)
      ? "chriszfree"
      : "other.diver",
    is_user_follow_business: follows,
  });
};
const app = createAPI({
  db: runtime,
  verify: async (token) => {
    if (!users.includes(token)) throw Error("unauthorized");
    return { sub: token };
  },
  messagingFetch: fetcher,
});
const spec = await SwaggerParser.dereference("docs/openapi/messaging.yaml");
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const contracts = [];
for (const [path, item] of Object.entries(spec.paths))
  for (const method of ["get", "post", "put", "delete"])
    if (item[method])
      contracts.push({
        pattern: new RegExp("^" + path.replaceAll("{id}", "[^/]+") + "$"),
        method,
        operation: item[method],
      });
async function request(
  uid,
  method,
  path,
  input,
  expected = 200,
  key = randomUUID(),
) {
  const headers = {
    ...(uid ? { Authorization: "Bearer " + uid } : {}),
    ...(key ? { "Idempotency-Key": key } : {}),
  };
  if (method !== "GET" && method !== "DELETE")
    headers["Content-Type"] = "application/json";
  const response = await app.request(
    "https://api.test" + path,
    {
      method,
      headers,
      ...(method !== "GET" && method !== "DELETE"
        ? { body: JSON.stringify(input || {}) }
        : {}),
    },
    env,
  );
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  const contract = contracts.find(
    (c) =>
      c.method === method.toLowerCase() && c.pattern.test(path.split("?")[0]),
  );
  const schema =
    contract?.operation.responses[String(expected)]?.content?.[
      "application/json"
    ]?.schema;
  if (schema) {
    const validate = ajv.compile(schema);
    assert.ok(validate(result), JSON.stringify(validate.errors));
  }
  assert.match(result.requestId, /^[a-f0-9-]{36}$/);
  return { data: result.data, error: result.error, response };
}
async function legacy(uid, action, input = {}, expected = 200) {
  const response = await app.request(
    "https://api.test/api",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + uid,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...input }),
    },
    env,
  );
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result.data;
}
async function drain() {
  let loops = 0;
  while (queued.length) {
    assert.ok(loops++ < 100);
    const job = queued.shift();
    if (job.kind === "instagram-dm")
      await processInstagramDM(job.id, env, runtime, { fetcher });
    else if (job.kind === "instagram-dm-reply")
      await sendOutbox(job.id, env, runtime, { fetcher });
  }
}
async function incoming(
  who,
  text,
  {
    mid = "fixture-" + base + "-" + serial++,
    at = Date.now(),
    deliver = true,
  } = {},
) {
  const payload = JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: brand,
        messaging: [
          {
            sender: { id: who },
            recipient: { id: brand },
            timestamp: at,
            message: { mid, text },
          },
        ],
      },
    ],
  });
  const response = await instagramWebhook(
    new Request("https://api.test/instagram/webhook", {
      method: "POST",
      headers: {
        "X-Hub-Signature-256":
          "sha256=" +
          createHmac("sha256", env.INSTAGRAM_APP_SECRET)
            .update(payload)
            .digest("hex"),
      },
      body: payload,
    }),
    env,
    runtime.query,
  );
  assert.equal(response.status, 200);
  if (deliver) await drain();
  const config = await messagingConfig(q, env);
  return (
    await q("SELECT * FROM finfolk.instagram_dm_events WHERE id=$1", [
      "dm:" + config.scope + ":" + mid,
    ])
  )[0];
}
const event = async (id) =>
  (await q("SELECT * FROM finfolk.instagram_dm_events WHERE id=$1", [id]))[0];
const outbox = async (id) =>
  (
    await q("SELECT * FROM finfolk.messaging_outbox WHERE event_id=$1", [id])
  )[0];
async function rollout(enabledCommands, acceptance, mode = "pilot") {
  return (
    await request(admin, "PUT", "/v1/admin/messaging/instagram", {
      mode,
      enabledCommands,
      pilotSenderIds: [sender, otherSender],
      ...(acceptance ? { acceptance } : {}),
    })
  ).data;
}
try {
  await q(
    "UPDATE finfolk.messaging_accounts SET account_id=null,username=null,credential_ciphertext=null,token_expires_at=null,mode='disabled',enabled_commands='[\"ping\",\"help\"]',pilot_sender_ids='[]',checks='{}',generation=generation+1,provider_scope=null,backoff_until=null WHERE id='instagram'",
  );
  for (const uid of users) {
    await q(
      'INSERT INTO neon_auth."user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,$4,now(),now())',
      [uid, "Messaging fixture", uid + "@example.com", uid !== unverified],
    );
    await legacy(uid, "me");
  }
  await request(null, "GET", "/v1/me/instagram", null, 401);
  await request(owner, "GET", "/v1/admin/messaging/instagram", null, 403);
  const missingKey = await request(
    owner,
    "PUT",
    "/v1/me/instagram/profile",
    { handle: "@chriszfree" },
    400,
    null,
  );
  assert.equal(missingKey.error.code, "idempotency_key_required");
  await request(
    owner,
    "PUT",
    "/v1/me/instagram/profile",
    { handle: "https://example.com/user" },
    400,
  );
  await request(owner, "PUT", "/v1/me/instagram/profile", {
    handle: "@chriszfree",
  });
  assert.equal(
    (await request(owner, "GET", "/v1/me/instagram")).data.profileUrl,
    "https://www.instagram.com/chriszfree/",
  );
  assert.equal((await legacy(owner, "me")).profile.open, false);
  assert.equal(
    (await request(admin, "GET", "/v1/admin/messaging/instagram")).data.ready,
    false,
  );
  const paused = await incoming(sender, "/ping");
  assert.equal(paused.processing_state, "paused");
  assert.equal(replies.length, 0);
  await incoming(otherSender, "/help");
  const auth = (
    await request(
      admin,
      "POST",
      "/v1/admin/messaging/instagram/authorization",
      {},
    )
  ).data;
  const state = new URL(auth.authorizationUrl).searchParams.get("state");
  const callback = await app.request(
    "https://api.test/v1/integrations/instagram/oauth/callback?state=" +
      state +
      "&code=fixture-code",
    {},
    env,
  );
  assert.equal(callback.status, 303, await callback.text());
  const replay = await app.request(
    "https://api.test/v1/integrations/instagram/oauth/callback?state=" +
      state +
      "&code=fixture-code",
    {},
    env,
  );
  assert.equal(replay.status, 400);
  assert.ok(
    !(
      await q(
        "SELECT credential_ciphertext FROM finfolk.messaging_accounts WHERE id='instagram'",
      )
    )[0].credential_ciphertext.includes("fixture-page"),
  );
  await rollout(["ping", "help"]);
  await drain();
  assert.equal(replies.length, 0, "Paused receipts must never be replayed");
  const beforePing = profileCalls,
    ping = await incoming(sender, "/ping");
  assert.equal((await event(ping.id)).processing_state, "completed");
  assert.match(replies.at(-1).message.text, /^Pong\. Reference:/);
  assert.equal((await outbox(ping.id)).state, "provider_accepted");
  assert.equal(
    profileCalls - beforePing,
    0,
    "Public assistance makes no follower-profile calls",
  );
  const help = await incoming(sender, "/help");
  assert.match(replies.at(-1).message.text, /\/ping/);
  assert.ok(
    !replies.at(-1).message.text.includes("/checkin"),
    "Help lists only enabled commands",
  );
  const count = replies.length;
  await incoming(sender, "/ping", { mid: ping.id.split(":").at(-1) });
  assert.equal(replies.length, count, "Duplicate webhook must not reply twice");
  const strangerEvent = await incoming(stranger, "/ping");
  assert.equal((await event(strangerEvent.id)).error, "rollout_restricted");
  follows = false;
  const unfollowed = await incoming(sender, "/ping");
  assert.equal((await event(unfollowed.id)).processing_state, "completed");
  assert.equal(replies.length, count + 1);
  assert.equal(unfollowed.follow_checked_at, null);
  profileError = true;
  await incoming(sender, "/help");
  profileError = false;
  assert.match(replies.at(-1).message.text, /You don’t need to follow/);
  follows = true;
  const acceptance = {
    pingEventId: ping.event_id,
    helpEventId: help.event_id,
    visibleRepliesConfirmed: true,
    productionAccessConfirmed: false,
    nonFollowerTestConfirmed: false,
  };
  const all = ["ping", "help", "connect", "status", "checkin", "points"];
  await rollout(all, acceptance);
  await incoming(sender, "/status"); // Personal pilot proves follower lookup before issuing claim codes.
  await request(
    admin,
    "PUT",
    "/v1/admin/messaging/instagram",
    { mode: "live", enabledCommands: all, pilotSenderIds: [] },
    409,
  );
  await request(unverified, "POST", "/v1/me/instagram/connect", {code:'ABCDEFGH'}, 403);
  const legacyKey=randomUUID();
  await idempotent({db:runtime,uid:owner,key:legacyKey,method:'POST',path:'/v1/me/instagram/claims',body:{},env},async()=>({data:{command:'/claim '+ 'a'.repeat(24)},status:201}));
  const retired=await request(owner,'POST','/v1/me/instagram/claims',{},410,legacyKey);
  assert.equal(retired.error.code,'claim_retired','Old cached responses cannot reactivate claim creation');
  const oldClaim=await incoming(sender,'/claim '+ 'a'.repeat(24));
  assert.match(replies.at(-1).message.text,/retired.*\/connect/);
  assert.equal((await event(oldClaim.id)).challenge_hash,null);
  follows=false;
  const followClaim=await incoming(sender,'/connect');
  assert.equal((await event(followClaim.id)).error,'not_following');
  assert.equal((await outbox(followClaim.id)).body,followRequiredReply);
  follows=true;
  await q("INSERT INTO finfolk.invitation_joins(invitee_id,inviter_id) VALUES($1,$2)",[owner,admin]);
  const codeFrom=async e=>unseal((await outbox(e.id)).body_ciphertext,env,'connect:'+e.id).body.match(/code: ([A-Z0-9]{4}) ([A-Z0-9]{4})/).slice(1).join('');
  const issued=await incoming(sender,'/connect'),code=await codeFrom(issued),connectKey=randomUUID();
  const connected=await Promise.all([request(owner,'POST','/v1/me/instagram/connect',{code},200,connectKey),request(owner,'POST','/v1/me/instagram/connect',{code},200,connectKey)]);
  assert.deepEqual(connected[0].data,connected[1].data);
  assert.equal((await request(owner,'GET','/v1/me/instagram')).data.verification,'verified');
  assert.equal((await legacy(owner,'me')).profile.open,false);
  await request(owner,'PUT','/v1/me/instagram/profile',{handle:'@someone.else'},409);
  await incoming(sender, "/status");
  assert.match(replies.at(-1).message.text, /chriszfree.*connected/);
  await incoming(sender, "/points");
  assert.match(replies.at(-1).message.text, /total/);
  follows = false;
  const pointCount = replies.length;
  const nonfollowerPoints = await incoming(sender, "/points");
  assert.equal(replies.length, pointCount + 1);
  assert.equal(replies.at(-1).message.text, followRequiredReply);
  assert.equal((await event(nonfollowerPoints.id)).error, "not_following");
  assert.ok(!replies.at(-1).message.text.includes('total'));
  const checkinsBefore = (await legacy(owner, 'myCheckins')).length;
  const deniedCheckin = await incoming(sender, '/checkin Bondi Beach');
  assert.equal((await event(deniedCheckin.id)).processing_state, 'blocked');
  assert.equal((await legacy(owner, 'myCheckins')).length, checkinsBefore);
  assert.equal(replies.at(-1).message.text, followRequiredReply);
  sendFailure = 'rate';
  const heldGuidance = await incoming(sender, '/status');
  sendFailure = null;
  assert.equal((await outbox(heldGuidance.id)).state, 'pending');
  await q("UPDATE finfolk.messaging_accounts SET backoff_until=null WHERE id='instagram'");
  await q("UPDATE finfolk.messaging_outbox SET body='Private member result',next_attempt_at=now()-interval '1 second' WHERE event_id=$1", [heldGuidance.id]);
  const beforeTampered = replies.length;
  await sendOutbox((await outbox(heldGuidance.id)).id, env, runtime, { fetcher });
  assert.equal((await outbox(heldGuidance.id)).state, 'cancelled');
  assert.equal(replies.length, beforeTampered, 'The nonfollower reply exception cannot send arbitrary/private content');
  follows = true;
  await incoming(sender, "/checkin Bondi Beach");
  assert.match(replies.at(-1).message.text, /Checked in/);
  await incoming(sender, "/checkin Bondi Beach");
  assert.match(replies.at(-1).message.text, /already checked in/);
  assert.equal((await legacy(owner, "myCheckins")).length, 1);
  profileError=true;
  const failed=await incoming(otherSender,'/connect');
  profileError=false;
  assert.equal((await event(failed.id)).processing_state,'failed');
  await request(admin,'POST','/v1/admin/messaging/events/'+failed.event_id+'/retry',{},202);
  await reconcileInstagramDM(env, runtime.query);
  await drain();
  const otherCode=await codeFrom(failed);
  await request(other,'POST','/v1/me/instagram/connect',{code:otherCode});
  await request(admin,'POST','/v1/admin/messaging/claim-reviews/'+randomUUID()+'/decision',{decision:'approve'},410);
  await request(owner,'POST','/v1/me/instagram/claims/'+randomUUID()+'/review-request',{},410);
  sendFailure = "timeout";
  const uncertain = await incoming(sender, "/points");
  sendFailure = null;
  assert.equal((await outbox(uncertain.id)).state, "uncertain");
  const sentBefore = replies.length;
  await processInstagramDM(uncertain.id, env, runtime, { fetcher });
  assert.equal(replies.length, sentBefore);
  await request(
    admin,
    "POST",
    "/v1/admin/messaging/events/" + uncertain.event_id + "/retry",
    {},
    409,
  );
  sendFailure = "rate";
  const limited = await incoming(sender, "/ping");
  sendFailure = null;
  assert.equal((await outbox(limited.id)).state, "pending");
  const backedOffCalls = profileCalls,
    backedOff = await incoming(sender, "/help");
  assert.equal((await event(backedOff.id)).error, "provider_backoff");
  assert.equal(
    profileCalls,
    backedOffCalls,
    "Account backoff prevents further provider calls",
  );
  await q(
    "UPDATE finfolk.messaging_accounts SET backoff_until=null WHERE id='instagram'",
  );
  await q(
    "UPDATE finfolk.messaging_outbox SET next_attempt_at=now()-interval '1 second' WHERE event_id=$1",
    [limited.id],
  );
  await sendOutbox((await outbox(limited.id)).id, env, runtime, { fetcher });
  assert.equal((await outbox(limited.id)).state, "provider_accepted");
  sendFailure = "server";
  const ambiguous = await incoming(sender, "/ping");
  sendFailure = null;
  assert.equal((await outbox(ambiguous.id)).state, "uncertain");
  const past = await incoming(sender, "/ping", { at: Date.now() - 90000000 });
  assert.equal((await event(past.id)).error, "message_expired");
  const future = await incoming(sender, "/help", { at: Date.now() + 600000 });
  assert.equal((await event(future.id)).error, "message_expired");
  queueError = true;
  const stranded = await incoming(sender, "/ping");
  queueError = false;
  assert.equal(stranded.processing_state, "received");
  await reconcileInstagramDM(env, runtime.query);
  await drain();
  assert.equal((await outbox(stranded.id)).state, "provider_accepted");
  const interrupted = await incoming(sender, "/ping", { deliver: false });
  await q(
    "UPDATE finfolk.instagram_dm_events SET processing_state='processing',lease=$2,updated_at=now()-interval '3 minutes' WHERE id=$1",
    [interrupted.id, randomUUID()],
  );
  await reconcileInstagramDM(env, runtime.query);
  await drain();
  assert.equal(
    (await outbox(interrupted.id)).state,
    "provider_accepted",
    "Interrupted command lease is recovered once",
  );
  const interruptedCount = replies.length;
  await q(
    "UPDATE finfolk.messaging_outbox SET state='sending',lease=$2,updated_at=now()-interval '3 minutes' WHERE event_id=$1",
    [interrupted.id, randomUUID()],
  );
  await reconcileInstagramDM(env, runtime.query);
  await drain();
  assert.equal((await outbox(interrupted.id)).state, "uncertain");
  assert.equal(
    replies.length,
    interruptedCount,
    "Interrupted delivery must never be resent",
  );
  const diagnostic = (
    await request(admin, "GET", "/v1/admin/messaging/events/" + ping.event_id)
  ).data;
  assert.equal(diagnostic.reply.state, "provider_accepted");
  assert.ok(!JSON.stringify(diagnostic).includes("challenge_hash"));
  assert.ok(!Object.hasOwn(diagnostic, "args"));
  const page = (
    await request(admin, "GET", "/v1/admin/messaging/events?limit=1")
  ).data;
  assert.equal(page.events.length, 1);
  assert.ok(page.nextCursor);
  await request(
    admin,
    "GET",
    "/v1/admin/messaging/events?limit=1&cursor=" + page.nextCursor,
  );
  await request(
    admin,
    "GET",
    "/v1/admin/messaging/events?cursor=broken",
    null,
    400,
  );
  const notSigned = await instagramWebhook(
    new Request("https://api.test/instagram/webhook", {
      method: "POST",
      body: "{}",
    }),
    env,
    runtime.query,
  );
  assert.equal(notSigned.status, 403);
  const promptBefore = replies.length;
  await incoming(sender, "hello");
  await incoming(sender, "another arbitrary private message");
  assert.equal(replies.length, promptBefore + 1);
  const rateKey = digest((await messagingConfig(q, env)).scope + ":" + sender);
  await q(
    "UPDATE finfolk.instagram_dm_limits SET minute=date_trunc('minute',now()),count=30 WHERE sender_id=$1",
    [rateKey],
  );
  const rate = await incoming(sender, "/ping");
  assert.equal((await event(rate.id)).error, "sender_rate_limit");
  await q("DELETE FROM finfolk.instagram_dm_limits WHERE sender_id=$1", [
    rateKey,
  ]);
  const pending = await incoming(sender, "/points", { deliver: false });
  await request(owner, "DELETE", "/v1/me/instagram");
  await drain();
  assert.equal((await event(pending.id)).processing_state, "blocked");
  assert.equal(
    (await request(owner, "GET", "/v1/me/instagram")).data.profileUrl,
    "",
  );
  const oldCount = replies.length;
  await incoming(sender,'/claim '+ 'a'.repeat(24));
  assert.match(replies.at(-1).message.text,/retired.*\/connect/);
  assert.equal(replies.length,oldCount+1);
  const fresh=await incoming(sender,'/connect');
  await request(owner,'POST','/v1/me/instagram/connect',{code:await codeFrom(fresh)});
  assert.equal((await request(owner,'GET','/v1/me/instagram')).data.verification,'verified');
  assert.equal(
    (
      await q(
        "SELECT count(*)::int AS n FROM finfolk.invitation_joins WHERE invitee_id=$1 AND rewarded_at IS NOT NULL",
        [owner],
      )
    )[0].n,
    1,
    "Reclaim cannot duplicate referral rewards",
  );
  await legacy(owner, "deleteAccount");
  assert.equal(
    (
      await q(
        "SELECT count(*)::int AS n FROM finfolk.instagram_dm_events WHERE owner_id=$1",
        [owner],
      )
    )[0].n,
    0,
  );
  assert.equal(
    (
      await q(
        "SELECT count(*)::int AS n FROM finfolk.messaging_idempotency WHERE user_id=$1",
        [owner],
      )
    )[0].n,
    0,
  );
  await request(admin, "PUT", "/v1/admin/messaging/instagram", {
    mode: "disabled",
    enabledCommands: ["ping", "help"],
    pilotSenderIds: [],
  });
  // Reconnect the same Page pathway with a changed Meta app binding.
  env.INSTAGRAM_MESSAGING_PROVIDER = "instagram-facebook";
  env.INSTAGRAM_MESSAGING_META_APP_ID = "778";
  env.INSTAGRAM_MESSAGING_PAGE_ID = "222";
  let pageReconnectAuth = await request(
    admin,
    "POST",
    "/v1/admin/messaging/instagram/authorization",
    {},
  );
  const pageReconnectURL = new URL(pageReconnectAuth.data.authorizationUrl);
  assert.equal(pageReconnectURL.hostname, "www.facebook.com");
  assert.equal(pageReconnectURL.searchParams.get("client_id"), "778");
  assert.equal(pageReconnectURL.searchParams.has("config_id"), false);
  assert.ok(pageReconnectURL.searchParams.get("scope").includes("instagram_manage_comments"));
  env.INSTAGRAM_MESSAGING_PAGE_ID = "223";
  let staleAuth = await app.request(
    "/v1/integrations/instagram/oauth/callback?code=fixture-code&state=" +
      pageReconnectURL.searchParams.get("state"),
    {},
    env,
  );
  assert.equal(
    staleAuth.status,
    400,
    "Changing the configured Page invalidates the old authorization",
  );
  env.INSTAGRAM_MESSAGING_PAGE_ID = "222";
  await q(
    "UPDATE finfolk.messaging_accounts SET account_id=null,username=null,credential_ciphertext=null,token_expires_at=null,provider_scope=null,checks='{}',mode='disabled' WHERE id='instagram'",
  );
  assignedMissing = true;
  const pendingAuth = await request(
    admin,
    "POST",
    "/v1/admin/messaging/instagram/authorization",
    {},
  );
  const pendingCallback = await app.request(
    "/v1/integrations/instagram/oauth/callback?code=fixture-code&state=" +
      new URL(pendingAuth.data.authorizationUrl).searchParams.get("state"),
    {},
    env,
  );
  assert.equal(pendingCallback.status, 409);
  const pendingConfig = await messagingConfig(q, env, { credentials: true });
  assert.equal(pendingConfig.token, "fixture-page");
  assert.equal(pendingConfig.checks.pendingVerification, true);
  assert.equal(pendingConfig.checks.authorization, false);
  assert.equal(pendingConfig.mode, "disabled");
  assert.ok(!pendingConfig.credential_ciphertext.includes("fixture-page"));
  const exchangeCount = businessExchanges;
  await assert.rejects(
    () =>
      completeMessagingAuthorization(
        runtime,
        env,
        {
          token: pendingConfig.token,
          expiresAt: null,
          tokenKind: "facebook-page",
        },
        admin,
        randomUUID(),
        { fetcher, expectedCredential: pendingConfig.credential_ciphertext },
      ),
    /Meta returned 0/,
  );
  assignedMissing = false;
  await assert.rejects(
    () =>
      completeMessagingAuthorization(
        runtime,
        { ...env, INSTAGRAM_MESSAGING_ACCOUNT_ID: "1234" },
        { token: pendingConfig.token, expiresAt: null },
        admin,
        randomUUID(),
        { fetcher, expectedCredential: pendingConfig.credential_ciphertext },
      ),
    (error) => error.code === "wrong_brand_account",
  );
  await completeMessagingAuthorization(
    runtime,
    env,
    {
      token: pendingConfig.token,
      expiresAt: null,
      tokenKind: "facebook-page",
    },
    admin,
    randomUUID(),
    { fetcher, expectedCredential: pendingConfig.credential_ciphertext },
  );
  assert.equal(
    businessExchanges,
    exchangeCount,
    "Verification recovery reuses the approved encrypted grant without another OAuth exchange",
  );
  const recovered = await messagingConfig(q, env);
  assert.equal(recovered.checks.authorization, true);
  assert.equal(recovered.checks.subscription, true);
  assert.equal(recovered.checks.pendingVerification, undefined);
  assert.equal(recovered.mode, "disabled");
  assignedMissing = true;
  const reconnect = await request(
    admin,
    "POST",
    "/v1/admin/messaging/instagram/authorization",
    {},
  );
  const failedReconnect = await app.request(
    "/v1/integrations/instagram/oauth/callback?code=fixture-code&state=" +
      new URL(reconnect.data.authorizationUrl).searchParams.get("state"),
    {},
    env,
  );
  assert.equal(failedReconnect.status, 409);
  assert.equal(
    (await messagingConfig(q, env)).credential_ciphertext,
    recovered.credential_ciphertext,
    "Failed reconnect preserves the verified credential",
  );
  assignedMissing = false;
  pageReconnectAuth = await request(
    admin,
    "POST",
    "/v1/admin/messaging/instagram/authorization",
    {},
  );
  const pageReconnectState = new URL(
    pageReconnectAuth.data.authorizationUrl,
  ).searchParams.get("state");
  const pageReconnectCallback = await app.request(
    "/v1/integrations/instagram/oauth/callback?code=fixture-code&state=" +
      pageReconnectState,
    {},
    env,
  );
  assert.equal(pageReconnectCallback.status, 303);
  const pageReconnectConfig = await messagingConfig(q, env, { credentials: true });
  assert.equal(pageReconnectConfig.provider, "instagram-facebook");
  assert.equal(pageReconnectConfig.scope, "instagram-facebook:778:" + brand);
  assert.equal(pageReconnectConfig.token, "fixture-page");
  assert.equal(pageReconnectConfig.token_expires_at, null);
  assert.equal(pageReconnectConfig.mode, "disabled");
  follows = true;
  await incoming(sender, "/ping");
  await incoming(otherSender, "/help");
  await rollout(["ping", "help"]);
  const pageReconnectBefore = replies.length;
  const pageReconnectPing = await incoming(sender, "/ping");
  assert.equal(pageReconnectPing.processing_state, "completed");
  assert.match(replies.at(-1).message.text, /^Pong\. Reference:/);
  assert.equal((await outbox(pageReconnectPing.id)).state, "provider_accepted");
  await incoming(sender, "/ping", { mid: pageReconnectPing.id.split(":").at(-1) });
  assert.equal(
    replies.length,
    pageReconnectBefore + 1,
    "Page duplicates reply only once",
  );
  await incoming(sender, "/help");
  assert.match(replies.at(-1).message.text, /\/ping/);
  follows = false;
  const pageReconnectPublicHelp = await incoming(otherSender, "/help");
  assert.equal(
    replies.length,
    pageReconnectBefore + 3,
    "Unified nonfollowers can receive public help",
  );
  assert.equal(pageReconnectPublicHelp.processing_state, "completed");
  assert.equal(pageReconnectPublicHelp.follow_checked_at, null);
  assert.equal(
    Buffer.byteLength(replies.at(-1).message.text, "utf8") < 900,
    true,
  );
  await request(
    admin,
    "PUT",
    "/v1/admin/messaging/instagram",
    {
      mode: "live",
      enabledCommands: ["help", "ping"],
      pilotSenderIds: [],
      acceptance: {
        pingEventId: pageReconnectPing.event_id,
        helpEventId: pageReconnectPing.event_id,
        visibleRepliesConfirmed: true,
        productionAccessConfirmed: true,
        nonFollowerTestConfirmed: true,
        nonFollowerHelpEventId: pageReconnectPublicHelp.event_id,
      },
    },
    409,
  );
  await request(admin, "PUT", "/v1/admin/messaging/instagram", {
    mode: "live",
    enabledCommands: ["help", "ping"],
    pilotSenderIds: [],
    acceptance: {
      pingEventId: pageReconnectPing.event_id,
      helpEventId: (await incoming(sender, "/help")).event_id,
      visibleRepliesConfirmed: true,
      productionAccessConfirmed: true,
      nonFollowerTestConfirmed: true,
      nonFollowerHelpEventId: pageReconnectPublicHelp.event_id,
    },
  });
  const publicReady = (
    await request(admin, "GET", "/v1/admin/messaging/instagram")
  ).data;
  assert.equal(publicReady.ready, true);
  assert.equal(publicReady.checks.publicHelp, true);
  assert.notEqual(publicReady.checks.followLookup, true);
  assert.notEqual(
    publicReady.checks.nonFollowerTest,
    true,
    "Public acceptance cannot attest personal-command rejection",
  );
  await request(
    admin,
    "PUT",
    "/v1/admin/messaging/instagram",
    { mode: "live", enabledCommands: ["help", "points"], pilotSenderIds: [] },
    409,
  );
  profileError = true;
  const publicFresh = await incoming(stranger, "/help");
  assert.equal(publicFresh.processing_state, "completed");
  assert.equal(publicFresh.owner_id, null);
  profileError = false;

  console.log(
    "PAGE_MESSAGING_SQL_PASS: actual role, Meta code exchange, configured Page binding, subscription, encrypted scoped credentials and changed-configuration OAuth rejection.",
  );
  console.log(
    "MESSAGING_SQL_API_PASS: isolated migration, actual Worker role, OpenAPI response validation, OAuth, encrypted idempotency, owner/admin boundaries, durable receipts, follower gates, claims/reviews, commands, queue recovery, outbox uncertainty, rollout cancellation and account-deletion cleanup.",
  );
} finally {
  for (const uid of users) {
    await q("DELETE FROM finfolk.instagram_dm_events WHERE owner_id=$1", [uid]);
    await q("DELETE FROM finfolk.messaging_audit WHERE actor=$1", [uid]);
    await q("DELETE FROM finfolk.members WHERE user_id=$1", [uid]);
    await q('DELETE FROM neon_auth."user" WHERE id=$1', [uid]);
  }
  for (const who of [sender, otherSender, stranger]) {
    await q("DELETE FROM finfolk.instagram_dm_events WHERE sender_id=$1", [
      who,
    ]);
    await q("DELETE FROM finfolk.instagram_dm_limits WHERE sender_id=$1", [
      digest("instagram-facebook:777:" + brand + ":" + who),
    ]);
  }
  await q(
    `UPDATE finfolk.messaging_accounts SET account_id=$1,username=$2,credential_ciphertext=$3,token_expires_at=$4,mode=$5,enabled_commands=$6::jsonb,pilot_sender_ids=$7::jsonb,generation=$8,checks=$9::jsonb,last_webhook_at=$10,last_command_at=$11,last_reply_at=$12,provider_scope=$13,backoff_until=$14 WHERE id='instagram'`,
    [
      original.account_id,
      original.username,
      original.credential_ciphertext,
      original.token_expires_at,
      original.mode,
      JSON.stringify(original.enabled_commands),
      JSON.stringify(original.pilot_sender_ids),
      original.generation,
      JSON.stringify(original.checks),
      original.last_webhook_at,
      original.last_command_at,
      original.last_reply_at,
      original.provider_scope,
      original.backoff_until,
    ],
  );
  await db.pool.end();
  await runtime.pool.end();
}
