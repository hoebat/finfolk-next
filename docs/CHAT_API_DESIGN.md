# Chat API design draft

**Status:** Draft design • 10 November 2026

The chat API will give FinFolk and StatsTrade a common way to receive messages, run commands and deliver replies. Simple public commands must run directly after durable receipt. Member checks, external lookups and domain mutations run only when the selected command requires them.

The service separates channel integration, command execution and delivery. All execution paths share receipt deduplication and delivery reservations. A queue schedules or recovers work; it does not determine whether a command requires authorization.

The initial scope is direct text chat through Instagram and an authenticated app interface. Comment events use a separate capability and target model. TikTok can reuse the protocol through its existing adapter after account-specific activation. Group chat, attachments, streaming AI, proactive campaigns and a human-agent inbox are outside the initial release.

## Current implementation and design boundary

| Component | Current local implementation | Design direction |
| --- | --- | --- |
| Existing FinFolk Instagram handler | Uses historical Instagram event and outbox tables; member commands use the queue | Retain during a staged cutover |
| Public command shortcut | Locally implemented and tested for ping, help, unknown-command help, greeting and retired claim guidance; not deployed by this work | Carry the direct execution policy into the shared core |
| Shared messaging core | Separate entity model, database bridge, gateway and Instagram, TikTok and app transports exist | Use this model for the common API; extend it rather than create another store |
| Native command registration | Public handlers exist; personal handlers require explicit registration and eligibility policy | Register product-specific commands independently |
| StatsTrade | Has its own Instagram integration and public command behaviour | Map through an adapter; preserve its account, credentials and product rules |

The existing Instagram shortcut and the native shared gateway are separate paths. Adding the shortcut has not migrated historical records or activated a new shared deployment. Production versions and account entitlements must be checked at cutover.

Repository reference points are `backend/next-api-worker.mjs`, `backend/messaging-engine.mjs`, `backend/messaging-gateway.mjs`, `backend/messaging-database.mjs` and `backend/messaging-handlers.mjs`. Existing contracts are described in `docs/MESSAGING_API.md` and `docs/MESSAGING_DB.md`.

## Architecture and ownership

The request flows through five responsibilities:

1. **Channel adapter:** verify the request, resolve the configured account, reject echoes and normalize incoming events.
2. **Receipt store:** persist the event once within its application and account scope.
3. **Command router:** select a trusted registry entry and its execution and authorization policies.
4. **Executor:** produce a reply and commit any domain effect together with command completion.
5. **Delivery service:** reserve the outgoing reply, validate current eligibility, call the provider and record the outcome.

An independent recovery worker scans eligible receipts and pending replies. Both immediate execution and queue consumers claim the same receipt; only one can own its current lease.

Product handlers own menus, member identity rules, follower requirements, points and check-ins. The shared service owns scoped receipts, leases, deadlines, delivery state and safe recovery. Provider adapters own signatures, credentials, identifier formats, capabilities and acknowledgement parsing.

FinFolk and StatsTrade may use separate databases while implementing the same contract. Sharing a protocol does not require sharing credentials, a database, or a runtime dependency on a sibling repository.

## Command routing

Register commands in trusted server configuration. Incoming text can select a registered command, but cannot choose an executor, account, handler function or authorization policy.

| Command class | Examples | Required work | Default execution |
| --- | --- | --- | --- |
| Public reply | ping, help, unknown-command menu | Account configuration, limits, receipt and delivery checks | Immediate |
| Public reply with a small state update | Greeting with a daily throttle | Public checks plus an atomic throttle update | Immediate |
| Account connection | FinFolk connect | Current provider eligibility, code issuance and limits | Background |
| Member read | Status or points | Member mapping, member eligibility and command data | Background initially |
| Member mutation | Check-in or check-out | Eligibility, domain validation and transactional effect | Background |
| External or model task | Future research or AI reply | Explicit permission, bounded external work and authorized context | Queued |

Execution policy and authorization policy are separate fields. A member read can later run immediately if its latency and transaction behaviour justify it. An immediate handler never bypasses its declared permissions.

A registry entry declares `name`, `aliases`, `execution`, `identityPolicy`, `providerEligibilityPolicy`, `mutatesDomain`, `feedbackPolicy`, `timeoutMs` and `handlerVersion`. Defaults deny personal access. New commands must explicitly opt into the public class.

