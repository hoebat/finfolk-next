# FinFolk social schema handoff

Updated 15 November 2026. Continue the native FinFolk database consolidation from Instagram and TikTok tables into shared Social* entities. Source changes and generated artifacts are present in the working tree. All 25 common Clojure database suites now pass on local Supabase PostgreSQL 17 (230 checks). Only isolated test databases were installed; no production installation or cutover was performed.

## Start here

Repository: `/Users/chris/Development/greenways/finfolk-next`.

Read `AGENTS.md`, `docs/DATABASE_DESIGN.md` and `docs/NATIVE_CUTOVER_HANDOFF.md`. The latter describes the broader migration and its acceptance requirements. This handoff covers the social schema work within that migration.

Docker access is verified under `danger-full-access`, network enabled and approval policy `never`. Do not pass `sandbox_permissions`. Local Supabase startup initially conflicted with the older `finfolk-tests-postgres-1` PostgreSQL 18 container on port 55432. That container was temporarily stopped for the PostgreSQL 17 Supabase tests, then restored after stopping the Supabase stack. Starting Supabase again requires freeing port 55432 first; do not substitute the older server for the requested Supabase tests.

There are uncommitted changes, including formatter/tooling and other database files beyond this task. Inspect the current diff and preserve unrelated work. Do not reset the working tree or attribute every modified file to the social consolidation. No commit was made by this agent.

## User decisions to preserve

- FinFolkdb is the database source of truth; author under `src/finfolkdb` and regenerate artifacts.
- Use configured `et/E` identity/tracking behavior. Do not use `:id/none`.
- Native entity identifiers and references are UUIDs, not text or integers. Provider external identifiers remain text.
- Tracking fields use long values, not `timestamptz`; retain the established microsecond convention and `time-created` / `time-updated` naming.
- Do not add tracking fields to `:id/entry` itself.
- Test FinFolk against local Supabase, not a hosted substitute.
- Generalize Instagram/TikTok persistence into Social* tables. This implementation is in FinFolk; no Auspo social changes were requested.

## Implemented source changes

`src/finfolkdb/common/type_social_account.clj` defines SocialAccount and SocialConnection. Accounts use a unique provider/namespace/external-id identity. Connections carry owner, encrypted credentials, generation and identity version, leases, synchronization state and explicit sharing consent. A partial unique index permits one current connection per account and retains revoked history.

`src/finfolkdb/common/type_social_workflow.clj` defines SocialConnectionProof, SocialSource, SocialSuppressedSource, SocialAction, SocialDiscovery, SocialDiscoveryReport, SocialCommand, SocialEvent and SocialRateLimit. These replace provider-specific native entities. All 11 new tables use UUID identity, configured tracking and server-only access. Audit-enabled entities reuse Audit/AuditLog rather than introducing provider-specific audit tables.

Related references were updated in SocialHandle, SocialPost, MediaImport, Messaging and UserPointsEntry. MediaImport includes provider namespace in media deduplication and a composite ownership foreign key for its optional SocialConnection. Shared provider/workflow enums were added. Historical provider enum declarations remain intentionally because immutable legacy contracts still reference them.

`src/finfolkdb/fn/social/social_manage.clj` implements 11 trusted-server functions for account creation, proof creation/verification/consumption, connection, sharing, disconnection and discovery publication/readback. Provider HTTP calls, signature validation and encryption remain responsibilities of the trusted adapter. Proof verification requires matching provider, namespace and external identity. OAuth proof creation requires hashed nonce and flow bindings. Connection consumes a proof once, rotates versions/generations and resets consent. Disconnect wipes credentials, leases and consent and invalidates outstanding proofs. Discovery publication checks owner, beach, platform, URL, approval and consent; public reads use the existing SocialPost visibility checks.

`src/finfolkdb/schema/social.clj` generates `resources/finfolkdb/social-grants.sql` for a private `finfolk_social` role. Do not grant that role to browser/API clients. The schema module, scaffold and build wiring are updated. The native catalog now has 88 tables, with no native Instagram*/Tiktok* tables. Legacy table responsibilities are mapped in `docs/DATABASE_DESIGN.md`.

Generated SQL/catalogs and grants are already regenerated. Do not edit generated files manually. Historical migration files were not changed. Legacy HTTP API/integration workers have not been switched to the new entities; that cutover still requires implementation and validation under the broader handoff.

## Test pattern and runtime fixes

Following the user's request, the test pattern was compared with `statstrade-v2`'s `statsdb` common and social tests and `statsbuild.testing.supabase.gw-db`. Every active FinFolk common namespace now owns its JDBC `l/script-` dependencies and explicit restart/teardown/setup/stop lifecycle. `local/prepare!` and `local/cleanup!` handle only disposable schema preparation and locking. The scaffold generator emits the same pattern.

Common tests no longer require the entire application scaffold, which pulled unrelated managed-auth-dependent site-note RPCs into every suite. They require their domain modules and fixture operations. New social tests use explicit domain fixtures and typed writes/reads with `try`/`finally` cleanup rather than catalog-driven persistence fixtures. The remaining common suites retain their existing authored scenarios and shared fixture constructors.

Live testing revealed and fixed these issues in authored code:

- `auth-uid` emitted a quoted `nullif` function instead of PostgreSQL's `NULLIF` expression. Its regression test verifies both anonymous and transaction-local UUID identities.
- Disconnect proof cleanup emitted an invalid `IN` list. Its source now uses a SQL tuple and artifacts are regenerated.
- Raw JDBC messaging claim calls lacked UUID casts, and the concurrency fixture could roll back one claim before the second worker selected. Both claims now remain open behind a second barrier before commit/rollback.
- Old test/scaffold examples used text actors and empty-string viewers. Native examples use UUIDs and `nil` anonymous identities.
- Single-namespace runs bypass the bulk test runner so setup failures preserve their diagnostic exception. Passing namespace check counts are printed explicitly.

