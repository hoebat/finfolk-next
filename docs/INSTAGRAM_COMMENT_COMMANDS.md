# Public comment release on Next

The default release enables only `/help @finfolk.com.au` and `/status @finfolk.com.au`. Membership and following are not required. Status returns public records only. Unsupported slash commands return help without creating member actions. Ordinary mentions do not receive automatic replies.

Runtime controls in `wrangler.next-api.jsonc` default to paused:

- `INSTAGRAM_COMMAND_REPLIES_ENABLED`: master switch.
- `INSTAGRAM_COMMENT_MODE`: `paused`, `pilot`, or `public` (unknown/missing means paused).
- `INSTAGRAM_COMMENT_COMMANDS`: comma-separated enabled commands, default `help,status`.
- `INSTAGRAM_COMMENT_TEST_POSTS`: provider media IDs allowed in pilot mode.
- `INSTAGRAM_COMMENT_ACTIVE_SINCE`: required ISO timestamp; only comments created at or after this boundary are eligible.

Before pilot activation, verify the managed Page grant, linked FinFolk account, actual `instagram_manage_comments` permission and both `mentions` and `comments` subscriptions. Set a fresh activation timestamp and designated test media IDs. Prove both owned-comment and external-mention retrieval and visible replies from the brand, including help/status for an unregistered nonfollower. Record comment IDs, context, command record, reply ID and operator-observed thread in the acceptance record. Never record credentials. Provider acceptance alone does not prove a visible reply.

For public activation retain `help,status`, set mode `public` and use a fresh activation boundary. On pause, disable the master switch or set mode `paused`. Re-activation must advance the boundary to prevent replaying accumulated comments. Old pending sends encountered outside the current rollout become skipped. Ambiguous sends remain uncertain and require inspecting the actual thread; never automatically resend them.

Authorization diagnostics include safe comment rollout settings alongside permission and subscription evidence. No new schema or SQL-release hash is needed for this Instagram stage. Existing member commands remain available only through explicit command configuration and their independent identity, follower and action gates; do not enable them for this release.

TikTok is the subsequent phase after Instagram live acceptance. It needs a separately verified Mentions API authorization and live webhook/retrieval/reply contracts; the Business Messaging questionnaire does not prove comment permissions. No TikTok comment delivery adapter has been activated by this change.

## Deployment and live inspection — 6 November 2026

- Deployed paused release `88575f4f-a9c6-4d29-94f2-2a6472ca9657` to `finfolk-next-api` / `api.finfolk.com.au`. Previous version: `4e170f70-f999-4eb2-a58f-be372e0dfa7f`.
- Reconstructed the published Worker source from its source map and overlaid only the comment-command and diagnostic modules; retained live bindings and variables, adding paused comment rollout controls. Unrelated checkout changes were excluded.
- Live HTTPS database inspection confirmed `finfolk_next`, Facebook Page provider, pilot mode and a valid token bound to the expected Meta app, Page and Instagram account.
- The live grant lacks `instagram_manage_comments`. Neither `comments` nor `mentions` was present in the account subscription lookup. Authorization for DMs does not establish these capabilities.
- The authorized account media lookup returned no posts. No live comment was created or replied to, and no live-delivery acceptance was recorded.
- Next: add the comment permission to the Meta login configuration and complete account authorization; verify both account webhook fields; designate a brand-owned test post and a consenting external public test post; then activate pilot-only replies with a fresh timestamp. Keep public access paused until actual thread evidence passes.

---

# Instagram comment commands

Comments must mention `@finfolk.com.au`. Either mention-first or command-first works; commands are case insensitive. One slash command per comment. Ordinary mentions retain the discovery/review workflow.

- `/help @finfolk.com.au`: fixed help.
- `/status @finfolk.com.au`: this post's public trip report or public beach listing; only a verified owner can receive their own pending status. No private draft contents.
- `/me @finfolk.com.au`: verified profile link when Open; private account controls when Closed. No statistics.
- `/publish Bondi Beach @finfolk.com.au`: sharing request. Only the independently verified media author, with sharing consent and one matched beach, is eligible for automatic publication. Other recommendations stay in review. Existing suppression and hidden-post rules apply.
- `/checkin Bondi Beach @finfolk.com.au`: today's self-reported visit.
- `/checkin YYYY-MM-DD Bondi Beach @finfolk.com.au`: an explicit visit date from local today minus 29 days through today. Never infer visit dates from media timestamps.

