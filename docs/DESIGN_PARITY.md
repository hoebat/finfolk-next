# Original-design migration checklist

Reference: current FinFolk production, with matching authored HTML/CSS/JS in
`js/finfolk-next/site/web-main/src`. The reference is independent of the React
pages. No migration screen is accepted solely because its actions work.

| Screen | Original reference | React status / remaining acceptance |
| --- | --- | --- |
| Landing | landing.html / landing.js | Markup, copy, eight demos, accents, motion and themes ported; full screenshot comparison pending |
| Navigation / chrome | profiles.html / navigation.js | Icons, guest/member navigation, menu, theme picker, skip link, status and footer ported; responsive comparison pending |
| Authentication | community.js guest account | Original atlas account shell and printed wordmark ported; sign-in, registration, password reset and recovery use native React |
| Directory list | directory.js | Card marks, metadata, filters and ownership labels ported; 32 deterministic original-reference cases cover populated, filtered, empty and paginated results |
| Directory detail | directory.js | Hero/initials, about, events, contact, source disclosure restored; native claim/report/create-event controls; populated authenticated detail passes eight reference cases |
| Public events | events.js | Native list, detail, editor, mine and invitation screens; RSVP, roster, private invitations, cancellation and moderation; populated reference cases pass |
| Profiles / people | profiles.html / profiles.js | Native `/people`, `/profile`, `/members/[id]`, `/profile/edit`; functional checks and 32 populated-state screenshot cases pass. Restricted/guest/error and modal visual cases remain pending |
| Page management / reviews | directory.js | Native owner editor/access, invitation redemption and review tools; populated reference cases pass |
| Logbook | logbook.js / media-inbox.js | Native atlas shell, list/detail/editor, publication dialog, photos, public profile and media inbox; 72 original-reference cases pass. Shared settings acceptance is recorded below; remaining error/menu states still pending |
| Account check-in / privacy / settings | community.js / messaging-settings.js | Native persistent tabs, check-ins, preferences/connections, deletion/recovery, themes and messaging controls; reference comparison and functional acceptance tracked below |
| Member walkthrough | member-tour.js | Native playback and interactive examples for all 11 steps; reference comparison tracked below |
| Account posts / trip reports | posts.js / trips.js / trip-report.js / instagram-discovery.js | Native sharing, discovered posts, trip editor/import/publication and public report; deterministic acceptance tracked below |
| Instagram tools | actions.js / instagram-commands.js | Native comment verification/check-ins, action confirmations, invitations, points consent and admin inbox; 144 deterministic original-reference cases pass |
| Site suggestions / moderation | site-editor.js / posts.js / trips.js | Native suggestions, revisions/imports and combined moderation; 112 deterministic original-reference cases pass |
| Atlas settings / activity / storage | map-settings.js / activity.js / offline-ui.js | Native dialogs, layer/source controls, activity filters and device storage; 80 original-reference cases pass. Map-route integration and offline startup/upgrade acceptance remain |
| Discovery browsing | index.html / discovery.js / discover-preferences.js | Native suggestions, filters/index/tree, comparisons, state/location controls and embedded directory/events; 120 original-reference cases pass. Card/region map handoff remains on the temporary legacy boundary |
| Maps / location details | index.html / app.js / map.js | Staged native `/map` canvas/tools pass 48 reference cases; compact place/photos/stays/sources/community panels are ported with their own acceptance below. Legacy navigation remains until complete map state/history/offline acceptance |

Verify all four themes (yellow/cobalt/navy-light/navy), desktop 1440×1000 and
mobile 390×844. Include guest/member, empty/populated, loading/error and menu
states. Fix data and viewport dimensions; freeze motion at equivalent frames.
Reference screenshots must come from the original HTML/renderers, not from a
React-generated baseline. Keep diff artifacts and review every unexplained
visual difference. Browser-font antialiasing is the only acceptable automatic
pixel tolerance; do not mask layout, controls, or typography.

`tests/test_nextjs_design.mjs` captures original and migrated directory screens
side by side using the original directory renderer and fixed local public data,
in all themes and both viewports. It covers populated, filtered, empty and
paginated lists and verifies design structure. The local read-only API supplies
server rendering; browser reference reads use the same fixture module. These paired screenshots are review artifacts, not a claim that all
screens are pixel-identical. Snapshot assertions remain a cutover gate once
remaining differences have been resolved and reference images reviewed.