Keep existing product behaviour: FinFolk ordinary text currently gets at most one greeting per sender per day, while StatsTrade uses its configured menu behaviour. Echo is enabled only where registered, and must sanitize and bound reflected content. Help lists commands enabled for the current product, account and rollout.

## Immediate and queued execution

For an immediate command, verify and save the receipt before acknowledging the provider webhook. Schedule execution in the request's supported background context, using a database lifetime that extends through the task or a new connection. Do not reuse a pool already closed with the HTTP request.

The executor claims the receipt, checks current account mode and generation, applies the sender limit, creates the reply and commits completion. The delivery service then reserves and sends the committed reply. Small stateful operations, such as greeting throttling, remain atomic with completion.

For background commands, publish a wakeup containing a trusted connection key and receipt reference, not message text or credentials. The consumer loads the durable receipt and runs the same claim and completion protocol. Queue publication follows receipt commit; a lost wakeup is recoverable from the database.

Do not globally serialize unrelated conversations. Use bounded concurrency across accounts and conversations. Commands that change a conversation's or member's state must enforce ordering using their domain sequence or message timestamp; queue order alone is insufficient. Limit work per drain so one busy account cannot monopolize processing.

Recovery must route a public receipt back to the public executor. It must not silently invoke the personal command pipeline or create a second reply.

## Identity and authorization

Keep these checks distinct:

| Check | Purpose | Public command |
| --- | --- | --- |
| Provider signature or app authentication | Establish trusted ingress | Required |
| Application and account scope | Select the correct tenant and provider account | Required |
| Product member mapping | Link the sender to an internal user | Skipped |
| Member eligibility | Check current active status and required verification | Skipped |
| Provider eligibility | Apply product rules such as FinFolk following | Skipped |
| Domain authorization | Decide which member data or mutation is allowed | Skipped |
| Rollout, deadline and rate limit | Control whether this reply may run and send | Required |

A verified webhook proves provider origin; it does not prove FinFolk membership. An authenticated app user does not need an external Instagram mapping. Resolve the actor from a verified token and authorized connection, never from a submitted user ID.

FinFolk member commands retain their configured follower requirement. StatsTrade must declare its own product policy rather than inherit FinFolk's rules automatically. Recheck sensitive delivery eligibility when results can wait in an outbox. Public help has no reason to call the profile API.

Provider participant identifiers are opaque and scoped by application, account and channel. Do not equate comment author IDs, messaging sender IDs and app user IDs.

## Seen and typing feedback

Feedback is optional UI behaviour and is not part of command correctness or delivery acknowledgement.

Public replies default to no feedback calls. Longer commands may mark the incoming message seen and show typing, using a separate, best-effort feedback task with a bounded budget. A failed or slow action must not delay command execution or the text reply.

The feedback task loads validated settings once for its short lifetime, serializes its own actions, and stops scheduling refreshes when the command finishes. Cleanup must account for an already in-flight typing-on call before issuing typing-off. Check account mode and cancellation before sending an action; stop on disconnect or rollout invalidation. Do not persist typing actions in the message outbox or retry them as messages.

Current FinFolk feedback awaits mark-seen and typing-on sequentially. Each action reloads configuration, checks the event lease and calls Meta with a three-second timeout. Typing can refresh at the pre-send check after four seconds, and typing-off runs during cleanup. This is a remaining optimization for member commands.

Deferred outbox-only retries currently use the generic sender and can still show typing for a public reply. Persist or derive the command's feedback policy so the delivery service applies it consistently on retries.

## Actual API routes and contract differences

The following inventory is based on the checked-in HTTP dispatchers in both repositories. It describes the code and deployment configuration, not a fresh audit of the currently deployed versions. FinFolk's checked-in configuration sets `ENTITY_MESSAGING_ENABLED=false`, so its native shared routes are gated off until explicitly configured and enabled.

Commands such as `/ping`, `/help` and `/echo` are message contents. Neither integration defines matching HTTP routes. Posting to an HTTP `/ping` endpoint is not how a user tests the bot.

### StatsTrade integration API

Configured host: `https://api.statstrade.com.au`. Dispatch lives in `services/instagram-api/worker.mjs`; the handlers live under `services/web-main/instagram-*.mjs`.

