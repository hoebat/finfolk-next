# PostgreSQL owned social and messaging implementation

Status: implementation in progress. Updated 16 November 2026.

## Outcome and boundaries

FinFolkDB owns social identity, command parsing, eligibility, consent, account
linking, domain mutations, reply composition, durable work and delivery policy.
Author every business rule in the PostgreSQL DSL under `src/finfolkdb`.
JavaScript is limited to HTTP routing, authenticating callers, checking webhook
signatures, provider payload normalization, cryptographic primitives and external
provider requests. It calls named generated RPCs, never domain SQL or arbitrary
handler callbacks. No network request holds a database transaction open.

The implementation includes direct messages, public mentioned comments and the
mock provider. Anonymous external participants are supported without creating
User records. Instagram and TikTok must use the same native command protocol;
provider-specific permissions and event formats remain adapter responsibilities.
Production activation, deployment, legacy data migration and serving cutover are
excluded. Preserve the dirty working tree and immutable historical migrations.

## Entity model

Use configured `et/E` entry identity, operation tracking and access conventions.
Native identifiers/references are UUIDs; external identifiers are opaque text.
Tracking and deadlines use Unix microseconds. Single-column validation belongs
on columns through DSL functions; cross-column consistency belongs in table
constraints. Use shared Rev/Audit providers where the entity needs history.

- SocialAccount is a stable provider/namespace/external identity. Namespace is
  trusted inbox/app configuration, never supplied as an authoritative webhook field.
- SocialConnection owns the optional current member association, encrypted
  authorization and explicit sharing consent. Disconnection removes personal
  authorization without deleting the external identity or conversation history.
- MessagingAccount is the configured operated provider account, capabilities,
  generation, activation mode, pilot audience and command policy.
- MessagingIdentity links the external participant to SocialAccount. Resolve
  social membership through the current active SocialConnection, rather than
  copying it into the identity's user field. App chat may retain a direct user.
- MessagingConversation and MessagingMessage retain private conversation content.
  Public comments do not become private conversation messages.
- SocialEvent is the canonical durable incoming envelope and deduplication record.
  It records the configured inbox/generation, external identity, event/message
  keys, channel, original timestamp, deadline, normalized data and correlation.
- SocialCommand is the parsed business request and its execution outcome, linked
  uniquely to the source event. It owns pending/waiting/completed/rejected/expired
  states. Its result is structured JSON; it does not own delivery status.
- SocialConnectionProof stores only hashed, expiring, receipt/event-bound linking
  evidence, generation and consumption binding. Codes cannot transfer ownership.
- SocialAction is an external-effect job belonging to a command: provider lookup,
  authorization verification or cryptographic preparation. It has a closed action
  kind, a scoped request/result, attempts, deadline and fenced lease.
- MessagingOutbox is the single durable delivery queue for DMs and public replies.
  Destinations distinguish DM threads, owned comments and mentioned comments.
  It links to the source command/event and optionally an outgoing private message.
  Sensitive replies use ciphertext; plaintext codes do not enter stored history.
- SocialRateLimit owns sender, inbox and command counters and expiry.

Consolidate MessagingReceipt processing into SocialEvent/SocialCommand. Remove
its native table and obsolete RPCs after adapters and Clojure tests use the new
protocol. Retain immutable legacy migrations as historical contracts only.
Avoid parallel command queues and duplicate delivery state machines.

## Database protocol

Trusted context binds application and inbox to the authenticated adapter/server.
Every RPC checks these scopes; identifiers are selectors, not authentication.
Separate ingestion, action and delivery roles; browser roles cannot call trusted
verification or worker functions. Generated catalogs publish exact UUID signatures.

1. `receive_social_event`: atomically validate the normalized envelope, resolve
   identities, deduplicate and persist the event. Changed content under an existing
   event key fails. Duplicates do not extend deadlines or replace generations.
   Acknowledge the webhook only after commit; wakeups are advisory.
2. `process_social_event`: claim eligible work, parse one registered command,
   evaluate rollout/limits/current membership and execute deterministic logic in
   one transaction. Unknown commands produce channel-appropriate help. A command
   is intercepted even when disabled, never passed into unrelated discovery.
