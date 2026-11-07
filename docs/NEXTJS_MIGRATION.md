# Next.js migration

The frontend migration is in progress in `@finfolk/web-main`: Next.js 16.4.4,
React 19.3.1, App Router, public server-rendered directory/listing/event pages,
explicit same-origin API forwarding, native profile routes, and temporary legacy map routing. The landing page is now server-rendered React markup with the existing visual engines mounted in client effects and disposed on unmount. A native `/account` screen reuses the existing auth client for email/Google sign-in, sign-up, reset and sign-out; old account entry links without a settings tab redirect to it.
finfolk.com.au remains on Cloudflare while the manually deployed Next app is available at https://finfolk.netlify.app. DNS cutover is waiting for Cloudflare DNS editing access. This is not the completed whole-site conversion.

Run the existing atlas build, then `node scripts/prepare_nextjs.mjs`, then
`corepack yarn workspace @finfolk/web-main build`. Start with `corepack yarn
workspace @finfolk/web-main start`. `make build-netlify` runs the complete build.
The hosting command is `bash scripts/netlify_build.sh`. It verifies Node 22.13+,
Python 3.12+ and JDK 25+, downloads a checksum-verified Leiningen launcher when
needed, bootstraps the pinned Foundation submodule/Git LFS inputs and dependencies,
checks generated sources, then builds both atlas assets and the native Next app.
The Netlify configuration selects Node 22 and Python 3.12. Git LFS must be enabled
with `GIT_LFS_ENABLED=true` in hosting settings before checkout; a build command cannot recover missing LFS
credentials or inputs after checkout.
Do not switch DNS until a clean Netlify build and preview pass acceptance checks.

`FINFOLK_API_ORIGIN` is the server-side API origin; it defaults to the existing
production API. Preview writes must use an isolated API, never production test
identities. `FINFOLK_SITE_ORIGIN` controls sitemap origin. Neither value is a
credential. The existing public config and legacy app retain canonical-domain
bindings, so authenticated deploy-preview testing requires explicit preview
configuration and approved Auth origins before acceptance.

Generated public assets are ignored. The preparation step retains legacy HTML
at `/legacy/*` and stable runtime, WASM and data URLs. The production Next build emits a versioned native service worker after asset
preparation. It verifies shell files before installation and waits for existing
tabs to close before activation. Activation removes older `finfolk-shell-*` and
`finfolk-next-shell-*` shell caches; saved map regions, SQLite and local
preferences are retained. Compressed survey assets
receive explicit rewrite and response-header rules. Location inference currently
returns no IP-derived region; users retain state selection and opt-in geolocation.

The user requested a manual Netlify deployment and DNS cutover before deployment
automation. The manual deployment is published and its hosted HTTP/asset checks
pass. Full migration acceptance still includes the screen-state, other-route
offline and authenticated-browser gates below. Public Map navigation keeps the
original entry while the remaining native map states are accepted.

The root `netlify.toml` defines the build and output. The local Netlify CLI is
authenticated and linked to the manual `finfolk` project in the Statstrade team
(`fe66fb45-09ab-4e37-8474-3a4f2e162123`). The app connectors remain stale, but
they are not required for the CLI deployment. Local link metadata is ignored.
Netlify has both finfolk.com.au and www.finfolk.com.au configured; Cloudflare DNS
and Worker domain bindings are unchanged, and the API remains on Cloudflare.

The landing page keeps its original copy, eight demos, theme choices, illustrations
and opt-in conditions panel. React renders the markup on the server. Client
effects own empty visual hosts only, with listener/animation teardown on unmount.
`tests/test_nextjs_pages.mjs` checks server HTML and legacy links, theme/motion/
location interactions, mobile layout and mocked account error/success/sign-out/
reset flows. Start a local production server on port 3199 and run
`corepack yarn test:nextjs-pages` (or set `NEXTJS_TEST_URL`). The test refuses
non-local hosts and intercepts the auth module; it never sends provider requests.

Original-design acceptance is tracked in [DESIGN_PARITY.md](DESIGN_PARITY.md).
Restored chrome, sign-in presentation, listing sections and event data mapping
are implementation progress; full visual acceptance remains a production gate.

## Persistent migration goal

The active goal is full native React coverage with original-design and behavior
acceptance before Netlify cutover. Work continues across screens; a successful
single-screen check does not complete the goal. Native member data is bound to
the current actor and filter set, with generation fencing for delayed reads and
connection responses. Member, directory and administration compatibility links
now resolve to native routes after their populated-screen acceptance checks. The production site is unchanged.

Native member routes now under acceptance: `/people`, `/profile`,
`/members/[id]`, `/profile/edit`. They reuse the existing actor-bound browser
client and backend operations; private data is never server-rendered. Profile
editing retains portrait conversion, location/featured-item limits and ordering,
visibility/sharing controls, preview, and save semantics. The Instagram section
and connection-code dialog are React-owned; connection acceptance is recorded
below.

Member tests use `tests/fixtures/nextjs-api-server.mjs` (port 3210), then a local
production server started with `FINFOLK_API_ORIGIN=http://127.0.0.1:3210` and port
3202. Run `test_nextjs_profiles.mjs` and `test_nextjs_member_design.mjs` with
`NEXTJS_TEST_URL=http://localhost:3202`. The API fixture serves only public
synthetic locations, directory listings and events; every mutation receives HTTP 405. Browser auth/member
operations are synthetic module fixtures. The fixture must not be deployed.
Member comparison artifacts are under `.cache/design-parity/members`.

Remaining order: migrate account posts/Instagram tools, site submissions and reviews; migrate
discovery/map shells and dialogs; finish remaining visual states for all native
screens; complete offline/worker upgrade acceptance; validate Netlify
build/bootstrap and authenticated preview; remove the final legacy `/app`
frontend rewrite after full replacement. Production remains unchanged.

Accepted populated member states now pass 32 deterministic screenshot cases
(People, own profile, other member and editor; four themes × two viewports).
Native member compatibility dispatch is active in the local Next.js app:
`/profiles?screen=people|me|member|edit` resolves to the new routes and retains
location context. Directory and administration aliases are described below.
Old `.html` entry links retain their queries through explicit redirects.
Functional checks also cover rejected portrait input, private featured-log
exclusion, connection actions, save payloads and a delayed read after sign-out.

Native page and event administration now replaces the corresponding legacy
frontend routes. `/pages`, `/pages/review`, `/pages/invitation`, `/events/my`,
`/events/new`, `/events/invitation` and authenticated `/events/[id]` use the
existing API client. Private event details and rosters load only for the current
actor; a delayed read after sign-out cannot restore either. Public event content
remains server-rendered, and private/unavailable event URLs carry noindex.
`/profiles` compatibility dispatch now handles directory, listing, ownership,
review, page invitation and event modes, retaining their IDs, tokens and filters.
The only remaining legacy frontend rewrite is `/app`.

`test_nextjs_administration.mjs` verifies claim/report submission, owner save and
access and subscription refresh, review authorization/evidence, event validation
and publishing, RSVP,
private invitations/revocation, acceptance and delayed-response sign-out fencing.
All mutations are browser fixtures, never production requests. Its separate
original-renderer suite passes 72 populated theme/viewport comparisons. The next
screen group is account posts/Instagram tools, site submissions and reviews,
followed by the global settings dialog, discovery/maps and offline upgrades. Remaining visual state and
Netlify bootstrap/preview acceptance still gate production cutover.

