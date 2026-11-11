# Entity messaging rollout and acceptance

> Fresh-rebuild direction: the user requires regeneration from the Clojure
> definitions, followed by seed and depth/geo/ocean imports. The additive migration
> proposal is superseded. See [DATABASE_REBUILD.md](DATABASE_REBUILD.md#fresh-rebuild-and-data-import-plan).
> The provisioning instructions below describe the existing implementation and
> must be reconciled with the new release/import command before cutover.

## Verified code and live status

The reusable native protocol, provider transports, authorization store, browser
OAuth state, gateway, application handler registry and API Worker registration
are implemented. Local PostgreSQL tests use synthetic tokens and injected
provider HTTP responses. They prove integration behavior, not live entitlement
or delivery. No provider account, subscription, production database, DNS, route
or deployment was changed by this work.

Live Instagram acceptance is pending. TikTok Business Messaging approval,
Advanced Access and an authorized account are unconfirmed. The existing TikTok
profile/video-import authorization does not establish messaging access.

The FinFolk developer app now shows **Approved** in the TikTok Business portal
(app ID `7703991919769632789`, inspected in Dia). Its displayed permission scope
contains one ad-account permission; searching for `/business/message/` returns no
entries, including in the permission-request editor. App verification does not
prove Business Messaging entitlement. The separate
[Business Messaging access guide](https://business-api.tiktok.com/portal/docs/access-to-business-messaging-api/v1.3)
requires the data-security/privacy review and directs applicants to the
[intake form](https://bytedance.sg.larkoffice.com/share/base/form/shrlg7vFArGhg9V20neYCEwIKrb).
The guide says review tracking is managed manually through email rather than the
app dashboard; it estimates review initiation within ten working days after
submission. The intake form was opened, but no application was submitted and no
review approval is established.

An isolated Neon child branch `finfolk-messaging` (`br-still-haze-a7z7c3m7`) and
fresh database `finfolk_messaging` now exist in the existing FinFolk project. The
parent is the schema-only test branch, chosen after the root-branch limit blocked
another schema-only root. The native schema is **not installed**: the supported
managed-auth enable command returns `permission denied for database
finfolk_messaging`. Direct owner connections work; the managed auth user table is
absent. A temporary database CREATE grant to the managed auth role did not resolve
provisioning and was revoked. Do not fabricate the managed-auth table to bypass
the fresh-schema guard. Installation waits for successful managed-auth
provisioning. Private connection details and the verified status are retained
under the ignored `.cache/entity-messaging/` directory. No serving database,
production route or native Worker feature flag was changed.

The initial Worker handler exposes `/ping` and `/help`. Personal operations are
not registered in that deployment. Applications can register trusted command
functions with `createFinFolkMessagingHandler`; its identity policy requires an
explicit identity link, verified active local user, and provider eligibility.
Instagram follower eligibility must be supplied by the application before any
personal Instagram command is registered. Message/model text cannot register
handlers or execute SQL. The old domain commands remain on the historical path.

Local validation completed on 2026-11-05: generation/parity, full database and
repository tests, focused messaging tests, production build and the API Worker
dry-run bundle pass. Restricted-role OAuth and signed-JWT Worker access are
included. Frozen historical SQL artifacts remain byte-identical.

## Provision a separate native database

1. Create an isolated database with managed `neon_auth."user"` and the required
   server-side authentication configuration. Provision `finfolk_api NOLOGIN` as
   required by the fresh-schema guard. Use a separate server login for messaging.
2. Review and explicitly apply `resources/finfolkdb/entity-schema.sql` to that
   empty database. It refuses existing application schemas. This file is a fresh
   schema, not an upgrade or a data migration. Never apply it to `finfolk_next`,
   a running legacy database, or as part of generation/deployment automatically.
3. Review and explicitly apply `resources/finfolkdb/messaging-grants.sql` there.
   It grants only messaging table operations, messaging helper execution and
   selected authentication columns to the server-only `finfolk_messaging` role.
   Grant that role to the dedicated connection login. Do not grant it to
   `finfolk_api`, a browser role, or any untrusted principal. These are invoker
   functions: the Worker connection needs the table privileges too. Additional
   domain commands need their own reviewed, narrow permissions.
4. Seed `MessagingApplication` and disabled `MessagingAccount` records explicitly.
   Account `id` is the local key; `account_id` is the provider's external account
   identifier. Match both to trusted connection configuration. Provision active
   native `User` rows linked to the managed identities that will use chat or
   operate connections. No automatic legacy identity/data migration is included.
5. Create a distinct Hyperdrive binding `ENTITY_MESSAGING_HYPERDRIVE`. Its
   database name must equal `ENTITY_MESSAGING_DATABASE_NAME` and differ from the
   historical `finfolk_next`. The native gateway checks the actual database and
   required native functions. SQL installation is never part of readiness.

The schema and grants are authored in Clojure and published by `make generate-db`.
Keep a reviewed backup and record the exact artifact hash before manual install.
Fresh installations require no changes to historical migrations or pilot SQL.

## Trusted Worker configuration

The checked-in `ENTITY_MESSAGING_ENABLED` remains `false`. Supply the separate
bindings below in a reviewed deployment configuration before turning it on:

- `ENTITY_MESSAGING_DATABASE_NAME` and `ENTITY_MESSAGING_HYPERDRIVE`.
- `ENTITY_MESSAGING_AUTH_BASE_URL` and `ENTITY_MESSAGING_AUTH_JWKS_URL`, both HTTPS
  and belonging to the native managed identity service. The managed verifier
  checks EdDSA signatures, issuer and time claims. Access additionally requires
  a current, verified, non-banned, non-deleted local user.
- `ENTITY_MESSAGING_API_ORIGIN`, normally `https://api.finfolk.com.au`.
- `ENTITY_MESSAGING_CONFIG`, deployment-owned JSON as illustrated below. Operator
  IDs are explicit per application; callbacks recheck this authority and user
  status. Registered applications share the native managed user directory for
  chat. Use an injected application authorization policy if a separate membership
  model is required; the default does not infer organization membership.
- `MESSAGING_ENCRYPTION_KEY`, a base64-encoded 32-byte secret; provider secrets and
  verification tokens in the environment bindings referenced by the JSON.
- `ENTITY_MESSAGING_QUEUE`, a dedicated producer binding, with a consumer invoking
  this Worker's `queue` handler. Configure bounded retries and a dead-letter
  queue. Retain the minute cron to reconcile durable work and refresh credentials.
  Queue bodies contain only `{kind:"entity-messaging",connectionKey:"..."}`;
  only registered keys and trusted handlers can run.

Example configuration (replace placeholder values; secrets stay outside JSON):

```json
{
  "applications": [{"id":"finfolk","administrators":["managed-user-id"]}],
  "allowedOrigins": ["https://finfolk.com.au"],
  "apps": [
    {"key":"instagram","provider":"instagram","appId":"registered-app-id","secretEnv":"ENTITY_INSTAGRAM_APP_SECRET","verifyTokenEnv":"ENTITY_INSTAGRAM_VERIFY_TOKEN"},
    {"key":"tiktok","provider":"tiktok","appId":"registered-client-key","secretEnv":"ENTITY_TIKTOK_APP_SECRET"}
  ],
  "connections": [
    {"key":"instagram","application":"finfolk","account":"finfolk-instagram","providerApp":"instagram","accountId":"numeric-instagram-account-id","authMethod":"instagram-facebook","pageId":"numeric-facebook-page-id","graphVersion":"v26.0","replyWindowSeconds":86400,"returnURL":"https://finfolk.com.au/?view=account","handler":"finfolk"},
    {"key":"tiktok","application":"finfolk","account":"finfolk-tiktok","providerApp":"tiktok","accountId":"business-open-id","accountAuthorizationURL":"https://www.tiktok.com/v2/auth/authorize?client_key=registered-client-key","replyWindowSeconds":172800,"returnURL":"https://finfolk.com.au/?view=account","handler":"finfolk"},
    {"key":"chat","application":"finfolk","account":"finfolk-chat","provider":"app","accountId":"finfolk-chat","handler":"finfolk"}
  ]
}
```

Use the actual TikTok account-holder authorization URL copied from its developer
portal; the example is a shape, not a replacement for that URL. Provider windows,
Graph versions, access scopes and account eligibility must be checked against the
current provider contract during activation. Instagram Page/Unified variants need
the corresponding configured `authMethod`, Page/login-config fields and verified
app binding. `subscribeOnAuthorization:true` explicitly permits subscription
creation; omission only verifies the existing subscription.

App-level signed webhooks are `/v1/messaging/webhooks/:appKey`. Provider-registered
OAuth redirects are `/v1/messaging/connections/:key/oauth/callback`. Configure the
exact callback with each developer app. These are separate from historical routes.
No payload may select arbitrary local application/account IDs.

## Read-only connection preflight

Once the native database and grants exist, copy the trusted Worker configuration
and secret bindings into a local, ignored environment file. Also set
`ENTITY_MESSAGING_DATABASE_URL` to the dedicated server connection and
`ENTITY_MESSAGING_DATABASE_NAME` to its exact native database name. The command
refuses `finfolk_next`, an unexpected database path, unregistered keys, or disabled
configuration before it connects. It never prints connection URLs or raw errors.

```sh
node --env-file=.env.messaging.local scripts/messaging_preflight.mjs
node --env-file=.env.messaging.local scripts/messaging_preflight.mjs --connection=tiktok --verify-providers
```

Without `--verify-providers`, it checks native readiness and configured account
bindings only; `provider_unchecked` does not establish provider access. With that
flag, it reads the existing encrypted grant, checks its app/method/generation and
expiry, and calls the configured provider verifier with subscription creation
explicitly disabled. It checks account identity, permissions/entitlement and the
registered callback subscription. It rechecks the native generation after HTTP.

It never refreshes or replaces a token, creates a subscription, activates an
account, processes a receipt, or sends a message. Output is limited to connection
key, provider, mode, generation, time and status; `liveDeliveryVerified` is always
false. A failed readiness/probe exits with status 1 and a sanitized failure.
`provider_verified` is evidence of that point-in-time grant/subscription check;
the consenting-sender pilot below is still necessary to establish delivery.
Repeated `--connection=...` arguments select distinct registered connections;
omitting them checks all registered connections.

## API and processing acceptance

All connection routes are under `/v1/messaging/connections/:key/`:

| Operation | Request | Authority |
| --- | --- | --- |
| Inspect safe connection status | GET `status` | Configured application operator |
| Begin browser OAuth | POST `authorization` with `{}` | Operator, allowed browser Origin |
| Authorize callback | GET `oauth/callback` | Single-use state, browser nonce, current operator and account generation |
| Activate | POST `activation` with `{generation,mode:"pilot",senders:["external-sender-id"]}` | Operator, allowed Origin, verified grant/subscription |
| Pause/disconnect | POST `pause` or `disconnect` with `{generation}` | Operator, allowed Origin |
| Send app chat text | POST `messages` with `{text}` and `Idempotency-Key` | Verified signed-in user, allowed Origin |
| Read own app chat | GET `messages` | Same verified signed-in user |

Use a Bearer JWT on authenticated routes. Keep the OAuth nonce cookie from the
begin request through the provider redirect; it is Secure, HttpOnly, SameSite=Lax,
and bound to the exact callback connection. Register redirects first. Begin and
callback must use a browser capable of preserving this first-party cookie.
No credentials or provider authorization codes are accepted by a generic upload
endpoint. Token replacement disables the account; activation is a separate action.

Run locally before a deployment candidate:

```sh
make generate-db
make generate
make check-generated-db
make check-generated
make test-db-messaging
make test-db
make test
make build
corepack yarn exec wrangler deploy --dry-run --config wrangler.next-api.jsonc --outdir .cache/entity-messaging-worker
```

The gateway suite exercises signed provider requests through actual PostgreSQL,
real provider client HTTP shapes with injected responses, single-use OAuth, native
Worker registration with signed JWTs, restricted runtime-role grants, per-user
chat history, queue dispatch and lost-wakeup cron recovery. Legacy Worker tests
verify its original isolation and readiness gates. No test sends live messages.

For an approved live pilot, record evidence for each channel separately:

1. Confirm account ownership, developer-app identity, scopes, entitlement and the
   exact callback subscription. TikTok requires approved Business Messaging and
   Advanced Access plus a successful conversation-list permission probe.
2. Complete browser OAuth as a configured active operator. Verify status shows a
   disabled but authorized/subscribed connection, without exposing its grant.
3. Activate pilot mode using its current generation and one consenting external
   sender. Initiate `/ping` from that sender inside the provider reply window.
4. Record external incoming/outgoing message IDs, receipt/outbox status, audit
   correlation, queue completion and the reply visible in the provider's client.
   Resubmit the same signed event in a controlled test and verify no second action
   or reply. Verify another sender cannot be processed in pilot mode.
5. Pause, verify new work cannot run, and verify an older-generation claimed item
   cannot use a reconnected grant. Disconnect and confirm local credentials clear.
6. Exercise app chat with two real verified users: each sees only their own history.
   Revoke operator authority and ensure a previously begun callback fails.
7. Inspect dead-letter and uncertain sends. An ambiguous network send is never
   automatically resent; reconcile it with the provider's history manually.

Only after this evidence is recorded should an explicit cutover change provider
subscriptions/routes or enable live mode. Do not subscribe both historical and
native handlers to the same production events during migration. Account/data
migration and historical-domain-command parity require a separate reviewed plan
before retiring the historical implementation.

## Rollback and operational recovery

Pause native accounts first; generation fencing invalidates pending work. Set
`ENTITY_MESSAGING_ENABLED=false` and redeploy the reviewed previous Worker/config.
Restore historical subscriptions only if a deliberate cutover had changed them.
Preserve receipts, outbox and audits for reconciliation. Never replay uncertain
sends blindly or reinstall the fresh schema over existing data. Existing API
routes and historical queue jobs keep their original database binding/readiness.
Native queue failures retry; cron scans registered accounts independently from
legacy recovery. Losing a wakeup does not lose an acknowledged durable receipt.

Monitor unavailable/refreshing drain results, failed/expired/uncertain receipts
and outbox, refresh lease expiry and dead letters. A refresh-token rotation that
succeeds remotely but fails to persist locally can require reauthorization.
Rotating the encryption key requires an explicit decrypt/re-encrypt procedure
before discarding the old key; simply changing the environment key makes stored
grants unreadable. Do not print tokens, raw callbacks, message bodies or secrets
in operational logs.