3. Public help/ping/site/privacy/status and member connect/status/disconnect
   policy are native functions. Personal commands recheck an active, verified
   member and current connection identity version immediately before effects.
   Public comment status describes the post; private commands in public comments
   produce DM guidance and discard submitted private arguments.
4. When provider evidence or crypto is needed, persist a SocialAction and mark
   the command waiting. `claim_social_action` returns a fenced request. JS performs
   only that effect; `complete_social_action` validates scope, kind, generation,
   lease, evidence binding and deadline, then resumes database processing.
5. `/connect` issues a fresh eight-character code, valid for ten minutes, through
   the crypto preparation exchange. PostgreSQL controls issuance/replacement,
   rates, scope and proof state. JS supplies code/hash/sealed delivery material
   bound to that request; material is validated before committing the proof and
   encrypted reply. Public/member reads and logs never return the stored code.
6. `redeem_social_connection` accepts the authenticated member and submitted code
   through a typed RPC. Normalize/hash and validate the code, proof expiry,
   eligibility and ownership; consume once and leave sharing disabled. Replays,
   concurrent takeover and old-generation callbacks cannot create another link.
7. `disconnect_social_connection` locks the current connection, clears secrets and
   consent, rotates identity/generation and invalidates proofs and unsent personal
   work. Domain writes and outbound personal effects revalidate current authority.
8. `claim_social_delivery` commits a send lease and returns a typed destination,
   payload/ciphertext reference and stable delivery ID, not arbitrary credentials.
   JS sends outside the transaction. `complete_social_delivery` records accepted,
   known-rejected retry, failed or uncertain outcomes. Missing acknowledgement or
   an expired send lease is uncertain and never automatically resent.
9. `reconcile_social_work` expires stale generations/deadlines, recovers abandoned
   processing/action claims, applies database-owned bounded retry delays, and
   preserves uncertain sends. Use consistent inbox/account/command lock order.

Reply templates and help availability are generated by the DSL command registry.
The registry defines supported channels, arguments, membership/consent needs and
enablement; request bodies never supply SQL, handler names or executable callbacks.
Start with help, ping, site, privacy, connect, status, disconnect and an internal
mock whoami scenario. Port enabled visit/points/publication operations through the
same authorized domain-RPC dispatch; do not advertise unimplemented commands.

## Mock and tests

There are no JavaScript tests for the new implementation. Primary tests are
Clojure `code.test` facts under `test/finfolkdb`, using `l/script- :postgres` and
the local Supabase lifecycle/scaffold. Declare only required modules. Fixtures
use actual native records and operation contexts, never a fake in-memory DB.

The mock adapter supplies signed inbound messages/comments and controlled
provider/crypto/delivery results. Its JS has no command parser, reply templates,
proof lookup, eligibility rules or domain queries. Local/CI only: explicit opt-in,
loopback binding and isolated finfolk_test_* databases. No hosted mock routes.
Clojure can exercise a real HTTP listener through Java HTTP clients when testing
signatures/normalization; assertions still live in the database test suite.
The former `tests/test_mock_social.mjs` has been removed. The social, mock and
messaging Make targets run the Clojure suite through the Supabase scaffold;
the Node launcher only manages the disposable database and starts Clojure.

Acceptance scenarios:

- Public external sender resolves to SocialAccount/MessagingIdentity, without a
  User/connection; public commands work, personal commands do not.
- Parsing, aliases, usage errors, unknown commands, enabled help and DM/comment
  privacy behavior are deterministic database tests.
- Signed event ingestion, scope rejection, namespace isolation and concurrent
  duplicate/conflicting webhook deliveries are atomic.
- Code issuance/replacement/expiry/redemption, takeover/replay protection,
  explicit consent defaults, disconnect/relink and stale identity fencing.
- External action claim/retry/completion, binding mismatch, expiration and rollback.
- DM and comment delivery use one protocol; provider rejection retries are bounded;
  timeout/expired send leases stay uncertain; late results cannot corrupt new work.