Run `node tests/test_nextjs_design.mjs --verify` to enforce the directory
comparison gate (at most 0.5% different pixels after antialias tolerance).
Dimensions must match. `.cache/design-parity/directory/report.json` records each result;
matching-sized images produce explicit difference PNGs. A failed gate is not
authority to update the reference or publish the migration.

Latest directory comparison passed the strict gate: desktop differences
0.002–0.003%, mobile 0.173–0.175%, below the 0.5% limit. The comparison
found and fixed landing-style leakage, sidebar specificity, mobile padding and
body background differences. This acceptance covers the directory list and its
guest chrome only, not every screen or authenticated state in the inventory.

The deterministic member suite now compares People, own profile, another member
and profile editing across all four themes and both viewports: 32 cases pass
the 0.5% gate. Fixtures intercept both browser catalog reads and member SDK
operations; a separate read-only local API supplies Next.js server reads. The
run exposed and fixed mobile logo spacing and Instagram stylesheet ordering.
Legacy profile query links dispatch to native member, directory, owner, admin,
invitation and event routes. The `/profiles` and explicit event legacy rewrites
have been removed from the local Next.js configuration. Guest/restricted/error/modal visual states are still outstanding.

The administration suite adds 72 populated-state cases: My pages, directory
review, page invitation, event list, My events, event editor, managed private
event detail, event invitation and authenticated listing detail. All four themes
and both viewports pass the same 0.5% threshold with equal dimensions. The run
found and fixed active navigation and page-access action placement. Fixtures
intercept browser REST operations; the isolated read-only API supplies server
reads. Run `corepack yarn test:nextjs-administration-design`; artifacts are under
`.cache/design-parity/administration`. These cases do not yet cover every
loading/error/guest state, expanded review editor or post-action panel.

The native logbook suite adds 72 cases across list, lower list, detail, editor,
lower editor, publication dialog, historical public profile, guest login and
import session chooser. Maximum pixel difference is below 0.001%; all cases use
the unchanged 0.5% limit and equal viewport dimensions. These views scroll inside
the original atlas shell, so lower scroll positions are captured explicitly.
The reference boots the original logbook, navigation and map-settings renderers
against synthetic SDK operations. Run `corepack yarn test:nextjs-logbook-design`;
artifacts are under `.cache/design-parity/logbook`. Global settings, account
tools, additional failure states and wider offline/upgrade acceptance remain
required before publication.

Account acceptance adds 144 cases: check-in, settings, privacy, lower privacy,
messaging controls, expanded messaging receipts, root-account guest sign-in and
all 11 walkthrough steps, each in four themes and two viewports. The independent
reference boots the original community/navigation/map-settings modules against
the same synthetic SDK. Equal-sized comparisons pass the existing 0.5% gate;
maximum difference is below 0.069%, confined to text rendering in the walkthrough
header. The run found and fixed dialog inheritance by rendering the React tour
in a body portal, matching the original dialog placement.

Run `corepack yarn test:nextjs-account-design`; artifacts and the 144-case report
are under `.cache/design-parity/account`. Functional account/tour tests verify
check-in retry/live updates, retained drafts, keyboard focus, privacy payloads,
connections, deletion and recovery, permission-gated messaging, retry keys,
no automatic uncertain resend, guest auth/reset and non-mutating tour examples.
Additional loading/error/empty/menu states remain in the full migration gate,
alongside the unported account tools and global map-settings dialog.

Posts and trip-report acceptance adds 88 cases: populated posts/discovery, lower
posts, paused submissions, new/existing trip editors, daily water entries, CSV
mapping/preview, public publication preview, public report/top and lower table,
and unavailable-report UI. Four themes × two viewports pass the same 0.5% gate
with equal dimensions. Maximum difference is below 0.011%; inspection shows
only text-rendering pixels in the CSV preview count. References use the original
community/trip renderers and the same synthetic SDK/API snapshots.

Run `corepack yarn test:nextjs-posts-design`; artifacts are under
`.cache/design-parity/posts`. Functional tests cover discovered sharing/location/
hide actions, post consent and failed-submit recovery, retained private trip
drafts, local CSV review, resumed batches, private row access, publishing consent
reset, withdrawal, SSR public-data isolation and sign-out during a pending import.
Instagram commands/actions and remaining state/menu/empty/error comparisons
still gate the full migration. Site and moderation acceptance is recorded below.