Validation for the page/event administration pass: `make generate`,
`make check-generated`, `make test`, `make build`, asset preparation and the
Next.js production build passed. Administration, compatibility/configuration,
member/profile and landing/auth browser checks also passed against local
fixtures. The 72 administration comparisons have a maximum pixel difference of
0.019%. No API/database writes or frontend publication were performed.

The native `/logbook` now uses the original atlas styling and React navigation.
Session IDs and historical logbook profile IDs stay in the query string. Old
`/app?view=logbook`, `.html` and root share URLs redirect to the native route with
their IDs intact. The remaining `/app` rewrite continues serving other atlas and
account views until their implementations pass acceptance. The session editor
and publishing dialog are React-owned, including private-before-edit behavior,
draft retry without losing fields, media assignment/publication consent, deletion
and photo URL cleanup. Public trip cards use the existing generated public model
when backbone mode is enabled.

`test_nextjs_logbook.mjs` uses synthetic SDK methods and local server reads. It
checks private save/retry, consent and unpublishing, restricted access, imported
media assignment/public consent, deletion, photo object-URL revocation and a
delayed read after sign-out. `test_nextjs_logbook_design.mjs` compares nine views
in all four themes and both viewports (72 cases). Populated, guest, publication
and scroll/chooser comparisons pass; global settings and other account tools
remain separate unfinished work. The old logbook module remains only as the
independent reference and the legacy atlas build dependency during migration.

Logbook validation: generation and generated-file checks, the full repository
test suite, atlas build, prepared assets and Next.js production build pass. The
72 final comparisons pass with maximum pixel difference below 0.001%. Local
member/People and landing/auth regressions pass. The functional logbook suite
also exercises public trip cards with backbone mode enabled against synthetic
HTTP data, proving this read still uses the generated public model. Account
tools and the shared global settings dialog remain migration work; production
has not changed.

The original account layout now owns `/account`, `/account/checkin`,
`/account/privacy` and `/account/settings`. The temporary welcome-only account
page is removed. Sign-in, registration, reset links and post-login check-ins stay
in this shell. A persistent account layout retains unsaved privacy drafts across
native tab navigation and restores focus when keyboard navigation changes tabs.
Check-in history and the privacy welcome name observe existing generated models;
actor changes immediately remove private forms and connections.

Native account tools include check-in/removal, profile preferences and sharing,
connections/blocks, email verification, account deletion/recovery, four-theme
settings and the existing administrator messaging controls. Messaging permission
denials hide the controls; mutation retries retain a body-specific idempotency
key, and uncertain deliveries retain the original no-resend behavior. The full
11-step member tour is React-owned, including reduced motion, playback controls,
interactive examples, dismissal and shortcuts. Its copy is shared through the
authored `src/member-tour-model.js`; the reference renderer remains independent.

Old account check-in/settings/profile query links now redirect to the corresponding
native routes, retaining site and return parameters. Posts, site submissions and
moderation/review now also have native replacements, as recorded below. Instagram
tools now have a native replacement, as recorded below.
No backend or database authorization rules have changed.

Account validation passed: `make generate`, `make check-generated`, `make test`,
`make build`, prepared browser assets and the final Next.js production build.
The 144 account/tour visual cases pass; maximum pixel difference is below 0.069%
with matching dimensions. Account, tour, URL/config, landing/auth and logbook
functional checks pass against local fixtures. The final root-account check
includes sign-in, reset requests and password-reset tokens in the original shell.
The standalone temporary account portal and its alternate presentation are gone.

Shared global map-settings acceptance is recorded below. Next required work
includes discovery/maps and their dialogs, plus remaining visual states and offline/worker
upgrade acceptance. The initial-read subscription race is now covered by the regressions described
below. Netlify
bootstrap, connection, preview auth and final release acceptance remain open.
No frontend publication, backend deployment or database writes were performed.

The account Posts tab now renders discovered Instagram sharing controls, tagged
post submission/history, followed-beach posts and a native trip-report manager.
Trip workflows retain private draft revisions, date/timezone mapping, local CSV
preview, explicit duplicate/replacement checks, resumable bounded batches, private
row pagination, public summaries/consent and withdrawal. Native public reports
under `/reports/[id]` render the original chart/table layout from the published
API snapshot only. Root and app query links for posts, reports and report issues
resolve to these native routes. Instagram tools now also have a native replacement, as recorded below. Native sites and combined review are described below.

The operation and REST observer hooks now attach after a read and compare the
model's immediate snapshot with that read. Synthetic regressions reproduced both
missed-update failures before the fix, then verified convergence to the current
model value without refresh loops. Existing actor fencing and listener cleanup
remain in place. These tests run locally with `test:nextjs-subscription-races`;
they never contact an account provider or mutate a remote API.

Posts/report validation passed: `make generate`, `make check-generated`,
`make test`, `make build`, asset preparation and the final Next.js production
build. All 88 original-reference cases pass; maximum pixel difference is below
0.011%. Post/trip, initial-read race, account, directory/event administration,
logbook and URL/config browser checks pass against local fixtures. During a
delayed import response, signing out removes the editor and prevents final import
confirmation. No remote write or publication was performed.

Next: discovery/maps, location details and their tools; remaining visual states
and offline/worker upgrades; then Netlify bootstrap, linked project, preview auth
and release acceptance. The production frontend remains unchanged.


Native `/account/sites` now supports site suggestions, corrections, source-backed
entry/depth/restriction evidence, preview, submission editing and withdrawal.
Native `/account/review` combines site drafts/import staging and publication,
community post moderation and trip-report moderation in the original order.
Single-site publication keeps numeric revisions; batch publication includes every
staged draft revision and explicit source-review consent. Import staging preserves
row diagnostics and duplicate warnings. Published-site events refresh the server
catalog. Ordinary members fall back to check-in without fetching private review
data. Old root, `/app` and `/app.html` account links for sites/admin resolve to the
native screens and preserve site context. Instagram is now a native account tab, as recorded below.

The 112-case original-reference visual suite passes all four themes and both
viewports (maximum difference below 0.013%). Functional checks pass for submission
recovery, payloads/revisions, staging/publication consent, moderation checks/tokens,
and permission/actor fencing. Required generation, generated-source consistency,
repository tests and atlas build pass. Final Next.js production build, compatibility redirects, configuration checks,
site/review functional checks, account/post regressions and subscription-race
regressions pass against freshly prepared assets. The final 112 visual cases
also pass. Production remains unchanged.


The profile Instagram connection modal now uses authored React rather than the
legacy DOM adapter. It preserves the illustrative DM animation, reduced-motion
view, automatic eight-character code submission, per-code idempotency key,
explicit retries, error handling, success/Done flow, focus return and cancellation.
Unmount/close aborts pending requests; actor checks prevent a delayed response
from exposing another session's result. No code is persisted. The full native
connection functional suite, profile regressions, 32 independent visual cases
and final Next.js build pass. Instagram action/comment-command panels are now native as recorded below; the
profile modal no longer imports their DOM renderer.


