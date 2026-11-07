# Seed-backed page models

Authored application metadata starts at `src-app/finfolk_web/lib/seed.clj`.
It exposes existing operation declarations and database table contracts, without
installing SQL or inferring REST permissions from tables. Page definitions live
in `src-app/finfolk_web/pages/registry.clj`. `make generate` publishes them and
the Clojure binding runtime to `@finfolk/edge/page-models.js`.

A model names an existing read operation and maps operation fields to page inputs.
Actions have their own registry and run only when explicitly invoked. Bound fields
override form fields, so a submitted ID cannot replace the current route ID.
Authenticated REST reads use the SDK's existing `__rest` representation, including
POST reads such as `pageAccess`, preserving existing cache identities. The public
server loader executes only declared public reads. Database generation remains
independent of deployment and migration installation.

React may consume one read with `usePageModel` or a set with `usePageModels`.
The latter subscribes to the existing backbone and releases subscriptions on
page exit; it does not create a second application or worker. Member reads wait
for authentication, while public reads use the public facade. Errors remain
per-model. The action adapter delegates to the existing SDK request/call methods.

## Migration status

Directory browse/detail SSR, listing claim/report actions, owner list, owner
access reads and owner save/invite/revoke/remove-admin actions now use page
models. JSX presentation remains in place.

Events browse/detail/editor/my-events, event invitations, page invitations and
directory superadmin review now use Clojure-declared reads and actions. Ordered
conditional reads cover editor eligibility, management-only rosters and the
administrator review gate. Composite reads stop if the authenticated actor
changes while a request is pending.

People, member profiles, own profiles and profile editing now use generated
Clojure loaders. Optional featured-log reads preserve public/owner filtering
and selected ordering. Instagram link/code actions use declared page actions
while retaining caller idempotency keys and cancellation signals. The member
chooser has an explicit local page definition.

The account frame/authentication adapter, check-in, privacy, site submissions
and site review now use Clojure page definitions. Account settings has an
explicit adapter declaration and its messaging reads/actions are migrated.

The account Instagram/posts/messaging and review panels now use page
definitions, including persistent account integration reads. Logbook and public report reads are now migrated as well. Home/discovery and Atlas now use declared page resources and the persistent
controller adapter. Route, offline and alias publication is now Clojure-owned and
validated against every Next application page and handler. Public SSR payloads
hydrate the existing public operation models and SQLite cache without warm-up
requests. The final lifecycle/coverage audit, browser/offline verification and production
builds pass. The page-model migration is complete locally.

Run `node --test tests/test_page_models.mjs` for binding, cache identity,
action dispatch and public-server isolation checks, alongside repository checks.

## Completion checklist

The migration goal covers every application screen and is complete locally.

- [x] Events: browse, detail, create/edit, my events and event invitations.
- [x] Directory: page invitations and superadmin review.
- [x] Community: people, member chooser/detail, profile and profile editing.
- [x] Account frame/authentication adapter, check-in, privacy, site submissions
      and site review.
- [x] Account Instagram tooling, posts/trip management and review, messaging
      settings and persistent integration models.
- [x] Logbook and public trip reports.
- [x] Home, discovery and persistent Atlas/map integration.
- [x] Explicit local/adapter definitions for static screens, legacy redirects
      and offline templates, with generated route/offline coverage checks.
- [x] Conditional/dependent reads, explicit access gates, missing-input handling,
      independent model errors and complete declared action coverage.
- [x] Shared SSR/browser hydration without redundant cache-warming requests.
- [x] Removal of superseded screen fetching/subscription orchestration.
- [x] Regression coverage for identity/input changes, stale responses, cleanup,
      mutation refresh/recovery, worker restart and offline navigation.
- [x] Final generation parity, repository tests, production builds and affected
      browser/design/offline checks after all screen conversions.

Acceptance requires every application screen to be migrated and all checks to
pass. Keep React presentation, backend contracts, cache identities and actor
isolation intact. Deployment, DNS and database installation are outside the goal.

## Event and review migration verification

- Ten focused model tests pass, including dependency gating, SDK transport,
  bound action inputs and account changes during parent reads.
- Generated-file parity and the Next.js production build pass.
- Browser administration checks pass for owner access/save, ordinary-member
  admin denial, review actions, event validation/publishing, RSVP, private
  invitations/rosters and sign-out fencing.
- Subscription race checks pass for account operations and directory REST reads.
- Original/native design comparisons pass for seven changed screen types across
  desktop/mobile and all four themes: 56 comparisons within the existing 0.5%
  pixel-difference threshold. Full repository tests pass.

## Community migration verification

- Fifteen focused model tests pass, including restricted-profile early exit,
  optional/foreign/private featured logs, approved post consent, pagination inputs,
  actor changes during optional reads and Instagram request options.