Site and combined-review acceptance adds 112 cases: new/existing suggestions,
dynamic evidence rows, submission previews/history, site management/editing,
draft and batch previews, staged imports, post review/metrics, trip review and
ordinary-member access. All four themes and both viewports pass the same 0.5%
limit with equal dimensions. Maximum pixel difference is below 0.013%; inspected
differences are text-rendering pixels in dates and preview metadata. The reference
boots the original community/navigation/map-settings renderers against synthetic
SDK/API data. No production writes or screenshot masks are used.

Run `corepack yarn test:nextjs-sites-design`; artifacts and the complete report
are under `.cache/design-parity/sites`. Functional site/review checks cover failed
submission recovery, evidence payloads, revision checks, source-review consent,
staging diagnostics and duplicate warnings, complete batch version lists, post
attribution/tag/beach checks, trip ownership/beach checks and review tokens,
permission fencing, and sign-out while a review request is pending. These scoped
passes do not complete the migration: additional state comparisons, Instagram
tools/dialogs, global settings, maps/discovery and offline acceptance remain.


The profile Instagram connection dialog is now native React. An additional 32
original-reference cases cover ready, malformed code, recoverable failure and
connected states across all themes and both viewports. All pass the existing
0.5% limit with equal dimensions; maximum difference is below 0.261%. Inspected
diffs show text rasterization/positioning within the otherwise matching dialog.
The modal mounts beneath the profile layout so the original typography,
controls and hidden-state styles apply. The reference uses the unchanged
`instagram-connect.js` renderer inside the original profiles page.

Run `corepack yarn test:nextjs-instagram-connect-design`; artifacts are under
`.cache/design-parity/instagram-connect`. Functional tests verify normalized
codes, no request for malformed input, one retry key per code, explicit retry,
400-response retry suppression, success, focus restoration, Escape, abort on
close/sign-out, and non-reduced animation/replay. Profile regressions and the
Next.js production build pass. Native Instagram tools/commands and the remaining
full-migration acceptance work are still open.


Native Instagram tools add 144 original-reference cases: collapsed/expanded
commands, verification/focus, command review and saved check-in, optional actions,
invitations, private dive confirmation, connection/action administration, empty,
paused, ordinary-member, and status/command/action/invitation/inbox failures. All
four themes and both viewports pass the unchanged 0.5% limit with equal dimensions;
maximum difference is below 0.005%. References boot the original account renderer
with synthetic SDK snapshots. The run caught and fixed verification focus/scroll
ordering: focus and select the command before appending its Copy button.

Run `corepack yarn test:nextjs-instagram-design`; artifacts are under
`.cache/design-parity/instagram`. Functional checks verify selected/copied commands,
visit and private-dive payloads, retained drafts and failed-confirm recovery,
points-consent rollback, invitations, exact public reply approval, cancellation,
admin draft/approve/decline/clarify actions, provider connection evidence, manual
uncertain-send reconciliation, points reversal and explicit event retry. No
uncertain send is automatically retried. Backend permissions and actor fencing
still apply; delayed inbox results disappear on sign-out and ordinary members
never fetch administrative inboxes.


Directory acceptance now passes all 32 deterministic cases with zero differing
pixels after matching each canonical screen's theme-picker labels. The directory
functional suite covers server HTML, pagination, submitted filters and offset
reset, empty results, original state-option order and persisted theme changes.
The shared theme picker waits until hydration has attached its handler, preventing
an early change from being silently lost after a filter navigation.

All 72 administration visual cases pass again using the appropriate original
profiles, directory or events HTML entry point. The administration fixture now
publishes the snapshot belonging to each subscribed REST path; owner-page and
superadmin subscriptions no longer return different schemas and trigger artificial
reference refresh loops. The functional administration and initial-read race
regressions also pass with those corrected snapshots. Final Next.js production
build, profile/directory/admin/URL/config checks pass. The full migration still
requires discovery/maps/location tools, further state comparisons, offline/worker
upgrades and validated Netlify release work. Shared settings acceptance follows.


Shared atlas acceptance adds 80 original-reference cases: initial/populated map
settings, expanded source notes, nested data guide, activity/all/failed/loading/
empty and lower storage view, plus guest settings. The original reference boots
the complete authored app against synthetic catalog/contour/SDK snapshots;
React uses the same public data and fixed device quota/clock. Four themes and both
viewports pass the unchanged 0.5% limit with matching dimensions. Maximum
difference is 0.0125%; inspected diffs show activity text rasterization. No
reference images, controls or layout regions are masked. The run fixed server/
client dialog mounting and restored storage-before-Instagram section order.

