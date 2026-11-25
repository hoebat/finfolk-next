# FinFolk Next

The Clojure-authored database and substrate backbone for [finfolk.com.au](https://finfolk.com.au). This is the source of truth for FinFolk production development. The `hoebat/finfolk-app` implementation remains a frozen legacy copy; it is not a build dependency.

## Project manager and previews

Run `make manage` and open [FinFolk manager](http://127.0.0.1:8135).
The Pipeline view covers database contracts, Clojure/XTalk publication, browser
bundles, site assets, Next.js, the API and integration checks. **Previews** opens
actual FinFolk routes, including the map, community, logbook, account and review
screens, with desktop/mobile widths and a separate-tab option.

Open **Environments → Development** to start or stop previews and toggle feature
flags for their screens. Linked previews update automatically; settings survive
stop/start. These local controls need no production flag credential.

`make manage-preview` reuses a running Next.js development server or starts one
on port 3010. The manager discovers its port from Next's local development lock;
start the preview before the manager. `FINFOLK_PREVIEW_ORIGIN` can override the
preview origin; `MANAGE_PORT` selects the manager port. The preview retains the
application's existing auth and API configuration.

```sh
make manage-preview          # reuse/start the actual Next app
make manage                  # shared local management UI (port 8135)
make manage-plan             # full target dependency graph
make manage-check            # compare generated text artifacts with fresh publication
make manage-build            # generate and run applicable build/integration checks
```

See [the management guide](docs/APP_MANAGE_INTEGRATION.md)
for build ownership, checks and preview configuration.

## Logbook lab

Run `make demo-logbook` for an isolated local demo at
[localhost:8132](http://127.0.0.1:8132), also available under app.manage's
**Previews → Logbook lab · devtool**. It uses the emitted Substrate backbone and
native PostgreSQL functions on local Supabase. The fixture actor switcher and
live model/cache/request inspector let you create a private session, check
Alice/Bob ownership and exercise a rejected write.

`make check-logbook-demo` verifies the demo stage and records evidence in
**Slices → Private logbook → Local demo & devtool**. Stop the demo with Ctrl-C
to drop its owned database. Fixture identities are distinct from production Auth.

In **Pages & models**, load `logbook-ownership` and click **Run / verify** to
inspect page/model results, errors, trace, state and cache. `make build-page-verifier`
generates the XTalk worker; `make test-page-models` replays the versioned saved
checks on a fresh disposable local fixture. See [page verification](docs/APP_MANAGE_INTEGRATION.md#verify-in-the-ui).

## Native entity identities

Fresh FinFolkDB entities use UUID IDs and UUID relationships, including addon
`class-ref` identities. `et/E` supplies generated UUIDs. Provider identifiers,
slugs and imported source keys remain separate text fields; former text primary
keys are retained as optional unique `key` fields. SiteCatalog has a UUID ID and
an enforced singleton flag. Transaction actor IDs and native ID RPC arguments
must be UUIDs; an absent actor is SQL NULL. Managed-auth subjects must contain
UUIDs and are compared in their canonical text form at the provider boundary.

This updates database source and generated fresh-schema artifacts. Existing
data, backend adapters, reference-import producers and deployed databases need
a coordinated UUID mapping before adopting this schema. Historical migrations
remain unchanged.

## Source and output

| Authored source | Generated output |
| --- | --- |
| `src/finfolkdb` | Native SQL under `resources/finfolkdb` and separate JSON contracts |
| `src-app/finfolk_web/groups` | The active browser operation registry, including HTTP bindings and invalidation domains |
| `src-app/finfolk_web/lib` | `js/finfolk-next/packages/edge`: actor lifecycle, substrate models, xt.db cache, application state and public HTTP adapter |
| Pinned `ref/foundation/src-lang` | Required `@xtalk/*` workspace packages under `js/finfolk-next/packages/libs` |
| Existing JavaScript in `js/finfolk-next/site/web-main/src` | The DOM/map site and versioned browser bundles |

The backbone implementations are written as genuine `l/script :js` Clojure declarations. `next-backbone.js`, `app-backbone.js` and the worker scripts are esbuild bundles of that emitted code. The DOM/map UI remains authored JavaScript.

Next uses a SharedWorker coordinator and one dedicated worker running xt.substrate models and an xt.db SQLite cache. The coordinator elects a page to host that worker because Chromium does not support spawning it inside a SharedWorker. Ports share reads, mutation ordering and invalidation; navigation remains specific to each tab. A writer lock and kernel epochs fence restarts. An interrupted write is never replayed automatically; an uncertain outcome blocks further writes in that domain until reload. If the browser loses the entire coordinator, existing tabs require reload before any further mutation because pending outcomes can no longer be established.

SQLite WASM 3.54.1 uses OPFS `opfs-sahpool`, with no cross-origin isolation headers. Ordinary public/member reads survive visits. Member data opens only after the existing SDK validates sign-in and is erased on sign-out, authentication rejection or account deletion. Administrative responses, credentials and mutation payloads stay out of persistent storage. Saved results start stale and revalidate online; cached reads can continue during a network outage. Writes require the server.

Large depth files and saved regions stay in IndexedDB. The device-storage panel reports both stores and applies a combined recent-cache budget, preserving pinned regions. Persistence is requested explicitly and remains subject to browser support and available storage. Without SharedWorker or OPFS, SQLite uses an in-memory dedicated/shared worker; a startup failure falls back to the existing memory runtime. Set `cacheBackend` to `memory` in configuration (or build with `NEXT_CACHE_BACKEND=memory`) to roll back the swap.

The table declarations retain the StatsDB-style domain layout. Current SQL is generated exclusively from `finfolkdb.*`; SQL outputs are disposable. SQL and JSON publication are separate manager targets. Historical SQL snapshots are retired; existing API paths still using the historical schema require native migration. Deployed API configuration is independent of local schema generation.

## Setup and workflow

Use JDK 27, Leiningen 2.12+, Node 22+, Corepack, Git LFS and Python 3.12 (3.13 is also supported). The root Yarn 4.9.4 workspace contains the generated application tree under `js/finfolk-next`. Foundation is pinned by commit and version; no sibling StatsTrade checkout or private secrets repository is required.

```sh
git clone --recurse-submodules https://github.com/hoebat/finfolk-next.git
cd finfolk-next
make bootstrap
make check-generated
make test
make test-db
corepack yarn playwright install chromium firefox webkit
make test-browser
make build
make dev
```

`make bootstrap` installs Foundation from its pinned source, installs the immutable Yarn dependencies, creates the Python environment and emits the packages. `make generate` regenerates all SQL, contracts, runtime modules and browser bundles. `make check-generated` regenerates in a temporary directory and compares every generated artifact. Generated files are committed for review; edit their Clojure source instead.

`make dev` serves on port 8000. It watches Clojure sources and regenerates their modules; reload the browser after generation. DOM/CSS edits are served directly, while atlas inputs come from the built site. Account access uses the separate Next API/Auth service; local origins must be trusted by that Auth service. Public browsing and fixture tests do not require credentials.

## Data and verification

Public survey sources are stored in Git LFS. The independent [ocean dataset catalog](datasets/ocean/README.md) and [cross-computer handoff](docs/OCEAN_DATA_HANDOFF.md) cover native bathymetry archives and paused download recovery. The frozen national directory and coastline inputs are under `resources/atlas`; a fresh clone can reproduce the public site without a developer's cache. Existing publisher attribution, metadata and survey limitations are retained. To refresh upstream sources deliberately, use the acquisition scripts; normal builds do not refresh them automatically.

Format Clojure with `lein zprint fix src/finfolkdb test/finfolkdb` (replace `fix` with `check` for CI). Zprint is a development dependency; `.zprintrc` uses a 100-column community style and reflows existing line breaks. Its form mappings are derived from the pinned Foundation clj-kondo `:lint-as` and analyzer-hook classifications, including PostgreSQL definitions, XTalk definitions, scripts and facts. The formatter skips hidden/editor files and symbolic links. Run `lein run -m tooling.format-test` to verify the formatter. After updating Foundation, refresh the mappings with `lein zprint sync-kondo ref/foundation`; this updates local configuration and does not modify the dependency.

`make test` first builds and verifies app.manage’s generated SQL target, then runs Clojure contract/release checks, Python atlas tests, and the generated-runtime, SQL/API and desktop/mobile UI tests. Docker and Supabase CLI 2.122.0 are required for its disposable native PostgreSQL installation check; the local stack starts automatically. Tests cover cache keys, concurrency, invalidation, committed-write refresh failures, authentication changes, navigation/history, public forwarding, member actions and admin restrictions. External Meta messaging remains governed by its existing feature switches.

`make test-db-common` runs every Clojure common namespace in a disposable database on the dedicated local Supabase stack (PostgreSQL 17). Install Supabase CLI 2.122.0 and start Docker first; the runner starts or reuses the stack automatically. `FINFOLK_TEST_POSTGRES_URL` remains an explicit override for a local test server. Select one namespace with `make test-db-common DB_TEST_NAMESPACE=finfolkdb.common.fn-system-util-test`. No hosted account, cloud credentials, or network quota is needed.

For editor/REPL testing, run `make test-db-local-up` first, then start `lein repl` and evaluate the test namespace (or run `lein test :only finfolkdb.common.fn-system-util-test`). The local JDBC runtime defaults to `127.0.0.1:55432`, database `finfolk_test_repl`, user `postgres`, password `postgres`. Override it with `FINFOLK_TEST_DATABASE_URL=postgresql://user:password@127.0.0.1:5432/finfolk_test_custom` before starting the REPL. Only local hosts and `finfolk_test_*` databases are accepted; URL query parameters are rejected. Each common namespace uses `l/script-`, typed PostgreSQL calls and `fact:global` hooks that lock the test database and rebuild its application schemas. `make test-db-local-status` shows the local API and Studio URLs. `make test-db-local-down` stops only this stack and retains its volumes; each test namespace still rebuilds its application schemas. Restart existing REPLs after switching runtimes.

`make scaffold-db-common` uses `code.manage` to add linked write/read facts and preserve authored application scenarios. Common tests exercise directory publication/privacy, event rollback and RSVP changes, owner-only logbooks, post consent/blocking, trip upload/publication protocols, provider messaging delivery, reward and request state, environment lease consistency, and foreign-key failures without partial writes. Catalog assertions remain in the independent local `--common-contracts` suite.

The common suites follow the `statsdb` testing pattern: each namespace declares its JDBC `l/script-` dependencies and owns explicit `l/rt:restart`, `l/rt:teardown`, `l/rt:setup` and `l/rt:stop` hooks. `local/prepare!` and `local/cleanup!` only manage the isolated database schemas and lock. Require the domain modules and fixture operations used by a suite rather than the whole application scaffold. Social suites construct explicit provider workflows, inspect persisted rows, test rejected writes and remove their fixtures with `try`/`finally`. Run a single namespace directly with `lein test :only finfolkdb.common.type-social-account-test` after starting the local stack; the Make target additionally creates and removes a disposable suite database.

`make test-db` uses the local Supabase project `finfolk-tests`, configured in `supabase/config.toml`. Each suite creates an empty `finfolk_test_*` database from `template0` and drops it on success or failure. The stack stays running for subsequent tests and REPL sessions. Supabase's main `postgres` database and managed Auth schemas are not reset or used as test fixtures. Native suites install the generated schema. Archived compatibility suites use a synthetic `legacy_auth` fixture; they do not access the production identity service.

The API, database, Studio and test-mail ports are 55431, 55432, 55433 and 55434 respectively. Clojure SQL generation remains authoritative: local Supabase migration replay and automatic seeds are disabled, and the suites install their own generated schema or historical migration fixtures into their isolated databases. `FINFOLK_TEST_POSTGRES_URL` overrides must use a local PostgreSQL URL without query parameters. CI installs the same CLI version and runs the same test command. No Supabase account, hosted project link, access token or production credentials are needed. First startup downloads the local service images. Stop the previous plain PostgreSQL test container if it still occupies port 55432.

`make test-db-runtime` checks local-only URL validation, stack reuse/startup and database cleanup without Docker. CLI state is kept in `.cache/supabase-cli`; the test tools only invoke local `start`, `status` and `stop` commands.

`make generate-db-sql` publishes the current native `entity-schema.sql` and supporting SQL files. `make generate-db-json` publishes metadata separately. See [native schema publication](docs/FRESH_SCHEMA.md). The old snapshot publication and old fresh-vs-migrated schema comparison are retired.

Native database coverage is defined by the Clojure facts under `test/finfolkdb`
and the native integration/cutover suites. Historical migration and old API tests
still describe the retired schema; they must migrate before they can validate the
current native publication. SQL generation is not constrained by historical output
hashes. The deployed API's readiness marker remains its own release configuration.

`make test-browser` runs Chromium, Firefox and WebKit against real SQLite/WASM and IndexedDB, including browser restarts, multiple tabs, writer handoff, offline reads, account erasure and saved-map preservation. CI installs the browsers and OS dependencies and publishes test reports/traces. These tests use synthetic identities; they do not sign in to the deployed site.

## Production deployment

The native Next frontend is now published on Netlify; see the current commands
and domain ownership in [the cutover runbook](docs/MAIN_SITE_CUTOVER.md).
The Worker frontend deployment notes below are historical. The API remains on
Cloudflare and is released separately.

The product uses the Slow melt identity with four device-local appearance choices: Yellow (default), Cobalt, Muted light and Muted dark. Account settings and the signed-out account screen offer the same choices. Existing Coastal/Sand preferences migrate to Muted light; Night swim migrates to Muted dark. Appearance initializes before styles load, and branding assets are fingerprinted and included in the offline shell. Map and depth rendering retain their existing colours.

Discover keeps the main search/activity and state controls visible. Region, waterbody, access and recommendation refinements live in closed Advanced filters panels with active counts and independent clearing. Existing filter URLs and history restoration are preserved.

The frontend owns its SVG masters and muted/hyper octopus artwork; it does not require the local Atelier server. Run `make dev` for the production application preview (`WEB_PORT` selects another local port).

The public homepage is authored in `landing.html`, with seven animated feature walkthroughs, three staggered illustration accents, a shared theme picker and opt-in forecasts. The production build publishes it at `/` and keeps the application at `/app`. Existing root query links (including account callbacks and location links) still open the application; campaign tracking parameters alone keep visitors on the landing page. Both entry points have separate offline shells. Preview the landing source at `/landing.html` with `make dev`.

The freediving directory opens at `/profiles?screen=directory`, with public business/group listings and claim entry points. Verified members manage listings through `screen=my-listings`; existing administrators use `screen=superadmin` to discover candidates, publish listings, track outreach and verify ownership. See [directory operations](docs/DIRECTORY.md) for migration and Brave Search configuration.

Member screens live at `/profiles?screen=people`, `screen=me`, `screen=member&id=…` and `screen=edit`. The atlas and profile pages share Discover, Map, People, Logbook and My profile navigation, with Check in and Settings under More. The landing community preview opens People. Profiles use the existing authenticated account API, including server-side location/availability/experience filtering, buddy requests, closed-profile restrictions and field-level statistics sharing. Visitors see a sign-in entry point rather than sample members.
Member screens live at `/profiles?screen=people`, `screen=me`, `screen=member&id=…` and `screen=edit`. The atlas and profile pages share Discover, Map, People, Logbook and Profile navigation, with Check in and Settings under More. The landing community walkthrough demonstrates People; its call to action opens the real member screen. Profiles use the existing authenticated account API, including shuffled discovery of Open profiles, optional server-side location/availability/experience filtering, buddy requests, closed-profile restrictions and field-level statistics sharing. Visitors see a sign-in entry point rather than sample members.

Portrait uploads are decoded and reduced to a WebP (or JPEG on Safari) thumbnail of at most 48 KiB, then validated by the API and saved in the existing member profile JSON. Featured items retain their selected order; the API filters selections to the member's own published logs and approved, consented posts. Removing or unpublishing content invalidates cached profile reads. Legacy profile edits preserve these optional fields. This release requires the API and frontend Workers together and does not change the database schema or SQL release hash.

```sh
make deploy
```

The frontend is hosted on Netlify at `finfolk.com.au`; the Cloudflare API at `api.finfolk.com.au` uses the native Supabase database and Auth service. Follow [frontend publishing](docs/FRONTEND_PUBLISH.md) and [production acceptance](docs/SUPABASE_ACCEPTANCE.md) for the current release workflow.

After deployment check [production health](https://finfolk.com.au/_next/health), public routes, account/profile/check-in behavior and sign-out. Rollback uses the preceding Next Worker versions. The legacy repository must not publish to the production hostname. See [the cutover runbook](docs/MAIN_SITE_CUTOVER.md).

No SQL installation is performed by generation or ordinary site deployment. Use the explicit native rebuild/cutover workflow for schema installation. The old `make db-release` snapshot-replay entrypoint is retired and refuses execution. Copy `.env.example` only as a starting point; never commit real credentials. Provider secrets remain in Cloudflare bindings/secrets.

`resources/migration/source.json` records the original source revision and imported working-copy hashes. The empty GitHub repository received a new initial history; the original working tree, its changes and its older worktrees were preserved.

Dive sites use the existing location IDs across check-ins, sessions, posts and trips. Waterbody type, site features, access method, entry/departure coordinates and sourced depth evidence are separate fields. Published records live in PostgreSQL; substrate and SQLite provide public cached reads. Inland locations do not inherit coastal survey packages and boat-only sites have no automatic shore-to-contour distance.

Members use Account → Dive sites to submit locations or corrections. Verified administrators use Review → Dive site management to edit drafts, review submissions, import CSV/JSON and publish. Imports show errors, existing-ID updates and possible duplicates before publication. Revision conflicts require a new draft from the latest record. Archiving preserves historical records; use a published history entry as a new draft to restore or revise it. Sources describe recorded access requirements, not live permission or conditions.

For a catalog release, obtain dedicated Next and temporary rehearsal direct connection URLs into ignored `.cache/site-next-url` and `.cache/site-rehearsal-url` files. The rehearsal branch creation result belongs in `.cache/site-rehearsal-branch.json`. Build the complete static directory, then run `node scripts/sites_release.mjs rehearse` twice to verify migration/seed idempotency. After checks, `node scripts/sites_release.mjs seed` applies the immutable Next migrations and seeds only missing sites. Reviewed and archived records are preserved. Run the guarded database release command to publish the SQL readiness marker, and build with `SITE_SNAPSHOT_FILE=$PWD/.cache/site-published-snapshot.json make build` before deploying the Next API and site. `node scripts/sites_release.mjs snapshot` refreshes the public fallback without seeding. Credentials are never part of the generated site.

Tagged Instagram photos/Reels and TikTok videos appear in the owner’s private Logbook media inbox. Review their post day and matched location, add notes, and assign them to an existing session or create a private session atomically. Imports do not create check-ins, depth records or completed dive sessions. Unknown/ambiguous locations require confirmation. Day metadata uses the matched beach’s time zone, with UTC as the unknown-location fallback. Repeated collection and assignment retries do not duplicate posts or sessions. Published sessions expose explicitly attached original links; import notes remain private. Removing a session returns attached imports to the inbox.

Instagram imports require the existing collector and a verified media-owner connection (a username alone is insufficient). Collection/publication flags remain separate. TikTok uses per-member Login Kit + Display API consent for `user.info.basic,video.list`, encrypted server-side refresh tokens and bounded polling every 15 minutes. It requires an approved TikTok app, `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, the existing `MESSAGING_ENCRYPTION_KEY`, and `TIKTOK_IMPORT_ENABLED=true`; register `https://finfolk.com.au/v1/integrations/tiktok/oauth/callback`. Web OAuth uses a one-time expiring state and a Secure/HttpOnly browser nonce cookie. Without configuration the connection UI and callback explicitly report unavailable. Disconnecting removes TikTok imports while retaining sessions. No provider credentials or copied videos are sent to the browser or service-worker cache.

People opens with a varied mix of Open profiles instead of a search form. “Refine the mix” contains optional filters; cards link into shared locations. Seeded pagination keeps a browsing round stable and avoids duplicates, while “Mix it up again” starts another round. Closed/deleted profiles, blocks in either direction and declined requests stay excluded. Discover opens on Suggested, with a changing set of documented locations and a refresh action; direct lookup remains in All dive sites.

Instagram linking and the code connection dialog live in Profile (`/profiles?screen=me#instagram-claim`). Logbook and legacy Account entry points link there. Instagram tools and administration remain available in Account, without a second connection form.

The illustrated Alex/Maya/Kai diver portraits are the standard avatar set for People, Profile and the landing walkthroughs. An account’s default is stable across screens and display-name edits. Uploaded portraits take precedence; “Use standard illustration” restores the default, and unavailable uploads fall back to it. Session-sharing walkthroughs use themed freediver silhouettes instead of sample photographs. Avatar art and silhouette masks are versioned and included in the offline shell.

The opt-in native messaging gateway supports signed Instagram/TikTok ingress and
authenticated app chat through the Clojure-authored entity schema. Its Worker
feature flag remains disabled. See [Messaging rollout](docs/MESSAGING_ROLLOUT.md)
for separate database provisioning, server-only grants, OAuth, queue/cron setup,
provider acceptance and rollback. Local tests use injected provider HTTP; live
provider activation is not verified.

Foundation editing support for Emacs lives in `dev/emacs/`. Add that directory
to `load-path` and `(require 'foundation-format)` in your init file. It styles
`fact`, `l/script`, and PostgreSQL `t:*`/`g:*` macros without needing a REPL.
`M-x foundation-format-buffer` reflows the buffer with the project's zprint
configuration; CIDER's format-buffer and format-region keys use these commands
in configured projects. Assertion triples stay together, including inside `let`
forms. The generated `foundation-form-data.el` shares the Foundation form
classifications with `.zprintrc`; `sync-kondo` refreshes both.

Script options put each `:require` entry on its own line and expand the
`:static` map across lines. `when` bodies always start on the next line.

Table formatting places the name below its metadata, aligns field/spec columns
and entity options, keeps scalar field attributes together, and puts nested
`:ref`, `:enum`, and `:sql` attributes on continuation lines. This changes layout
only; field declarations, defaults, constraints and entry order are preserved.

`defn.pg` and `defrun.pg` place a metadata-bearing function name on the next
line with two-space indentation.

Native mock social testing: `make test-db-mock` exercises signed HTTP webhooks, external identities, replies and account linking on local Supabase. `make mock-social` starts the interactive CLI harness. See [mock provider workflow](docs/MOCK_SOCIAL.md). Mock endpoints are local-only and are not registered in production Workers.

`make test-db-note-revisions` verifies the native SiteNote entry defaults, column processors and transactional Rev/RevLog lifecycle on disposable local Supabase PostgreSQL.

The active [PostgreSQL social and messaging plan](docs/SOCIAL_MESSAGING_DSL_PLAN.md)
places command and workflow logic in the PostgreSQL DSL. Run `make test-db-social`
for its Clojure Supabase scaffold tests under `test/finfolkdb/fn/social`.

`make test-app-integration` runs the shared `app.manage` PostgreSQL + JavaScript
runtime pilot with the actual account backbone and native logbook functions.
Assertions live in Clojure facts; each run owns a fresh local Supabase database.
See [application integration](docs/APP_MANAGE_INTEGRATION.md).

## Environment console

Run `make environments` to open the independent environment control plane. Its
URL is printed at startup; the workbench also links to **Environments**. The tree
is platform → environment → services. Start/Stop controls
operate on declared local resources; remote descriptors are health-only.
Configuration is `config/environments.json`. The console requires Node, but no
application dependencies, running database, container engine or app build to open.
Resources survive console closure; restarting reconciles owned process identity.
Existing healthy external prerequisites are observed without adopting ownership.
Local stack startup is explicit, may prepare missing demo data, and never resets
persistent volumes. Dupasupa’s owned demo database remains disposable. Failed
startup retains successful resources; Start retries missing/unhealthy components.

Environment checkout, version and revision are displayed as environment metadata;
they do not create a separate tree level. The initial environment is `default`.
