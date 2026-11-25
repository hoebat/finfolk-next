# Native page migration checkpoint

The agreed destination is fresh development accounts on Supabase Auth, mock external providers, and preservation of current Next.js routes/layouts. Replace functional groups incrementally. Existing account/data transfer and hosted deployment are excluded.

## Implemented foundation

`finfolkbuild.project.page-coverage` inventories every registered page, assigns it to exactly one of ten migration groups, and enumerates model/action/auth/SDK/resource/effect/composition/lifecycle capabilities. Static screens require browser evidence, HTTP resources require request evidence, and build-only entries require artifact evidence.

The inventory rejects missing pages, stale page assignments and duplicate assignments. Native contract readiness requires an explicit native RPC, request shape and result shape; old REST/action declarations do not qualify. The manager exposes the group, required capability count and contract readiness for every page. These are inventory facts, not evidence of a completed migration.

Commands:

- `make page-migration-status`: inspect the machine-readable inventory and native contract gaps.
- `make check-page-migration`: enforce exhaustive assignment and truthful coverage reporting.

Existing logbook verification remains available. The account/privacy slice now runs on real local Supabase Auth and the native database. No entire migration group is marked complete; the inventory still reports required page/model capabilities separately.

## Remaining implementation, in dependency order

1. Native RPC request/result schemas, validators, generated UI types and shared DTO adapters. Generate the allowlisted Worker dispatch from the same source; bind actor from verified auth rather than request payloads.
2. Real local Supabase Auth email/password/OTP flows, native UUID user provisioning and fixtures that own/clean up their Auth users. Replace the retired provider session wiring; retain database authorization and actor/environment cache isolation.
3. Reuse native messaging/provider mocks and generalize the fixture runtime and Next.js preview. The application and verifier must share clients/adapters; remove the logbook-only verifier SDK shim after parity checks pass.
4. Migrate account → community → logbook → directory → events → atlas/sites → posts/trips → social/messaging → finnies → shells/compatibility. For each group: DB rules, RPC contracts, generated backbone/types, saved scenarios, actual screen wiring, browser acceptance, then removal of replaced legacy paths.
5. Expand app.manage with capability-driven execution, group filters and independent contract/RPC/backbone/browser/provider evidence. Missing coverage stays blocked/unverified; edits invalidate evidence.
6. Replace tests that still install removed SQL snapshots with current native fixtures. Track unrelated ocean/VCDEM asset failures separately without weakening their assertions.

Completion requires every registry entry and route accounted for, no unsupported required operation, generated parity/type checks, real local Auth/native DB tests, mock-provider failure scenarios, and browser journeys through the existing screens. Inventory completeness alone never establishes any of these gates.

## Auth/account implementation

The native account slice is authored in `finfolkdb.fn.user.user-account` and
`finfolkdb.schema.account-contracts`. Its operation declarations generate the RPC
catalog metadata, browser/server validators, operation allowlist, and
`packages/edge/native-account.d.ts`. The Substrate application backbone owns the
actor-scoped models; Next.js renders the existing account/privacy layout.

Implemented operations include idempotent UUID provisioning, profile/privacy
preferences, buddy requests/responses, blocks, and database-backed roles/feature
flags. Permissions derive from verified Supabase identities and native roles;
user-editable Auth metadata never grants roles. SQL is generated from Clojure
sources, including the restricted trusted-server role in `account-grants.sql`.
That role must never be assigned to a browser or PostgREST role.

Email sign-in, signup confirmation, verification, password recovery, refresh,
sign-out and password-confirmed deletion use the Supabase SDK/Auth service.
Deletion erases owned data and private revision/audit payloads, anonymizes nullable
shared contributions and retains a minimal UUID tombstone. Auth cleanup happens
after the database transaction. A provider failure leaves `pending_auth` work for
the server's periodic retry; it never reports that cleanup as complete. Old JWTs
cannot provision a tombstoned account.

