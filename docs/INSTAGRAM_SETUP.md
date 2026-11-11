# Instagram connections, Actions and invitations

The active implementation uses Neon Postgres, Neon Auth and the `finfolk-community` Cloudflare Worker. Legacy Firebase Instagram functions are not used. The brand account is `@finfolk.com.au`.

## Versioned messaging API

Instagram has one authorization pathway: **Meta Facebook Login for Business → configured Facebook Page token → linked Instagram professional account**. It serves messages, comments, mentions and media. Use the [canonical activation runbook](INSTAGRAM_ACTIVATION.md#only-supported-authorization-meta-facebook-page) for current settings and verification. Instagram-only login and the separate system-user flow have been removed.

## Existing Meta registration

FinFolk is already registered as Meta app `1667613151655339`, with domain `finfolk.com.au`, Facebook Page `1387107281155901` and linked Instagram account `17841461601419539` (`@finfolk.com.au`). Do not register another app. The original Actions configuration `1823789635502060` included comment permissions; the later Messaging configuration `2606242293176301` focused on messaging. These are historical dashboard configuration records, not independent runtime provider options.

The last live check on 6 November 2026 verified the app/Page token but found `instagram_manage_comments` absent and no account `comments`/`mentions` subscriptions. The deployed comment release remains paused until the existing connection is reauthorized and live acceptance passes. Historical dashboard sample callbacks do not prove current account subscriptions or real delivery.

## Instagram account claiming

Connect through Instagram: follow @finfolk.com.au, send `/connect`, then enter the private eight-character code in the signed-in Instagram tab. See [member workflow, commands and activation](INSTAGRAM_COMMANDS.md). `/claim` and the older manual `FINFOLK <code>` approval path are retired; existing verified connections remain valid.

## Current controls

`INSTAGRAM_ENABLED` gates the legacy action processor; the managed Page connection has its own messaging and comment rollout controls. Member linking uses the DM-first `/connect` workflow above. Manual challenge review and Firebase custom-claim setup are retired. Administrator access uses the verified Neon member IDs in `INSTAGRAM_ADMIN_IDS`.

## Deployment

Use the existing `finfolk-next-api` Worker, `finfolk_next` database and Next Instagram queue declared in `wrangler.next-api.jsonc`. Never install a schema merely by generating it. No schema migration is required for the single-provider cleanup.

Keep static app/signature secrets and `MESSAGING_ENCRYPTION_KEY` in Worker secrets and the ignored, restricted `.env.local` with verified encrypted backups. The managed Page access token remains encrypted in the database; there is no raw access-token environment fallback. Public app, Page, account and Graph-version identifiers are declared in Worker configuration. See [activation](INSTAGRAM_ACTIVATION.md#only-supported-authorization-meta-facebook-page) for the complete list and reconnection sequence.

The stable webhook is `https://api.finfolk.com.au/instagram/webhook`. Account-level subscriptions and app-level callbacks are separate. Actual comment permissions, lookup fields and replies require live acceptance; dashboard sample callbacks are insufficient. Comments remain independently paused until that evidence is recorded.

## Actions

Every comment yields a review item. Keywords `stats`, `log`, and `points` add independent action types. Explicit `depth 8` and `duration 30` are suggestions only; no dive is inferred from somebody else's post. Unique source-comment/action keys prevent duplicate effects.

- Stats proposals use opted-in fields and an unambiguous beach match for Open profiles. The member confirms the exact public text; an administrator must approve it before sending. Editing text invalidates consent.
- Dive drafts require the requesting member to confirm their own dive, date and beach. Administrator approval atomically inserts one private session. Posts from other people remain attributed source recommendations.
- Participation awards require review and are capped at one point per member per Australia/Melbourne calendar day. No awards depend on depth, duration or breath holding. Administrators can reverse a ledger entry.
- Reply sending first claims the action. An interrupted or ambiguous provider response remains `uncertain`; there is no blind retry. Administrators must inspect the actual Instagram thread before marking it sent or returning it to review. In-flight replies cannot be reset within 20 minutes.
- Members can cancel pending actions or disconnect. Disconnect cancels pending work and hides public points. Approved/sent history is retained for review; account deletion removes the member's connection/actions/invitations and ledger.

## Invitations

Each verified FinFolk member can get a unique invite link and view aggregate join/verified counts. The new member explicitly accepts the invitation after sign-in. One inviter is credited per new member. The inviter receives one referral point only after the new member's Instagram sender identity is verified. A sender identity can unlock only one referral award, including after handle changes. Referral points are separate from the daily participation cap. Public totals are opt-in and displayed in eligible beach community cards; there is no leaderboard.

The initial default rewards the inviter only. These records represent FinFolk invitations, not a verified Instagram mutual-follow graph. No monetary rewards or redemption are implemented.

## Tests and activation checklist

`npm test` includes Actions UI and animated walkthrough checks. Run `npm run test:instagram-actions` only with the isolated `finfolk-regulars-dev` env file; it tests against actual Postgres rows with synthetic members and no external Instagram messages. `npm run test:neon` checks account/community regression.

Before activation, use the real brand plus two public test accounts to verify own-post and third-party comment mentions, connection code ownership, private/deleted sources, duplicate deliveries, unknown senders, exact stats consent, private dive logs, admin-only replies, pause/disconnect, points limits, referral attribution and token expiry. Test uncertain-reply reconciliation explicitly. Inspect the Cloudflare dead-letter queue and pending event inbox. Do not advertise automatic Instagram connection, follower gating or universal mention coverage.

## Automated post discovery

The new discovery pipeline, public beach galleries, member sharing controls, admin review and source monitoring are implemented behind separate rollout gates. See [Instagram discovery operations](INSTAGRAM_DISCOVERY.md) for activation requirements, identity evidence, public APIs, polling budgets and tests. Live collection, public publication and hashtag polling remain disabled until real-provider acceptance.
