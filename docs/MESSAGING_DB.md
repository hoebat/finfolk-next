# Shared messaging database

The active FinFolkDB schema now provides the same durable messaging protocol for
Instagram, TikTok and an application chat channel. This is the database layer:
it does not install a public webhook endpoint, call a provider, or provision
TikTok Business Messaging access. The existing production API still uses the
frozen historical schema. No production migration or cutover is performed here.

## Source and verification

Types live in `finfolkdb.common.type-messaging-base`; transactions live in
`finfolkdb.fn.messaging.messaging-manage`. Both are authored in Clojure and
compiled through the normal database entrypoint.

```sh
make generate-db
make test-db-messaging  # Clojure contracts and disposable live PostgreSQL
make test-db-types      # includes messaging plus all active entity suites
```

The messaging suite runs the complete receive/process/reply/delivery/history
cycle for both Instagram and TikTok. It also exercises concurrent webhook
retries, worker claims, duplicate conflicts, retry delays, expired leases,
account generations, application/account scope, pilot restrictions, transaction
rollback and ambiguous sends. No external provider credentials are required.

## Model

| Entity | Responsibility |
| --- | --- |
| `MessagingApplication` | Integrating system, for example FinFolk or another app |
| `MessagingAccount` | One application's provider account, activation and generation |
| `MessagingIdentity` | External participant within that account; optional linked `User` |
| `MessagingConversation` | Direct conversation and its participant |
| `MessagingMessage` | Inbound or outbound text, normalized metadata and timestamps |
| `MessagingReceipt` | Deduplication, processing status, deadline, attempts and worker lease |
| `MessagingOutbox` | Durable reply, delivery attempts and provider acknowledgement |
| `MessagingAudit` | Account-scoped processing/delivery audit entries |

`MessagingAccount.provider` is a native enum: `instagram`, `tiktok`, or `app`.
The same external IDs may exist in different accounts, providers or applications.
Native foreign keys also prevent connecting a conversation, message, receipt or
reply to another account's records. `MessagingOutbox` no longer refers to an
`InstagramDmEvent` or an Instagram connect code. Provider-specific challenge
references can be retained as handler metadata instead.

The current core supports direct text conversations, with a 2,000-character
body limit. Group participants, attachments, streaming tokens, read receipts and
provider-specific conversation features are separate extensions. Outgoing
messages have a null `sent_at` until the provider accepts them; they remain in
history while queued, including uncertain or failed deliveries.

## Adapter input

The HTTP adapter verifies the raw provider signature, selects the configured
application/account, rejects echoes and unsupported events, and converts each
message into this envelope:

```json
{
  "eventId": "provider-event-or-message-receipt-key",
  "messageId": "provider-message-key",
  "conversationId": "provider-thread-key",
  "senderId": "provider-participant-key",
  "body": "Hello",
  "sentAt": "2026-11-04T10:00:00Z",
  "deadline": "2026-11-04T11:00:00Z",
  "metadata": {}
}
```

These timestamps are illustrative. The adapter supplies the original provider
message time and an absolute deadline derived from that channel's actual policy;
the database does not assume Instagram's policies apply to TikTok. Missing or
malformed times and messages more than five minutes in the future are rejected.
Past-deadline receipts can be recorded but cannot be processed or delivered.
Batch webhooks must be expanded into individual messages with deterministic
message-level event keys. Do not pass access tokens or raw credential-bearing
payloads in metadata.

Call `finfolk_rpc.receive_message(application, account, envelope::jsonb)` and
acknowledge the webhook only after commit. Duplicate retries return the original
receipt without repeating side effects. Reusing an event/message key with changed
message content, participant, conversation or provider time fails. Duplicate
retries never extend an existing deadline or reset its account generation.

Ingestion serializes short transactions for each account. Identity/conversation
creation and duplicate detection therefore remain atomic during concurrent
webhook retries; separate accounts can ingest concurrently.

## Worker protocol

All functions below take the application ID and local account ID first.

1. `claim_message(application, account)` returns `{receipt, message, provider}` or
   null. The receipt contains a random `lease`, valid for 60 seconds. Claims use
   `FOR UPDATE SKIP LOCKED` so workers can process different messages concurrently.
2. An application-selected handler handles that message. It can load the latest
   50 messages using `ret_messaging_history(application, account, conversation)`.
   AI/model calls and other network requests happen outside database transactions.
3. `complete_message(application, account, receipt, lease, result::jsonb, reply)`
   completes processing, creates an outbound message and queues a reply atomically.
   A null reply completes without sending. A handler can execute its domain
   mutations and this call in the same transaction. **If completion returns null,
   roll back that transaction**: the claim expired, became stale, or is no longer
   permitted. A duplicate completion cannot queue another reply.
4. `retry_message(application, account, receipt, lease, delay_seconds)` releases
   a valid processing lease for retry. Delays are bounded to 1–3,600 seconds and
   processing is limited to five claims. Expired processing leases may be reclaimed
   with a new token; old workers cannot complete the new claim.
5. `claim_delivery(application, account)` returns a delivery lease, provider,
   external account ID, recipient ID and conversation ID. It returns no account
   credentials. The provider adapter loads credentials through its trusted
   configuration and sends outside the transaction.