Native `/account/instagram` now replaces the remaining account tool tab. Comment
commands preserve verification/copy, explicit dated beach confirmation, activity
records and uncertain-reply resolution. Optional actions preserve public-points
consent, invitation statistics/acceptance, exact proposed reply approval and
private dive draft confirmation/cancellation. Administrators retain received-code
and sender checks, reply drafting/review, manual uncertain/sending reconciliation,
points reversal and explicit event retry. Backend operations remain unchanged.
Private forms survive tab navigation and errors; successful action refreshes reset
the tools like the original account renderer. Actor fencing prevents late reads
or mutation results from restoring controls after sign-out.

Old root, `/app` and `/app.html` Instagram account links now redirect to the native
tab while retaining context. Unknown account tabs fall back to native check-in,
matching the original parser. The remaining `/app` legacy rewrite serves maps and
discovery; it is still required until those screens are migrated. Required
`make generate`, `make check-generated`, `make test`, `make build`, asset
preparation and Next.js production build pass. Instagram functional checks,
account/tour/post/site/connect regressions, URL/config and initial-read race
checks pass against local fixtures. All 144 Instagram original-reference cases
pass (maximum difference below 0.005%).

Directory visual acceptance now uses shared deterministic local data for server
and browser reads instead of live API data. It includes 32 populated, filtered,
empty and paginated cases. Diff review identified a theme-picker text mismatch:
canonical directory/event pages use the original directory/event HTML labels;
profile and page-management screens retain the original profile labels. The
administration suite now selects the actual original HTML entry point for each
canonical route. Final comparison results are recorded in DESIGN_PARITY.md.
No production frontend publication, backend deployment or database write occurred.


The refreshed directory suite passes all 32 cases with zero differing pixels.
All 72 administration cases pass using each route's actual original HTML entry
point. Directory filtering/pagination/theme behavior, profiles, administration,
compatibility URLs/config and subscription-race checks pass against the final
Next.js production build. A real early-interaction bug was fixed by enabling the
shared theme picker only after its React handler is ready. The synthetic admin
subscription fixture now returns the schema for the requested REST path, removing
artificial refresh loops in the original reference renderer. Production remains
unchanged; the full-screen migration goal remains active.


The native atlas layout now owns the Settings dialog, source guide, System
activity panel and device-storage controls. The More → Settings action opens the
original modal composition; members retain its Account settings link. A shared
React controller loads the public static catalog through the existing StaticData/
DatasetCache engines and retains layer/survey state across native account tabs.
Layer capability/legend logic, refresh, zoom/fit, contour download and attributed
PNG export operate the actual map engine. The canvas remains inactive while the
account screen is active, matching the original shell. The remaining map views
have not been routed to this controller yet.

Storage controls use the existing public atlas store and generated application
storage model. Save/update/retry/open/remove, cache limits, clearing recent or
account reads, persistence requests, network-only mode, dataset progress/cancel
and cache-status notices are React-owned. Saved regions remain pinned when
recent data is cleared. Activity uses one stable browser store shared by map/data
engines and native Instagram commands. Its counters, transfer/paint display,
filters, clear and connection updates retain the original layout. Storage precedes
the optional Instagram status section in the panel, as in the original app.

The authored DepthMap engine now exposes disposal: detach ResizeObserver and
gesture listeners, stop scheduled work, abort imagery, clear contour work and
cancel active tile telemetry. Active images are tracked separately from the
replaceable image cache, so refreshing and then unmounting cannot leave a tile
operation behind. Generated runtime implementations and backend/database sources
were not edited.

All 80 independent settings/guide/activity comparisons pass; maximum pixel
difference is 0.0125%. Functional atlas/storage checks, map/rendering/offline model
tests, account/tour/Instagram/post/site/URL/config regressions pass. Required
generation/consistency, repository tests, atlas publication build, prepared assets
and the final Next.js production build pass. The final complete repository test
run also passes after the lifetime change. Discovery/maps/location tools, remaining
visual states, worker/offline startup and upgrade behavior, Netlify bootstrap/link/
preview auth and release acceptance remain required. Production is unchanged.


Final shared-layout visual regression: all 144 account/tour and 72 logbook cases
pass with the native atlas/settings/storage runtime present. Next map work must
connect generated public site-directory reads/updates to this controller, restore
site/area/offline-region URL context, port discovery/location and map tools, and
then replace the remaining `/app` rewrite. Until that work passes, navigation to
the legacy map still crosses a frontend boundary; this checkpoint does not claim
map-route or offline-application-startup completion.


Native `/discover` now owns browsing: state choices, location preference controls,
recommendations and detailed filters, index/state/region tree, alias search and
pagination, up-to-three comparison cards, and embedded native directory/event
panels. It reuses the original pure discovery functions and outline geometry.
The atlas now reads/observes the generated runtime's public site catalog, hydrates
site-only regions on catalog loads, retrieves current popularity, and refreshes
comparison/site data on publication or reconnect. Revision fences ignore older
catalog snapshots; unpublished sites are removed from active comparisons.

Discovery is persistent within the shared React atlas layout. Native navigation
uses client routing so comparison/filter/expanded-control state and layer settings
survive moving to account screens and back. Filter URLs and explicit All Australia
are restored across navigation; precise location remains in memory. Old app/root/
HTML Discover, Areas and Guides links redirect to `/discover`, retaining filters
and choosing the original section for each alias. Map card and region links still
use the explicit legacy map boundary until the native map panels/tools are ready;
selection and target-depth handoff are not accepted as native map behavior yet.

