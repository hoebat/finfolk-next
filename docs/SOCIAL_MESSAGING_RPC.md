# Native social worker contract

This is the implemented PostgreSQL protocol for the design in
[SOCIAL_MESSAGING_DSL_PLAN.md](SOCIAL_MESSAGING_DSL_PLAN.md). JavaScript adapter
replacement and privilege separation remain in progress. Nothing here activates
production processing.

Every worker call binds a trusted application UUID and inbox UUID. These come
from authenticated server configuration. Member calls additionally bind the
authenticated member; an incoming body cannot choose its actor. Calls use the
generated exact signatures in `resources/finfolkdb/rpc-catalog.json`. Mutations
receive a fresh FinFolk operation context. Native times are Unix microseconds.
HTTP requests never hold a database transaction open while contacting a provider.

## Intake and execution

`receive_social_event(application, inbox, envelope, op)` validates and commits
one canonical event, returning `{id, duplicate}`. The envelope contains `channel`
(`message`, `mention` or `owned`), `senderId`, `messageId`, `body`, `sentAt` and
`deadline`. DMs also require `conversationId`. A comment's `messageId` is its
provider comment identifier. `url` and `mediaId` may carry normalized source
context. Provider event IDs are advisory; the message/comment identifier is the
deduplication key. A retry with changed contents fails instead of extending its
deadline. Namespace and generation are derived by PostgreSQL. DM and comment
events have separate namespaces, but share a SocialAccount for the same sender
in one trusted inbox.

The adapter authenticates the signature and normalizes provider fields before
calling this RPC. Acknowledge the webhook after commit. Repeat deliveries are
safe. Public comments do not create private conversations or messages. Private
arguments submitted in comments are discarded before persisting command data.

`process_social_event(application, inbox, op)` executes the next eligible event
atomically and returns its ID, command ID when applicable, and status. `null`
means no event was claimed. Ordinary text is ignored by command dispatch. The
database owns parsing, enabled commands, rollout, limits, membership and replies.
It either finishes the command with an outbox reply or persists an external
action and leaves the command waiting. It accepts no handler or executable
callback.

## External actions

`claim_social_action(application, inbox, op)` returns `null` or
`{id, lease, kind, deadline, binding, request}`. Its thirty-second lease commits
before any external request. The binding contains the action, lease, inbox,
event, inbox generation and account generation. Echo it unchanged at completion.

- `verify-account` asks the provider adapter for identity evidence. A successful
  result contains `provider`, `namespace`, `externalId`, `eligible` and `binding`.
  PostgreSQL verifies the identity binding before advancing to preparation or
  composing an ineligibility reply.
- `prepare-link` asks for cryptographic material. The request supplies code length
  and reply prefix/suffix. The successful result contains `code`, `tokenHash`,
  `ciphertext` and `binding`. The code is eight uppercase alphanumeric characters;
  its SHA-256 hash is lowercase hexadecimal. Encrypt the composed sensitive reply
  with the exact binding as authenticated context, using deterministic key order
  when serializing that context. PostgreSQL validates the material and commits
  only the hash and sealed reply. It never stores the plaintext code in an event,
  action result, command result or message history.

`complete_social_action(application, inbox, id, lease, outcome, result, op)` accepts
`success`, `retry` or `failed`. Failure results carry the same binding and do not
inject reply text or domain mutations. `null` means the result is stale. Known
effect failures retry at database-selected delays, at most three attempts within
the original deadline. Recovery of an abandoned read/crypto claim creates a new
lease; the previous callback cannot commit. Inbox policy and generations are
checked again at completion.

Successful preparation atomically revokes previous proofs, cancels pending old
code replies, creates the ten-minute proof and queues its encrypted DM. If a
replaced reply was sending, it becomes uncertain. `/connect` has a separate
database limit of three accepted requests per sender per hour.

## Member association

`redeem_social_connection(application, inbox, user, code, op)` normalizes and
hashes the submitted code, checks scope/current policy and consumes the verified
proof once. It returns the connection or `null`; another member's existing
connection cannot be taken over. Successful association leaves public sharing
and public points disabled. Social MessagingIdentity records retain their
SocialAccount reference and do not copy the member into their user field.

`disconnect_social_connection(application, inbox, user, connection, version,
excludeCommand, op)` revokes the current association and returns a boolean.
Authenticated web adapters pass `null` for `excludeCommand`; the native command
processor uses the same RPC. Revocation clears secrets and consent, rotates the
identity version and account generation, and invalidates proofs and unsent
personal work. It preserves the external identity and conversation history.

## Delivery

`claim_social_delivery(application, inbox, op)` returns `null` or
`{id, lease, deadline, provider, accountId, destination, payload}`. The destination
contains the channel, recipient, and either a DM conversation or public comment
identifier. Comment destinations do not expose a private conversation ID.
The payload contains `body`, `ciphertext`, `cipherContext` and `replyKind`.
Sensitive bodies contain a history placeholder; only the claimed worker receives
their sealed material. Credentials are not part of this response.

The database checks current rollout, generation, audience, command enablement,
deadlines, proof validity and personal authority before granting a sixty-second
send lease. Personal status replies bind the connection identity version and
recheck member activity and blocks. Public post replies recheck moderation,
consent, owner activity and blocks. Attempts increment when claiming. Use the
delivery ID as the stable provider idempotency key where supported.

Send outside the transaction, then call
`complete_social_delivery(application, inbox, id, lease, outcome, providerId,
retryAfter, op)`:

| Outcome | Database result |
| --- | --- |
| `accepted` | `provider_accepted`; requires the provider's nonempty message ID. |
| `retry` | Only for a known rejection: pending with database backoff, or terminal if policy/deadline/budget now forbids retry. |
| `failed` | Terminal failure. |
| `uncertain` | Acceptance cannot be established; never automatically resend. |

Retry delays start at thirty seconds and double; at most five send attempts are
permitted. A bounded provider retry-after can lengthen that delay. Acknowledging
an accepted send records external truth even if policy changed after its claim.
Terminal completion clears sensitive ciphertext. The result contains delivery
status and retry timing, without returning stored sensitive material. A stale
lease returns `null` and cannot replace a newer outcome.

## Recovery

`reconcile_social_work(application, inbox, op)` expires stale work and proofs,
recovers abandoned read/crypto actions and marks abandoned sends uncertain. It
does not resend them. It returns change counts, `scanned` and `more`.
Each queue scans at most one hundred rows per call; inbox-owned cursors advance
past unchanged rows. Continue while `more` is true and run recovery periodically.
An incomplete pass resumes from its committed cursor. A completed pass resets
the cursor for the next cycle.

The Clojure suites under `test/finfolkdb/fn/social` exercise these transitions on
local Supabase. Run `make test-db-social`; `test-db-mock` and
`test-db-messaging` select the same database suite. No JavaScript assertions are
part of this implementation.