Server configuration is `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, private
`SUPABASE_SERVICE_ROLE_KEY`, and a trusted `DATABASE_URL`. The Next.js native mode
uses server-side `FINFOLK_AUTH_PROVIDER=supabase`, `FINFOLK_SUPABASE_URL`,
`FINFOLK_SUPABASE_PUBLISHABLE_KEY`, and `FINFOLK_API_ORIGIN`. Its public
`/api/account-config` response exposes only an allowlisted public configuration,
rejects private/service-role keys, and disables caching. Existing hosted
configuration is unchanged.

`make test-native-account` regenerates the modules and creates an isolated
application database plus owned accounts on the existing local Supabase stack
(API 55431, database 55432). It exercises the restricted production database
adapter, real Auth flows, authorization failures, actor isolation, recovery,
late responses after sign-out, profile revision history, account erasure and
Auth-cleanup retries. A real Chromium journey starts the existing Next.js app,
signs in, edits privacy preferences, reloads persisted data, signs out, and tests
password-confirmed deletion. All fixture processes/databases/accounts are cleaned
up. External-provider failure is injected only at the Auth deletion effect;
identity verification and database operations stay real.

The manager now declares a separate account slice and `native-account` check.
Use its build/check action to record source-fingerprinted evidence across schema,
logic, RPC, interop, backbone, types and browser stages. A successful CLI run alone
does not manufacture manager receipts. Saved account page/model cases now use a separate disposable native database and
real local Auth users. The Clojure/XTalk case runner calls the published page/model
layer and actual actor-scoped account client. The `account-native` case covers
page composition, profile mutation/readback, actor isolation, privacy models and
rejection of an unknown role field. It returns transport events, model states and
cache snapshots to the workbench. Fixture credentials stay in the child process;
cases contain actor aliases only. Account and older logbook identities stay in
separate scenarios. Other application groups, messaging settings/provider
adapters, and full account composition remain pending.

## Native community visits and discovery

The community slice now includes `account-checkin` and `people`. Visits use
`UserCheckin`, site-local dates, verification checks, idempotent daily inserts and
actor-owned removal. Discovery selects only open active profiles, reapplies
bidirectional blocks and declined relationships, and returns a fixed public DTO.
Its opaque cursor binds the seed, filters and verified actor; each page is bounded
to six people. Inactive relationships become `null` so a new request is available.

The existing screens use the generated native client in Supabase mode. Public
site-catalog SSR selects the native catalog in this mode. The real browser test
records a visit, reloads and removes it, opens People and sends a connection
request. Native tests additionally cover concurrent duplicate visits, the rolling
window, filters, pagination, cursor scope and exclusion of private fields.

`community-checkins` and `community-discovery` are saved workbench scenarios.
Native cases may use `select`, an array of result field names/array indexes, to
assert a stable nested value while retaining the full page output, trace, model
states and cache snapshots. A missing selected field fails explicitly. Profile viewing/editing and shared statistics now have a native path, described
below. Site-community ranking/reporting and provider/content adapters still
require migration; this does not mark the whole community group complete.

## Native private logbook

Private sessions now have native create, owned reads/listing, edit and delete RPCs
in `finfolkdb.fn.user.user-logbook`. Date/location, statistics and map-point rules
are enforced in the database. Caller-supplied visibility and photo fields are
rejected. Edits append revision history, and deletion removes the revision/audit
streams. Cursor pages are bounded and always constrained to the verified owner.

The emitted Supabase client supplies the SDK methods used by the existing logbook
page/model declarations. Next.js configuration selects the native client settings
in Supabase mode. A real browser journey creates, edits and deletes a private
session through the existing screens. Integration tests cover actor isolation,
invalid input, revision history, deletion and a 52-session cursor traversal.

`logbook-native` is a saved scenario with `runtime: "native"`; the older SQL-only
logbook demo scenarios retain their separate fixture identities. SDK calls appear
in the native scenario's actual model trace and cache snapshots. Invalid local
input does not poison later writes. An uncertain server response after a write
blocks further mutations until refresh; a fault-injection test confirms that the
refresh discovers the real committed state without repeating the write.

Source-sensitive manager checks run in fresh child JVMs and require generated
parity before their stages can be reported as verified.

## Native public logbook

The native logbook also supports verified-email publication and unpublication.
Public session/list/profile operations always use anonymous authorization, even
if a bearer token is supplied. Member reads separately enforce blocks and closed
profile/buddy visibility. Public DTOs exclude private notes and sharing settings;
private sessions never enter public model caches. Unpublishing invalidates both
member and public models. Publication is media-free until a provider adapter can
verify media ownership; attaching unverified media also hides an existing public
session. Imported media and provider workflows remain blocked.

The `logbook-public` saved scenario exercises publication, anonymous and member
reads, whole-page composition, private access rejection and unpublication through
the actual generated SDK/backbone. The browser journey uses a separate anonymous
context to open the same URL before publication, after publication and after
unpublication.

Execution uses native capability checks by default rather than a page-name
allowlist. Binding-only `resolve` checks do not need a native fixture. Individual models can be tested before the rest of a page is migrated.
Unsupported operations return a blocked result naming the missing capability;
empty resource/static pages require their own request/browser/artifact evidence.
A case can explicitly select `runtime: "native"`. Older demonstration scenarios
are tagged `runtime: "sql-demo"` and retain their separate fixture identities.

`make generate` synchronizes the emitted browser runtime into Next.js public
assets as well as the source bundles. Native browser fixtures assert byte parity
before starting, so an old public bundle cannot silently substitute for the
backbone being tested. This does not rebuild atlas/reference assets.

## Disposable native preview

Run `make manage-preview-native` to regenerate and start the existing Next UI at
`http://127.0.0.1:3011/account`. The manager also lists native account, logbook and
people previews. Set `NATIVE_PREVIEW_PORT` before starting both processes to use
a different port. The original `make manage-preview` remains available.