| Method and route | Request and authorization | Actual response and behaviour |
| --- | --- | --- |
| GET /health | No user token | 200 JSON with service and configuration booleans; no-store |
| GET /api/instagram/webhook | Meta hub.mode, hub.verify_token and hub.challenge query fields | Exact plain-text challenge; 403 for invalid verification, 503 if setup is missing |
| POST /api/instagram/webhook | Raw Meta payload plus X-Hub-Signature-256; configured account binding | 200 plain-text Accepted after the normalized batch commits, or Ignored for no supported events |
| GET or POST /instagram/webhook | Alias using the same handler | Same contract and receipt deduplication as /api/instagram/webhook |
| GET /connect?ticket=... | Signed, single-use operator capability valid for ten minutes; no app-member JWT | 302 to Meta OAuth with a secure browser-state cookie |
| GET /v1/integrations/instagram/oauth/callback | OAuth code, state and matching browser cookie; consumed server-side intent | Verifies app, business/account and subscriptions, saves an encrypted credential, then returns plain-text connection confirmation |
| GET or HEAD /privacy | Public | HTML privacy page |
| GET or HEAD /data-deletion | Public | HTML deletion instructions |

Webhook bodies are bounded to 262144 bytes. Bad signatures return 403, malformed supported payloads 400, oversized bodies 413 and storage failure 503. The webhook allows GET and POST only; other methods return 405. The connection handler allows GET only. Unrecognized Worker routes return 404.

This API has no app conversation submission, history, member linking, operator event listing or HTTP retry route. The operator currently uses `scripts/instagram-connect.mjs`, `instagram-check.mjs`, `instagram-sync-connection.mjs` and `instagram-process-commands.mjs`.

The Worker uses service-role-only Supabase RPCs with `Content-Profile: stats_rpc`. Important operations are `web_instagram_events`, `web_instagram_oauth_begin`, `web_instagram_oauth_consume`, `web_instagram_connection_save`, `web_instagram_connection_get`, `web_instagram_dm_claim` and `web_instagram_reply_finish`. These are server integration calls, not browser chat endpoints; never give clients the service credential to call them.

After webhook commit, `waitUntil` starts a bounded command batch. The processor loads the brand credential once, claims up to five replies and processes those jobs concurrently. It currently awaits seen and typing-on before each text send, then typing-off during cleanup. StatsTrade therefore already bypasses a queue for ordinary replies, but its feedback calls still contribute latency. A scheduled handler exists in code; the checked-in Wrangler file declares no cron trigger, so independent scheduled recovery must be configured separately.

### FinFolk existing Instagram API

Configured host: `https://api.finfolk.com.au`. The Worker delegates these routes to the historical Instagram API and database. The public shortcut intercepts eligible webhook POSTs before the general API router.

| Method and route | Access and input | Actual responsibility |
| --- | --- | --- |
| GET /instagram/webhook | Meta verification query | Return challenge independently of database verification |
| POST /instagram/webhook | Raw signed Meta payload; handover flag and account checks | Save receipts, handle comments/discovery, and schedule direct public or queued member processing |
| GET /v1/me/instagram | Member bearer JWT | Read the caller's Instagram linking/status view |
| POST /v1/me/instagram/connect | Verified member, Idempotency-Key and JSON code | Redeem the private code received through Instagram DM |
| PUT /v1/me/instagram/profile | Member JWT, Idempotency-Key and JSON handle | Save a self-provided profile link; does not prove ownership |
| DELETE /v1/me/instagram | Member JWT and Idempotency-Key | Remove link, disconnect verification and cancel eligible unsent member work |
| GET /v1/admin/messaging/instagram | Verified configured administrator | Read mode, enabled commands, readiness and health |
| PUT /v1/admin/messaging/instagram | Administrator, Idempotency-Key, mode, enabledCommands, pilotSenderIds and acceptance | Change rollout configuration with activation checks |
| GET /v1/admin/messaging/instagram/authorization/diagnostics | Administrator | Probe and report authorization diagnostics |
| POST /v1/admin/messaging/instagram/authorization | Administrator, Idempotency-Key and empty JSON object | Return authorizationUrl and expiresAt for brand-account OAuth |
| GET /v1/integrations/instagram/oauth/callback | Bound one-use OAuth state and fresh administrator checks; no callback bearer token | Save validated authorization and redirect 303 to settings |
| GET /v1/admin/messaging/events | Administrator; limit, cursor, state, command and requestId filters | List receipts and delivery status with nextCursor |
| GET /v1/admin/messaging/events/:id | Administrator; event UUID | Read one receipt and its reply status |
| POST /v1/admin/messaging/events/:id/retry | Administrator, Idempotency-Key and empty JSON object | Retry only failures confirmed safe under current mode, generation and deadline |