A native Netlify function is prepared for `/api/location`, using platform geo
context to return only country and a recognized Australian state, with private
no-store responses. It follows the [Netlify Functions context and custom-path API](https://docs.netlify.com/build/functions/api/).
No SDK dependency or third-party location request is needed. The plain Next.js
route returns the null fallback. Unit checks cover foreign/invalid/absent hints
and exclude precise coordinates/IP; browser checks prove that late hints cannot
replace manual choices. A real Netlify preview must still prove custom-function
routing and platform context before release. Netlify framework/functions skill
guidance was consulted; no deployment or domain modification occurred.

All 120 independent discovery visual cases pass (maximum difference below 0.021%).
The functional discovery, compatibility URLs, atlas/storage, account/tour,
Instagram and configuration checks pass against local fixtures. Required
`make generate`, `make check-generated`, `make test`, `make build`, public asset
preparation and the final Next.js production build pass. All 80 shared settings/guide/activity visual regression cases also pass. The remaining work includes
native maps/location/context/media/measurements/inspection/profile tools, remaining
visual states, offline startup and worker upgrades, and Netlify release acceptance.
Production remains unchanged and the full migration goal remains active.


Discovery follow-up regression passes for logbook, posts/trips, site/review and
subscription update races, including rejection of an older public catalog
snapshot after a newer publication removed a compared site. The historical
`/_next/location` endpoint uses an exact-match Next.js proxy to redirect to
`/api/location`, retaining query parameters with a private no-store response.
Ordinary Next.js config redirects exclude the reserved `/_next` prefix, so the
compatibility behavior must be checked against the production server. Real
Netlify preview routing for both URLs remains a release gate.

The production Next.js build and local production-server checks pass for the
exact location redirect (307, query retention and private no-store), null fallback,
all compatibility URLs, configuration and the full native discovery functional
suite. No production deploy, project-link or domain change was made.


A staged native `/map` now renders the persistent DepthMap canvas through React,
with original search/keyboard interactions, region attribution/empty state,
inspection details and grouped record pagination, contour measurement controls,
profile drawing/help, native raster sampling, chart and CSV download. Existing
map/data/measure/contour-estimate functions supply calculations. Layer settings
remain shared across the atlas. Native controller selection connects site/area
search and markers, richer site records, context coastline/contours and area zones;
initial surveys focus the original dominant area. Direct site/depth links and a
Discover/back round trip retain selection/depth/canvas. Public catalog removal
fences delayed detail reads and clears removed selection/tools.

All 48 independent map comparisons pass in four themes and both viewports, with
zero differing pixels in the final run. Map tool functional/race tests pass, including
real gzip raster profile sampling/export and cancelled or superseded requests.
`make generate`, `make check-generated`, `make test`, `make build`, asset
preparation and the native Next production build pass. Shared atlas/discovery
visual regressions pass all 80 and 120 cases after this persistent runtime change.
Final production-server checks also pass for map tools, original compatibility
URLs, account tools and logbook behavior.

The navigation destination and `/app` rewrite remain on the original map. The
native place overview is partial: media, stays, community/session actions and
remaining restrictions/source details must be ported and compared before map
cutover. Full history/offline restoration and native offline startup/worker
upgrades, the remaining screen states and Netlify preview/release acceptance
remain mandatory. Production and the full migration goal remain unchanged.


Native place panels are now implemented under `atlas/place-*`: compact summary,
source and restriction details, surveys, photo/stay tabs, original stay filtering
and source links, filtered map pins/stay inspection, local photo-link storage,
opt-in Instagram/X previews, public/discovered/member photo feeds, pagination and
reports, trip links, regulars/check-ins/permission-limited stats/connections/block/
profile reports, and beach post feeds/preview/share/report controls. Log a session
here opens a native private editor prefilled from the selected catalog site; a
guest direct link cannot open that editor. Detail failure preserves the listed
reference and offers a real retry. X preview loading handles failure and retry.
Private reads/actions are fenced by actor and site, pagination by its base read,
and statistics by the person snapshot. Functional checks cover paging, filters,
private device links and opt-in networking, report payloads, privacy levels,
member actions, prefilled editor/guest guard, failed detail/preview recovery, and
a delayed community response completing after sign-out.

Original place comparisons initialize the original lazy logbook client through
its Logbook → Map UI, then require the same public/member photo records in both
renderers. Native cold-start member-photo loading has separate functional
coverage. The reference app and calculations remain unchanged.

Discovery directory/events now register route content into the runtime and
render in the persistent screen's own React tree, with owner-checked cleanup.
This replaces the sibling portal handoff. A transient React exception observed
in one regression was not reproduced in three isolated reruns; the replacement
passes repeated directory/event mounts and a deliberately delayed/superseded
route response. Discovery functional and all 120 visual cases pass. Required
generation/generated checks, repository tests, atlas build/asset preparation and
Next production build pass. Map and logbook visual regressions also pass.

These changes do not switch `/app` or the Map navigation destination. Full map
history/offline restoration, remaining media/inspection/error/loading/gesture
states, public collection status/activity integration, native offline startup and
worker upgrade behavior, other outstanding screen states and Netlify preview/
release validation remain required. Production is unchanged and the migration
goal remains active.

All 112 independent place visual cases pass in four themes and both viewports.
Maximum difference is below 0.0061%, with matching image dimensions and the
unchanged 0.5% threshold; the worst expanded-stay text diff was inspected. New
place/recovery/pagination/session-prefill tests and original URL compatibility
checks pass. The discovery navigation stress test and its 120 visual cases,
48 map and 72 logbook visual regressions also pass.


Native map navigation now gives explicit site/area/survey choices their own
history entries and replaces the current entry for target-depth changes. An
opaque marker preserves Next's history fields; viewport, panel and public map
tool snapshots stay in memory. Back/Forward restores the context and exact
canvas view without resetting shared layer preferences. Snapshot versions fence
old measurements/profiles/inspections after catalog or directory publication
changes. Missing/unpublished site links cannot revive the saved site record, and
a corrected republished record is read afresh. Partial site/region loads are
cancelled when leaving; late responses cannot change the returned-to site or
its contour targets. In-progress raster profiles and point inspections resume on
return, with older completions ignored. No member feed/profile records are
stored in map history.

`AtlasStore.keys()` checks availability without reading all dataset payloads.
DatasetCache only prefers complete saved packages whose keys are still present,
scoped to the same data base. It skips malformed/evicted records and uses a
complete alternative if the most recently opened package is damaged. Offline
region switching selects that package's own manifest; older concurrent selection
reads cannot change a newer choice. Existing DB names, schema, pinned old versions
and interrupted-update data remain intact. Controller catalog reads also reject
superseded results and unknown region IDs without substituting the wrong map.

Browser checks pass for Back/Forward site/area/panel/depth/camera state, retained
Next metadata, delayed site details and contour responses, and pending real
raster profile/inspection work across native navigation. Native saved-data boot
passes after recent-cache clearing, an interrupted newer package update, and
loss of a preferred package file: it restores the previous complete saved
version and its original contour targets instead of mixing newer metadata.
That test disables dataset networking while serving application code; complete
offline HTML/JS startup and service-worker upgrade behavior remain unaccepted.

All 48 map comparisons pass with zero differing pixels after waiting for derived
contour computation in both renderers. The read-only test observer calls the
original calculation and returns its unchanged result; no reference rendering,
geometry or image masking is used. All 112 place and 80 settings/activity
comparisons pass too. The same completion observation makes place checks wait
for the actual derived map state. Required generation/generated checks, repository
tests, atlas build, asset preparation and native production builds pass.

The public Map navigation and `/app` rewrite still use the original map until the
remaining map states, gestures, public collection/activity integration, full
offline startup/upgrades and release gates pass. Other outstanding screen-state
and Netlify preview/release checks remain part of the active full migration
goal. No production, hosting or domain change was made.

## Native map offline startup and shell upgrades

The native production build now emits `/sw.js` from an integrity manifest of
that exact build's Next chunks, public JS/CSS/WASM/branding, public build config,
and prerendered map HTML. The public config contains environment bindings, not
session credentials. Map datasets remain in AtlasStore; account/API/auth/RSC and
third-party responses never enter the shell cache. The legacy retirement stub
has been removed. Native `/map` document navigation falls back to the cached
native map when the network fails, retaining the requested query/context.
Other native document routes still require their own offline acceptance.

Installation checks every response's SHA-256 and rejects redirects or mismatched
files; failed installs remove only their incomplete candidate cache. Both the
original worker template and previous native worker can remain active until
existing tabs close. Complete activation removes older shell caches and leaves
AtlasStore, account storage and preferences intact. A build-match record stores
only an opaque browser client ID and a boolean. Stable runtime URLs are served
from this cache only to matching documents, avoiding older worker files being
substituted into a newer application's HTML. Immutable Next chunk paths remain
safe to serve directly. Workers can restart between requests without losing the
build-match record. App updates do not force a reload of an open editor.

`test_nextjs_offline_shell.mjs` passes with a new document, no page-route fixtures,
all browser networking disabled, and HTTP cache cleared after saving a real
contour package through Settings. Native HTML, chunks, dynamic modules and map
controls boot from device storage, preserving region/depth URL selection.
`test_nextjs_offline_upgrade.mjs` runs the original worker implementation with a
small static shell fixture, rejects a corrupted native runtime, then exercises
both legacy-to-native and native-to-native waiting/activation while preserving
AtlasStore metadata. It also checks that a document outside the worker's build
receives its own runtime from the network. The pure worker contract is included
in the root test suite. Existing route-mocked screen tests explicitly block
workers so their synthetic data and reference instrumentation cannot be bypassed;
the separate lifecycle tests run real browser workers.

Existing saved-package interruption/eviction recovery, pending profile/inspection
navigation recovery and repeated/superseded discovery navigation checks pass.
Full offline coverage of other native screens, complete original-user data
migration, remaining map states/gestures/public collection activity, and Netlify
preview/release checks remain mandatory. No production/domain change was made.

After this shell change, all 48 independent map comparisons still match exactly
and all 80 settings/source-guide/activity comparisons pass (largest differing
pixel ratio 0.000125). Required `make generate`, `make check-generated`,
`make test`, `make build`, public-asset preparation and native production builds
pass. The final native build is checked again with real offline-startup and
worker-upgrade browser tests. The offline HTML artifact is excluded from search
indexing and ordinary HTTP caching; the worker stores its verified copy explicitly.

## Non-shore sites, coverage states and gesture lifecycle

Native map selection now retains the original boat-only/inland explanation and
the original automatic-distance failure copy instead of showing the generic
start-point prompt. Clear/manual measurement still work normally, and history
snapshots retain the selected site's explanatory state. When an empty or
site-only map is open, the published-map selector shows no published selection;
it no longer misleadingly displays the first unrelated published map.

Rich static detail reads are normalized through the existing site model before
selection, so a retired/unknown survey reference becomes the site's own empty
map. Failed survey loading stops selection before it can commit a new place.
The same public catalog/model and API remain in use; no database/schema changes
were made. Real inland selection is checked to have no coastal raster, contour,
coastline or regional-context leakage. Boat departure pins, unavailable profile/
contour controls and contextual coverage notices are checked too.

`test_nextjs_map_coverage_design.mjs` compares the untouched original HTML,
renderers and math against native React with identical synthetic public data.
All 56 comparisons pass with zero differing pixels: boat-only, inland, site-only,
regional context, context settings, automatic-distance failure, and no-depth
inspection across four themes and desktop/mobile. Fixtures use distinct reference
locations for each type; coincident beach-marker behavior is not established by
this comparison. No screenshot masks or reference substitutions are used.

`test_nextjs_map_gestures.mjs` uses actual mouse/wheel/keyboard browser events and
CDP two-finger touch events. Original/native camera positions and zoom match
exactly after drag, anchored wheel zoom, keyboard pan/zoom, pinch and pointer
cancellation at desktop and mobile sizes. The check found an active touch drag
surviving native navigation; map deactivation now explicitly cancels/relinquishes
its gesture before hiding the persistent canvas. Returning restores the view
without a stale drag/pinch. Existing history, pending profile/inspection recovery,
map tools and full-network-outage native startup checks pass after the change.

Remaining map inspection/loading/error/publication states, overlapping/grouped
records, public Instagram collection/activity integration, full offline coverage
for other native routes, landing acceptance and Netlify preview/release gates
remain open. Global map navigation and `/app` are still gated on those checks;
production and the domain remain unchanged.

Post-change regression checks also pass: all existing 48 map screenshots still
match exactly, and all 80 settings/source-guide/activity screenshots pass with
maximum pixel ratio 0.000125. Required generation, generated-source check,
repository tests and atlas build pass; fresh asset preparation and final native
production build pass. Gesture, coverage, offline shell and place-detail failure/
retry checks are rerun against that final production build. Raw offline store
and dataset-cache browser assets match their authored sources after preparation.

## Inspection records and public collection activity

The native inspector is now checked against untouched original HTML/renderers
with the same hashed datasets and actual browser pointer clicks. All 112
comparisons match exactly across four themes and desktop/mobile: above-datum
cells, missing numeric cells, loading, failed reads, bounded contour interpolation
with the original datum code, nearby line labels, individual contour sources,
12-record pagination/selection, spatially spread groups and their real fit/zoom,
mixed contour/raster groups and numeric raster-cell selection, regional-context
warnings, and file-footprint metadata. Group counts remain record counts; model
context and source-line labels do not become numeric point-depth claims. The
read-only map observer locates visible pin bubbles and never changes calculations
or renderer output. Separate renderer contexts prevent warmed datasets from
hiding the pending-read state.

Native public Instagram feeds now report the original `Instagram beach posts`
operation in System activity, including failures, and render the original public
collecting/paused/last-success summary. The generated public operation, existing
backend and public feed cache remain in use. The displayed summary is session
memory, not additional persisted account data. A request-generation guard stops
late pagination from an older place overwriting a more recently requested feed's
collection metadata. Failed reads keep the last successful summary, and clearing
completed telemetry does not remove it. Requests retain the original 12-second
bound. No collector, publication, account or database settings were changed.

Collection visual checks exposed the original toggle's companion behavior:
opening System activity closes place details. Native toggles now do the same;
closing activity retains a place explicitly opened while activity was visible.
A delayed initial catalogue also exposed search query/suggestion loss. Empty
initial selection values are normalized, and the first catalogue arrival no
longer behaves like a later publication revision. Real publication revisions
still dismiss old search results. The delayed-load browser test enters a query
before releasing the catalogue and selects the resulting place with the keyboard.

All 16 public collecting/paused views pass original-reference checks across four
themes and desktop/mobile, with identical collection text. The test waits for
real derived contours and tile work to finish before seeding identical telemetry;
it does not accept late tile completions as a layout difference. Functional
checks cover actual feed telemetry, cleared-log retention, failed pagination,
older-request completion, and the place/activity panel interactions. Existing
place tools, settings, gesture and full-network-outage native startup checks pass.
Required generation/generated-source/repository tests and atlas builds pass;
public assets are prepared afresh and native production builds pass.

Remaining gates include persistent account-integration status across routes,
other map loading/error/publication states and coincident beach markers, native
offline coverage outside `/map`, landing/remaining screen-state acceptance, and
Netlify preview/auth/platform/release validation. Public map navigation and the
legacy `/app` rewrite remain gated. Production and finfolk.com.au are unchanged.

Final verification for this change: 112 inspection comparisons are exact; all 16
collection comparisons pass with maximum pixel ratio 0.000006944444444444445
(and identical collection/settled operation text). Operation descriptions use
single text runs as in the original renderer. Existing 48 map comparisons remain
exact, and all 80 settings/source-guide/activity comparisons pass (maximum
0.000125). Public collection/race/panel behavior, delayed search and complete
network-outage map startup are checked again against the final native production
build. Prepared raw offline assets match their authored sources. These results
are staged acceptance, not a production release or completion of the full goal.

## Account integration lifetime across native atlas routes

The authenticated Instagram discovery summary is now owned by the persistent
atlas runtime instead of a portal owned by an account tab. Account discovery
uses that same status read for its controls/review; it no longer makes a second
independent `instagramDiscoveryStatus` request. Initial activation follows the
existing successful account membership/profile/status reads. Guest, deleted or
permission-rejected accounts cannot activate the shared status. Returning to the
account scope refreshes it; navigation to Discover/Logbook retains the current
read and status, including an initial response that finishes after leaving Account.

The shared read is fenced by the actual observed authentication object as well
as request generation. Sign-out, account changes and fresh sign-ins to the same
uid cannot expose a previous session's result before effects run. Deactivation
clears its local record. Old-identity and superseded same-identity completions
cannot replace a newer read. A same-identity refresh preserves its last successful
summary during loading or a transient read error, with retry through the account
controls. Only client session memory is used; the API, model cache, SQL, auth
provider and Cloudflare backend are unchanged. Private state is not serialized
into HTML, history, application-shell cache or custom browser storage.

`test_nextjs_account_integration.mjs` covers native navigation with a pending read,
retained canvas/status, refresh on account re-entry, sign-out, same-uid fresh
sign-in without a stale DOM flash, account switching with late responses,
superseded refreshes, refresh failure/retry and deleted-account activation.
Eight independent original/native comparisons pass for the retained status after
leaving Account, across all four themes and desktop/mobile, at a maximum pixel
ratio of 0.00004253250698748329 with matching status text.

The 144 account and 80 settings/source-guide/activity comparisons pass. The
posts/trips suite exposed a screenshot being taken while the native public report
was still waiting for authenticated navigation. It now explicitly waits for the
same signed-in fixture state in both renderers; dimensions, original markup,
renderers and pixel gates are unchanged. All 88 posts/trips comparisons pass.
Account/post/trip tools, public collection activity and full-network-outage map
startup checks also pass. Required generation, generated-source check, repository
tests, atlas build, fresh asset preparation and final native production build pass.

Combined integration states, remaining map/publication/loading/error coverage,
coincident beach markers, native offline coverage outside `/map`, landing and
remaining screen-state acceptance, and Netlify preview/auth/platform/release
validation remain open. The public Map navigation and legacy `/app` rewrite stay
gated. No hosting, production or finfolk.com.au change was made.

## Netlify bootstrap, packaging and deployment-tagged offline assets

The hosting build now runs the repository bootstrap instead of assuming a warm
machine. A clean Linux dependency environment completed generation, generated
source verification, atlas and native production builds with Node 22, Python
3.12 and JDK 25. It used a materialized source snapshot with pinned Foundation
and LFS inputs, without host Maven, Node or Python dependencies. This establishes
toolchain/bootstrap compatibility; it does not establish hosted checkout access.

The real Netlify adapter builds SSR, custom location and edge bundles. Its version
is intentionally unpinned/automatically updated. The explicit plugin declaration
also ensures CLI builds run its hooks when framework detection selects a static
server. CI now builds the native app with that adapter, checks its published
assets and exercises the unchanged SSR zip on Node 22 at Lambda's `/var/task`
using the official local Blobs server seeded with the adapter's prerendered data.
Account, Directory, native Map, the staged legacy map and compatibility redirects
pass that packaged-runtime check. The required repository tests also pass.

Next public-file rewrites are unsupported by the adapter. `/app` is now a
prerendered route containing the same legacy HTML, preserving the gated map
without depending on such a rewrite. Compressed atlas files generate exact
Netlify CDN `_redirects` and encoding/type `_headers` during asset preparation;
local Next startup keeps its own compressed-file fallback. No map cutover is
included in these routing changes.

Netlify skew protection tags Next chunks with `?dpl=...`. The offline manifest
records the build's deployment ID, and the worker accepts that exact query only
on hashed Next static assets. Unknown deployment IDs, extra parameters and
account/API/RSC requests still bypass shell storage. All 248 published shell
assets match their hashes, and actual browser startup with deployment-tagged
chunks, networking disabled and the HTTP cache cleared passes with saved map
data. Existing saved-region ownership and waiting-worker activation are retained.

Local Netlify custom geography returns the mock AU country with only country/
state and private/no-store headers; the built compatibility edge redirect also
passes. CLI 27.16.2 cannot relocate this monorepo's absolute `/var/task` imports
on macOS, and its `serve --dir` path override fails before startup. These are
local-emulator limitations, not a successful hosted-preview check. CDN compressed
response/header precedence, authenticated flows, actual platform geography,
worker upgrades on the hosted origin and release routing remain preview gates.
`tests/test_netlify_release_http.mjs` requires an explicit isolated `*.netlify.app`
URL for the read-only HTTP portion; it refuses the production domain. The
packaged-runtime check is reproducible with `node tests/test_netlify_lambda_bundle.mjs`
after `netlify build` (Netlify CLI on PATH or in `.cache/netlify-tools`, plus Docker).

Both connected Netlify accounts explicitly require reauthentication even for
project-list and coding-context reads. Reconnect the Netlify app before the
intended project can be identified and hosted-preview validation can proceed.
No hosting project, deployment, database, API or finfolk.com.au setting changed.
All remaining screen-state, offline-other-route and hosted-release gates
remain part of the active migration goal.

## Landing original-reference acceptance

The native landing page passes 72 original-reference comparisons with exact
pixels and matching copy across all four themes and desktop/mobile. The original
HTML initializes its own original engines; React initializes those same engines
only inside its empty visual hosts. Full-page checks cover every walkthrough at
completed, first and in-progress steps, and forecast-section checks cover prompt,
pending, loaded, partial, failure and retry. Forecasts make no request before
opt-in; changing the location resets the prompt; refresh/retry uses the selected
location and preserves the same provider/consent behavior. No implementation or
reference-image substitution was needed for these accepted states.

Run `node tests/test_nextjs_landing_design.mjs` against the local production
server. Results are written to `.cache/design-parity/landing/report.json` with
reference, actual and unmasked difference images. The largest ratio in the full
72-case run is zero. Remaining map/integration states, offline coverage of other
native screens and hosted Netlify release acceptance remain part of the goal.

For local browser checks against a deployment-tagged Netlify artifact, start
Next with that artifact's `NEXT_DEPLOYMENT_ID` (the `config.deploymentId` in
`.next/required-server-files.json`). Otherwise the standalone server and compiled
client disagree about the deployment and Next deliberately reloads during soft
navigation. With matching local configuration, the final landing/account
sign-in, settings navigation, sign-out and reset browser regression passes.
This local configuration is separate from the adapter's deployed runtime, which
uses its packaged configuration. The final tagged offline-startup and original/
native waiting-worker upgrade checks pass as well.

