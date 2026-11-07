# Native community notes

Dive-site notes are authored in `src/finfolkdb/common/type_site_note.clj` and
`src/finfolkdb/fn/site/site_notes.clj`. Generation includes the three native
entities and server-only RPCs in the fresh entity schema. Historical migrations
and the deployed legacy database remain unchanged.

`SiteNote` belongs to a Beach and its author. Topics are access, facilities,
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
fresh native entity database and its managed-auth/native User and Beach records
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
