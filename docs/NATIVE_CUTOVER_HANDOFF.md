# Native FinFolk production cutover handoff

## Status

The migration is **not complete**. This commit contains its native schema/RPC
foundations and readiness checks. No production database reset, authentication
disable, binding change or native API cutover has been performed.

The HTTP API and integration workers still use legacy tables. Do not promote a
native database merely because generation or the type tests pass.

## User-approved outcome

- Replace the entire serving application schema with actual `finfolkdb` entities.
  No legacy tables, compatibility views or shadow stores in the serving database.
- Reset application data; retain real managed sign-in identities and the existing
  verified brand authorization. Rebuild pinned reference data. Existing users may
  sign in again and receive fresh private-default application profiles.
- Use a maintenance window. Preserve the old database only as an isolated recovery
  copy (default seven days). Provider-owned auth/extension objects are exempt from
  application-table cleanup.
- Preserve the sole Meta Facebook Page authorization pathway, encryption key,
  app/Page/Instagram identity binding, reply deduplication and uncertain-send safety.
- Keep rollout restricted; resetting data must not replay historical webhooks,
  queued replies, OAuth states or previously granted sharing consent.

## Implemented in this commit

- Typed Finnies account/item/redemption/ledger entities in the native entrypoint;
  real references, request/reference uniqueness, enums and business constraints.
- Generated `resources/finfolkdb/rpc-catalog.json` from typed Clojure functions
  (52 signatures at verification). `backend/native-rpc.mjs` validates function
  names/arity and parameterizes values. It is trusted-server infrastructure,
  not a public arbitrary-function endpoint. Existing HTTP handlers have not yet
  been converted to it, and raw-SQL-published functions need separate coverage.
- Fresh installation/import manifests no longer install the legacy shop SQL.
  Legacy shop code/artifacts remain for the current serving implementation and
  must be retired when its replacement is complete.
- Generated-catalog relation checks reject missing entities, legacy tables,
  compatibility views, shop objects, RPC-schema tables and `public.finfolk_migrations`.
  Contract hashing includes native schema, catalog, RPC catalog, import contract
  and worker grants. This is not yet a complete production promotion command.
- Read-only `scripts/native_cutover_status.mjs` audits legacy backend references;
  `--candidate` verifies the recorded branch/endpoint before inspecting relations.
  Nonzero exit status is expected until the cutover is ready. The last source
  audit found 631 legacy references in 31 backend files; rerun against your checkout.

## Verification completed

- `make generate`, `make check-generated`, `make test`, `make build`.
- `make test-db-types`: disposable real PostgreSQL, 93 native tables at verification,
  including 55 domain tables, 70 reference checks, 27 enum checks, 19 business checks.
- `node scripts/test_database.mjs --rebuild`: atomic fresh install/import,
  rollback, integrity checks and native-only shop installation.
- `node scripts/test_database.mjs --native-rpc`: actual native function invocation,
  JSON/Unicode preservation and rejection of unknown names/invalid arity before SQL.
- `node tests/test_native_cutover.mjs`: exact generated relation inventory gates.

Logs are local ignored `.cache/native-cutover-*` and `.cache/native-rpc-*`; they
are not required to reproduce the tests. Docker or the documented disposable
local PostgreSQL test connection is required for database suites.

## Immediate cloud blocker

At the last check, both production and candidate database connections returned
Neon HTTP 402, account/project quota exceeded. Production `/health` returned 503.
The candidate also failed using a freshly retrieved connection URI. This was
observed before any cutover action; credentials should not be replaced blindly.
Restore project capacity and recheck health. Offline API implementation remains
necessary regardless of that blocker.

## Remaining implementation, in order

1. Inventory all HTTP actions, queue/cron jobs and administrative scripts. Map each
   to native Clojure RPCs with matching public JSON contracts. Add missing native
   functions for accounts/profiles/check-ins, sites/environment, rewards, social
   workflows and Instagram comments. Complete native Finnies operations.
2. Port all database business logic to those functions. Keep JS for transport,
   verified identity, crypto, provider HTTP and queue orchestration. Preserve
   HTTP paths/response shapes; remove legacy SQL fallbacks/schema detection.
3. Consolidate native messaging and comments on the canonical native database,
   with separately scoped API/worker/importer roles. Replace name-only isolation
   checks and `backbone_release` with explicit endpoint/native-release checks.
4. Finish the one native release/install/import/verify pipeline. Retire legacy SQL
   publication and deployment entrypoints from production use. Extend readiness
   gates to RPC signatures, grants, seeds, imports, configuration and route coverage.
5. Rehearse on an isolated candidate. Install the complete regenerated schema;
   rebuild reference data from a verified manifest and existing immutable R2 assets.
   Import only the retained brand grant: decrypt in memory and reseal through the
   native credential store's different scope binding, retaining the encryption key.
6. Add/enforce fresh integration activation boundaries. Start paused; require
   fresh pilot acceptance. Never reset uncertain replies to pending to force sends.
7. Run complete native-only API, authorization/isolation, browser, queue, cron,
   idempotency/concurrency and provider acceptance tests. Reject every remaining
   runtime legacy-table dependency and every unexpected application relation.
8. During maintenance: freeze mutations and provider processing, verify encrypted
   backups, disable old branch Auth without deleting its data, clone current managed
   identities into the final candidate, initialize the native application, and
   verify retained identity state. Enable the candidate's managed Auth.
9. Deploy matched fresh API/Netlify builds and candidate Hyperdrive/auth/JWKS/release
   settings plus fresh queues. Keep public domains and Meta callback URLs stable.
   Complete operator acceptance before reopening public writes. Isolate the old
   branch and revoke its worker access. Fix forward after new writes begin.

## Repository and deployment cautions

The handoff is based on local commit `d879835`. At handoff preparation local
`main` was twelve commits behind `origin/main`. Reconcile upstream changes in an
isolated checkout before implementation/deployment; do not pull or rebase the
shared dirty working tree. The handoff branch carries only the migration files.

Read `AGENTS.md` and `docs/DATABASE_REBUILD.md`. Author database logic under
`src/finfolkdb`, regenerate artifacts, and never hand-edit generated SQL/JS.
The existing native cloud candidate is recorded in `.cache/cloud-rebuild/`; those
private records and canonical `.env.local` are deliberately excluded from Git.
Use the existing FinFolk project and verified endpoint identities, not a new
unrelated project or fabricated managed-auth tables.

There are other uncommitted changes in the shared checkout (Instagram/provider,
worker lifecycle, chat and ocean work). This commit intentionally does not include
them. Do not discard or indiscriminately stage/deploy them. In particular, a clean
checkout of this commit is **not a copy of the currently deployed API**. Reconcile
production fixes before publishing the replacement. The last Instagram release
verified in this migration conversation was `e8e8de21-8480-4129-ad92-7b2ccb8f88e6`;
recheck live deployment metadata rather than assuming that is still current.

Never run `make deploy` or the old migration-backed release command as a shortcut:
the current default deployment path still targets the legacy application. Do not
switch production until the native-only replacement has passed acceptance.