## Coincident beach-marker acceptance

`test_nextjs_coincident_sites.mjs` adds 24 original/native comparisons with zero
differing pixels across all four themes and desktop/mobile. Two published sites
share exactly the same entry/reference point. Real pointer hover/click follows
the original last-drawn marker priority, search still selects the obscured site,
and profile-point selection at that coordinate does not switch the selected
beach. URL selection, shared coordinates, selected map identity and one-vertex
profile controls are asserted alongside the original-reference images. The test
uses actual original map hit testing and separate renderer contexts, without
source substitutions or masks. No runtime change was required for these states.

The covered landing and coincident-site gates are now accepted. Combined
integration states, other map/publication/loading/error states, offline startup
outside `/map` and hosted Netlify/auth/release acceptance remain open. The public
Map link remains gated, and finfolk.com.au is unchanged.

## Initial map loading/failure and original saved-package acceptance

Startup comparisons found a missing original coverage prompt before the initial
catalogue was available. Native Map now retains that prompt while the catalogue
is pending or failed, and hides it once published coverage is established.
Thirty-two original/native map/settings comparisons pass across all four themes
and desktop/mobile, with matching error copy and a maximum differing-pixel ratio
of 0.0017924413659010814 (below the existing 0.005 gate). Pending completion and
reconnect/reload recovery are checked independently of the screenshots. The
native save-offline action remains disabled until storage/region setup is ready.