Historical claim status and review-inbox routes remain for compatibility. Claim creation, review requests and approval mutations are retired with 410. They are not alternative connection workflows. Older `POST /api` action dispatch remains a compatibility interface, not the target for new chat routes.

The existing versioned API returns `{data,requestId}` or `{error:{code,message,retryable},requestId}`, with `X-Request-Id`. Member routes verify the JWT, resolve the current identity and member, and enforce a per-user request limit. Admin routes additionally require verified email and the configured administrator role. Mutations use an actor-scoped idempotency record; replay returns `Idempotency-Replayed: true`.

JSON bodies are bounded to 8192 bytes and unsupported fields are rejected. The API distinguishes missing/invalid login with 401 and insufficient permission with 403. Browser origins are explicitly allowed, OPTIONS returns preflight metadata, and account responses use private, no-store caching.

Important naming distinction: FinFolk's DM `/connect` issues a member-linking code, while its HTTP `POST /v1/me/instagram/connect` redeems that code. StatsTrade's HTTP `GET /connect` instead authorizes the brand's Meta integration. These three operations must not share an ambiguous generic connection route.

### FinFolk native shared messaging API

All `/v1/messaging/` requests are intercepted before the historical API middleware. They use a separately configured database, authorization policy and error format. Enabling the historical Instagram integration does not enable this gateway.

Let `C` mean `/v1/messaging/connections/:connectionKey`. Connection keys resolve trusted server configuration; clients cannot submit an arbitrary account or handler.

| Method and route | Access and exact input | Actual response |
| --- | --- | --- |
| GET /v1/messaging/webhooks/:providerAppKey | Instagram verification; registered provider app | Provider challenge response |
| POST /v1/messaging/webhooks/:providerAppKey | Provider-specific signature; configured account selection | Provider adapter acknowledgement after durable receipt |
| GET C/status | Scoped administrator | 200 with {connection} |
| POST C/authorization | Scoped administrator, allowed Origin and empty JSON object; external channel only | 200 with {authorizationURL,expiresAt} and a browser-state cookie |
| GET C/oauth/callback | Bound OAuth state, browser cookie and fresh operator authorization | 303 to the configured return URL |
| POST C/activation | Scoped administrator and allowed Origin; {generation,mode,senders} | Updated authorization state; pilot requires a sender list |
| POST C/pause | Scoped administrator and allowed Origin; {generation} | Updated authorization state |
| POST C/disconnect | Scoped administrator and allowed Origin; {generation} | Updated authorization state |
| POST C/messages | App-channel user, allowed Origin, Idempotency-Key and {text} | 202 with {receiptId,duplicate} |
| GET C/messages | App-channel user | 200 with {messages:[{id,direction,body,sentAt,createdAt}]} |

The webhook route selects Instagram or TikTok from registered configuration. TikTok has POST ingress; GET challenge applies to Instagram. App message routes explicitly reject external-channel connections: they are not an Instagram/TikTok send API.

The checked-in Worker policy verifies the bearer JWT and queries the native user and auth records for active, verified eligibility. It does this even when app text is `/ping`. Skipping extra command-member lookups does not bypass this existing app-ingress policy. Whether verified email is necessary for all app chat is an explicit product decision.

Mutating browser routes require an allowed Origin; bearer authentication alone is insufficient. JSON parsing has a 16384-byte body cap and rejects unknown fields; app text is capped at 2000 JavaScript string units. The native app route requires an idempotency key but does not expose the historical API's response envelope or replay header.

Missing or invalid actor authorization currently returns 403. Errors are `{error:"safe message"}`, not structured error objects. Conflicting duplicate input or changed authorization returns 409; infrastructure/configuration problems return 503. The outer Worker can return a different safe 503 body before the gateway runs. The gateway does not currently attach the historical API's requestId envelope.

