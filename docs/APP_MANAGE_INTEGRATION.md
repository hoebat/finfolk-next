# FinFolk management and page verification

Run `make manage` and open <http://127.0.0.1:8135>. The manager reads the project declaration in `src/finfolkbuild/project/management.clj`; it loads the shared `app.manage` framework from the local Maven artifact `xyz.zcaudate/app.manage` at the version pinned in `project.version`. The Pipeline and Slices views show generation targets and build evidence. Pages & models lists the application registry and provides the verification workbench.

## Native account slice

The **Native account & privacy** slice covers database rules, portable RPC
contracts, Supabase Auth/API interop, the generated Substrate client, generated
TypeScript declarations, and a real Next.js browser journey. Build the account
slice's UI stage to run these checks and record evidence against the current
source fingerprint. Source edits make that evidence stale.

The **Native account · real Auth, DB and browser** test profile also exposes the
account facts in the source/tests workbench. It owns its test accounts, disposable
database, API/Next servers and Chromium process. It uses the existing local
Supabase stack; it does not require credentials entered into saved test cases.
The CLI equivalent is `make test-native-account`.

A passing account slice does not verify every account tab or every migration
group. The saved `account-native` scenario runs account, account-identity and
account-privacy models/actions against a fresh native schema and real Auth users.
`community-checkins` covers visits and `community-discovery` covers people and
connection requests. A native case can use `select: ["people", 0, "displayName"]`
to assert a nested value; the full output remains in its execution evidence.
`logbook-native` uses `runtime: "native"` for real Auth and private session CRUD;
the older logbook scenarios retain the SQL-only demo fixture. Run these from
Pages & models to inspect model transitions, transport events, cache
snapshots and expected results. Use Alice/Bob actor aliases; credentials are
created and cleaned up by the fixture. Mixed account/logbook identity scenarios
remain blocked. Messaging settings and other functional groups retain their own
pending capabilities.

## Start with the logbook slice

The existing local Supabase Postgres stack must be running (`make test-db-local-up`). Then:

```sh
make build-page-verifier
make demo-logbook
# In another terminal:
make manage
```

The demo is at <http://127.0.0.1:8132>. It owns a disposable database on the existing local stack. Closing the demo drops that database. The fixture actors Alice and Bob are development identities; this verifies PostgreSQL domain functions through a local JDBC HTTP adapter, not Supabase Auth, PostgREST or production RLS.

## Verify in the UI

In **Pages & models**, load `logbook-ownership` and click **Run / verify**. It executes five ordered steps against the running demo: create an entry, read its model, load its page, read as Bob, and load as Bob. It checks persisted private visibility and sanitized photos, the owner's profile, a legitimate `null` foreign-owner read, and the page's privacy error.

The latest execution shows pass/fail per step. Expand a result to inspect expected values, actual result/error, transport calls, Substrate state transitions and model cache. **Full execution** includes the request and source fingerprint. Editing sources or saved cases marks previous evidence **Stale**. Source or generated-module edits also block new live runs until `make build-page-verifier` rebuilds the runtime. Saving cases alone does not require a rebuild.

Load `logbook-branches` for default/profile loader branches and an invalid-site rejection. Load `model-contracts` for binding/validation checks. **Try model** under a definition prepares an individual request. Inputs, payload, actor and assertions are editable JSON. **Check all definitions** performs structural checks across every registered page; it does not claim all pages have live adapters.

A request without an assertion is reported **Executed**, not **Passed**. Use exactly one assertion:

```json
{
  "page": "logbook",
  "kind": "resolve",
  "member": "session",
  "actor": "alice",
  "inputs": {},
  "payload": {"id": "example-id"},
  "expect": {"contains": {"name": "session", "values": {"id": "example-id"}}}
}
```