The social account suite also installs the generated privilege policy from its Clojure source, tests account creation as `finfolk_social`, and verifies `anon` cannot invoke it. Temporary role membership and account writes are rolled back together; browser clients receive no trusted role membership.

## Validation completed

- Local Supabase startup and SQL connectivity passed: PostgreSQL 17.11, port 55432. Log: `/tmp/finfolk-social-local-up.log`.
- `node scripts/test_database.mjs --clojure-common` passed **all 25 namespaces, 230 checks**, including account/workflow, MediaImport, Messaging, SocialHandle, SocialPost, UserPointsEntry and enum suites. Log: `/tmp/finfolk-common-live.log`.
- `make generate` passed after SQL fixes. Log: `/tmp/finfolk-social-generate.log`.
- `make check-generated` passed. Log: `/tmp/finfolk-social-check-generated.log`.
- `make build` passed. Log: `/tmp/finfolk-social-build.log`.
- Clojure test/tooling files were formatted with the repository formatter; `git diff --check` passed.
- `make test` passed 10 local runtime tests, 6 application checks and 26 native catalog checks, then stopped at the same Python failures noted previously: three failures and one error among 157 tests. The ocean audit compression assertion and VCDEM checksums/gzip fixtures remain outside this task. Later Makefile test commands therefore did not run. Log: `/tmp/finfolk-social-test.log`.
- No commit, production database change, adapter deployment or production cutover was performed.

## Next actions

Native common behavior validation is complete for this change. Continue the broader `docs/NATIVE_CUTOVER_HANDOFF.md` work: translate legacy HTTP/API and integration workers to native RPCs, finish release/install/import readiness gates, and rehearse native-only behavior on an isolated candidate before any production promotion. The legacy JavaScript type tests still contain earlier text-ID/time assumptions; this Clojure test work does not complete that separate conversion.

To reproduce the live Clojure suites, free port 55432 and run from the repository root:

```bash
make test-db-local-up
make test-db-common
```

Select individual suites with `DB_TEST_NAMESPACE=finfolkdb.common.type-social-account-test` or `finfolkdb.common.type-social-workflow-test`. For direct statsdb-style editor/CLI use, start the local stack first, then use `lein test :only <namespace>`. This uses the isolated persistent `finfolk_test_repl` database; the Make/Node runner instead creates a disposable database from `template0` and drops it on success or failure.

Local Supabase project: `finfolk-tests`, PostgreSQL 17, API port 55431, database port 55432. CLI wrappers set `SUPABASE_HOME` to `.cache/supabase-cli` and disable telemetry.

Implementation details useful when debugging:

- Entity `:enum` / `:ref` namespace metadata must use fully qualified namespaces; script aliases are not resolved there.
- Scalar SQL helpers need explicit UUID/boolean return metadata; otherwise the generator defaults to JSONB.
- Audited entity fixtures require the correct scoped Audit constructor. See `src/finfolkbuild/testing/behavior.clj`; the generic proof fixture uses kind `manual` to avoid fabricating OAuth bindings.
- Use a fresh operation context for each mutation. Reusing one operation across entries in the same audit stream can violate the audit/op uniqueness constraint.

Do not mark the migration complete based on catalog generation alone. Report the live test results and distinguish native schema readiness from the remaining adapter and production cutover work.

## Mock provider continuation — 16 November 2026

The native provider enums now include `mock`. MessagingIdentity can reference SocialAccount, and social-message ingestion, receipt-bound proof issuance and current-member resolution RPCs are authored in `src/finfolkdb/fn/social/social_messaging.clj`. Social-provider messaging derives membership from the active SocialConnection; direct app chat retains its user reference. The local CLI/HTTP harness and verification are documented in `docs/MOCK_SOCIAL.md`. It is not registered in production Workers. Instagram/TikTok adapter cutover, public comments, production encrypted-code delivery and real sign-in integration remain separate work.

## Site naming and native notes — 16 November 2026

The native `Beach` entity is now `Site`, and native location relationships use
`:site` / `site_id`. Declarations, references, native fixtures, rebuild manifests,
grants and generated artifacts are updated. Historical migrations and their
legacy table/column contracts are unchanged.

SiteNote now uses the standard `:0d/entry` identity/tracking with `:addons [:rev]`.
Its former independent revision counter and manually declared tracking times are
removed. Votes and reports also inherit entry defaults. The API revision field
is projected from the shared Rev stream; creation, withdrawal and moderation
write RevLog snapshots transactionally. Single-column text/date validators use
column `:sql :process` functions following StatsDB, with matching column CHECKs
for direct SQL writes. Cross-column conditions/date validation remains a table
constraint. This defaults/revision cleanup is scoped to the notes family; other
existing domain overrides still need a separate audit.

Validation: all 25 common namespaces pass (243 checks), native catalog suite
passes 28 checks, the new UUID-native `make test-db-note-revisions` scenario
passes, and build/generation parity pass. Logs are `/tmp/site-rev-common.log`,
`/tmp/site-rev-catalog.log`, `/tmp/site-rev-rpc.log`,
`/tmp/site-rev-final-parity.log` and `/tmp/site-rev-build.log`. `make test` still
stops at the same three ocean/VCDEM Python failures and one error among 157 tests
(`/tmp/site-rev-test.log`). No production installation or deployment occurred.