The worker-upgrade browser test now saves a complete synthetic contour package
through Settings in the original rendered map before either upgrade. After the
corrupt-install rollback and waiting legacy/native upgrades, a fresh native map
renders those original saved contours, requested depth and working map controls
with networking disabled and HTTP cache cleared. The original worker's shell
fixture remains deliberately small; this does not establish compatibility with
every older production shell/runtime cache or complete all hosted upgrade gates.

The final native build passes packaged SSR/custom-function/offline-asset checks,
repository tests, real offline startup and native map tools after the prompt fix.
Packaged SSR validation uses its own read-only public API fixture as well as the
official local Blobs server; its directory assertion requires fixture listing
content. No production provider/account data is required by that harness.

## Manual Netlify publication and hosted-platform fixes

The local CLI is authenticated, despite both app connectors returning stale
reauthentication errors. The `finfolk` project was created and linked without
Git continuous deployment. Its current production deployment is
`6ae988b426b5f0659bc4ebc8`, available at https://finfolk.netlify.app and
https://6ae988b426b5f0659bc4ebc8--finfolk.netlify.app. The API origin is configured
as https://api.finfolk.com.au in Netlify. No deployment automation was enabled.

Actual hosted checks found two routing differences that local SSR alone missed.
Netlify served the prerendered legacy `/app` response ahead of Next query-based
redirects. Compatibility routes are now shared by Next configuration and the
proxy, which applies them at the edge before static/prerendered handling. All
account tabs, Discover sections, trip links and old HTML entry points preserve
their destinations and query precedence; actual map links remain on the gated
legacy screen. Netlify also applies static response headers to the original
incoming path, so compressed survey rules now declare gzip/content type at both
the incoming and packed URLs. Hosted checks pass for the native pages, aliases,
public directory, actual country/state function, historical location redirect,
GeoJSON decompression and worker revalidation policy. The directory's first
public page contains 20 published listings.