6. `record_delivery_result(application, account, delivery, lease, outcome,
   provider_message_id, delay_seconds)` records `accepted`, `retry`, `failed`, or
   `uncertain`. Accepted results require the provider's message ID. Use `retry`
   only when non-acceptance is known. Delivery retries are also bounded to five
   claims. Timeouts with unknown acceptance must use `uncertain`.

Commit each claim before performing network work. A send whose lease expires
becomes `uncertain`, never automatically retryable: the provider might already
have delivered it. The core provides transactional deduplication and fencing;
it does not claim exactly-once external delivery. Late acknowledgements cannot
modify an expired or replaced lease. Reconciliation/manual handling of uncertain
provider outcomes belongs to an adapter with provider-specific evidence.

`reconcile_messaging_work(application, account)` expires past-deadline or stale
processing receipts, terminalizes exhausted processing, cancels stale pending
replies, and marks abandoned sends uncertain. Claims call it automatically; a
scheduler can also call it. Disabled accounts do not process or deliver messages;
pilot accounts permit only their configured external sender IDs. Backoff delays
claims. Increment `generation` during reconnect/configuration handover so older
work cannot execute against a new account connection. Acknowledgements for sends
already attempted may still record their factual outcome after reconnection.

## Plugging in chat or another system

An application chat API authenticates its user, establishes the authorized
conversation, and calls the same ingestion function using an `app` account. A
human-chat handler, deterministic command handler or AI handler can all consume
the same claims. A worker selects its handler from trusted application code;
the database does not execute arbitrary handler names or SQL supplied in messages.
FinFolk-specific check-in, follower requirements, moderation and account linking
belong in those authorized handlers/adapters, not in the provider-independent core.

These functions are trusted server interfaces. The application/account arguments
are scope selectors, **not authentication**. A shared gateway must authenticate
and authorize the requested application, account and chat participant before
calling them. Do not grant them directly to browsers or independent tenants with
unrestricted scope arguments. The generated fresh schema revokes PUBLIC access
and grants the API role no messaging table/function privileges. A future HTTP
integration must add appropriately restricted wrappers and grants.

## Worker bridge

`backend/messaging-database.mjs` exports `createMessagingDatabase`, which accepts
an existing transactional database connection and trusted application/account
configuration. It works with the repository's row-array query interface or
node-postgres query results. Its transaction callback receives a query function,
matching the existing `db.transaction` interface.

```js
const messaging = createMessagingDatabase({db, application: 'finfolk', account});
await messaging.receive(verifiedNormalizedEnvelope);
await messaging.processNext(async ({message, provider, history}) => {
  const context = await history();
  // Application code may call a model or other network service here.
  return {result: {handled: true}, reply: 'Your reply'};
});
await messaging.deliverNext(providerAdapter);
```

A handler can return an `apply(query)` closure for trusted database mutations.
It must perform only database work and return a JSON object (or nothing). The
bridge executes it and completion in one transaction, rolling back those writes
if the lease is stale or anything fails. Errors schedule a bounded processing
retry; model output is never treated as executable code. The bridge's live tests
exercise application mutations and rollback, not just mocked SQL.

An adapter's `send(message)` receives provider/account/recipient/conversation
identifiers, body, claimed account `generation`, absolute `deadline`, and a stable
outbox `idempotencyKey`. Credential loaders must check that generation before
using a grant, and adapters reject work past its deadline before HTTP. It returns
`{status: 'accepted', messageId}` or a known `retry` / `failed` / `uncertain`
outcome. Retry may include a bounded `retryAfter` in seconds. An exception or
malformed send result is recorded as uncertain. A database failure while recording
the result propagates without calling the provider again. The stable key is
available to adapters whose provider supports idempotency; the bridge does not
assume that support exists.

## Transport implementation status

`backend/messaging-transport.mjs` provides the shared raw-body HTTP boundary.
`backend/messaging-instagram-transport.mjs` provides configured-account signature
verification, GET challenge handling, text-message normalization and a sending
adapter for the existing `InstagramProvider`. The reply window is explicit
connection configuration. Tokens and local application/account IDs are never
accepted from incoming payloads. Attachments and non-message events are ignored.

The focused test command now includes provider contract tests and a signed
Instagram request through the real PostgreSQL workflow, application handler,
existing Graph client with injected HTTP, and persisted delivery acknowledgement.
This verifies code integration; it does not send a real Instagram message.

## Opt-in integration

`messaging-gateway.mjs` and `messaging-worker.mjs` connect both transports,
browser-bound OAuth, trusted handler registration and authenticated app chat to
the separate native database. The existing API Worker routes new messaging paths
through this gateway only when explicitly configured. The checked-in feature flag
is disabled; the historical routes and database remain in place. Native queue and
cron processing recover durable work and refresh eligible grants.

`resources/finfolkdb/messaging-grants.sql` publishes server-only role permissions
from Clojure; it is installed only by an explicit provisioning action. Live tests
exercise those grants and signed JWT access through the actual Worker. Provider
HTTP is injected in automated tests. Live Instagram and TikTok approval,
subscription and delivery remain pending. See [MESSAGING_ROLLOUT.md](MESSAGING_ROLLOUT.md).
