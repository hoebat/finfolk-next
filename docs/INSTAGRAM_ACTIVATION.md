# Instagram activation and staged discovery rollout

PR #4 supplies the versioned DM API, encrypted credentials, Settings controls and durable processing. This release adds current-follower proof for personal comment actions and automatic publication, connection-generation binding, and admin operational health. Infrastructure and mocked integration tests are not live Meta acceptance.

## Connection cutover

Use the DM-first `/connect` workflow described in [Instagram commands](INSTAGRAM_COMMANDS.md). Stage migration 0016, deploy the compatible backend, apply retirement migrations 0017–0018, then deploy the UI. Enable `connect` in the existing pilot; `/claim` redirects immediately, and no legacy manual approval remains. Preserve existing connected accounts and the stable encryption key.

## Operator configuration

Use the permissions-restricted, ignored `.env.local` as the canonical operator configuration. Preserve the existing `MESSAGING_ENCRYPTION_KEY`; never regenerate it during deployment. Keep encrypted backups verified. Store static messaging client/signature secrets and the encryption key in Worker secrets and protected GitHub Actions secrets. The messaging credential remains encrypted in Neon. The Page token is validated against its configured app, Page and linked Instagram account; reconnect when revoked or expired.

Resolve the owner’s actual verified Neon member ID from their signed-in FinFolk account before configuring `INSTAGRAM_ADMIN_IDS`. Use the sole `instagram-facebook` provider. The callback is `https://api.finfolk.com.au/v1/integrations/instagram/oauth/callback`; the stable webhook is `https://api.finfolk.com.au/instagram/webhook`.

In Settings, authorize only `@finfolk.com.au`. Verify the actual account, app-level webhook configuration and brand subscription. Keep processing paused until these checks succeed. Account recovery, required security verification, Meta app access/review and real-user testing cannot be replaced by database flags or synthetic evidence.

## Only supported authorization: Meta Facebook Page

Use `INSTAGRAM_MESSAGING_PROVIDER=instagram-facebook` for every Instagram feature: DMs, comments, mentions and media. This is the existing Facebook Login for Business / Page-token pathway. The separate system-user Unified Login variant and Instagram-only Login are removed; unsupported provider settings fail rather than falling back.

The production bindings are Meta app `1667613151655339`, Facebook Page `1387107281155901`, linked Instagram account `17841461601419539` (`@finfolk.com.au`). Set the Meta app credentials in `INSTAGRAM_MESSAGING_META_APP_ID` and `INSTAGRAM_MESSAGING_META_APP_SECRET`, the Page in `INSTAGRAM_MESSAGING_PAGE_ID`, and the linked Instagram account in `INSTAGRAM_MESSAGING_ACCOUNT_ID`. Preserve the existing Page credential namespace and encryption key. `.env.local` is the canonical private operator file; deployment retains secrets in Worker storage and tokens encrypted in the database.

