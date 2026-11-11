# Instagram messaging API

For the staged operator runbook and cross-provider publication rules, see [Instagram activation](INSTAGRAM_ACTIVATION.md).

`/claim` and legacy claim/manual approval mutations are retired immediately with `410 claim_retired`, including old idempotent replays. Connection status remains readable. Use `/connect` and `POST /v1/me/instagram/connect`; see [the member workflow](INSTAGRAM_COMMANDS.md).

The API contract is [OpenAPI 3.0](openapi/messaging.yaml). The command bot serves only `@finfolk.com.au`. API availability, signed-webhook receipt, command completion, provider acceptance and visible Instagram delivery are separate states.

## Authentication and interfaces

All `/v1/me/instagram` routes require a Neon Auth bearer JWT and enforce member ownership. Redeeming connection codes requires verified email. `/v1/admin/messaging` additionally requires verified email and membership in server-only `INSTAGRAM_ADMIN_IDS`. OAuth callbacks authenticate the initiating administrator through single-use, ten-minute state plus a fresh server-side account/role check.

Mutating REST calls require `Idempotency-Key` (8–128 letters, digits, underscores or hyphens). The same actor/key/method/path/body returns the original response for 24 hours. Changed input returns `409 idempotency_conflict`; expired keys return `409 idempotency_expired`. Authorization URLs in replay responses are encrypted with AES-256-GCM, bound to actor/key through authenticated additional data. Response ciphertext is erased at expiry; non-secret tombstones expire after 30 days. Keep the same key when retrying a lost response.

Success is `{data, requestId}`. Errors are `{error:{code,message,retryable},requestId}`. `X-Request-Id` correlates API requests; `Idempotency-Replayed: true` identifies replays. Body limits are enforced while streaming bytes, before JSON parsing. Errors never return provider response bodies, secrets or SQL. All account endpoints use `private, no-store` caching. See the contract for exact schemas and HTTP status codes.

There is no arbitrary recipient/message sending endpoint. Internal replies are bound to an accepted incoming event and its sender. Existing `/api` Instagram actions remain compatibility adapters to the same domain services; the legacy RPC interface does not offer REST idempotency guarantees.

Example profile linking:

```sh
curl https://api.finfolk.com.au/v1/me/instagram/profile \
  -X PUT \
  -H "Authorization: Bearer $FINFOLK_API_TOKEN" \
  -H "Idempotency-Key: $REQUEST_KEY" \
  -H 'Content-Type: application/json' \
  --data '{"handle":"@chriszfree"}'
```

This saves a self-provided profile URL, not verified ownership. `DELETE /v1/me/instagram` removes it, disconnects verification, invalidates connection codes and cancels unsent member work. Uncertain or already in-flight replies cannot be retracted.

## Provider setup