Run `corepack yarn test:nextjs-atlas-design`; reports and paired images are under
`.cache/design-parity/atlas`. `test:nextjs-atlas-settings` verifies survey/layer
changes, retained state across account tabs, contour downloads and source links,
saved region completeness, pinned maps surviving recent-cache clearing, cache
limits/account clearing/persistence/bypass/removal, activity filters/clear and
online/offline updates. A real canvas test verifies that disposal disconnects
observation and gestures and cancels an in-flight tile even after the image cache
was cleared. Map/rendering/offline model checks and native account/tour/Instagram/
post/site/URL/config regressions pass with the shared runtime present.

The atlas controller currently supplies the native account/logbook shell and
settings. Discovery/maps routes, rich location context, measurements/inspection,
profile charts and their remaining controls are still on the original frontend.
Crossing to those routes still crosses the temporary legacy boundary. This is
not full map-route or service-worker/offline-startup acceptance. Keep the original
routes and production frontend until the remaining work passes.


The shared-layout regression run also passes all 144 account/tour and 72 logbook
original-reference cases after the atlas/settings/storage integration. The final
complete repository test run passes after the active-tile lifetime change.


Discovery browsing acceptance adds 120 cases: recommendations, expanded filters,
ocean-swimming and camping modes, empty suggestions, index/tree/search/pagination,
advanced index filters, empty search, comparison, embedded directory/events and
guest navigation. All four themes and both viewports pass the same 0.5% limit
with matching dimensions. Maximum difference is below 0.021%; inspected worst-case
diffs show comparison text rasterization. The reference boots the original full
app against a shared synthetic catalog, summary and public API fixture. Fixture
file hashes match their contents, so the real DatasetCache verifier remains in use.

Run `corepack yarn test:nextjs-discovery-design`; artifacts are under
`.cache/design-parity/discovery`. Functional checks cover aliases/search pagination,
independent filters and URL/reset semantics, recommendation controls, comparison
caps/removal, live catalog updates and removal, tabs/keyboard focus, explicit
geolocation and late approximate-hint fencing. Discovery remains mounted in the
shared atlas while navigating native screens: comparisons, expanded controls,
filters, explicit All Australia and layer state survive a Check in round trip.
The first Show me somewhere new click now changes the mix; the original listener
order deferred that shuffle until the following render. This is a functional fix,
not a rewritten visual reference or an image tolerance exception.

Old Discover/Areas/Guides app/root/HTML URLs now resolve to native `/discover`
with their filters preserved. Map card/region handoffs still cross to the original
map frontend; map selection/target-depth continuity is part of the remaining native
map work. This acceptance does not prove map-route, location-detail, media, offline
startup/upgrade or Netlify deployment acceptance.


Staged native map acceptance adds 48 independent original-reference cases for the
map canvas, matching/no-result keyboard search, numeric raster inspection, profile
drawing and sampled profile chart. All four themes and both viewports pass the
same 0.5% gate with matching dimensions. The final run has zero differing pixels
in all 48 cases. Inspection coordinate text uses the same single string as the
original, fixing a small spacing difference from separate React text nodes.
The fixture supplies real gzip survey cells, matching DatasetCache hashes and a
deterministic basemap tile; neither rendering nor original markup is replaced.
Run `corepack yarn test:nextjs-map-design`; artifacts are under
`.cache/design-parity/map`.

The `/map` route is staged and not yet the navigation destination. Functional
checks cover real numeric inspection, site search and direct site/depth links,
contour targets, saved measurement visibility, Escape cancellation, native raster
profile sampling/CSV, region resets and retained canvas/target depth across a
Discover/back round trip. Separate asynchronous checks reject older inspection
and site-detail results, closed inspections, cancelled profiles, disposed runtime
results and a site removed from the current publication while details load.

Full place photos/stays/community panels, source restrictions and remaining
place states still need original-reference acceptance. Native map URL/history,
offline region restoration, inspection variants/grouped records, gestures, errors,
worker/offline startup and Netlify release checks also remain. These map tools
checks do not authorize replacing `/app` or the production frontend.

The shared runtime regression also passes all 80 atlas/settings/guide/activity and
120 discovery cases with the native map mounted. Map tools, compatibility URLs,
account tools and logbook functional checks pass against the final production
build. This is a staged map-tools checkpoint; the remaining acceptance above
still applies and production is unchanged.