One Facebook authorization dialog requests `instagram_basic`, `instagram_manage_messages`, `instagram_manage_comments`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata` and `pages_messaging`. A short-lived Facebook user grant is exchanged for a long-lived user grant and then the token for the explicitly configured Page. Verify token type `PAGE`, app ID, Page identity and linked Instagram account before installing it. Arbitrary assigned accounts and system-user grants are not accepted. Page tokens require reauthorization when revoked or expired; Instagram user-token refresh endpoints are not used.

The old Actions configuration `1823789635502060` and Messaging configuration `2606242293176301` are historical Meta dashboard records, not alternative runtime pathways. Login configuration IDs and Instagram-only client credentials no longer select runtime behavior. Do not create another app or switch providers to enable comments.

App-level callbacks, account subscriptions, token permissions and live delivery are separate checks. A valid messaging grant does not imply comment access. Subscribe and verify `messages` on the Page and linked Instagram account. Where the grant includes `instagram_manage_comments`, also subscribe `comments` and `mentions` on the linked Instagram account. Preserve current subscriptions during reconnection. Keep comment replies paused until diagnostics prove grants/subscriptions and owned/external test comments receive exactly one visible reply.

## Public help release

Public assistance (`help`, `ping`, unknown-command guidance and the welcome prompt) does not require following, registration or a profile lookup. Both processing and sending use this policy. It still requires signed receipts, an authorized brand, subscription, enabled command, matching rollout and the reply window. Do not mark follower verification or timestamps for public assistance. A deleted/unlinked member can still ask for public help.

Start with only `help` and `ping`. The help reply introduces FinFolk, lists enabled commands and links to the site; it never advertises disabled personal actions. Help-only readiness does not require follower verification. For public acceptance, submit `nonFollowerHelpEventId` alongside the diagnostic event IDs and confirmations: it must identify a successful help response to a separate unregistered sender. The operator must actually confirm that this person was not following and saw the reply. This sets public-help acceptance, never personal-command negative-test acceptance. Missing evidence blocks public activation.

Personal commands continue to require current follower proof at processing and sending. In a future personal-command pilot, a signed `/status` receipt can verify the follower lookup before connection codes are issued. Enabling personal commands in live mode must independently satisfy personal follower and negative-test requirements.

## Acceptance sequence

1. **Paused receipt:** send a fresh message from `@chriszfree`. Inspect the signed receipt and observed scoped sender. Do not infer a sender ID from a handle or reuse a Facebook-scoped ID.
2. **Diagnostic pilot:** allowlist the observed sender, enable only `ping` and `help`, and send both commands again. Record each event ID, completed processing, Meta message ID, and an actual visible Instagram reply. Target 30 seconds in normal operation. Provider acceptance is not proof of delivered/read status.
3. **Small member pilot:** the operator selects 3–5 consenting divers from signed receipts. Enable connect, status, check-in and points after diagnostic acceptance. Test verified email, follow, connect, reload/retry, unlink/relink and private replies. Use Bondi first; check-ins are real visits, not fabricated diagnostics.
4. **Nonfollower tests:** first verify a consenting, unregistered sender receives `/help`. For personal commands, use a consenting pilot before they follow; confirm no personal command effects/reply. After following, repeat successfully. Do not unfollow `@chriszfree` merely to manufacture the test.
5. **Comments:** independently verify Facebook Login subscriptions, mentioned-comment retrieval, owned-comment retrieval and correct public reply routes on owned test posts. Enable public `help` and post `status` first. Personal comment actions require the separately proven comment identity and a current follower check through the linked Page-authorized Instagram messaging connection.
6. **Discovery before publication:** enable collection for pilot authors and inspect pending content around Bondi before enabling public publication. Automatic publication requires verified media ownership, explicit sharing consent, one clear beach and current follower eligibility. Ambiguous places, unknown authors and third-party suggestions stay reviewed; inaccessible posts use manual URL submission. Content stays on Instagram through links/embeds.
7. **Public release:** record real production-access and non-follower acceptance in Settings before selecting Public. Widen read-only messaging, personal commands, discovery and publication separately. Do not enable public features merely because a deployment completed.

Use the current Settings API and idempotency contract for rollout changes. Pausing cancels eligible unsent work; previously paused receipts do not replay when enabling. Inspect uncertain replies in the actual Instagram thread; never clear uncertainty to force a resend.

## Identity and publication rules

Migration `0014_instagram_connection_proofs.sql` adds a connection generation and records the DM provider scope/generation alongside each public-comment proof. Existing comment proofs require a fresh challenge; profile links are preserved. A completed fresh connection rotates the connection generation, clears stale media-owner evidence and resets automatic sharing consent. The member must verify the author proof and opt in again before automatic publication.

Follow lookup uses the Page-authorized Instagram messaging sender belonging to the verified member, never the Facebook comment actor. Personal action preflight and send-time checks enforce the current messaging rollout and pilot list. `/help` and public post `/status` do not require a follower lookup. Follower proof is short-lived, bound to the exact sender/scope/generation, and checked again against the database before effects. Provider network requests stay outside SQL transactions. Consent and identity changes during the lookup prevent automatic publication or member placement.

## Health and validation

`GET /v1/admin/messaging/instagram` adds optional `health` metadata: `status`, `issues`, pending/uncertain/failed reply counts and stalled-command count. The additive OpenAPI schema preserves existing clients. Settings shows token expiry and actionable refresh/subscription/delay/uncertain-reply diagnostics without sender IDs or message content in general health. Paused mode remains visibly paused; no recent traffic alone is not an outage.

Run the full npm suite, actual workerd checks, versioned API/OpenAPI SQL integration, comment/discovery SQL integrations, static build and Worker dry-run. Regression cases include non-followers, unavailable follow lookup, separate provider namespaces, same-sender relinking, consent changes during lookup, concurrent duplicate delivery, private confirmations, uncertain sends and rollback. Real Instagram acceptance must be recorded separately.

## Recover an approved grant awaiting account verification

For an initial connection, a successful Meta code exchange is retained encrypted with `pendingVerification=true` if the assigned-account or subscription checks fail. Messaging stays paused and both authorization/subscription checks remain false. A failed reconnect preserves an already verified credential. Provider verification stays outside the database transaction; the final update checks that a newer grant has not replaced it.

A privileged operator with the database connection, existing encryption key and matching provider configuration can run `node --env-file=.env.local scripts/verify_instagram_authorization.mjs --inspect` to read permission status, assigned-account counts and brand access without printing credentials or message content. After repairing the Meta asset assignment, use `--verify` to repeat the same account/subscription checks and save the verified connection. The command requires the original authorizing member to remain active and email verified, and rejects changed OAuth configuration. It never enables command processing.

## DM-issued connection codes

Apply `0016_instagram_connect.sql` using the existing migration runner on an isolated database branch first, then deploy the backend and frontend. Enable `connect` in Messaging Settings for pilot senders before public release. Existing connections and legacy `/claim CODE` clients continue to work; the website presents the new Connect Instagram dialog only when `capabilities.connect` is available.

The dialog demonstrates following @finfolk.com.au, sending `/connect` and receiving a code. Codes contain eight characters, expire after ten minutes and are entered on the authenticated website. Verified FinFolk email and a current follower check are required. Nonfollowers may receive follow-and-retry guidance but never a code; this is the only new exception to personal-command denial replies. `/help` advertises `/connect` only when enabled and hides the legacy `/claim` command.

A new `/connect` replaces the sender’s unused code. Duplicate receipts reuse the persisted reply; uncertain deliveries are not automatically resent. Code replies are encrypted in the durable outbox; only hashes are stored in challenge records. Administrative event views and logs omit codes. Issuance is limited to three per sender per ten-minute window; redemption to ten attempts per member and trusted Cloudflare client IP per fifteen-minute window. The scheduled reconciler removes challenge records and expired rate buckets after a day. Codes are not stored in browser storage.

Run `npm run test:connect` for the isolated Postgres/WASM and dialog tests; these do not access Neon, live Instagram or production data. Before public activation, verify actual delivery, pasting on mobile, a nonfollower’s guidance/no-code response, follow rechecks, and disconnect/reconnect using consenting test accounts. The local Postgres/WASM harness serializes database transactions; use the existing isolated Neon integration environment for true multi-connection lock contention checks. Disabling `connect` blocks issuance and redemption while preserving connected accounts.

## Single-path release — 8 November 2026

API Worker version `2335c13b-65a2-42e8-904d-46d45435dc85` enforces the Page-token pathway; the previous pre-cleanup release is `88575f4f-a9c6-4d29-94f2-2a6472ca9657`. Instagram-only and system-user login, user-token refresh and raw-token fallback helpers are removed. The generic messaging gateway also rejects the retired methods; TikTok remains independent. Retired Firebase setup tooling is removed.

The existing production encrypted grant still opens under the unchanged `instagram-facebook` namespace and encryption key. No schema, managed authorization or account data was changed. Local obsolete login-configuration IDs were removed from `.env.local` with verified encrypted backups before and after. The deployment used the existing published source plus only the relevant API cleanup, excluding unrelated ocean-data work.

Generation/parity checks, repository tests, isolated PostgreSQL messaging suites, production and native Next.js builds, and the Worker deployment dry-run passed. Production health was checked after deployment. Comment replies remain paused; the cleanup does not grant `instagram_manage_comments` or certify live delivery. The canonical authorization dialog now requests this permission on the same Page pathway, followed by the actual subscription and test-post acceptance checks above.