Kinds are `resolve`, `model`, `action`, and `page`. `resolve` runs the emitted binding/validation code without database access. Live adapters currently support `logbook` session/profile/ensure reads and its loader, plus `logbook-editor` creates. Other live operations, including editing existing sessions, are **Blocked**. Native `owner-id`/`beach-id` fields are adapted to the SDK's `ownerId`/`beachId`; reads still go through the generated actor-scoped backbone.

`equals` compares the exact result (including `null`); `contains` compares a nested map subset; `error` compares error fields. An error cannot satisfy a positive assertion. For ordered scenarios use `steps`, give each step a unique ID, and refer to earlier outputs using `{"$ref":["create","result","id"]}`. Model SDK arguments belong in `payload` unless the definition explicitly declares an input binding. Editor creates use `payload.values`.

## Save and replay

Enter a case ID such as `my-logbook-check` and click **Save case**. Saved checks require assertions for every step. They are stored in versioned EDN at `.app-manage/page-tests.edn`; stale revisions are rejected. Commit this file as the source of repeatable cases. No arbitrary JavaScript assertions are evaluated.

**Run saved checks** creates its own fresh disposable fixture and drops it afterward, independently of the interactive demo. The UI and CLI share the same runner:

```sh
make test-page-models
# Equivalent after generation:
lein run -m app.manage.verify finfolkbuild.project.management/PROJECT run
```

A failing or blocked case makes the suite fail and the CLI exit nonzero. The `:page-model-verification` app.manage check runs the saved cases and all-page contract checks via `code.test`. Latest evidence is disposable `.cache/app.manage/page-verification.edn`.

## Extend another slice or project

Declare `:pages`, `:page-verifier`, `:verification-targets`, and optionally `:page-test-fixture` on the project map. A verifier receives the declarative request and returns `{:result ...}`, `{:error ...}`, `{:blocked ...}`, or ordered `{:steps [...]}` with matching step IDs. Trace/state/cache fields are optional diagnostics. The fixture receives a zero-argument function and must clean up its resources even on failure.

FinFolk's worker is authored in `src-app/finfolk_web/demo/page_verifier.clj`; `:page-verifier` emits it alongside the actual page/model graph and Substrate backbone. The provider in `src/finfolkbuild/project/page_verification.clj` invokes that emitted worker. Extend the adapter with native operations and saved expectations before claiming live coverage for another slice. SQL remains generated exclusively from `finfolkdb.*`; fixture helpers live in `finfolkdb.schema.logbook-demo`.

The shared HTTP actions are `verify-definitions`, `verify-page`, `save-page-case`, and `run-page-cases`, through the manager's existing token-protected action queue. AI agents can invoke the CLI or those actions and read the same machine-readable evidence shown in the UI.


## Local Maven installation

FinFolk declares `[xyz.zcaudate/app.manage ~FOUNDATION_VERSION]` in `project.clj`.
The current locally installed coordinate is `xyz.zcaudate/app.manage:4.1.8`.
The framework Clojure namespaces and management stylesheet load from its JAR in
`~/.m2/repository`; `ref/foundation/src` and `ref/foundation/resources` are no longer
on FinFolk's source/resource paths. `ref/foundation/src-lang` remains for the DSL
sources used by the application.

To rebuild the package after changing the pinned Foundation framework sources,
run from `ref/foundation`:

```sh
lein run -m clojure.main -e "(require 'code.tool.maven) (prn (code.tool.maven/install 'xyz.zcaudate/app.manage {:tag :all})) (System/exit 0)"
```

This installs only that package into local Maven; it does not publish remotely.
Restart the manager after reinstalling, then regenerate the page verifier before
running saved checks. Project dependency/version changes invalidate build evidence.

To confirm the source being loaded, run from the FinFolk root:

```sh
lein run -m clojure.main -e "(require 'clojure.java.io) (println (clojure.java.io/resource \"app/manage.clj\")) (System/exit 0)"
```

The printed URL should start with `jar:file:` and point into `.m2/repository`.