Messaging, comments and media use the **Meta Facebook Login for Business / Page-token connection** at `graph.facebook.com`, pinned to `v26.0`. `instagram-facebook` is the only supported provider. See [the canonical activation runbook](INSTAGRAM_ACTIVATION.md#only-supported-authorization-meta-facebook-page) for identifiers, permissions, Page-token exchange, subscriptions and acceptance checks. Instagram-only login, system-user authorization and Instagram user-token refresh are not available.

Open Settings → Instagram messaging → Authorize @finfolk.com.au. The Facebook dialog requests the messaging and comment permissions. The callback validates the app-bound Page token and linked account, stores it encrypted and leaves processing paused. Account-scoped messaging and comment identities remain distinct even under this one connection; never equate their sender IDs.

## Receipt → command → reply

`GET /instagram/webhook` returns the exact challenge after token verification and does not need Neon/Auth to be available. `POST` accepts only a valid HMAC over the exact raw bytes, bounded to 262144 bytes. It validates the account recipient and persists normalized, minimal records before returning `200`. Persistence failure returns a retryable `503`. Queue publication failure does not lose the persisted event: the independent recovery job publishes it later.

Message text is not retained as a conversation archive. Only command type, bounded check-in arguments, scoped sender/recipient, timestamps, attribution and diagnostic state are retained. Echoes are ignored; unsupported message types with an ID are recorded as ignored. Malformed timestamps are never replaced with the current time. Disabled mode records paused receipts without executing or queuing them.

The command registry drives parsing and `/help`:

| Command | Claim required | Effect |
| --- | --- | --- |
| `/ping` | No | `Pong.` and a diagnostic reference. |
| `/help` | No | List currently enabled commands. |
| `/connect` | No | Issue an encrypted private code after sender/follow checks; redeem at `POST /v1/me/instagram/connect`. |
| `/status` | No | Explain the sender's connection or how to link it. |
| `/checkin BEACH` | Yes | Record the beach's local day at the incoming message timestamp; duplicates do not create another visit. |
| `/points` | Yes | Return participation and referral totals privately. |

Public help and ping work for followers and nonfollowers within the configured rollout. `/connect` and personal features require authoritative current `is_user_follow_business=true`. Confirmed nonfollowers receive only fixed follow instructions, with no feature effects or private result. Missing follow data fails closed. Ordinary messages receive at most one help prompt per day. Per-sender limits are 30 commands/minute; explicit provider rate limits create account-wide backoff.

Command effects, completion and the outbound record commit together. Duplicate provider IDs cannot create duplicate check-ins, rewards or replies. Queue delivery is advisory and may repeat. The one-minute recovery task retries persisted eligible work with leases, independently from the existing 15-minute discovery scheduler.

Processing states: `received`, `queued`, `processing`, `completed`, `ignored`, `blocked`, `paused`, `failed`.

Reply states: `pending`, `sending`, `provider_accepted`, `failed`, `uncertain`, `cancelled`, `expired`.

`provider_accepted` requires a Meta message ID and does not imply delivered/read. Every send rechecks current follow eligibility, rollout generation, cancellation and its 24-hour deadline. Disconnect or rollout changes cancel unsent work. Old paused receipts and work from an earlier rollout generation are not replayed after enabling.

Only explicit retryable provider rejection or a failed preflight is retried automatically, with bounded backoff and five attempts. A timeout, interrupted send, unreadable send response or ambiguous server error is `uncertain`; it is never automatically resent. Safe admin retries reuse the same command result and are audited. The API rejects retrying uncertain, accepted, pending, cancelled or expired sends. Inspect uncertain results in Instagram directly.

Events and outbound records expire after 30 days. Account deletion removes attributed records, claims, OAuth state and replay responses. General operational audit records expire after 30 days. Connection codes expire after ten minutes.

## Pilot and acceptance

The readiness response also includes optional admin-only health metadata for pending/uncertain/failed replies, stalled commands, authorization expiry and subscription/refresh failures. No traffic alone is not considered an outage.

Settings shows token/setup blockers, brand subscription, follow capability, last signed receipt, last command, last provider-accepted reply and recent event metadata. Expired or revoked Page grants require reconnection. Lack of recent traffic alone is not proof of an outage.

1. With processing disabled, send a new message from @chriszfree. Verify a signed receipt and authoritative scoped sender ID; dashboard delivery by itself is insufficient.
2. Configure pilot mode for sender IDs observed in signed receipts and enable only `ping` and `help`. No other account can execute commands.
3. Send `/ping` and `/help` from @chriszfree. Verify each signed receipt, completed command, one provider-accepted outbound record and one actual visible reply. Target completion within 30 seconds under normal conditions.
4. Record the two event IDs and explicitly attest that their replies are visible. Then enable the remaining pilot commands and test connect, status and points. Check-ins require authorization to create an actual visit; synthetic integration tests cover effects before that authorization.
5. Complete the authorized non-follower test without unfollowing @chriszfree. Instagram's followers-only request setting has exceptions for existing chats/accounts the brand follows; the API follower gate must still block command processing.
6. Record the real Meta production-access/publishing check and non-follower acceptance. Public mode is rejected until all readiness and acceptance checks pass.

Rollback: select Paused. This cancels pending replies and blocks queued work. Keep signed receipts and completed links for diagnostics. Do not clear uncertain delivery states to force a resend.

## Verification

- `npm run test:messaging`: validate OpenAPI, encryption/AAD, provider contracts/error classification, command registry, body limits and admin UI separation. The actual workerd runtime test verifies encrypted replay, Unicode, scope binding and database-free webhook verification.
- `npm run test:messaging:integration`: migrate only the isolated `finfolk-community-pilot-test` endpoint; exercise the actual Worker database role with mocked Meta transport; validate real HTTP responses against OpenAPI; cover OAuth, replay/ownership, follower gates, connection/legacy retirement, queue recovery, replies, uncertainty, rollout and deletion cleanup.
- `npm test`, Python tests, static build and Wrangler deployment dry-run retain existing account, trip, discovery and comment-command coverage.
- Real Meta acceptance remains a separate gate; mocked responses and dashboard tests never count as live delivery success.