Native place panels now preserve the compact thumbnail/name/depth overview and
More details disclosure, sourced access/depth/restriction text, photo/stay tabs,
source facts and jurisdiction advice, and bounded survey inventory. Stay controls
use the original distance/filter calculations, source-checked defaults, unverified
opt-in, initial three/expanded thirty cap, map pins and stay inspection. Photos
retain curated, public-discovered and shared-member cards, local device links,
explicit Instagram/X loading, reporting, per-page groups and trip reports.
Regulars, visit check-ins, permitted statistics, connection/block/profile report,
public beach-post feeds and prefilled private-session creation use existing APIs.

The source app initializes the logbook client lazily; shared member photos appear
in the original map after visiting Logbook. The independent place reference
follows the original Logbook → Map controls to load the same authenticated
dataset as the native screen, and explicitly checks for the shared member card.
Guest comparisons verify it is absent. No original renderers, markup, layout or
images are replaced or masked. A separate cold-start native functional check
requires shared member photos without a prior Logbook visit.

The discovery directory/event content now renders directly inside its persistent
React screen, replacing portals into sibling-owned nodes. An observed transient
React exception did not recur in three isolated reruns. The direct-rendering
version passes repeated tab mounts, delayed/superseded route responses and an
account round trip without React errors; all 120 discovery visual cases pass.

Remaining map acceptance includes complete URL/history and offline-region
restoration, media/inspection/loading/error variants, gestures, public collection
status/activity integration, offline startup/worker upgrades and release checks.
The legacy map navigation and production frontend remain in place.

Final place acceptance: all 112 cases pass across four themes and desktop/mobile
with matching dimensions and the unchanged 0.5% gate. Maximum difference is
0.0061%; the inspected worst expanded-stay diff contains a few text glyph pixels.
Artifacts are in `.cache/design-parity/place`; run
`corepack yarn test:nextjs-place-design`. Map (48), logbook (72) and discovery
(120) visual regressions pass alongside the new functional/recovery/navigation
checks. Complete map/release acceptance remains pending as listed above.


Map history/data restoration acceptance now covers explicit site/area/survey
entries, replace-only depth changes, exact viewport/panel restoration, shared
layer continuity, late-response cancellation and resumed pending raster/point
calculations. Version fences reject stale overlays and unpublished site data.
Unit and browser checks retain Next history fields and keep camera/tool records
out of browser history state. Region source/context notes retain the original
broad-scale/no-local-survey wording.

The 48 map cases pass with zero differing pixels when both renderers' real
derived-contour computations have completed. Tests observe completion while
returning the original calculation unchanged; rendering and geometry are intact.
The 112 place checks use the same settled-data observation and pass; the 80
settings/activity cases also pass. This avoids comparing a pending original
contour pass with a completed native pass.

Saved-data checks prove pinned packages survive recent-cache clearing, old
complete versions survive failed updates, damaged preferred packages are skipped,
and saved region manifests are not mixed with a newer cached catalog. Application
code is served during this data-network outage test; full offline application
startup and worker upgrade acceptance remain a separate mandatory gate. Existing
legacy navigation and the production frontend remain unchanged.

The separate native-shell browser test now proves `/map` starts as a fresh
document with networking disabled and the HTTP cache cleared; the older
saved-data-only test remains useful for interrupted updates and eviction. Real
browser lifecycle tests also cover failed native installs and both original-
worker-to-native and native-to-native upgrades without AtlasStore deletion.
Offline acceptance for the other native routes and full release acceptance
remain open. Route-mocked visual/functional suites explicitly block workers;
real worker lifecycle is tested separately with actual network requests.

Post-shell regression: all 48 map comparisons pass with zero differing pixels;
all 80 settings/source-guide/activity comparisons pass with a maximum pixel
ratio of 0.000125. Existing screenshot dimensions, original renderers and
comparison gates are unchanged.

Non-shore/coverage acceptance adds 56 original/native screenshots across all four
themes and desktop/mobile, with zero differing pixels: boat-only, inland,
site-only unsurveyed, regional context, context settings, automatic-distance
failure and no-depth inspection. The original renderer/math and same synthetic
data are used without masks. Dedicated sites have distinct reference positions;
this does not establish coincident beach-marker behavior. Map selector and
measurement explanatory text differences found by these checks were corrected.
Actual drag/wheel/keyboard/pinch/cancel events also produce matching original/
native camera states; native navigation cancels outstanding touch gestures.