## Source and test inspection

Open **Source & tests**, then **Scan / search** or **Needs attention**. Select a
functional unit to read its original source beside every linked `code.test` fact.
Expand **Runtime and calls** to inspect the original `l/script-` scaffold, runtime,
and resolved function calls. Search accepts a namespace or function substring.

The project declares `:unit-analysis {:sources [...] :tests [...]}` with owned
project paths. The reusable index uses `code.framework` source/fact analysis and
`code.manage.unit` missing/TODO checks. It never loads project namespaces or runs
source/test forms. `GET /api/units` returns the index; `?q=...&issues=true` filters
it, and `?unit=qualified.namespace/function` returns the source and full tests.

Attention flags include missing tests, TODOs, absent assertions, duplicate fact
IDs (which can silently replace registered tests), pointer-only and type-only
checks. DSL functions also flag absent `l/script-` scaffolds and linked tests
that do not directly invoke the unit. Indirect tests require manual review:
fixture/helper calls may exercise the function correctly, but their assertions
must be inspected. Diagnostics distinguish stale references in indexed namespaces
from references outside the configured roots and report files that cannot parse.

**Linked, not run** describes static evidence only. A scaffold and direct call
cannot establish that assertions check the intended behaviour, or that a test
passes. Inspect domain values and resulting state in the test, then run the
project's `code.test`/Supabase scaffold checks for execution evidence. A pointer
check alone is insufficient for application logic. Removing `:unit-analysis`
removes this optional workbench section.

## Optional IDE workspace frontend

`:workbench-ui :next` enables the shared DSL-authored React workspace. The
Clojure manager serves its static Next.js export and local Monaco editor assets;
Node is required to build the frontend, not to run the installed package.
The Application and Build sections embed the existing workbench views without
old navigation chrome, preserving their actions and verification controls.

From `ref/foundation`, rebuild the frontend with:

```sh
lein run -m app.manage.frontend /tmp/app-manage-next build
```

This generates the frontend from `app.manage.workspace`, installs locked npm
packages, builds a static export and publishes generated assets into the Maven
resource bundle. Reinstall `app.manage` and restart the manager afterward.
Do not edit generated JSX or static output. The `publish` action can publish
an already-built frontend directory.

Test profiles declare a label, namespace vector (or provider symbol), optional
fixture symbol accepting a zero-argument function, and timeout. The Testing
explorer runs a whole registered namespace in a child JVM through `code.test`;
assertion reports are stored under `.cache/app.manage/tests`. Browser requests
cannot supply commands, forms or unregistered namespaces. FinFolk's common and
social profiles retain its existing local database lock and namespace setup.

`/api/source` provides whole indexed source/test files. `/api/test-profiles`
discovers executable namespaces. `/api/session` supplies the current action token.
The existing action API accepts `run-test-namespaces` with a request containing
`profile` and `namespaces`. Structural findings remain independent of execution
results. Runtime and helper navigation open the original authored files.

Facts without `:refer` are included in the testing inventory. Calls to indexed
functions provide inferred navigation links; these do not silently become declared
coverage. A `missing-test-link` finding distinguishes an inferred candidate from a
function with no test evidence. Completed test reports are marked stale by the
state API when indexed source/tests change, independently of manual rescanning.

The workspace supports quick open (`Ctrl/Cmd+P`), a command palette
(`Ctrl/Cmd+Shift+P`), explorer/panel toggles (`Ctrl/Cmd+B/J`), editor tab
close/reopen (`Ctrl/Cmd+W`, `Ctrl/Cmd+Shift+T`), navigation history
(`Alt+Left/Right`) and next/previous review finding (`F8`/`Shift+F8`). Explorer
arrows move focus and expand/collapse folders. Monaco supplies find and go-to-line.
Theme, pinned tabs, expanded folders and pane sizes are stored per project.
On narrower windows, **Show tests / Show source** switches the visible editor.