The native preview reuses local Supabase Auth (55431) and PostgreSQL (55432),
creates a separate owned application database, and seeds two open demo profiles
through the published client and real Auth/RPC path. Temporary sign-in details
are printed only to the local process console. Account/privacy, check-ins, people
and private/public logbook are available. Unsupported groups remain gated.
Stopping the preview removes its application database and its two demo Auth
users. Other local Auth accounts are outside the preview's ownership.

## Native profiles and shared statistics

Profile viewing/editing now uses the native account, logbook and social-post
entities. Portrait bytes, size and image format are validated in Clojure-authored
DB functions. Featured logs require owned published sessions; featured posts
require current ownership, approval and public consent. Consent withdrawal is
rechecked on every public read. The profile action projects only declared editable
fields before calling the strict RPC; server/private fields are preserved in the
database and excluded from another member's projection.

Statistics are calculated from native visits and sessions in the site's timezone.
The established eight-day Regular threshold is declared in Clojure and emitted
into profile-editor metadata for UI copy. Both open profiles must meet the visit
threshold. Accepted buddies bypass openness/activity gates, but every result still
obeys the owner's individual sharing flags. Blocks take precedence. Future visits
are excluded; count, total duration and the upper median depth are tested against
real rows. This shares aggregates only, never private session content.

`community-profiles` adds 20 saved page/model steps: editing, whole-page loads,
closed/buddy access, field isolation, featured publication/unpublication and invalid
portrait rejection. The browser journey edits the existing profile screen, uploads
a real image converted by the browser, reloads it and views another member's stats.
Native tests additionally cover ownership/approval/consent boundaries, independent
sharing flags, visit gates, blocks and the request-size envelope for valid portraits.
The native preview includes profile links; place-community/reporting and social
provider controls remain separate pending capabilities.

## Management CLI completion

`app.manage.slices/run-command!` provides the embedded slice-command API. The
slice and saved-page-check command entrypoints now terminate after recording
their results and return exit code 1 for failed checks, including when a loaded
project owns background threads. This matches the main `app.manage` CLI.
Subprocess tests exercise both success and intentional failure with a non-daemon
project thread; deliberately incorrect expectations were confirmed to fail and
then restored. `make test-page-models` completes with the 72 saved steps passing.

The full `make test` run still reports the existing ocean/VCDEM asset issues
(three failures and one error). Native application checks, generated parity,
production asset build and the isolated Next production build pass.


## Native directory, events and site notes

Directory and event operations now have strict `finfolkdb.schema.*-contracts`
request/result declarations, typed native RPC entrypoints, generated validators
and UI types. Existing Next screens consume the generated Substrate page/models.
Directory supports member creation/editing, administrator creation/publication,
claims, reports, page administrators, hashed expiring invitation tokens, and
idempotent merges of unmanaged pages without linked events. Merge locks both
pages in a consistent order, preserves revision/audit history, and keeps the
archived source out of public reads.

