# Native community notes

Dive-site notes are authored in `src/finfolkdb/common/type_site_note.clj` and
`src/finfolkdb/fn/site/site_notes.clj`. Generation includes the three native
entities and server-only RPCs in the fresh entity schema. Historical migrations
and the deployed legacy database remain unchanged.

`SiteNote` belongs to a Site and its author. Topics are access, facilities,
wildlife and conditions. Text is bounded to 10–1,000 characters. Conditions
require an observation date; future dates are rejected in the site's timezone.
`SiteNoteVote` permits one upvote per member per note. Clients submit the desired
vote state, making retries safe. UUID note creation is also retry safe.
`SiteNoteReport` accepts one report per member per note.

Public reads expose only the note, display name, dates and helpfulness count.
Member reads include ownership and their vote state. Contributions require an
active, verified, unbanned managed-auth member and a native User with the same
subject ID. Deleted/unverified/banned authors and votes are excluded. Member
reads honor blocks in either direction. Draft and archived sites are excluded.
Authors can withdraw their notes and undo removal with revision checks.
Administrator hiding is independent of author withdrawal, so restoring a note
cannot bypass moderation.

## Server configuration

No SQL or feature activation occurs during generation or builds. Provision a
fresh native entity database and its managed-auth/native User and Site records
through the existing native provisioning workflow. Never apply
`entity-schema.sql` to the populated legacy application database.

Apply generated `resources/finfolkdb/site-notes-grants.sql` explicitly to the
native database and grant `finfolk_site_notes` to its trusted server login.
This role is for the server only: the adapter derives the actor and administrator
settings from authenticated requests inside each transaction. Do not expose
SQL access or these settings to browser clients.

The Node API accepts `SITE_NOTES_DATABASE_URL`. The Worker is opt-in and requires
all of:

- `ENTITY_SITE_NOTES_ENABLED=true`
- `ENTITY_SITE_NOTES_HYPERDRIVE`, bound to the separate native database
- `ENTITY_SITE_NOTES_DATABASE_NAME`, matching its actual database name

The Worker checks the database name and installed SiteNote table. It rejects
reuse of the legacy database connection. No bindings or feature flags are enabled
by this change. With no configured native connection, lists return
`enabled:false` and writes return 503. Native User/auth subject IDs must be
synchronized before enabling contributions.

API paths are `GET /v1/sites/:site/notes` for public reads and
`GET /v1/me/sites/:site/notes` for member reads. Member POST actions append
`/save`, `/vote`, `/withdraw` or `/report` to the latter path. Administrator
moderation uses `POST /v1/admin/sites/:site/notes/moderate`. These responses bypass
HTTP and application persistence caches. The UI lives in map spot details and
the site's community panel; anonymous visitors can read and sign in to contribute.

## Verification

`make test-db-notes` exercises the generated schema and RPCs in disposable local
PostgreSQL, including concurrent retries and authorization. `yarn test:site-notes`
checks generated page bindings and Worker connection gates. Run
`NEXTJS_TEST_URL=http://localhost:3220 yarn test:nextjs-site-notes` against a
fresh local Next build to check member/guest behavior and desktop/phone layouts.
The browser suite uses isolated transport fixtures; the database suite separately
executes the same HTTP adapter against real PostgreSQL.

## Native entry and revision model

The native location entity is `Site`; related native columns use `site_id`.
`SiteNote` uses `(et/E {:class :0d/entry :addons [:rev]})`, with inherited UUID
identity and operation/time tracking. Votes and reports use normal `:0d/entry`
defaults. There is no local note `revision` column: the HTTP `revision` value is
projected from its scoped `Rev.index`. Creation initializes version 1 and its
`RevLog`; withdrawal and moderation append snapshots in the same transaction as
the note change. Repeating an already satisfied state does not add a revision.
Stale versions fail, and rollback removes both the note mutation and history.

Single-column bounds use the StatsDB column-processing pattern:
`:sql {:process [[finfolkdb.common.type-system-seed/as-bounded-text 10 1000]]}`.
Column-level checks invoke the same validator for direct SQL writes. Body and
report-reason lengths are rejected rather than truncated; optional observation
dates must be finite. The cross-column conditions/date requirement remains a
table constraint.

Run `make test-db-note-revisions` for UUID-native, live PostgreSQL coverage of
revision history, idempotence, stale writes, moderation, rollback, column
validation and the generated notes-server grants. This suite uses an isolated
local database and a synthetic auth fixture; it never changes hosted auth.