Namespace stdout/stderr stream into **Output** while running. **Test results**
groups namespace → fact → assertion and exposes expected/checker and actual
values with clickable source locations. Problems include readable explanations
and file-analysis diagnostics. Individual fact execution and file editing are
outside this version.

## Classic workspace file and test inspection

FinFolk defaults to `:workbench-ui :legacy`. The classic dashboard is available at
`/` and `/legacy`. Source inventories in the target inspector and Sources/Outputs
views use bounded, filterable folder trees. Folder counts and basename rows replace
repeated full paths; hover a file for its path and byte size. Generated files in
the inspector start collapsed.

Opening a file uses a locally bundled, read-only Monaco viewer with highlighting,
line numbers and a **Go to line** control. Enter a line number and press Enter or
Go. The viewer remains open without resetting while run progress updates.

In **Source & tests**, click a path to inspect the whole file or **Run namespace**
to execute its registered database scaffold. **Run history** shows namespace/fact/
assertion groups with expected and actual values. Clicking an assertion opens its
test file at the reported line, including failed assertions.

## Development server controls

The classic **Servers** view and each linked **Preview** expose Start, Stop and
Restart for declared `:dev-servers`. These actions launch actual processes, show
PIDs, listening-port status, exit codes and bounded combined stdout/stderr. FinFolk
registers its Next.js server and the disposable native Auth/database preview.
Native routes, including the logbook, share a single `:native` server.

A declaration contains `:id`, `:label`, a loopback `:url` with an explicit port,
and a `:command` vector. Optional `:directory` is relative to the project root;
`:env` supplies string environment overrides and `:stop-timeout-ms` allows graceful
fixture cleanup. `:stop-argument` can select an owned entry process by an exact
command argument, so wrappers such as the native preview shut down their own
children without receiving duplicate signals. Link a preview using `:server` with the same id. Commands and
working directories come from project configuration, never browser input.

Processes belong to the workbench session. Restart replaces the owned process;
Stop signals its process tree and waits for cleanup before forcing stragglers.
Closing the workbench stops its owned servers. A port already used by another
terminal is labelled **external**: it remains available for previews, but the
workbench cannot stop or replace it. Stop it in that terminal first, then Start
it here to give the workbench ownership.

## Live rendered-page checks

Use **Slices → Live page health → Rendered routes → Build** with **Include checks** enabled to scan the running Next preview in Chromium. This catches page-load HTTP failures, console errors, JavaScript exceptions and handled error screens (including `/people` and `/account/settings`). The slice records failed/verified evidence independently of model verification; changes to its source inputs make earlier evidence stale. **Run history** contains the per-route output. See [PAGE_HEALTH.md](PAGE_HEALTH.md) for reports, server prerequisites and guest-session coverage limits.

## HTTP API for AI clients

The standard `app.manage.server` supports the project-level `:http-api` declaration.
FinFolk exposes a fixed `page-health` action, run polling, reports and screenshots.
See [WORKBENCH_HTTP_API.md](WORKBENCH_HTTP_API.md) for HTTP examples and the Node
client. Discover the live schema at `/api/v1/openapi.json`. The API shares the UI's
controller, queue and run history; no FinFolk-specific server is required.

## Shared Web Pipeline v1

FinFolk and Auspo share six stages and their execution contract: Database SQL,
Contracts, Application, Browser assets, App build, Verification. Stage cards are
identical; their inspector exposes actual project-specific steps and results.
The detailed target graph is retained below stage inspection. Run stage includes
its prerequisites; Run pipeline includes verification unless checks are disabled.
Failures block dependants, and disabled verification remains explicitly not run.

