# Buddies and private session conversations

`/buddies` owns connections, requests, blocked profiles, direct messages and session
invitations. It is controlled by the `buddies` release flag, initially off. The
sidebar entry is signed-in only. Account privacy settings retain their existing
connection controls until that flag is enabled.

Messages use generated `buddyRead` and `buddyAction` operations through the native
account gateway and XTalk substrate. They are not provider/service conversations.
Both operations exclude persistent application caching. Message bodies and inbox
previews are never stored in SQLite or service-worker caches. Sending is online
only; an explicit retry reuses its request UUID. There is no offline outbox.

The additive Clojure-authored SQL in `finfolkdb.schema.buddies` is published in
`account-grants.sql`, after the entity schema. It creates conversations, membership
periods, messages and read cursors. Only the trusted account role can access them.
The server derives the actor from verified Auth; browser-provided actors are not
accepted. Direct chats require accepted connections. Session chats require the
organiser or joined membership. Triggers close/open membership sequence ranges
when connections or session participation change. Read queries enforce those
ranges even after leaving and rejoining. Blocks hide affected conversations.
Completed sessions stay open; cancelled sessions are read-only. Only the organiser
can archive or reopen a session conversation.

Inviting buddies to an existing plan uses `sessionPlanning` mode `invite`, which
changes only membership and does not overwrite session details. Existing invitees
are not duplicated. Creating a plan reuses the Sessions composer. Unread counts
and invitations appear in Buddies; visible conversations refresh every three
seconds, lists every fifteen seconds, and both refresh on focus/reconnect.

## Verification

- `make generate` and `make check-generated`
- `node tests/test_buddies_contracts.mjs` (includes real SQLite persistence check)
- `node tests/test_feature_flags.mjs`
- `node scripts/test_database.mjs --buddies` against disposable local Supabase
- `NEXTJS_TEST_URL=http://127.0.0.1:3271 node tests/test_nextjs_buddies.mjs`
- `NEXTJS_TEST_URL=http://127.0.0.1:3274 node tests/test_nextjs_buddies_preview.mjs` (fictional, enabled Buddies preview only)
- Optimized Next production build and offline asset verification

The database suite tests pair uniqueness, forbidden reads/sends, send idempotency,
unread cursors, connection removal, membership history ranges, organiser archiving,
trusted/untrusted SQL roles and the real native HTTP gateway with controlled Auth.
The mock preview has an isolated, in-memory chat service and fictional members;
it does not send external communications.

## Release

Keep the flag off until the generated entity release and account-grants SQL have
been rehearsed on an isolated PostgreSQL database and installed through the
existing production database release process. Publish the API with matching
contracts, then publish the committed frontend through GitHub Actions. Enable
for testers, verify two real accounts, and only then enable for everyone.
No email or push notifications are sent. Do not enable the flag against an API or
database lacking these operations. Generation and tests never install production
SQL. The ordinary frontend workflow does not publish the API or database.

The 27 November 2026 release is generated from committed authored sources with
schema fingerprint `1c5b4ceae62cf952b2a4fe7cc1b24b563b4003f7c06053c65f4b247bee2a2e3c`.
The additive installation preserves the previous release marker and adds four
private conversation tables, planning RPCs and membership triggers. API readiness
checks every required table, including conversation storage, rather than rejecting
additional tables during a rolling release. A verified encrypted off-server backup
and a repeated installation rehearsal precede installation.

The database regression suite relocates `uuid-ossp` into Supabase's `extensions`
schema and creates invitations through the actual trusted HTTP gateway. Session
creation uses PostgreSQL's built-in `gen_random_uuid()` so it does not depend on
a login role's extension search path. Production activation remains a separate,
audited feature-flag update after hosted and frontend release checks.
