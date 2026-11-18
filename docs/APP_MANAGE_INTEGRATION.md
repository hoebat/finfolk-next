# FinFolk management and page verification

Run `make manage` and open <http://127.0.0.1:8131>. The manager reads the project declaration in `src/finfolkbuild/project/management.clj`; it loads the shared `app.manage` framework from the local Maven artifact `xyz.zcaudate/app.manage` at the version pinned in `project.version`. The Pipeline and Slices views show generation targets and build evidence. Pages & models lists the application registry and provides the verification workbench.

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