Existing-map regressions after the coverage/gesture changes: 48 comparisons
remain exact; all 80 settings/source-guide/activity comparisons pass with maximum
pixel ratio 0.000125. Required builds/tests and the final production browser
smoke checks pass. These checks do not remove the outstanding map, landing,
offline-other-screen or Netlify release gates.

Inspection acceptance adds 112 exact original/native comparisons covering real
numeric elevations/gaps/failures/pending reads, contour interpolation/labels/
source pins, record pagination, group zoom and mixed raster selection, regional
context warnings and raster footprints. All four themes and desktop/mobile are
included; inspector text must match independently of the screenshot gate.

Public collection activity adds 16 original-reference cases for collecting and
paused/not-yet-run states across the same themes/sizes. Collection text must
match, and actual map work is allowed to settle before identical activity-ledger
fixtures are seeded. These comparisons found and corrected native activity
opening without closing place details. The original renderers, math, screenshot
dimensions and pixel gate remain unchanged; no image masks are used.

Final collection result: 16 pass, largest differing pixel ratio
0.000006944444444444445; collection summary and settled operation-row text match
exactly. Existing 48 map comparisons remain exact, and the 80 settings/source-
guide/activity cases pass at a maximum ratio of 0.000125. Final native-build
checks also pass for public feed races/errors/panel behavior, delayed initial
search and full-network-outage map startup. Release and other outstanding gates
remain open.

Account integration lifetime adds eight original/native views after navigating
from Account to Discover. All themes and desktop/mobile pass with identical
private status text and a maximum pixel ratio of 0.00004253250698748329. The
source remains the original application; no masks or native reference images
are substituted. The existing 144 account, 80 settings/activity, and 88 posts/
trips comparisons also pass. Public-report comparisons now wait for the same
fixture authentication state before screenshots, avoiding a transient guest rail
being compared to a settled signed-in original. This changes synchronization,
not reference rendering or the acceptance threshold.

Landing acceptance adds 72 comparisons using the original `src/landing.html`
and native React page, with zero differing pixels and identical visible copy.
All four themes and desktop/mobile sizes are covered. Full-page captures include
all eight walkthroughs in completed, first-step and in-progress states; section
captures cover forecast prompt, pending, loaded, partial, failure and retry.
Only the existing shared demo engine sets the same illustrative step in each
renderer. Forecast fixtures use identical weather/marine data and timestamps;
no screenshots are masked or replaced with native references. The test also
asserts no forecast request before opt-in and refresh/retry after failures.
This closes the covered landing design states; hosted platform/auth, remaining
map states and offline coverage outside the native map remain release gates.

Coincident site markers add 24 exact original/native comparisons across all four
themes and desktop/mobile. Both sites share the exact plotted point. Actual hover
and pointer selection choose the last drawn marker, search reaches the obscured
site independently, and drawing a profile suppresses marker selection at that
same coordinate. Selected location URLs and profile controls are checked as well
as pixels. Fresh browser contexts isolate each renderer. Draw is instrumented
only to observe the original map instance; hit testing and selection are
unchanged, and no screenshots are masked.

Initial-map acceptance adds 32 catalogue loading/failure views for map and
Settings across all themes/sizes. A missing native coverage prompt was restored.
Map views match exactly; all Settings views pass the existing 0.005 gate, with
maximum differing-pixel ratio 0.0017924413659010814 and matching error copy.
The save-offline button stays disabled until native storage/region setup is
ready. Completion and reconnect/reload remove the initial prompt correctly.

Contour loading acceptance adds 64 original/native comparisons across all four
themes and desktop/mobile, with zero differing pixels. Map and Settings captures
cover pending requests, HTTP 503 failures and successful recovery. Notice/source
copy and available measurement actions match; unused default options in the
hidden, unavailable measurement panel are excluded from the action comparison.
Recovery checks require contours and controls to become available, the loading
or failure notice to clear, activity to settle and no browser page errors.
Each renderer uses its own browser context and the same contour fixtures; no
screenshots are masked. This adds state coverage without changing runtime code.

After sharing directory/listing/event views with the public offline documents,
the 32 directory comparisons are rerun with zero differing pixels. The 24
listing, event-list and event-detail comparisons also pass across all four
themes and desktop/mobile, with maximum differing-pixel ratio
0.0001833247781770184 against the unchanged 0.005 gate. These are regressions
of existing acceptance coverage, not additional states in the cumulative count.
The reference renderers and fixtures are unchanged; no screenshots are masked.