Netlify injects its hosting comment into HTML, even after disabling the optional
Powered by badge. The badge is disabled for this project to preserve the design.
Offline documents are now distributed in an exact-build JSON envelope containing
the build ID and public prerendered HTML. The worker verifies the envelope bytes,
checks its build identity, and creates the HTML navigation response only on the
device. It does not accept transformed HTML or cache account/API responses.
All 248 assets delivered by the actual production deploy match the local SHA-256
manifest without redirects or transformations, including deployment-tagged chunks.
The envelope is served as JSON with no-store/noindex headers. Local browser tests
pass for fresh fully offline startup, original saved contours across both worker
upgrades, and landing/account sign-in/navigation/sign-out/reset regressions.
Required generation/generated checks/repository tests/atlas/native builds and
packaged Lambda validation pass. Authenticated hosted browser acceptance remains
separate; read-only hosted HTTP checks do not establish it.

The existing live Cloudflare worker has 108 cached shell paths, with versioned
map modules and no cached unversioned `/map.js`. An artificial unversioned-map
cache probe is therefore not evidence of a production legacy-cache regression.
The current backend, database, account bindings and stored datasets are retained.

Cloudflare OAuth can manage Workers and read the zone, but DNS reads return 403
and its grant has no DNS editing scope. The zone's apex, www and api are Worker
custom domains; only the apex/www would move, retaining api.finfolk.com.au on
`finfolk-next-api`. No Cloudflare custom domain has been detached and no DNS
record changed. Completing cutover requires the requested DNS-edit credential;
then Netlify HTTPS and the canonical domain must be verified. All remaining
native-map, integration and other-route offline acceptance stays in the goal.

## Additional native offline documents

The build now saves exact-build JSON envelopes for every successful, permanently
prerendered native page in Next's prerender manifest. This currently covers
`/map`, `/pages`, `/pages/review`, `/members` and `/events/my`. Internal error
pages, route handlers, dynamic pages and revalidated content are excluded.
The worker selects the envelope by the requested pathname and retains the
destination query. Installation verifies every envelope hash; navigation checks
the build ID before allowing that document to use stable runtime assets.

Offline link clicks to saved documents use full document navigation, since
Next's RSC transitions require a server. Modified clicks, downloads, external
links and same-document anchors retain their usual behavior. No rendered user
pages, auth responses or API data are added to shell storage.

The production-build browser check clears the HTTP cache, disables all network
access, opens four previously unvisited static pages, changes their themes and
checks an offline link transition. The existing fresh map startup and original
saved-contour worker upgrade checks also pass. These checks establish public
shell availability, not offline access to private page/event records. Dynamic
routes, including landing, discovery, logbook and account screens, still need
their own offline document strategy and acceptance. This change is local; the
published Netlify release and Cloudflare DNS have not been changed by it.

Required generation, generated-source verification, repository tests, atlas and
native builds pass. A fresh local Netlify production-context build also passes:
its static output contains 252 verified offline assets and all five document
envelopes match the compiled Next HTML. The packaged SSR Lambda runs unchanged
on Node 22 with the isolated read-only API fixture. Offline startup/navigation
and original-package upgrade browser checks pass again against this final build.

## Offline documents for dynamic atlas routes

Build-authored `/offline-app/[screen]` templates now reuse the native landing,
Atlas layout, discovery, logbook and account components. They contain no
server-rendered account data. The build maps the public templates to `/`,
`/discover`, `/logbook` and all eight account paths; internal template URLs are
excluded from worker destinations and search indexing. Online routes retain
their server rendering and catalogue reads. Offline account/logbook location
choices come from the saved Atlas directory, while private records and external
services still require a connection. Discovery's directory/events panels show
the existing connection error instead of an empty panel when offline.

On reconnection the template reloads the real server route, retaining the URL
and query. The worker also reuses the shared compatibility rules when offline:
legacy home query links and HTML aliases redirect to their native destinations;
the legacy map URL reaches the saved native map only while offline. Root-query
decisions now share one pure helper between the server page and worker, with
tests for account/logbook/report links, encoded IDs and tracking parameters.

Next emits percent-encoded bracketed chunk URLs. Offline asset keys now use
URL-encoded path segments, fixing a real cold-start chunk failure in the new
templates. Authored landing illustrations, theme scenes and demo avatars are
included in the exact-build asset set. API responses, user-rendered documents,
datasets and credentials remain outside the shell cache. These additional
documents do not establish offline availability of private records or complete
offline coverage for dynamic community, profile, event and report routes.