## Member experience

Account → Instagram comment commands contains examples, one-time verification and private pending check-ins. First connect and verify Instagram through the Instagram Login DM service. Personal actions additionally require current follower eligibility and the active messaging pilot/public rollout. Then generate a one-time `/me CODE @finfolk.com.au` command and post it from that account within 15 minutes. FinFolk binds the provider-fetched comment actor to the existing verified member using code possession **and** the provider-fetched account handle. Handles alone and DM sender-ID equality never authorize comments. Codes are stored as hashes and removed from persisted command arguments after use. Disconnect removes the binding and cancels pending work.

A check-in without one clear supported beach, or an undated request processed on another local calendar day, requires private location/date confirmation. Public replies never disclose beach, date, visit counts or live presence. Existing `(member, beach, local day)` uniqueness prevents repeated visits being counted twice. Visit records remain manageable in normal account controls.

## Delivery and operation

Signed webhooks persist event IDs before queueing. `mentions` retrieves external mentioned comments; `comments` retrieves brand-owned media comments and verifies media ownership. Explicit commands are intercepted before discovery and legacy actions, even when commands are paused. External mention replies use `/{brand}/mentions`; owned-media comments use `/{comment}/replies`.

Command execution, rolling-limit reservation, identity binding and check-in insertion run in a Postgres transaction. Sender limit: 5 comments / 10 minutes; post limit: 20 / hour; brand limit: 100 / hour. Duplicate comment IDs never execute twice. Reply claims use a conditional atomic update; ambiguous POST responses and interrupted sends become `uncertain`, never automatically resent. Cron recovers persisted pending replies. Admin activity exposes uncertain replies; after inspecting the Instagram thread, enter the actual reply ID or skip. No automatic resend control exists.

Separate Worker flags default to false:

```
INSTAGRAM_COMMAND_REPLIES_ENABLED=false
INSTAGRAM_COMMAND_CHECKINS_ENABLED=false
INSTAGRAM_COMMAND_PUBLICATION_ENABLED=false
```

Publication also requires the existing `INSTAGRAM_PUBLICATION_ENABLED` gate. Comment commands do not enable DM commands or the legacy statistics replies. Member API actions remain authenticated; confirmation checks the current connection, identity, active/email-verified member, command ownership, beach and rolling date window again.

## Activation checklist

Deployment alone does **not** activate Instagram responses. Keep flags false until:

1. A production token has the actual required Meta grants and access to the linked FinFolk professional account.
2. The app/account subscriptions include both `mentions` and `comments`; Meta app publishing/access requirements are satisfied. Dashboard sample callbacks alone are insufficient.
3. On designated test posts, prove retrieval of `from.id`, `from.username`, timestamp, media identity/owner and permalink for both contexts. Verify one-time binding without assuming namespaces match. If a field is unavailable, leave identity/automatic actions gated.
4. Prove an actual reply appears under the original comment from `@finfolk.com.au`, with the expected route, and repeated webhook delivery produces no second reply.
5. Test `/help`, `/status`, Closed `/me`, check-in/private confirmation and opt-in publication before opening each corresponding flag.

Official references: [mentioned comments](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/mentioned_comment/), [mentions replies](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/mentions/), [owned comment replies](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/replies/). Meta's reference pages may require a developer login. Provider behavior still requires the live acceptance checks above.

## Validation

```
node tests/test_instagram_commands.mjs
node tests/test_instagram_commands_ui.mjs
node --env-file=.env.test.local scripts/migrate_neon.mjs
npm run test:instagram-commands
npm test
npm run build
npx wrangler deploy --dry-run
```

The integration script refuses any branch other than `finfolk-regulars-dev`, creates synthetic members, uses mocked provider responses with real Postgres transactions, and cleans up. It covers namespace isolation, code binding, public privacy, rolling dates, duplicate concurrent delivery, private confirmation ownership, command interception, both reply routes, third-party publication review, durable limits and uncertain-send reconciliation. It does not certify live Meta access.

Connection proofs are also bound to the current DM provider scope and connection generation. Fresh claims/relinks invalidate old comment and media-owner evidence; sharing consent must be enabled again. See [activation runbook](INSTAGRAM_ACTIVATION.md).