App history has no HTTP cursor parameter in this router. Native receipt-status, operator event-list and safe-retry endpoints are also absent. The historical admin event routes read the historical tables and cannot serve as native event inspection endpoints.

### Route design decisions from the comparison

Keep `/v1/messaging` as the shared namespace. Introducing another complete `/v1/chat` route family would duplicate an implemented gateway without changing the execution pipeline or its latency.

Preserve the installed provider callback URLs. StatsTrade's two webhook aliases should continue to converge on one receipt store, while FinFolk's historical and native callbacks must not both process the same account with delivery enabled.

Reuse native connection lifecycle routes, keeping brand authorization separate from individual member linking. Add only the missing shared capabilities: participant-scoped receipt status, paginated app history, scoped operator event inspection and a safe retry action. Proposed additions are `GET /v1/messaging/receipts/:id`, `GET /v1/messaging/events`, `GET /v1/messaging/events/:id` and `POST /v1/messaging/events/:id/retry`; history pagination extends the existing message route.

Standardize native correlation and errors deliberately. Add `X-Request-Id`, then introduce a documented structured error contract with a compatibility plan for existing clients. Decide whether unauthorized native requests should distinguish 401 from 403, and align idempotency validation and replay visibility across implementations. Do not describe these changes as already present.

The target app submission keeps the existing `{text}` request and 202 `{receiptId,duplicate}` response until versioned deliberately. GET history remains participant-scoped. External replies stay bound to accepted inbound events; no general recipient/body send route is proposed.

Acceptance should test dispatch precedence, enabled/disabled gateway behaviour, both StatsTrade webhook aliases, callback state validation, actor and Origin checks, duplicate payload conflict, history ownership and each actual response shape. These route tests are separate from latency measurements and provider delivery acceptance.

## Data and delivery guarantees

Use the native shared entities: application, account, identity, conversation, message, receipt, outbox and audit. Add command metadata only where the current schema cannot express it. Database changes belong in the Clojure-owned schema and generated operations; historical migrations remain immutable.

A normalized incoming event carries `eventId`, `messageId`, `conversationId`, `senderId`, `body`, `sentAt`, `deadline` and bounded metadata. The adapter supplies the trusted application and account scope separately.

Enforce unique receipt identity by scoped provider event ID, and app submission identity by scoped actor and idempotency key. Store a payload fingerprint to distinguish a true duplicate from conflicting reuse. A reply is unique for its triggering receipt in the initial protocol.

The command transaction commits domain effects, result metadata, completion and the outgoing reply together. External calls run outside that transaction. Completion requires the current receipt lease and account generation; stale work rolls back its effects.

| State group | Meaning |
| --- | --- |
| Received, queued, processing | Durable work awaiting or undergoing execution |
| Completed | Command result committed; delivery can still be pending |
| Ignored, blocked, paused | Execution intentionally did not proceed |
| Failed | Execution failed; retry requires an eligible attempt and policy |
| Pending, sending | Outgoing reply waiting or reserved by one sender |
| Provider accepted | Provider returned a valid acknowledgement ID |
| Uncertain | A send may have succeeded; automatic resend prohibited |
| Cancelled, expired | Outgoing reply is no longer eligible |

These are conceptual states. Each adapter maps them to the existing schema's names rather than assuming both current stores are identical.

Queue delivery and wakeups may repeat. Lease checks and unique records protect effects and replies, but the service cannot promise exactly-once external delivery. An ambiguous provider POST, unreadable acknowledgement, or crash after sending becomes uncertain. An expired sending lease must never be reset blindly to pending. A known rejection or confirmed pre-send failure may retry with bounded backoff. Provider acceptance is distinct from delivered and read.

## Deadlines limits and recovery

Set a trusted reply deadline at receipt time from the adapter's configured capability and channel rules. Recheck it before execution and delivery. Do not extend it on retry or assume all providers and authorization modes share the same window.

Use bounded budgets for public execution, personal execution, feedback and provider sending. The current FinFolk personal executor has a twelve-second processing budget; it is not an overall end-to-end delivery guarantee. Timeout fallback is allowed only when no original effect committed and no reply was accepted or became uncertain.

Preserve per-product limits during migration. FinFolk currently allows thirty commands per sender per minute and has separate connection-code limits. Add configurable account-wide and tenant-wide budgets for fairness. Provider throttling creates account-wide backoff so parallel workers do not keep sending.

