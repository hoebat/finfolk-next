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

## Multiline help replies — 10 November 2026

Release `ddef9510-4934-43ff-a923-078677923f5c` formats new comment help replies
with an introduction, a blank line, the mention instruction and one enabled
command per line, then a blank line before the site link. `/help` and `/status`
have short descriptions. The reply contains actual LF characters, preserved by
the existing form encoder; no HTML, literal backslash-n text or invisible
spacing characters are used. Disabled commands remain omitted.

The rollout remains the same two-post pilot. Previously sent replies are not
edited or resent. Existing comment processing/transport tests and the repository
tests passed, as did the API deployment dry run; the active production version
and API health were checked. A fresh comment and actual-thread inspection are
still needed to verify Instagram's displayed line breaks at that release.

The later supervised owned-comment send below verified actual multiline
rendering in Dia: blank paragraphs and separate command lines are preserved.

## Owned media received as a mention — 10 November 2026

Comment `18116504573144371` on pilot media `17950528881348521` arrived through
the `mentions` webhook before the owned-comment event. The persisted command
therefore selected the external-mention send route, despite the media belonging
to FinFolk. Its initial attempt ended `uncertain` at `2026-11-09T23:10:30.332Z`;
it was no longer processing during the subsequent wait. This is a reply-routing
failure, not a 15-minute queue delay.

After inspecting the thread and confirming an empty replies edge, the operator
verified the media owner against the authorized brand and made one supervised
send through `18116504573144371/replies`. Meta returned HTTP 200 with reply
`17929539756220478`. The existing command was reconciled as `owned`/`sent` using
that actual reply ID; it was never reset to pending. API readback showed exactly
one reply with six LF characters. Dia independently showed the brand reply,
blank paragraphs and separate command lines. The newline format was accepted.

The permanent fix selects the owned reply route whenever the provider-fetched
media owner matches the configured brand, regardless of which webhook field
arrives first. The SQL-backed regression failed before the fix and passed
afterward; it also verifies that external media retains the mentions route and
a second webhook context cannot create a duplicate reply. Production version
`e8e8de21-8480-4129-ad92-7b2ccb8f88e6` contains this fix. Generated-source parity,
repository tests, production build and isolated API dry run passed; the active
deployment and API health were verified. The real mentioned-comment lookup was
also checked and includes the expected media owner, so it supplies the evidence
needed by the new routing rule. Rollout remains the same two-post pilot.

## Comment pilot and OAuth repair — 10 November 2026

Meta's existing FinFolk app/Page approval now grants `instagram_manage_comments`.
The saved app-bound Page token remains valid for Page `1387107281155901` and
linked account `17841461601419539`. Account subscription readback verifies
`messages`, `comments` and `mentions`; the active app callback retains all three
fields. No alternate login pathway or replacement encryption key was introduced.

The callback's initial code exchange used `redirect: 'error'`, which native
Cloudflare Workers fetch rejects. Release
`4b030418-c192-4d85-9d8f-ec404288dfbe` changes this to `manual`, matching the other
Meta calls. Redirect responses still fail instead of being followed or accepted
as grants. The real workerd regression reproduced the failure before the change
and passed the complete short-token → long-token → configured-Page exchange
afterward. Generated-source parity, repository tests, build and API deployment
dry run passed; production health and deployment settings were read back.

The same release enables only `help,status` in comment `pilot` mode on media
`17950528881348521` and `17885251788525086`, with activation boundary
`2026-11-09T20:38:31.074Z`. The first post's ownership and comments endpoint were
verified against Meta; its comments list was empty. Canonical `.env.local` and
source controls match production, with verified encrypted backups before and
after updating the rollout values. The encryption key was preserved.

A fresh real Facebook authorization was subsequently completed in Dia using
the previously approved settings. The repaired callback returned to Settings
with `messaging=connected`; the new grant and account subscription verified.
Reauthorization intentionally clears live/follower acceptance and pauses
processing. The existing pilot was restored through Settings and confirmed by
UI and database readback (generation 6). No acceptance flags were manufactured.