- Repository tests, generation, generated-file parity and production builds pass.
- Browser checks pass for People, profiles and native Instagram code connection,
  including privacy restrictions, save payloads, retries, focus/abort and sign-out.
- Original/native member design verification passes: 32 comparisons across four
  themes and desktop/mobile, with a maximum pixel difference below 0.003%.
- The offline restart test now polls resolved public-cache reads and persisted
  SQLite rows before closing the warm browser; an unresolved async predicate
  previously allowed navigation before the warm-up was complete.
- Offline verification passes 96 people/profile/member/public-report cases across
  four themes and desktop/mobile, including a real browser restart, unavailable
  origin, saved public records, local filters, aliases, invalid/missing reports,
  anonymous profile guards and actor-scoped cache/sign-out erasure.
- Browser proxy fixtures must be selected at Next.js build time with
  `FINFOLK_API_ORIGIN=http://127.0.0.1:3210`, as well as at server start. Merely
  setting the start environment leaves build-time rewrites pointed elsewhere.

## Account core and sites migration

- Account frame reads retain their original me-then-status sequence and stop
  after an actor change. Check-in and privacy reuse existing operation/cache keys.
- Authentication actions delegate directly to declared SDK methods; passwords
  and codes are not sent through model/cache storage. Existing confirmation,
  cancellation, signup error handling and auth-session guards remain in React.
- Site submissions and admin review use declared reads/actions. Draft imports
  load only after the admin list; mounting never stages or publishes an import.
  URL parameters are encoded and removed from POST bodies where the endpoint
  previously accepted them only in its path.
- Nineteen focused model tests, repository tests, generated-file parity, the
  base production build and the native Next.js production build pass.
- Browser account-tools, site-review and subscription-race checks pass for retry,
  live updates, privacy payloads, versioning, publication consent and identity
  fencing. Account original/native design comparisons also pass.
- The remaining account integrations/content panels were completed in the
  subsequent account integrations migration described below.
- Site/review design verification passes 112 comparisons and account design
  verification passes 40 comparisons across four themes and desktop/mobile.
- A cold offline navigation check exposed an account-header hydration race:
  navigation buttons now stay disabled until their client handlers are mounted.
  Account browser/design checks pass again after that change.
- The offline-shell test now polls the resolved saved-map package status before
  disconnecting, rather than relying on an asynchronous truthiness check.
- The strengthened offline-shell check passes: cleared HTTP cache, unavailable
  network, saved contours, offline account/logbook/discovery documents, history,
  query controls, compatibility links and reconnect behavior across four themes
  and desktop/mobile sizes. Private API/auth responses remain excluded from
  the shell cache.

## Account integrations and content migration

- Instagram tools, comment commands, post/trip management and review use
  declared reads and explicit actions. Lazy panels retain their existing gates.
- Clojure loaders preserve usable posts when the followed feed fails, combine
  member Instagram data with admin state, and stop messaging event reads after
  permission failures. Non-permission failures remain visible and retryable.
- Messaging event queries and idempotent retries preserve existing wire shapes.
  The persistent account status hook keeps its session-object lifetime guards
  and now resolves its operation through the page registry.
- Retired `instagramVerify` is an explicit rejection descriptor with the existing
  410/claim_retired message, not a restored operation. The old browser fixture
  assertion now verifies that no retired transport call is made.
- Twenty-three focused model tests, generation/parity, repository tests and
  base/native production builds pass. Browser checks pass for Instagram tools,
  posts/trips, persistent integration and account tools.
- Original/native design verification passes for 144 Instagram cases, 88
  posts/trip/report cases and the persistent account integration status across
  all four themes and desktop/mobile sizes.
- The native offline-shell regression passes with the new generated models and
  activity chunk: saved maps, account/logbook/discovery documents, query/history
  controls, compatibility links and reconnection remain functional offline.

## Logbook and public reports migration

- Logbook composition, private-entry ownership checks, profile/list reads, media
  inbox actions and publication/deletion actions now resolve from Clojure page
  definitions. SDK method adapters preserve their existing argument shapes,
  save return values, optional ensureProfile behavior and operation cache keys.
- File/blob photo adapters invoke the SDK directly and never serialize files
  into operation-model storage. Existing SDK photo restrictions remain intact.
- Public extras use the existing public model service with the original cache
  environment identity; unavailable public trips remain an optional failure.
- Public-report server reads use the shared public loader with Clojure-declared
  ID validation and API error handling. Invalid IDs do not trigger requests.
- Twenty-nine focused model tests cover ownership rejection before profile
  reads, SDK argument/return shapes, optional SDK methods, native file identity,
  public-service routing and report validation/error messages.
- Browser logbook and posts/trips checks pass for failed draft retention, private
  saves, publication consent, private-before-edit, media assignment, photo URL
  cleanup and late-read sign-out fencing.