- Pilot/paused/public modes, rate limits, member inactivity/blocking and consent
  withdrawal apply at execution and again when required before external effects.
- Generated role grants execute the intended RPCs and deny browser/cross-scope use.

## Implementation order and checks

1. Add the native parser/registry and Clojure behavior tests; establish typed RPC
   boundaries and replace JS-owned mock command handling.
2. Consolidate event/command receipt state and adapt the proof/member protocol.
3. Implement durable external actions, encrypted linking preparation and resumption.
4. Generalize outbox destinations and consolidate delivery/reconciliation policy.
5. Reduce JS to interop/provider adapters; port mock first, then Instagram/TikTok
   and public comments without activating production processing.
6. Remove superseded native receipt/functions and JS test/handler paths; regenerate
   catalogs, schema/grants and document the final adapter contract.

Each slice must pass its Supabase Clojure tests and regeneration checks before
continuing. Final acceptance runs the complete native common/workflow suites,
generation parity, build and repository checks. Report existing unrelated
failures separately. No deployment, installation on an existing application
DB, or production cutover is authorized by this plan.

## Implementation checkpoint

The native registry, channel-aware parser, enabled help and public reply
composition are implemented in `fn/social/social_commands.clj`. The Clojure
Supabase scaffold suite `finfolkdb.fn.social.social-commands-test` passes 29
checks through `make test-db-social`; `make test-db-mock` and
`make test-db-messaging` alias this target.
The former JavaScript mock test was removed. No new JavaScript tests are part
of this design.

Canonical event intake and public command execution now run in
`fn/social/social_events.clj`. Its 41 Supabase checks cover deduplication,
conflicting retries, scope validation, comment privacy, ordinary mentions,
rollout/generation checks, rate limits and composite foreign keys. Events and
commands reference one another; DM/comment replies use the common outbox without
a legacy receipt.

`fn/social/social_actions.clj` implements durable `verify-account` and
`prepare-link` actions. Claims carry a fenced lease and exact inbox/event/account
generation binding. PostgreSQL checks provider evidence, bounds retries, admits
three code requests per sender per hour, replaces proofs atomically, and resumes
the command with an encrypted outbox reply. Only the code hash is persisted;
private message history holds a placeholder. Replaced or redeemed codes cancel
their pending deliveries, and sending deliveries become uncertain.

`fn/social/social_connections.clj` implements inbox-scoped authenticated-member
redemption and disconnect. Consumption is atomic under concurrent redemption,
sharing remains disabled, social identity membership is resolved through the
connection, and revocation clears consent/secrets, rotates identity version and
expires pending private actions and replies. Native `/disconnect` uses this same
protocol. Clojure coverage lives in `social_actions_test.clj` alongside the
parser/event suites.

`fn/social/social_delivery.clj` now implements one DM/comment claim and completion
protocol. A committed send lease lasts sixty seconds; only known rejection can
retry, with database backoff and a five-attempt limit. Ambiguous outcomes and
abandoned send leases remain uncertain. Terminal delivery clears sealed material.
The shared policy module rechecks current audience, enablement, generation,
connection version, activity/blocks, proof validity and public publication consent
before external effects. Comments expose no private conversation destination.

Reconciliation recovers abandoned read/crypto actions with fresh leases, stops
after three attempts, expires proofs and terminates stale commands/events. Each
queue scans at most one hundred rows per transaction and commits its cursor on
the inbox, allowing repeated calls to advance past unchanged valid work. The
worker contract is documented in [SOCIAL_MESSAGING_RPC.md](SOCIAL_MESSAGING_RPC.md).
The Clojure social suite now includes delivery/recovery and real trusted-role
execution checks; the common suite passes 248 checks across 26 namespaces.

Legacy receipt and duplicate send-state removal, restoration of native messaging
entry defaults/operation tracking, separate worker privileges, real HTTP boundary
tests and the thin-adapter replacement remain in the active
implementation goal. The preceding
mock CLI still invokes its earlier JS handler until those components replace it;
it is not the completed implementation described above. Local Supabase is
running for continued goal work; the older plain PostgreSQL test container was
stopped to free port 55432. Restore it after stopping Supabase when goal work ends.
