# Local mock social provider

`mock` is a native provider alongside Instagram and TikTok. The local harness uses real signed HTTP requests, Clojure-authored RPCs and disposable Supabase PostgreSQL databases. It imports no historical migration fixtures and does not create a managed-auth substitute. Production entrypoints never register its endpoints.

Run `make test-db-mock` for automated native domain coverage; it aliases `make test-db-social`. The CLI transport below is a separate interactive harness. Docker and the pinned Supabase CLI must be available. An existing FinFolk local stack on port 55432 is reused. The runner creates a database from template0 and removes it after success or failure.

For interactive testing, run `make mock-social`. Startup prints one JSON configuration containing the loopback URL, webhook signing secret, admin token, two inbox UUIDs and two `[member-token, member-UUID]` pairs. These credentials are ephemeral and only work in that process. Stop with Ctrl-C to close both HTTP servers and remove the database. Starting another process gives a fresh environment; there is no implicit persistent reset command.

Use another terminal, replacing the capitalised values with startup output:

```sh
make mock-social ARGS='send URL SECRET INBOX sender-one /ping'
make mock-social ARGS='drain URL ADMIN_TOKEN'
make mock-social ARGS='replies URL ADMIN_TOKEN'
make mock-social ARGS='send URL SECRET INBOX sender-one /connect'
make mock-social ARGS='drain URL ADMIN_TOKEN'
make mock-social ARGS='replies URL ADMIN_TOKEN'
make mock-social ARGS='redeem URL MEMBER_TOKEN INBOX CODE'
make mock-social ARGS='send URL SECRET INBOX sender-one /whoami'
make mock-social ARGS='drain URL ADMIN_TOKEN'
make mock-social ARGS='inspect URL ADMIN_TOKEN'
make mock-social ARGS='disconnect URL MEMBER_TOKEN INBOX CONNECTION_UUID IDENTITY_VERSION'
```

`/help`, `/ping`, `/connect`, `/status` and `/whoami` are deterministic test commands. Unconnected senders retain SocialAccount, MessagingIdentity and conversation history; their member resolves to null. Connecting creates a SocialConnection; the identity's user column stays null. Membership is resolved again within processing completion, with a connection row lock, so queued work cannot use a connection revoked before execution. Disconnect does not remove history. Sharing stays disabled.

The operated inbox has its own SocialAccount; each sender has another. Their namespace is derived from the mock application and inbox UUIDs. Matching sender IDs in distinct inboxes are distinct identities. The receipt-bound proof RPC validates the receipt's actual participant before creating a ten-minute, hashed, single-use proof. Sending another /connect revokes older pending/verified proofs. The adapter seals prepared replies with an ephemeral AES-GCM key and decrypts them at delivery; captured provider replies contain the synthetic plaintext codes. This does not configure production credentials or delivery.

POST `/v1/messaging/webhooks/mock` accepts `{version:1,inbox,events:[{eventId,messageId,threadId,senderId,text,timestamp}]}`. Timestamp is epoch milliseconds; the adapter converts it to the native microsecond convention and assigns a one-hour test reply window. `mock-signature` is `t=UNIX_SECONDS,s=HEX_HMAC_SHA256`, signing `timestamp + '.' + exact request bytes`. Request timestamps must be within five minutes. Local scopes and member IDs cannot be supplied by events.

Admin endpoints under `/__mock/` support `drain`, `step`, `replies`, `inspect`, `identity` and `outcome`. Outcome accepts `accepted`, `retry`, `failed`, `uncertain` or `lost_ack` for the next outbound HTTP send. The provider simulator captures accepted/uncertain sends in memory, while PostgreSQL owns all domain and outbox state. Uncertain sends are not automatically retried. Redemption and disconnect use a test-member bearer token; redemption accepts `{inbox,code}` and disconnect accepts `{inbox,connectionId,identityVersion}`. Authentication here is a local fixture, not the production sign-in service.

The standalone local gateway reuses the shared native messaging database bridge and delivery protocol. It is deliberately separate from production OAuth/Worker configuration. Native schema changes and the shared handler context are reusable, but this work does not migrate Instagram/TikTok adapters or implement comments, real OAuth, browser UI or hosted mock access.

## Database tests

The replacement social/messaging implementation is specified in
[SOCIAL_MESSAGING_DSL_PLAN.md](SOCIAL_MESSAGING_DSL_PLAN.md). All new tests are
Clojure facts using the local Supabase scaffold; the former JavaScript mock
integration test has been removed. Run `make test-db-social` (`test-db-mock` and
`test-db-messaging` are aliases). The suite covers the native command registry,
parser, channel policy, enabled help, public replies, canonical event ingestion,
deduplication, rate limits, event/command/outbox scope constraints, fenced external
actions, encrypted linking preparation, member redemption and disconnect/relink.
Delivery leases, bounded retries, uncertainty, current policy checks and recovery
are also covered. See [SOCIAL_MESSAGING_RPC.md](SOCIAL_MESSAGING_RPC.md) for the
native worker contract. The mock CLI uses that native runtime through signed local
HTTP ingress and a simulated provider. Production provider adapters and broader
automated HTTP boundary coverage remain separate migration work.
