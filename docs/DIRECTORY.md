# Freediving directory

Browse `/directory`; each listing has a public page at `/directory/<listing-id>`.
Legacy `/profiles?screen=directory` and `screen=listing&id=…` links remain supported.
Verified members use `screen=my-listings`. Existing administrators access
`screen=superadmin` through My listings. Authorization uses the server-side
`INSTAGRAM_ADMIN_IDS` allowlist, not client UI flags.

Apply immutable migration `0022_directory.sql` using the guarded database
release workflow. Its historical table contracts are frozen in
`resources/finfolkbuild/legacy/catalog.json`; the database suite verifies migration
columns, constraints, defaults and indexes against that fixture. The standalone
entity model is authored in `src/finfolkdb/common/type_directory_base.clj` and
`type_user_access.clj`; see [the database model](DATABASE_REBUILD.md).
The directory functions ship in `0023_backbone_directory.sql` with an updated
backbone SQL hash. Deploy the matching API and frontend together.
Set `BRAVE_SEARCH_API_KEY` as a Worker secret to enable candidate discovery.
Without it, manual listing creation, browsing and claiming remain usable.

Discovery is explicitly initiated by an administrator. Each run makes three
bounded Brave requests (general web, Instagram and TikTok). Results are
candidates, never automatically published. Search descriptions are private
operator notes. Confirm names, Australian state, category and source evidence
before publishing. Runs record failures without discarding prior candidates;
use Find candidates to retry. This is search-index coverage, not a complete
social account inventory. No authenticated crawling or automatic outreach occurs.

Use Merge to consolidate an unclaimed candidate into an existing listing ID.
Its social identities and source links move to the target; the original is
archived. Suppress unwanted accounts to prevent rediscovery. Archiving alone
also retains duplicate detection.

Copy the invitation message into a manually sent social message or email, and
update outreach status. Claim links are public entry points, not ownership
credentials. A verified member requests a seven-day challenge and sends it
from the listed social account to Finfolk. Administrators inspect the actual
message and sender, record evidence, then approve or reject. Never approve
based solely on a submitted handle or possession of an invitation link.
Ownership can be revoked from the listing editor. Owners edit listing copy and
contact information directly; verified social identities require an admin edit.

Test with `node tests/test_directory.mjs` and
`node tests/test_directory_ui.mjs`. The database suite uses isolated PGlite and
synthetic identities; no external provider or production database is contacted.
Pilot real Brave searches and sender verification before public launch.

Directory persistence now goes through generated `finfolk_rpc.directory_operation`
functions preserved in `resources/finfolkbuild/legacy/pilot.sql`. The HTTP adapter
sets actor and administrator context within each transaction. Direct directory
table access is revoked from `finfolk_api`; only the generated entry point is
executable. Brave calls happen between short database transactions.

Public, owner and admin screens use xt.substrate models and explicit directory
invalidation domains. Generation does not install SQL. Install the new immutable
`0023_backbone_directory.sql` release with the guarded database release command,
then deploy the matching API and frontend with the updated SQL hash.

## Pages and access

A listing is a Finfolk page representing a person, business or group. Claiming
assigns ownership of the Finfolk page; linked Instagram/TikTok accounts provide
verification evidence. A member may own multiple pages. The Freediver category
supports personal athlete/creator pages, including international locations.

Each page has one owner and may have multiple admins. My pages includes both
owned and administered pages. Admins edit page content/contact details; only the
owner creates/revokes admin invitations or removes admins. Verified social
identity changes retain the superadmin review requirement. Invitations expire in
seven days, are single-use, and store only a token hash. Owners share links
manually; no messages are sent automatically. Redeeming requires a verified
Finfolk account. Revoking ownership also clears delegated access and invitations.

Release the new page functionality with migrations 0024–0026, then deploy the
matching API and frontend. These changes have not been installed in production.

## Australian launch listings

`config/directory-australia.json` contains 27 public-source Australian clubs,
schools, instructors and groups researched on 3 November 2026. Each has source
links; research dates stay in the private operator notes. Source summaries do
not assert certification or affiliation. These pages were published, unclaimed,
on finfolk.com.au through the existing `admin-save` operation.

The repeatable content release is `scripts/release_directory.mjs`. Set
`DIRECTORY_RELEASE_CONTEXT` to an ignored operator JSON file containing
`nextDatabase` and `nextEnv.INSTAGRAM_ADMIN_IDS`. Run `node
scripts/release_directory.mjs rehearse` to validate in a rolled-back transaction,
then `node scripts/release_directory.mjs publish` to commit. The script checks
the dedicated endpoint/database and deployed SQL release, uses an existing
administrator, serializes release runs, and preserves every existing matching
record, including archived or owned pages. It never changes schema or sends
outreach. Rehearsing again after publication reports 27 skipped records.

Browse https://finfolk.com.au/directory, or open Discover and choose Directory.
Public name, category, state and locality filters work without signing in.

## Native site-to-community journey (local candidate)

Site details now include a locality-filtered directory panel, links to broader
state results, and contextual page creation. Locality text matches are browsing
aids, not verified site affiliations. Group pages direct visitors to organisers
through the listed website/social links; FinFolk group membership and chat are
not implemented by these contact links.

`/pages?create=1&state=NSW&locality=Bondi&site=bondi` restores the creation context
after sign-in. A verified member creates an owned candidate page, edits it in My
pages, and waits for administrator publication review. A stable request UUID
prevents duplicate pages when retrying an uncertain response. New social
identities require separate review. Existing published listings still use
sender-evidence claim verification.

Native lifecycle SQL is authored in `src/finfolkdb/schema/directory.clj`, generated
into the fresh entity schema, and uses `DirectoryListing`, shared Access roles
and requests, revision streams, audit streams, and the existing typed creation
helper. This introduces no migration or production schema changes. The trusted
`finfolk_directory` role is separate from browser/API roles.
`backend/native-directory-api.mjs` provides an isolated authenticated HTTP factory
for the native candidate, requires an explicit DatabaseRelease pin, and checks it
in each transaction. It does not change serving Worker bindings. The old API
returns an explicit unavailable error for creation until native rollout is ready.

Validate with `node scripts/test_database.mjs --directory-native` (disposable live
PostgreSQL) and `NEXTJS_TEST_URL=http://localhost:<port> node
tests/test_nextjs_directory_journey.mjs` (local production Next build with synthetic
UI fixtures). Database tests cover creation/retry, private candidates, publication,
locality reads, ownership isolation, revisions, claims and privileges. UI tests
cover map discovery, contextual sign-in, retry and pending-review presentation.

This native adapter is a staged subset. Delegated invitations, admin discovery,
merge, ownership revocation, and editing a document during publication review
still need native parity. Publication currently reviews the saved document;
owners edit through My pages first. Production cutover also requires the broader
API/auth/member-content acceptance described in DATABASE_REBUILD.md. These changes
have not been published to finfolk.com.au or the previously shared Netlify deploy.
