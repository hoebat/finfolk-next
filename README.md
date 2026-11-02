# FinFolk Next

The Clojure-authored database and substrate backbone for [finfolk.com.au](https://finfolk.com.au). This is the source of truth for FinFolk production development. The `hoebat/finfolk-app` implementation remains a frozen legacy copy; it is not a build dependency.

## Source and output

| Authored source | Generated output |
| --- | --- |
| `src/finfolkdb` | `resources/finfolkdb/pilot.sql` and browser RPC contracts |
| `src-app/finfolk_web/groups` | The active browser operation registry, including HTTP bindings and invalidation domains |
| `src-app/finfolk_web/lib` | `js/finfolk-next/packages/edge`: actor lifecycle, substrate models, xt.db cache, application state and public HTTP adapter |
| Pinned `ref/foundation/src-lang` | Required `@xtalk/*` workspace packages under `js/finfolk-next/packages/libs` |
| Existing JavaScript in `js/finfolk-next/site/web-main/src` | The DOM/map site and versioned browser bundles |

The backbone implementations are written as genuine `l/script :js` Clojure declarations. `next-backbone.js`, `app-backbone.js` and the worker scripts are esbuild bundles of that emitted code. The DOM/map UI remains authored JavaScript.

Next uses a SharedWorker coordinator and one dedicated worker running xt.substrate models and an xt.db SQLite cache. The coordinator elects a page to host that worker because Chromium does not support spawning it inside a SharedWorker. Ports share reads, mutation ordering and invalidation; navigation remains specific to each tab. A writer lock and kernel epochs fence restarts. An interrupted write is never replayed automatically; an uncertain outcome blocks further writes in that domain until reload. If the browser loses the entire coordinator, existing tabs require reload before any further mutation because pending outcomes can no longer be established.

SQLite WASM 3.54.1 uses OPFS `opfs-sahpool`, with no cross-origin isolation headers. Ordinary public/member reads survive visits. Member data opens only after the existing SDK validates sign-in and is erased on sign-out, authentication rejection or account deletion. Administrative responses, credentials and mutation payloads stay out of persistent storage. Saved results start stale and revalidate online; cached reads can continue during a network outage. Writes require the server.

Large depth files and saved regions stay in IndexedDB. The device-storage panel reports both stores and applies a combined recent-cache budget, preserving pinned regions. Persistence is requested explicitly and remains subject to browser support and available storage. Without SharedWorker or OPFS, SQLite uses an in-memory dedicated/shared worker; a startup failure falls back to the existing memory runtime. Set `cacheBackend` to `memory` in configuration (or build with `NEXT_CACHE_BACKEND=memory`) to roll back the swap.

The table declarations retain the StatsDB-style domain layout. The deployed SQL slice contains profile/check-in and identity functions. Table default/constraint metadata remains an inventory, not a replacement for the full migration history. All existing migrations and the SQL release hash are preserved. The SQL header retains its historical generator label to preserve those exact bytes.

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

Public survey sources are stored in Git LFS. The frozen national directory and coastline inputs are under `resources/atlas`; a fresh clone can reproduce the public site without a developer's cache. Existing publisher attribution, metadata and survey limitations are retained. To refresh upstream sources deliberately, use the acquisition scripts; normal builds do not refresh them automatically.

`make test` runs Clojure contract/release checks, Python atlas tests, and the existing generated-runtime, SQL/API and desktop/mobile UI tests. Tests cover cache keys, concurrency, invalidation, committed-write refresh failures, authentication changes, navigation/history, public forwarding, member actions and admin restrictions. External Meta messaging remains governed by its existing feature switches.

`make test-db` requires a running Docker engine and owns a disposable PostgreSQL 18 container/database for every run. It never uses cloud credentials. CI uses the same pinned image. `FINFOLK_TEST_POSTGRES_URL` may point to a local test server; cloud hosts are rejected and each suite creates/removes a distinct `finfolk_test_*` database. The test fixture reproduces Next's provisioned API schema grant and a minimal synthetic Neon Auth table. Provider calls remain simulated.

Database coverage includes domain-organized Clojure facts, all 47 table declarations, 426 constraints, identity/default metadata, 31 explicit indexes, all ten generated SQL functions, real role permissions, pooled actor isolation, concurrent operations, ownership and migration/release guards. The separate deployment-readiness marker is tested through the actual Next API Worker. The Instagram connection/queue suite also runs with independent PostgreSQL pool connections to exercise competing redemptions and transaction locks. A coverage manifest is written to `.cache/test-results/finfolkdb-coverage.json`; new tables and constraints require matching fixtures and assertions. Applied migrations and the published SQL hash remain immutable.

`make test-browser` runs Chromium, Firefox and WebKit against real SQLite/WASM and IndexedDB, including browser restarts, multiple tabs, writer handoff, offline reads, account erasure and saved-map preservation. CI installs the browsers and OS dependencies and publishes test reports/traces. These tests use synthetic identities; they do not sign in to the deployed site.

## Production deployment

The product uses the Slow melt identity with four device-local appearance choices: Yellow (default), Cobalt, Muted light and Muted dark. Account settings and the signed-out account screen offer the same choices. Existing Coastal/Sand preferences migrate to Muted light; Night swim migrates to Muted dark. Appearance initializes before styles load, and branding assets are fingerprinted and included in the offline shell. Map and depth rendering retain their existing colours.

Discover keeps the main search/activity and state controls visible. Region, waterbody, access and recommendation refinements live in closed Advanced filters panels with active counts and independent clearing. Existing filter URLs and history restoration are preserved.

The frontend owns its SVG masters and muted/hyper octopus artwork; it does not require the local Atelier server. Run `make dev` for the production application preview (`WEB_PORT` selects another local port).

The public homepage is authored in `landing.html`, with illustrated Australian coastal scenes, live app previews and opt-in forecasts. The production build publishes it at `/` and keeps the application at `/app`. Existing root query links (including account callbacks and location links) still open the application; campaign tracking parameters alone keep visitors on the landing page. Both entry points have separate offline shells. Preview the landing source at `/landing.html` with `make dev`.

Member screens live at `/profiles?screen=people`, `screen=me`, `screen=member&id=…` and `screen=edit`. The atlas and profile pages share Discover, Map, People, Logbook and My profile navigation, with Check in and Settings under More. The landing community preview opens People. Profiles use the existing authenticated account API, including server-side location/availability/experience filtering, buddy requests, closed-profile restrictions and field-level statistics sharing. Visitors see a sign-in entry point rather than sample members.

Portrait uploads are decoded and reduced to a WebP (or JPEG on Safari) thumbnail of at most 48 KiB, then validated by the API and saved in the existing member profile JSON. Featured items retain their selected order; the API filters selections to the member's own published logs and approved, consented posts. Removing or unpublishing content invalidates cached profile reads. Legacy profile edits preserve these optional fields. This release requires the API and frontend Workers together and does not change the database schema or SQL release hash.

```sh
make deploy
```

This builds and deploys `finfolk-next-api` and `finfolk-next-site` on `api.finfolk.com.au` and `finfolk.com.au`, retaining the existing isolated Neon branch/database/Auth service and Hyperdrive binding. The current machine's Wrangler login can be reused. GitHub Actions runs generation checks, tests and builds; it does not deploy automatically or need Cloudflare credentials.

After deployment check [production health](https://finfolk.com.au/_next/health), public routes, account/profile/check-in behavior and sign-out. Rollback uses the preceding Next Worker versions. The legacy repository must not publish to the production hostname. See [the cutover runbook](docs/MAIN_SITE_CUTOVER.md).

No SQL installation is performed by generation or ordinary site deployment. For an intentional database release, create a new immutable migration, update release hashes together, and use `make db-release` with ignored `.env.next.local`. That command refuses another database or endpoint. Copy `.env.example` only as a starting point; never commit real credentials. Provider secrets remain in Cloudflare bindings/secrets.

`resources/migration/source.json` records the original source revision and imported working-copy hashes. The empty GitHub repository received a new initial history; the original working tree, its changes and its older worktrees were preserved.

Dive sites use the existing location IDs across check-ins, sessions, posts and trips. Waterbody type, site features, access method, entry/departure coordinates and sourced depth evidence are separate fields. Published records live in PostgreSQL; substrate and SQLite provide public cached reads. Inland locations do not inherit coastal survey packages and boat-only sites have no automatic shore-to-contour distance.

Members use Account → Dive sites to submit locations or corrections. Verified administrators use Review → Dive site management to edit drafts, review submissions, import CSV/JSON and publish. Imports show errors, existing-ID updates and possible duplicates before publication. Revision conflicts require a new draft from the latest record. Archiving preserves historical records; use a published history entry as a new draft to restore or revise it. Sources describe recorded access requirements, not live permission or conditions.

For a catalog release, obtain dedicated Next and temporary rehearsal direct connection URLs into ignored `.cache/site-next-url` and `.cache/site-rehearsal-url` files. The rehearsal branch creation result belongs in `.cache/site-neon-branch.json`. Build the complete static directory, then run `node scripts/sites_release.mjs rehearse` twice to verify migration/seed idempotency. After checks, `node scripts/sites_release.mjs seed` applies the immutable Next migrations and seeds only missing sites. Reviewed and archived records are preserved. Run the guarded database release command to publish the SQL readiness marker, and build with `SITE_SNAPSHOT_FILE=$PWD/.cache/site-published-snapshot.json make build` before deploying the Next API and site. `node scripts/sites_release.mjs snapshot` refreshes the public fallback without seeding. Credentials are never part of the generated site.