Use `lein run -m app.manage.pipeline finfolkbuild.project.management/PROJECT`
with an optional final stage id to run the same pipeline from a terminal.
Existing target-specific commands remain available. Generation and drift checks
never execute build commands, services or SQL installation. Worker packaging uses
a dry run and does not deploy. Pipeline results track source fingerprints and
artifact hashes to flag stale evidence. Development servers remain independently
controlled through Servers. Both apps pin the same immutable local app.manage
pipeline release, leaving the other Foundation dependencies at their existing versions.

## Mock-backed UI previews

`make manage-preview` now starts Next.js with a loopback mock service rather than
Supabase Auth/database provisioning. No login is needed. Public SSR and browser
reads use the same fixture service; the authored Clojure preview adapter retains
real Substrate models, subscriptions and invalidation. The default port remains
3010 (`PREVIEW_PORT` overrides it). Run the real Auth/database integration preview
separately with `make manage-preview-native`; it is no longer in the UI preview list.

The preview-only toolbar selects Alice, Bob, the page owner or administrator.
Manager links to review and Coop management select the administrator; My pages
selects the owner. Ordinary navigation retains the actor. Reset demo restores
sample data. Records persist under `.cache/mock-preview/state.json` across
refresh/server restarts; `FINFOLK_PREVIEW_STATE_DIR` selects an isolated test store.
No mock configuration is returned in production, and mock proxy routes are
registered only for an explicitly enabled development server.

Mock writes currently include profiles, sessions/publication, check-ins,
connections, event creation/RSVP, page creation/editing, site suggestions and
Coop reward creation/redemption/fulfilment/refunds. Unimplemented actions return
explicit mock-operation errors; provider integrations remain disabled. The route
sweep is `NEXTJS_TEST_URL=http://127.0.0.1:3010 node tests/test_mock_preview.mjs`.
It includes a profile-save/refresh/reset journey, so use an isolated preview store
when running it. Full provider, moderation and import simulation is still pending.

Validation: the static-route and representative detail-route sweep passes against
the isolated mock preview, including profile save/reload/reset. Direct mock-state
checks also cover closed-profile access, reciprocal connection acceptance and
private-session ownership. Generation parity, manager configuration loading and
both site/Next production builds pass. The full repository test command still
stops on the four ocean-data compression/checksum failures. Dynamic report and
advanced import/provider scenarios are not covered by this preview sweep.

## Preview groups

Each app owns its group labels, order and membership in its project map:

```clojure
:preview-groups [{:id :explore :label "Explore"}
                 {:id :community :label "Community"}]
:previews [{:id :map :label "Map" :group :explore
            :target :web-main :url "http://127.0.0.1:3010/map"}]
```

Groups follow declaration order. Unassigned previews appear under Other; empty
groups are hidden. Apps without group definitions keep flat preview navigation.
Group IDs must be unique and references must name a declared group. Selecting a
group restores its last selection during the manager session. Existing preview
hashes remain unchanged, so deep links, refresh and browser history select the
correct group automatically.

FinFolk declares Home, Explore, Community, Events, Practice, You and Administration.
Its route classifier assigns both named samples and discovered screens; future
unmatched routes appear under Other.

The shared grouping patch is installed locally as app.manage
`4.1.9-preview-groups.1`, preserving the installed `4.1.9-web-pipeline.8` dependency
graph and frontend assets. Reproduce the local package with
`python3 scripts/package_manage_preview_groups.py`, then restart `make manage`.
The script packages the authored Foundation server/UI/CSS; no remote publication
is performed. Other apps can adopt this package and declare their own groups.

### Starting the correct preview runtime

`corepack yarn workspace @finfolk/web-main dev --port 3010` starts the mock
service and Next together, just like `make manage-preview`. The launcher resolves
its project root independently of the caller's working directory. Use `dev:live`
only when deliberately testing a configured live backend; raw `next dev` does
not supply the mock API and can show server-rendered data failures. Check
`/api/account-config`: a mock preview returns `authProvider: "preview"`.

## Project panels and production feature flags