Events support drafts, publication, revision checks, email-bound private
invitations, rosters, cancellation, moderation and RSVP capacity. The database
serializes competing RSVPs on the event row. Invitation acceptance and revocation
use the same lock order. Invitation email comes from verified Supabase identity;
request fields cannot override it. Local links are available; external invitation
delivery and directory discovery providers remain pending.

Site notes now use native verified account state instead of a Supabase Auth table.
The trusted transport synchronizes `User.email_verified` from Supabase `getUser`
responses. User-editable metadata and profile payloads cannot set it. Notes,
votes, withdrawal/restore, reporting, moderation, blocks and public DTO isolation
run through native RPCs. The native map composition and its browser acceptance
remain pending; the site-notes UI stage stays blocked accordingly.

There are now **132 saved page/model steps**: 24 directory, 20 events and 16 site
notes, alongside the previous 72. They execute real local Auth/native DB flows
through emitted clients/backbones. Directory/event screen creation, publication
and cancellation are also exercised in Chromium. The integration suite additionally
installs the published entity schema and account grants on an empty database;
no historical SQL or `legacy_auth` schema is needed.

The native preview at `http://127.0.0.1:3011` now creates Alice, Bob and an
administrator demo account. The administrator role is seeded only in the owned
local fixture database. All three Auth accounts are removed when the fixture
stops. Credentials are printed only to its local console. app.manage exposes
separate directory, events and site-notes stages, previews, saved cases and AI
work notes. Remaining provider and atlas stages retain explicit blockers.

Latest validation: native integration, all 132 saved steps, generated parity,
production assets and an isolated Next production build pass. `make test` still
reports the existing ocean/VCDEM asset issues (three failures and one error).
Other atlas/site workflows, content/trips, social/messaging providers, Finnies,
and shell compatibility still require migration; these checks do not mark them
complete.


## Native discovery and atlas map verification

Directory discovery now starts with an authorized native `DirectoryRun`, performs
bounded HTTP provider work outside the database transaction, then completes the
run through a server-only RPC. Clojure/XTalk projects provider results into
candidates; the database validates them, deduplicates website/social identities,
and retains them as unpublished listings for review. Repeated completion is
idempotent. A failed, missing, oversized or interrupted provider records a failed
run; administrator permissions are checked before external work begins. Local
fixtures and the preview use an explicit synthetic HTTP provider. Hosted provider
configuration is separate; these checks make no live search requests.

The review form retains search inputs through refresh and displays persisted run
state and candidate counts. `directory-discovery` adds nine saved steps covering
authorization, successful search, unpublished candidates, deduplication, provider
failure and retry. Chromium exercises successful discovery and its failed search
state through the existing review screen.

The atlas now reads published canonical `SiteProfile` and `SiteCatalog` entities
through generated `siteCatalog`, `siteDetail` and `discoverPopular` contracts.
Public projections exclude archived sites, invalid/missing map points and private
payload keys. Source attribution/licence fields are retained. Popular spots need
at least three active, verified, open members with recent visits and expose site
IDs only. Site editing, publication and environmental adapters remain pending.

A legacy helper previously reopened the shared application and replaced its native
public transport with the old REST adapter. The Clojure browser adapter now keeps
the Supabase transport once selected. Map presentation clones catalogue DTOs
before deriving display fields. In native mode, an RPC failure cannot silently
substitute a legacy site snapshot. `make generate` synchronizes the authored
catalogue adapter into Next public assets, and generated parity checks include it.

The real Next/Chromium map story uses real native Auth, DB, RPCs and page/models;
only reference-map files and basemap responses are synthetic. It publishes a note,
reloads it, verifies anonymous visibility, withdraws it, verifies disappearance,
then restores it. It also deliberately reopens the legacy helper and confirms the
native transport and unmodified backbone DTOs. The `atlas-native` saved case adds
four steps for catalogue reads, whole-page composition, popular spots and field
isolation. There are now **145 saved page/model steps**.


## Native single-site authoring and invitation delivery