Recovery scans due receipts and pending replies, preserves command classification, and checks deadlines, attempt counts and current rollout generation. It marks abandoned sends uncertain. Use the existing one-minute FinFolk reconciliation schedule initially, while tracking backlog age and revisiting its interval if recovery latency is unacceptable.

Pause prevents new execution and unsent delivery. Resuming does not replay old paused work automatically. Rollout or authorization changes invalidate older work through account generations. An in-flight provider send cannot be recalled.

## Privacy and channel capabilities

Minimize storage by channel and purpose. The existing command bot is not a conversation archive. The native shared model can retain conversation text, so its activation requires an explicit retention policy and participant access controls; do not copy historical message content into it automatically.

Initial external command records retain only the fields needed to process, deduplicate and diagnose commands. App conversation history uses a separately configured retention period. Document expiry and account-deletion behaviour before activation. Keep tokens and private connection codes encrypted, use environment or managed secret bindings, and exclude message bodies, credentials and codes from operational logs.

Treat incoming text as untrusted data. Bound payloads and reflected text, escape rendering, and never execute submitted handlers, SQL or model tool instructions. Browser origins, JWT issuers and operator scope are configured explicitly.

Comments are a separate event kind with a post/comment target. Deduplicate by scoped comment event, ignore self-generated echoes, and enforce the product's configured post rules. A public comment reply and a private reply from a comment are separate capabilities. Enable each only when the account, permissions and provider adapter support it; DM authorization alone does not establish comment-reply permission.

## Observability and performance targets

Record request ID, receipt ID, outbox ID, application/account scope, command class and handler version. Capture timestamps for receipt commit, enqueue, claim, result commit, send start and provider acknowledgement. Track feedback duration separately.

Expose queue wait, execution duration, provider lookup duration, send duration, receipt-to-acceptance latency, backlog age, stale leases and uncertain sends. Operators should be able to distinguish no webhook received, received but blocked, waiting for execution, provider rejection and ambiguous send without inspecting private text.

Initial engineering targets are a p95 webhook acknowledgement under one second and p95 public receipt-to-provider-acceptance under three seconds at ordinary load. These are proposed targets, not measured production results. Separate platform delivery delay from service time, and alert on missing samples or error rate rather than counting only successful replies.

## Verification and rollout

Required acceptance cases are:

- Public ping and help issue no member, follower or feedback calls and normally do not enqueue.
- Member commands cannot use the public executor or bypass their configured identity policy.
- Concurrent direct and queued attempts commit one result and reserve one reply.
- Changed idempotency payloads conflict; scoped IDs cannot cross accounts or applications.
- Lost wakeups and interrupted preparation recover without losing or duplicating effects.
- Ambiguous sends remain uncertain and cannot be retried through operator or automatic routes.
- Disabled mode, account-generation changes, expired deadlines and rate limits block both execution paths.
- Feedback failure does not delay a reply; retry delivery preserves the command's feedback policy.
- App history and receipt status enforce participant ownership and stable cursor pagination.
- Comment actions enforce their own capabilities and avoid echo loops.

First baseline current latency, then deploy the existing public shortcut independently. Next add explicit execution, eligibility and feedback policies to the shared registry and database contract. Validate native public commands in an isolated database, then activate one account in a pilot.

Keep only one authoritative processor for a provider account and event scope at a time. A shadow comparison may inspect normalized events without sending replies or mutating domain state. Do not point the same live event stream at both stores with delivery enabled.

Migrate member commands after their native domain handlers and eligibility checks pass acceptance. Integrate StatsTrade through its own adapter and account configuration. A deployment does not widen the pilot audience automatically. Roll back by pausing the new processor and restoring ingress ownership with a defined cutoff; never replay uncertain sends.

## Decisions to confirm

The proposed defaults are direct execution for fixed public replies, queued execution for external work and domain mutations, no feedback for public replies, and bounded independent feedback for longer work.

Before the shared API is activated, confirm where it is hosted, whether each product keeps its own database, the retention period for app history, which StatsTrade member commands are in scope, and which comment actions each account should enable.

Human handoff, unrestricted outbound messaging and AI responses require separate product and permission decisions. They are not implied by enabling the chat API.

