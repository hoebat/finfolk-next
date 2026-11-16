# FinFolk management and page verification

Run `make manage` and open <http://127.0.0.1:8131>. The manager reads the project declaration in `src/finfolkbuild/project/management.clj`; it uses the shared `app.manage` framework in `ref/foundation`. The Pipeline and Slices views show generation targets and build evidence. Pages & models lists the application registry and provides the verification workbench.

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