Owned-post `/help` delivery passed on 10 November 2026. `@chriszfree` posted
comment `18125995540932012` at `2026-11-09T21:07:01Z` under
https://www.instagram.com/p/DfdNz_dyFGn/ . The signed receipt was persisted at
`21:07:07.419Z` and completed on its first attempt. The durable command is
`done`/`sent`, with reply `18099971858411672` from `@finfolk.com.au` at
`21:07:20Z` (19 seconds after the comment). Meta readback returned exactly one
reply under the parent; expanding the actual thread in Dia independently
showed the correct brand and help text. No additional comment or reply was
posted by the operator during verification.

Keep the two-post pilot active. Public `/status`, external-mention routing,
duplicate-webhook delivery and nonfollower acceptance remain separate live
checks before widening rollout. This owned-comment evidence does not certify
DM delivery and must not set the separate DM acceptance flags.

## Live comment investigation — 8 November 2026

- Production Worker `2335c13b-65a2-42e8-904d-46d45435dc85` uses the sole `instagram-facebook` Page-token pathway. Comment replies remain disabled with rollout `paused`; no activation timestamp or pilot media IDs are configured.
- A fresh Meta inspection confirmed a valid app-bound `PAGE` token and the expected linked Instagram account. The grant still lacks `instagram_manage_comments`; account-level subscription readback contains only `messages`. No comment-command or comment-context event records have been stored.
- The app-level Instagram callback was active at `https://api.finfolk.com.au/instagram/webhook` with only `mentions,messages`. Added `comments` while preserving those fields and the callback. Meta acknowledged success; GET readback confirmed the callback active with `mentions,messages,comments`.
- The authorized account now exposes two media records, including test candidate `17950528881348521`: https://www.instagram.com/p/DfdNz_dyFGn/ . No test comment was posted and no automated reply was enabled.
- Remaining action: from the signed-in administrator account, use Settings → Instagram messaging → Authorize @finfolk.com.au on the existing Meta app/Page pathway. The deployed dialog requests `instagram_manage_comments`; the callback can add account-level `comments` and `mentions` when the token actually grants it. Recheck token permissions and account subscriptions before pilot activation. App-level subscription success does not prove account authorization or delivery.

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

Account → Instagram comment commands contains examples, one-time verification and private pending check-ins. First connect and verify Instagram through the Meta Facebook Page messaging service. Personal actions additionally require current follower eligibility and the active messaging pilot/public rollout. Then generate a one-time `/me CODE @finfolk.com.au` command and post it from that account within 15 minutes. FinFolk binds the provider-fetched comment actor to the existing verified member using code possession **and** the provider-fetched account handle. Handles alone and DM sender-ID equality never authorize comments. Codes are stored as hashes and removed from persisted command arguments after use. Disconnect removes the binding and cancels pending work.

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

## Shared public commands in production

Worker version `03462e87-3fc1-40f3-afad-2343a9e6f513` enables comment `/help`,
`/menu` (help alias), `/ping`, `/site`, and `/privacy`, plus the existing public
post `/status`. Comment status describes the post's publication, not the
commenter's account. `/help account` and `/help diagnostics` have channel-specific
responses. Unsupported commands continue to show public comment help.

Plain commands are accepted only on provider-verified FinFolk-owned media. Other
media still requires the exact @finfolk.com.au mention and an eligible rollout.
The rollout remains `pilot`, with these verified brand-owned posts:

- https://www.instagram.com/p/DfdNz_dyFGn/
- https://www.instagram.com/p/DfcDML8iQWz/

`/connect`, `/cancel`, `/disconnect`, `/points`, `/in`, `/out`, and retired `/claim`
produce guidance to use DMs before any private identity lookup or mutation. Their
submitted arguments are discarded, so connection codes and other supplied private
text cannot be reflected in the public reply or retained as command arguments.
The existing unredeemed-code cancellation logic is reachable only through DMs.

Public comment commands preserve the existing receipt/reservation, rate limits,
current-authorization checks, pilot/date gates, and uncertain-send protection.
The only production binding changed was `INSTAGRAM_COMMENT_COMMANDS`, now
`help,status,ping,site,privacy`. No schema migration was needed. All required
repository checks and isolated release tests passed; production checks verified
website/API health, webhook verification, signature rejection, protected admin
access, managed Meta comment authorization, media ownership, and deployed-source
checksums. A fresh user comment remains the visible-delivery acceptance step.

The isolated release config is
`.cache/shared-commands-release/comments-release.wrangler.json`; the previous
Worker version for rollback is `e0687cf2-9c52-4c9e-afd9-f0b284399b45`.