FinFolk uses `app.manage:4.1.9-environment-flags.1`. Reproduce this local package with
`python3 scripts/package_manage_project_panels.py --build-frontend`, then restart
`make manage`. This packages the authored Foundation extension and regenerates
the optional Next workspace; it does not publish to Maven remotely.

Projects may declare `:project-panels` with `:id`, `:label`, `:entry`, an explicit
`:assets` URL-to-project-file map, `:read`, and named `:actions`. Handlers are
functions or qualified symbols accepting `{:project project :input input}` and
returning JSON-compatible data. The workbench exposes panels in its sidebar and
under Application in the optional workspace. It serves declared assets beneath
`/project-panels/<id>/`; `GET api/state` and `POST api/actions/<name>` require the
local session token. Requests from another origin, undeclared files/actions and
paths outside the project are rejected. Polling preserves active panel edits.
Framework code contains no FinFolk flag behavior.

### Environment preview flags

Open [Environments](http://127.0.0.1:8135/#/environments), expand **Development**,
and use its **Feature flags** checkboxes. Start the Mock Next.js preview or native
preview from that environment's service controls. Linked open screens update
within about one second; disabled operations also close at the preview API.
Settings are independent per environment and survive stopping previews,
restarting them, and restarting the environment console. The environment console
stays available while the application is stopped. No production credential is
needed. Standalone preview launchers retain their existing Everyone defaults.

`config/environments.json` declares the feature definitions file at
`feature_flags.definitions_file`. Each local environment declares
`feature_flags.resources` (its preview resource IDs) and optional boolean
`feature_flags.defaults`. Inline `feature_flags.definitions` are also supported.
FinFolk reuses `resources/finfolkdb/feature-flags.json`; Development starts with all
six flags Off. Each flag-aware preview resource belongs to one environment.
Create separate preview resources and ports for additional environments.

The controller injects `APP_MANAGE_ENVIRONMENT` and
`APP_MANAGE_FEATURE_FLAGS_URL` when starting linked processes. The local preview
adapter accepts only a loopback controller URL. Values live in the ignored
`.cache/app.manage/environments/state.json`, alongside lifecycle state. Writes
require the console's local session token and expected revision; stale writes
return 409. A healthy external preview is observed without taking ownership;
stop its original launcher, then start it through Environments to link its flags.
Remote environment entries remain read-only.

Run `yarn test:environment-flags` for environment isolation, write protection,
native API enforcement, lifecycle persistence, and live Next.js screen updates
through the workbench in Chromium. The shared controls are included in the local
`4.1.9-environment-flags.1` package used by the other app.manage consumers; each
project supplies its own flag definitions and environment mappings.

### Production flag connection

The **Production flags** panel is declared by `finfolkbuild.project.feature-flags`.

For normal `make manage` startup, store the connection in the ignored, private
`config/feature-flags.local.json` file. It has `apiOrigin` and `managementToken`
fields and is read server-side on each panel request. Environment variables
still take precedence for automation. Configure it using an existing API token
file without printing the secret:

```sh
node scripts/configure_feature_flags.mjs --api-origin https://api.finfolk.com.au --token-file /private/path/to/flag-token
node scripts/configure_feature_flags.mjs --check
```

`--generate` creates a new credential in a mode-0600 local configuration file;
it must also be provisioned as `FINFOLK_FLAG_MANAGEMENT_TOKEN` on the selected API.
It does not deploy that API, install SQL, or establish a connection by itself.
Existing configuration is preserved unless `--replace` is specified. The check
reports connection status without exposing credentials. A 503 response means
backend/database readiness must be repaired; refreshing or replacing the token
cannot repair an unavailable backend. Never point a production-labeled panel at
a local database merely to clear a connection error.

Set `FINFOLK_FLAG_API_ORIGIN` on the manager process (defaults to
`https://api.finfolk.com.au`) and supply `FINFOLK_FLAG_MANAGEMENT_TOKEN` through its
local environment. Install the same secret on the API runtime. Use a randomly
generated credential of at least 32 characters dedicated to this API. It is
never sent to the panel browser or exposed by the public account configuration.
`FINFOLK_FLAG_OPERATOR` labels changes in the audit history; it defaults to
`app.manage`, identifying the shared credential rather than an individual user.

`GET /v1/admin/feature-flags` returns definitions, settings, environment and the
latest 100 changes. `POST` accepts `{id,mode,testers,revision}`. Modes are `off`,
`testers`, `everyone`; testers are up to 1,000 unique member UUIDs. Saving takes a
row lock, compares the revision and writes settings plus history atomically.
Stale saves return 409. The dedicated credential grants no other application
administration access. Neither ordinary members nor administrators can bypass
these gates. `GET /v1/features` returns only evaluated boolean flags and a revision,
using optional verified member identity for tester evaluation.

Initial flags are `shop`, `events`, `practice.progress`, `practice.breathing`,
`practice.watch-imports`, `practice.breath-check`, all Off. Sessions and the
logbook stay available. Practice flags expose existing placeholder cards; they
do not implement their future workflows. Feature gates supplement existing
permissions, provider readiness and infrastructure switches. They cover public
and private REST paths, native event dispatch, navigation, direct Next routes
and event sections embedded in the map/directory. Disabled API operations return
403 `feature_disabled`. Accepted delivery work and provider completion callbacks
retain their existing behavior. Production changes take effect on subsequent
API requests; online screens refresh within 30 seconds or on focus/auth change.
Gated pages unmount when access is revoked. Flag decisions are never persisted;
missing data, request failures and offline status close the gates.

### Installation and rollout

1. Run `make generate` and review the separate SQL and JSON outputs. The additive
   `resources/finfolkdb/feature-flags.sql` creates only the flag schema/settings/history;
   rerunning preserves existing values. Install it through the existing database
   release workflow before rolling out the application gates. Do not run a full
   schema rebuild to install flags. It grants access to existing trusted
   `finfolk_api`, `finfolk_next_api` and `finfolk_account` roles, never browser roles.
2. Provision the dedicated API secret and local manager environment, deploy the API
   and frontend through their existing release workflows, and open Production flags.
   Until schema/configuration is ready, gated features remain closed.
3. Verify all six production settings are Off. Enable Testers with selected member
   IDs to verify a feature, then switch it to Everyone when ready. Off provides
   the immediate backend rollback without redeployment.

Local native previews explicitly set `FINFOLK_FEATURE_ENVIRONMENT=development`
and `FINFOLK_FEATURE_FLAGS_DEFAULT=everyone`; both are required for the local
fallback. Mock previews return an explicit Everyone response from their mock API.
Production defaults to closed gates and does not use the local fallback.

Verification: `yarn test:feature-flags` exercises a disposable local PostgreSQL
fixture, credential and route enforcement, concurrent updates, history, and both
workbench interfaces in Chromium. `node tests/test_nextjs_feature_flags.mjs`
checks Sessions-only Practice, independent cards, navigation, direct URLs and
live revocation using the explicit local mock preview. No production flags or
production data are changed by these checks.

## Durable history prerelease

FinFolk pins `xyz.zcaudate/app.manage` `4.1.9-history.1`.
`make manage` installs this local prerelease from the pinned baseline package
and the authored sources in `ref/foundation` before starting the server.
The baseline `4.1.9-environment-flags.1` artifact must exist in the local Maven
repository. This is a local packaging path, not a published Maven release.

History is stored in `.app-manage/state/history.sqlite`, outside `.cache` and
ignored by Git. Preserve it when cleaning generated assets. The Foundation
[local history and Cloud design](../ref/foundation/docs/app-manage.md#durable-local-execution-history)
documents the retention settings, read APIs, process capture and hosted roadmap.
The cloud blueprint provisions no hosted services and uploads no local data.