Single-site submission, editing, withdrawal, administrator review/rejection,
publication and archiving now use `finfolkdb.schema.site-review-contracts` and
native typed RPCs. New drafts retain their proposed key without creating a public
`Site` row. Publication creates or updates the canonical UUID site, compares the
current revision, increments the catalogue revision and records review history in
one transaction. Replaying the same publication does not publish twice. Approved
source-backed access/depth/fact records and attribution survive editing. Private
site drafts and child records are erased with the account; published history
retains the existing nullable-identity cleanup semantics.

The existing forms use generated native page actions, project only editable
fields, and retain a request ID for uncertain first saves. The native client now
reports supported operations. Bulk import controls are unavailable in native
mode until their own operations are implemented. Site imports and environmental
provider adapters remain explicit management blockers; they are separate from
single-site authoring.

Private event invitations may now be queued for delivery. `EventInviteDelivery`
is a server-only native entity; link tokens are encrypted using a private
server key while retryable and cleared on acknowledgement, cancellation or retry
exhaustion. Typed delivery calls enforce current manager access, event/invitation
validity, a bounded lease and at most five attempts. Provider work runs outside
the DB transaction and uses a stable outbox ID as the provider idempotency key.
A lost acknowledgement can retry the same work without duplicate mail. Revocation
invalidates the lease so a late acknowledgement cannot revive the invitation.
The manager roster exposes only safe state, attempt count and a sanitized error.

Local fixtures and the preview inject an explicit in-process email provider.
They send no external email. A hosted adapter is a separate configuration task;
these tests do not validate real email-provider credentials or delivery. The
sealing key (`FINFOLK_INVITATION_SEAL_KEY`) and provider callback remain private to
the trusted server; neither enters browser configuration or generated UI types.
Production hosting/cutover is unchanged.

The real browser journey submits, reloads, reviews, publishes, revises and archives
a site through the existing screens. It also creates a private event, displays a
mock email failure, retries the same invitation and reloads its persisted sent
state. Restricted-role tests cover cross-actor access, version conflicts,
concurrent publication, encrypted storage, idempotency, lost acknowledgements,
leases, cancellation during delivery and retry exhaustion. Fresh installation
checks also reject anonymous table/function access to the outbox.

`site-review-native` adds 20 saved steps and `event-delivery-native` adds 13,
bringing the saved page/model total to **178**. Site review scenarios exercise
individual native review models/actions and the complete member submission page;
bulk-import composition remains a separate unsupported capability.

Final checkpoint: the combined atlas build passes with a stable source receipt
through generation, parity checking, native integration and all 178 saved steps.
The Next production build and existing site asset build pass. The full project
test command still has the previously recorded ocean/VCDEM asset baseline
(three failures and one error). One separate browser run timed out waiting for
the atlas note control; the subsequent complete browser/build run passed.
Delivery cleanup also covers deletion of an organiser whose pending work was
requested by another manager. The refreshed local preview uses disposable demo
accounts and the mock delivery provider; production email is not configured.

The refreshed app.manage UI also loaded and executed both new saved cases in
Chromium: all 20 site-review steps and all 13 delivery steps passed. The refreshed
native preview sign-in screen and public Supabase configuration were verified.

## Standard local preview

`make manage-preview` and the workbench's standard Next.js Start control now use
an owned native Supabase Auth/database fixture on port 3010. `PREVIEW_PORT`
selects another port. The separate native preview remains on 3011. Each fixture
cleans up its own database and demo accounts when stopped. External email and
search providers remain mocked.

A bare Next.js process without local API configuration used the hosted legacy
catalogue and made `/people` return HTTP 500 when that API returned 503. The
standard preview now uses its local native catalogue, generated backbone and
local demo accounts. An already running legacy preview must be stopped before
starting the native preview; the launcher does not silently reuse it. Hosted
production configuration is unchanged.

Verified on port 3010: `/people` returns HTTP 200, renders the guest sign-in
state, signs in through real local Supabase, discovers the other fixture diver,
retains that result on reload and filters by the fixture location without page
exceptions. The launcher reuses the already running native fixture. Both
workbench browser facts still pass, including real Next.js Start/Restart/Stop.