The saved templates own query navigation until the real route is reloaded.
Atlas router/query hooks delegate to Next normally, and use local history and
query subscriptions inside a saved template. Same-document Back restores the
discovery view without replacing its map canvas; cross-page buttons open the
destination's verified document. Template mode also handles failed connections
when the browser still reports online. Root link handling recognises that mode,
and a real online event reloads the normal route. Discovery's unavailable public
panels use stable React elements, avoiding a slot-registration render loop.

The final browser run passes 88 dynamic route/theme/layout combinations, covering
11 canonical paths, four themes and desktop/mobile. It verifies discovery tabs,
Back, retained canvas identity, unavailable directory/events panels, account to
logbook navigation, legacy discovery/map links, the selected saved contour, and
normal server routing after reconnect. Networking is disabled and the HTTP cache
is cleared; the dynamic cases deliberately report `navigator.onLine === true`.
Caught React/chunk/hydration failures are rejected as well as page errors.

The final local Netlify package has 16 public offline destinations and 317
verified assets. Generation/generated-source checks, repository tests, atlas and
native builds, output validation, original-package worker upgrades, online native
page/auth fixtures, and the unchanged SSR Lambda on Node 22 pass. Online map,
discovery and account-tool browser regressions pass too. This increment remains
local; no production deployment, DNS change or deployment automation was made.
Those browser checks start fresh documents within a browser context; separate
full-browser restart acceptance is recorded below. Remaining gates include
dynamic community routes and hosted authentication.

## Full browser restart and SQLite worker recovery

A persistent Chromium profile now saves a real contour package and a public
Clojure/SQLite model result, clears the HTTP cache, and terminates the browser.
A separate browser process opens the same profile with networking disabled from
launch and no request fixtures. It restores the selected 20 m contour, canvas
controls, saved-region metadata and discovery, and verifies a live SQLite kernel
in persistent mode returning the public result saved by the previous process.
The test uses a temporary profile, blocks external requests during setup, and
removes the profile afterward. No production data is written.

This stronger check exposed two worker-cache gaps hidden by an already-running
worker: the coordinator requests `?protocol=2`, and the kernel requests WASM
under its own browser client ID. The service worker now accepts only that exact
protocol query on the verified coordinator asset. When it serves verified bytes
for a worker/shared-worker script, it records the resulting worker client ID as
belonging to the same build before the worker fetches dependencies. Unrecognised
parent clients still bypass the cache; unknown protocols and extra query
parameters remain excluded. Build-match records also survive service-worker
termination. The fix changes neither the Clojure runtime nor SQLite schema.

Run `corepack yarn test:nextjs-offline-restart` against the local production
server to repeat this acceptance check. Unit coverage verifies dependency
access before/after worker startup and rejects dependencies from an unrecognised
worker, as well as preserving the existing install, upgrade and private-response
cache exclusions.

The final Netlify production-context build passes with 317 verified assets.
Full browser restart, the 88 dynamic route/theme/layout cases, original-package
worker upgrades and the unchanged packaged SSR Lambda on Node 22 all pass against
that exact build. Required generation, generated-source checks, repository tests,
atlas/native builds and output validation pass. This closes the covered Chromium
cold-browser/SQLite recovery gate; remaining community offline coverage, hosted
authentication and the final map/navigation release gates remain open. This fix
is local and has not changed the published release or Cloudflare DNS.

## Cached community pages

Directory, listing and event renderers are now shared between their existing
server pages and public offline templates. Server rendering, filters, pagination,
listing actions and event controls retain the same markup. After hydration a
public model read lets the existing Clojure/SQLite cache retain visited directory
queries, listing details, upcoming events and public event details. API responses
and rendered user pages are not added to the service-worker shell cache.

The offline worker resolves exact routes before the one-segment directory/event
ID patterns. The event editor and event/page invitation entry screens have their
own native templates, retaining their existing account checks and query inputs.
Unknown queries or records show the existing connection error; they are not
presented as empty results. Cached directory/events tabs also work inside
Discover when its location package has been saved. Route-aware community frames
mount after the destination pathname is available, avoiding hydration mismatches
between an internal template URL and the actual listing/event URL.

Native model transport now uses the existing same-origin Next API proxy. A
read-only request to the old hostname with the Netlify origin returned 403,
while the Netlify `/v1/directory` proxy returns 200. Optional `cacheApiUrl` in the
Clojure application and worker bridge preserves the configured backend's original
cache identity while the transport uses the current frontend origin. Native
public and member clients select that same identity. Existing configurations
without the option retain their previous behavior; identity-provider and other
backend namespaces remain isolated. The browser restart test seeds public data
using the old configuration and restores it through the native proxy binding.
No SQL schema, API Worker, authentication provider or CORS allowlist was changed.

The new community browser check warms public models through native page
hydration, verifies that browser requests use the same-origin proxy, saves a
location package and shuts down the browser. It then closes its isolated site
proxy, restarts with networking disabled, clears the HTTP cache again and checks
96 cached/missing-data and private-entry cases across four themes and desktop/
mobile. It uses no fixtures in the offline process and rejects React hydration,
chunk and page errors. Cached records, filtered queries, nested Discover panels
and unavailable-data states pass; unauthenticated invitation screens do not
offer acceptance. Public cache data remains separate from private account data.

Profile, people, member-detail and report offline coverage, hosted authentication
and the final map/navigation release acceptance remain open. These community
changes are local and have not been published or changed Cloudflare DNS.

The final Netlify production-context package passes with 324 verified assets,
21 exact offline destinations and two one-segment public-detail patterns. The
96 community cases, existing 88 dynamic route/theme/layout cases, full browser
restart with original cache identity, original-package worker upgrades and
packaged SSR Lambda on Node 22 all pass against this build. The 32 directory
design comparisons remain pixel-identical, and all 24 listing/event comparisons
pass the unchanged 0.005 gate (maximum 0.0001833247781770184). Generation,
generated-source checks, repository tests, atlas/native builds and artifact
validation pass. Online native page/auth fixtures and account tools pass after
the transport/cache-binding changes. Hosted real authentication remains a
separate unverified gate; these fixture checks do not establish it.


## Places and community map

The native `/map` entry now uses MapLibre GL JS with the approved Atelier layout: category chips, clustered icons, linked result cards, area search, shared selection URLs and a mobile results sheet. Community navigation groups People, Events and Businesses & groups; Map remains a primary destination.

Data comes from the published site catalogue and the existing declared public directory, events and popular-spot reads. Business pins use an explicit approximate locality reference matched against the catalogue; they never claim to identify premises. Listings and events without a reliable match remain in the list with a Not mapped label. Co-located results share a marker and expose their associated entries in the detail card. People markers identify published popular spots; profiles still use existing sign-in and sharing gates. No live member positions or fictional Atelier records are published.

`/map?mode=survey` retains the previous canvas, depth, measurements, profiles, exports and offline datasets. Existing `region` and `depth` links continue to open that view. Both modes link to one another and preserve a selected dive site. The vector basemap requires internet; if it is unavailable, results and the depth-map link remain usable. No frontend deployment or DNS change is part of this local adoption.

Checks: `npm run test:nextjs-explore-model` and `NEXTJS_TEST_URL=http://localhost:3220 npm run test:nextjs-explore-map`. The browser test uses the actual WebGL engine with an isolated style and published-data fixtures at desktop and phone sizes; real basemap appearance is reviewed separately.
