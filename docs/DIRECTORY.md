# Freediving directory

Browse `/directory`; each listing has a public page at `/directory/<listing-id>`.
Legacy `/profiles?screen=directory` and `screen=listing&id=…` links remain supported.
Verified members use `screen=my-listings`. Existing administrators access
`screen=superadmin` through My listings. Authorization uses the server-side
`INSTAGRAM_ADMIN_IDS` allowlist, not client UI flags.

Apply immutable migration `0022_directory.sql` using the guarded database
release workflow. Its table contracts are authored in
`src/finfolkdb/common/type_directory.clj`; the database suite verifies migration
columns, constraints, defaults and indexes against those declarations.
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
functions authored in `src/finfolkdb/fn/directory/operations.clj`. The HTTP adapter
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
