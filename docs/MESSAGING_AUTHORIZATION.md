# Messaging authorization and credentials

This is the private server credential layer for the new FinFolkDB schema.
Production continues to use the historical integration until a tested cutover.
A successful fixture test is not evidence that a live provider app is approved.

## Database ownership

`finfolkdb.fn.messaging.messaging-authorization` owns conditional credential
installation, activation, pause/disconnect and refresh claims. It uses the same
application/account scope and account generation as message processing.

- `set_messaging_authorization`: installs an already verified encrypted grant
  only if the expected generation still matches. It advances the generation,
  disables the account and expires/cancels old work. Provider verification must
  happen before this call so an unsuccessful reconnect preserves the old grant.
- `activate_messaging_account`: explicitly enables pilot/live processing after
  provider authorization and subscription checks. Pilot activation requires a
  nonempty list of string sender identifiers. App chat needs no provider token.
- `disable_messaging_account`: pauses or disconnects with a generation change.
  Disconnect also clears the encrypted grant and verification metadata.
- `claim_messaging_refresh`, `save_messaging_refresh`, and
  `release_messaging_refresh`: serialize refreshes using a two-minute lease.
  No database transaction is held open during provider HTTP. Saving requires the
  original generation and a current lease. A reconnect winning the race cannot
  be overwritten by an old refresh. Refresh preserves mode and generation.

These functions are private trusted-server interfaces, not browser RPCs. The
application/account parameters select scope; the HTTP gateway must authenticate
and authorize its caller before invoking them. Generated installation SQL grants
no messaging privileges to the public API role.

## Server store

`createMessagingAuthorizationStore` in `backend/messaging-authorization-store.mjs`
uses the existing transactional database and encryption environment.

```js
const authorization = createMessagingAuthorizationStore({
  db, application: 'finfolk', account, encryptionEnv,
});
const saved = await authorization.install({
  credential: grant.credential,
  expiresAt: grant.expiresAt,
  expectedGeneration,
  verify: providerAuthorization.verify,
});
await authorization.activate({
  generation: saved.generation, mode: 'pilot', senders: pilotSenders,
});
```

`install` verifies ownership and subscription before changing the database. The
provider verifier is trusted server code, never supplied by an HTTP client or a
model. Provider proof is reduced to known metadata. Encryption is AES-256-GCM
using `MESSAGING_ENCRYPTION_KEY`; authenticated context binds the ciphertext to
its application, local account, provider, external account and provider app ID.
Ciphertexts copied to other connections cannot be decrypted there. No key or
token is returned from `connection()`, which exposes only safe configuration and
verification flags. `accessToken({authMethod, appId, generation})` is for server adapters only.

The store validates expiry and clamps it to a shorter provider-verified access
lifetime when present. A missing expiry is accepted only with explicit provider
proof that the grant does not expire. Senders pass the claimed outbox generation when loading a token; a reconnect or
pause between claim and credential loading rejects that old work before HTTP.
Token access is temporarily blocked during a refresh claim so a sender does not race a rotating token. Provider tokens,
refresh tokens and refresh expiry/issuance times stay in the encrypted payload.

`refresh({exchange, verify})` claims, decrypts, exchanges, verifies and conditionally
saves a new grant. It prevents silent changes of provider app or authorization
method. Provider failures release the lease and preserve the old stored grant.
If a process fails after the provider rotates a token but before its new grant
is saved, provider-specific recovery or reauthorization can still be necessary;
no database transaction can make the remote token exchange atomic.

`disconnect` clears local credentials before an optional remote revocation call.
If remote revocation fails, local processing stays disabled and the returned
`remoteRevoked` flag records that the remote outcome needs operator attention.
Pausing preserves the encrypted grant but still fences older message work.

## Instagram connection verification

`backend/messaging-instagram-authorization.mjs` verifies the configured account
without the legacy FinFolk username singleton. An optional `expectedUsername`
retains a particular application's explicit brand policy.

- Instagram Login verifies the token's `/me` account identity.
- Facebook Page authorization verifies the app-bound Page token, configured Page
  and linked Instagram account. Page exchange resolves the configured account;
  it does not select an arbitrary Page or assume a FinFolk username.
- Unified Login verifies the business token and selects the explicitly configured
  account from assigned accounts. Multiple assigned accounts do not implicitly
  select a different tenant. Token metadata establishes app binding and whether
  the grant is non-expiring.

All variants check the configured app's message subscription. Subscription
creation requires the explicit `subscribe` option in the trusted setup flow.
The factory provides connection-bound authorization URLs and code exchange.
Instagram user-token refresh preserves issuance time and enforces its minimum
age; Page/system-user grants are not sent to that refresh endpoint.
Legacy provider validation and the running authorization callbacks are unchanged.

## TikTok Business Messaging verification

`backend/messaging-tiktok-authorization.mjs` uses the Business API endpoints,
not the existing profile/video-import OAuth flow. It verifies:

1. Token metadata binds the grant to the configured developer app and account.
2. Messaging send/manage scopes and `user.account.type` are granted.
3. The account reports Advanced Access.
4. A read-only Business Messaging conversation request actually succeeds.
5. The app's `DIRECT_MESSAGE` webhook subscription matches the configured callback.

It provides the Business Messaging code exchange and refresh-token exchange.
The OAuth redirect is trusted configuration, not callback query input. Token
responses must match the expected account, required scopes and positive expiry
values. Refresh-token expiry is retained so an expired refresh grant fails before
HTTP. Setting up the subscription is an explicit server-side option.

See [provider contracts](MESSAGING_PROVIDER_CONTRACTS.md) for the primary source
references. The additional `user.account.type` scope is used to verify entitlement;
existing video-import credentials are not treated as messaging approval.

## Verification and remaining wiring

`make test-db-messaging` runs provider authorization contract tests and live
PostgreSQL tests for scoped encryption, wrong keys/accounts, pilot activation,
expiry, reconnect preservation, concurrent refresh, stale refresh fencing,
provider-verified installation, pause and disconnect. Tokens in tests are synthetic.

Browser authorization state is now bound to its operator, connection, generation,
callback configuration and nonce, with single-use expiry and current operator
rechecks. Opt-in HTTP routing, Worker refresh and trusted application handlers are
implemented. Live account approval, subscription and message delivery still need
configured provider acceptance. See [MESSAGING_ROLLOUT.md](MESSAGING_ROLLOUT.md).