- Original/native design checks pass: 72 logbook comparisons and 24 public-report
  comparisons across four themes and desktop/mobile. Browser-restart offline
  verification passes all 96 member/profile/public-report cases.
- Final generation/parity, full repository tests, base/native production builds,
  browser logbook checks and the strengthened offline-shell regression pass
  after the optional-SDK compatibility adjustment.

## Home, discovery and Atlas migration

- Home styles and the landing-effect lifetime resolve from the Clojure page
  definition. Discovery's optional location hint is a declared resource.
- The generated Atlas adapter delegates to one existing controller, retaining
  snapshot identity, subscriptions, canvas ownership and layout lifetime.
  Dataset/map/offline engines remain owned by that adapter. Its public client
  only accepts the declared catalogue and popularity operations.
- Place media/trip/feed composition is Clojure-owned. Member versus public post
  inputs keep their existing cache identities; media failures remain independent
  and late actor changes reject the combined result.
- Public post reports/referrals are explicit actions. The public HTTP adapter
  omits URL identifiers from JSON bodies, preserving the report endpoint contract.
- Thirty-six model tests, generation/parity, repository tests and production
  builds pass. Browser place/recovery, discovery/navigation, map history and
  persistent integration checks pass.
- Replaced hard-coded operation totals with owning-group completeness/collision
  checks and typed operation invariants; exact baseline HTTP contract checks
  remain in place, accommodating the worktree's additional site operations.
- Visual fixture setup now activates visible details via DOM click and waits for
  DOM content plus its existing ready checks. Actual pointer interactions remain
  covered in the functional browser suites. Pixel thresholds remain unchanged.

- Full visual verification passes for 120 discovery and 112 place cases, plus
  landing and Atlas settings/guide/activity comparisons. The native offline-shell
  regression passes after these adapter changes.
- All 32 Next application route patterns are covered by generated declarations,
  including compatibility entrypoints, the location resource and internal offline
  templates. Compatibility/infrastructure exclusions have explicit reasons or
  adapters; a new route or unresolved alias fails generation and the build.

## Route publication and public SSR hydration

- `pages/routes.clj` owns the existing exact/dynamic offline templates, static
  document policies and ordered legacy aliases. Generation checks actual Next
  source inventory; offline publication independently validates the generated
  inventory and caches only declared documents.
- Home and `/profiles` invoke only declared compatibility adapters. The legacy
  redirect parsers retain their existing precedence and query-string behavior.
- The server loader records public-result provenance. Its server cache component
  only serializes matching public loader results; the worker independently rejects
  member scopes, private/admin/write operations and uncached reads.
- SSR hydration reuses canonical operation/input identities, subscriptions and
  SQLite persistence. Pending reads, network results, invalidation and eviction
  take precedence; among SSR seeds the newer server timestamp wins. Older running
  kernels retain their original read fallback during upgrades.
- Forty-eight focused tests pass for bindings, dependent reads, access gates,
  actions, real route inventory, hydration ordering/exclusions and React lifetime
  races. Replacement SDK clients for the same actor now hide old records and
  fence late results, alongside input/user/readiness changes and unmount.
- Real-browser verification covers seven SSR route/input cases with zero warm-up
  requests, persisted worker-owned SQLite data, private seed rejection and stale
  SSR replay. Report entry retains the Atlas controller's independent catalogue
  read, which has no server catalogue payload.
- The two unused generic transport hooks (`useOperationData` and `useRestData`)
  were removed. Screen reads/actions now use declared page models or explicit
  SDK/controller adapters. Shared React helpers retain only lifetime management.
- Source inventory covers `page` components and `route` handlers. Framework
  layouts, error/not-found boundaries and crawler metadata (`robots`, `sitemap`)
  are not independent product screens or offline documents; their existing Next
  behavior remains in place. API rewrites continue to use the existing Worker.

## Final acceptance

- Generation and generated-file parity pass. The full `make test` suite,
  `make build` and the native Next.js production build pass. Forty-eight focused
  model/route/hydration/lifecycle tests pass; `git diff --check` is clean.
- Final browser checks pass for subscription races, account tools and integration,
  administration/events, directory, people/profiles, logbook/posts/trips, discovery,
  place, map history, SSR hydration and legacy/profile URL compatibility.
- Final native offline-shell, browser-restart and upgrade checks pass, including
  corrupt-install rollback and existing saved contours. The 96 community and 96
  profile/report cold-offline cases pass with cleared HTTP caches and unavailable
  origins, including actor-scoped reads and sign-out erasure.
- Final original/native comparisons pass for 32 member and 72 administration
  cases across four themes and desktop/mobile. Their maximum pixel differences
  are 0.00249% and 0.01834%, within the existing 0.5% threshold. Earlier per-screen
  design evidence is recorded above; presentation markup was preserved.
- No migration checklist items remain. Publication, DNS changes and database
  installation were not performed as part of this goal.
