# FinFolkDB

## Production cutover implementation — in progress

The approved production direction is a native-only application database, with
application data reset rather than copied. Retain real managed-auth identities
and the verified brand authorization, regenerate reference content, and require
fresh sign-in. Use a maintenance window. The serving database must contain no
legacy application tables or compatibility views; the former serving branch may
remain isolated for seven days as recovery storage.

The native schema now includes typed Finnies account, item, redemption and ledger
entities. The fresh installer no longer installs the legacy shop publication.
`node scripts/native_cutover_status.mjs` reports generated table inventory and
remaining backend legacy references; `--candidate` also checks the isolated
candidate's actual relations after verifying its endpoint/branch identity.
This command is read-only and fails when the relation/source gates are unmet.
It does not certify full RPC, auth, permissions or browser acceptance.

The HTTP API and integration workers still require porting before promotion.
Production has not been reset or switched by these preparatory changes. Do not
run the old migration-backed release commands against the native candidate.

Native typed RPC signatures are published as `rpc-catalog.json` by
`finfolkdb.schema.rpc-catalog`. The trusted server caller in `backend/native-rpc.mjs`
checks function names and arity against that artifact and parameterizes values.
It is not a public arbitrary-function dispatcher. The live PostgreSQL regression
executes generated user creation and rejects unknown calls before database access.

Cloud validation is currently blocked: the native candidate returns Neon HTTP
402 (account/project quota exceeded), including with a freshly retrieved connection
URI. Restore project capacity before cloud inspection or promotion. This does not
remove the separate requirement to complete the API/worker port; the source audit
still reports legacy dependencies. No database drop or auth-disable operation has
been executed as part of this implementation.

The current work is the standalone database model. Frontend and HTTP API migration
are outside this cleanup. The existing application database has not been changed
or deployed; historical migrations remain immutable.

## Commands

Run these from the repository root:

```sh
make generate-db        # Clojure types -> SQL, hydrated catalog, enums, inventory
make check-generated-db # fail on stale generated database artifacts
make test-db-types      # Clojure contracts + disposable live PostgreSQL suites
```

`test-db-types` starts the pinned PostgreSQL 18 Docker image and creates a separate
database per suite, then drops each database and stops its container. An existing
local server can be supplied through `FINFOLK_TEST_POSTGRES_URL`; remote servers
are refused. Generation never connects to a database or installs SQL.

`make generate`, `make check-generated`, `make test-db`, `make test`, and
`make build` remain the whole-repository workflows. The full live database suite
also includes the active type suite and historical migration/API regressions.

## Active source

`src/finfolkdb/common/type_*.clj` contains 21 active type namespaces, following
StatsDB's `type-system-*`, `type-user-*`, `type-social-*`, and domain `*-base`
families. Tables use singular capitalized names, real `:ref` relationships,
`et/E` elements, and native domain enums. Shared `Rev`, `Audit`, `Activity`,
`Access`, and `Social` providers and their logs retain their 1D/2D scope rules.
`EnumClassType` is derived from entity metadata using StatsDB's `et/class-types`
pattern, with a small fallback list for historical discriminators.

The environmental, site revision, provider ingestion, messaging and rewards
contracts now use native declarations too. These records retain natural keys,
provider timestamps, identity counters, uniqueness and check constraints.
Their explicit `:track/none` avoids inventing a second timestamp/audit lifecycle
for imported data, queues, rate limits and snapshots. Domain entities that use
revision/audit/activity streams continue to attach those actual addons.

Local relationships are typed links, including action-to-session and
revision-to-beach links absent from the old FK catalog. External provider IDs,
request keys, correlation IDs and connection generation/version fences remain
scalar values: they do not identify local rows. Managed-auth user identities
remain text. No application data is copied or migrated by these declarations.

`finfolkdb.main.scaffold-001-entity` is the sole active SQL entrypoint.
`finfolkdb.build` is the sole active database artifact publisher. The application
publisher delegates to it. `finfolkdb.schema.namespaces` discovers every type file,
checks namespace/path consistency, and requires all modules. The tests reject
orphan type modules and SQL entrypoints that omit declared tables.

## Generated artifacts

- `resources/finfolkdb/entity-schema.sql`: transactional fresh installation of
  79 tables, their enums, references, constraints, indexes and typed functions.
- `entity-catalog.json`: hydrated Foundation metadata, including addon fields,
  physical column names and relationships.
- `entity-coverage.json`: all 69 historical table responsibilities mapped exactly
  once to the active model. Shared audit/access providers consolidate some roles;
  extra system/provider tables account for the different entity count.
- `type-namespaces.json`: all discovered type modules and source paths.
- `enums.sql` / `enums.json`: separately testable closed domain value contracts.

The fresh schema refuses nonempty application schemas and requires the API role
and managed-auth table to have been provisioned. It contains no table drops.
Tables and internal functions remain inaccessible to PUBLIC; API permissions
must be granted deliberately during a future integration.

## Removed redundancy and compatibility fixtures

The old lowercase table declarations, source-text catalog scanner, raw-string
SQL function publishers, pilot scaffold, catalog forwarding namespace, and pilot
build entrypoint have been removed from active FinFolkDB. Emacs autosaves of
retired files contained only formatting differences and were removed; lock and
autosave files are now ignored by Git.

The pre-entity release artifacts are frozen under
`resources/finfolkbuild/legacy/`, with a single fixture reader at
`src/finfolkbuild/db/legacy.clj`. These include the historical catalog, schema,
pilot SQL, site SQL, index list and operation contracts. They preserve the
existing release and migration tests without maintaining a second executable
schema tree. The whole-app generator copies them to its existing compatibility
paths. They are not authored type definitions or a second active DB build.
Historical function names in frozen JSON are provenance labels, not loadable
Clojure namespaces. Retire these fixtures when the legacy API is migrated.

## Verification and remaining scope

`make test-db-types` checks all 21 namespaces and all 79 live tables. The 44
domain tables in the broad fixture suite receive valid rows; every one of their 55 typed
references rejects a missing parent, all 25 enum columns reject invalid labels,
and 12 business checks reject invalid writes. Existing suites also cover hydrated
columns, 1D/2D isolation, addon creation and rollback, directory/event access,
owned private sessions, media ownership, social consent/blocking, trip import
concurrency and publication snapshots. The dedicated Clojure runner preloads
its test namespaces so namespace load errors produce a failing exit status.

Coverage of table declarations does not mean the application API has migrated.
Historical HTTP operations still address the old schema. Replacing that path,
reference-data imports, full business workflow parity, deployment and
frontend integration remain separate work. This cleanup installs and tests the
new model only in disposable PostgreSQL databases.

## Shared messaging refactor

See [MESSAGING_DB.md](MESSAGING_DB.md) for the reusable Instagram/TikTok/app chat
contract and adapter integration examples. The active schema now uses
`MessagingApplication`, `MessagingIdentity`, `MessagingConversation`,
`MessagingMessage` and `MessagingReceipt`. Native `InstagramDmEvent` and its
three obsolete enum declarations were removed; its historical responsibility is
mapped to `MessagingReceipt`. Instagram connect-code evidence now links to that
generic receipt. The outbox is linked to generic receipts and outgoing messages,
with database-enforced account scope. The standalone domain enum artifact now
contains 34 enums; messaging-specific provider/direction/receipt enums are defined
next to their types and included in the full entity schema.

`make test-db-messaging` runs the focused live suite. It is also included in
`make test-db-types` and `make test-db`. This tests both provider labels through
the actual database protocol, with an application chat channel and another
application/account in the same schema. It does not test live provider webhooks
or external message delivery; those adapters and grants remain integration work.

## Fresh rebuild and data import plan

The release direction is **regenerate from scratch, seed, import, verify, then
replace**. The user does not want a database migration. Do not replay historical
migrations, add an additive coexistence migration, or convert the legacy tables
in place. Historical migration files remain immutable fixtures for the current
serving application and its tests.

Clojure owns the native tables, enums, relationships, functions, system seed and
database import operations. Keep singular capitalized table names, actual `:ref`
links, StatsDB-style namespaces/formatting and the existing 1D/2D addon conventions.
Python acquisition/parsing code can continue to normalize source files; a release
CLI should orchestrate those inputs and trusted database functions. Generation
itself never opens a database connection.

### One explicit release pipeline

1. **Generate the release bundle.** Publish the complete native schema, enums,
   functions, narrow grants, required system seeds and an artifact digest from
   the current Clojure source. System defaults are distinct from imported content.
   Record compiler/source versions needed to reproduce that release.
2. **Pin and validate the import inputs.** Build a manifest from site/area
   configuration, the built site catalog and its source lineage, dataset inventory,
   ocean source records, acquisition manifests and actual available assets. Each
   input records version, checksum, provenance, licence, quality and availability.
   Verify files before a database write; reject LFS pointers, unsafe paths, corrupt
   bytes and unsupported formats. Downloads are a separate acquisition step, not
   an unpinned side effect of rebuilding.
3. **Prepare a clean candidate.** Provision a new isolated database/application
   schema target and its managed-auth dependency. An isolated auth-aware branch
   may retain its provider-owned `neon_auth` schema while application schemas are
   recreated from scratch. Verify branch/endpoint/database identity before any
   candidate reset. Never drop or reset the serving database. Do not generate or
   mock authentication-provider tables to bypass installation guards.
4. **Install and seed.** Apply the generated fresh release explicitly and
   transactionally, then seed required system records and reviewed application
   identity references. Keep external integrations disabled. Do not invoke
   `migrate_neon.mjs`, `release_next_db.mjs`, or the current migration-backed site
   release command in this pipeline.
5. **Import reference data in dependency order.** Load source/provenance records,
   geographic/site references, asset and dataset versions, environmental records,
   then site-to-dataset/station links. Use stable source keys and native linked
   entities. Make imports rerunnable with immutable-version conflict checks and
   atomic batches; failed batches must not publish partial results.
6. **Verify the candidate.** Compare expected and actual counts, source/version
   checksums, linked parents, geometry/coverage, enum constraints and meaningful
   sample reads. Emit an import report including missing/blocked assets and
   preserved quality labels. Record schema, seed and import-manifest versions in
   the candidate's release readiness evidence.
7. **Exercise the native application contracts and promote.** The old API still
   addresses lowercase tables, so verify its replacement against the native
   functions before pointing live traffic at this database. Test authentication,
   account isolation, messaging and rollback on the candidate. Change bindings
   only through an explicit tested replacement; retain the previous database and
   configuration for rollback.

The native command now provides preparation, explicit install/import, source-file
verification and database inspection stages; see the runbook below. Local
acceptance is separate from cloud asset publication, native API cutover and live
provider activation.
Schema changes produce another regenerated release. Reference-data refreshes use
the same rerunnable import functions.

### Depth, geo and ocean inputs

| Inputs | Import requirements |
| --- | --- |
| Sites and geography | Stable site IDs, state/area membership, timezones, reference points, access points, sourced geometries and boundaries where available; retain provenance and native site/revision relationships |
| Depth/contours | Register source and immutable dataset versions; import contour features/coverage and available measured depth assets with survey date, CRS, vertical datum, units, sign convention and nodata semantics |
| Ocean catalog/acquisitions | Import source records, materialized assets and acquisition/quality state; preserve partial, discovered, unverified, mixed and context labels |
| Environmental records | Import available station/reference metadata and sourced observations/predictions with validity and freshness; never mark old forecasts fresh or fabricate unavailable observations |
| Cross-links | Create explicit native site/dataset/station relationships with evidence; envelope overlap remains a candidate relationship until actual coverage is verified |

Use `DataSource`, `DepthDataset`, `TideStation`, `Beach`, native site/revision
entities and their links where they fit. Define any missing asset/spatial/source
entities and import functions in Clojure before generating SQL. Store large raster
assets in durable asset storage and import their verified references, footprints
and metadata into Postgres; the import must make those assets resolvable for the
actual depth read path. Do not claim a metadata-only record contains numeric depth
samples. Preserve the geometry/features required for geographic queries. Curated
browsing areas in `config/areas.json` are not legal/administrative boundaries.

The inspected inputs currently include 16 contour packages, 13 ocean source
records, and a cached site catalog containing 2,309 sites in 69 areas. The ocean
registry labels ten sources partial and three discovered; its quality labels are
context, mixed or unverified. `datasets/inventory.json` currently lists zero
rasters in its published `rasters` array, while acquisition/provenance records
track additional native assets separately. Inventory those actual assets before
deciding what can be imported. Do not treat registry discovery as proof that a
download is complete, or treat an empty published raster array as proof that no
acquired raster assets exist. These counts describe inspected inputs, not an
imported or complete national depth dataset.

### Existing code to adapt

`backend/environment-imports.mjs` writes legacy `data_sources`, `depth_datasets`,
`tide_stations` and related lowercase tables. `scripts/sites_release.mjs` invokes
the migration runner before writing legacy site tables. Those paths cannot serve
as the native rebuild/import pipeline unchanged. Reuse appropriate source
validation/normalization, then call native Clojure-authored import functions.
The file-based ocean registry remains the acquisition/review source. The native
rebuild command now consumes its verified observations and acquisition parts.

### Required acceptance

- Two clean local PostgreSQL rebuilds from the same schema/seed/import manifest
  produce equivalent semantic results and stable source identities.
- Re-importing the same bundle creates no duplicates; changing bytes under an
  immutable dataset identity is rejected.
- Missing/corrupt assets, bad CRS/datum/units, broken links and invalid enum values
  fail clearly; transactional failures leave no published partial batch.
- Counts, checksums, provenance, geometry, sample depth reads and site links match
  the pinned inputs. Missing/partial acquisition remains explicitly visible.
- Every active `type_*` namespace still loads and is tested against live Postgres;
  required generation/parity, database, repository and build checks pass.
- The candidate API uses the native schema and passes authentication and messaging
  acceptance. Existing member-owned content requires an explicit retention/reset
  decision before cutover; preserve the old database while that is unresolved.
- No schema migration or historical migration ledger is needed to reproduce the
  replacement. Live provider review/activation is recorded separately from the
  rebuilt database's readiness.

### Native rebuild runbook

The implementation is authored in `common/type_import_base.clj` and
`schema/rebuild.clj`. The latter derives fixed import projections from the native
entity catalog and generates `rebuild.sql` and `rebuild-contract.json`. PostgreSQL
casts incoming records through the native table types, checks immutable replay,
and enforces references/enums. The importer never accepts dynamic table SQL and
is executable only by its owner. No browser or API role receives import rights.

```sh
make generate-db
make prepare-db-rebuild    # pins local acquired inputs; no database connection
make verify-db-rebuild     # verifies every pinned byte/hash; no database connection
make test-db-rebuild       # disposable live PostgreSQL, small failure/replay fixtures
make test-db-rebuild-data  # also imports all acquired repository inputs on PostgreSQL
```

Preparation writes `.cache/rebuild/manifest.json`. It pins the importer and site
normalizer implementation as well as the generated schema,
import function, grants, sources, site catalog/details, reviewed examples,
curated areas, contour packages, ocean registry/evidence, and acquired native
parts. Large assets are hashed as streams; acquisition parts are checked
individually and against the complete concatenated acquisition checksum. Native
inspection documents are imported into dataset metadata, preserving the reported
CRS, bounds, resolution, units, nodata and container checks. Inspection hashes must
match their acquired asset; header bounds do not establish valid-data coverage.
Contour and coastline geometries are validated and imported into PostgreSQL;
they are not merely registered as filenames. Batches limit feature payload size.

Some old inventory contour hashes differ from the physical files. For these,
the matching ocean registry observation is authoritative for byte verification;
the inventory discrepancy is retained as an explicit manifest warning, together
with the original metadata. A mismatch with the observed hash fails preparation.

The current local input release has 2,309 sites, 78 curated browsing regions,
92 depth datasets, 34,807 contour features and 4,133 Natural Earth coastline
features. The 128 physical asset records include acquired archive/raster parts;
95 dataset/asset links connect those assets to their depth products. Reference
points link to sites, regions and sources through native references. Contour
site relationships remain candidates, and all depth products are staged. Source
reviews retain mixed/unverified/context quality and partial/discovered acquisition.
Three sources have no acquired assets: GBR 2020, Northern Australia 2018, and
VCDEM 2021. No tide-station or fresh environmental forecast bundle is present in
these pinned inputs; none is fabricated. These are an inspected input release,
not a claim of complete Australian coverage.

To install on a separately provisioned, **empty candidate** with real managed
`neon_auth."user"` and `finfolk_api` already available:

```sh
# Set these in the shell without checking credentials into a file or git.
# FINFOLK_REBUILD_DATABASE_URL=<direct candidate PostgreSQL connection URL>
# FINFOLK_REBUILD_EXPECTED_DATABASE=<exact candidate database name>
node scripts/rebuild_database.mjs install
node scripts/rebuild_database.mjs import
node scripts/rebuild_database.mjs inspect
```

Installation is one transaction across schema and grants. It refuses existing
application objects. Import is a separate atomic transaction across all batches,
required `SiteCatalog` seed, counts and `DatabaseRelease` receipt. Failed imports
leave the installed schema empty; retry with the same manifest. Successful replay
is a no-op; changed content under an existing identity fails. Database inspection
checks the receipt and actual native table counts. `verify` checks local source
files; `inspect` additionally connects to the explicit candidate database.

The default manifest uses local file URIs and is for local rehearsal. Remote
installation/import requires an explicit `FINFOLK_ASSET_URI_FILE`, a JSON map of
every physical asset path to its durable HTTPS URI, followed by preparation of a
new manifest. Publishing and verifying those durable objects and wiring the
native depth reader remain cloud acceptance work. Acquired raster samples stay
in those assets; importing their references does not turn them into queryable
numeric PostgreSQL samples. The deployed legacy API is not switched by any of
these commands.

The real-data test writes `.cache/rebuild/acceptance.json` with the release ID,
PostgreSQL version, counts, source limitations and warnings. Its database is
explicitly disposable and is removed afterward. The real-data test compares sorted semantic fingerprints across two complete
clean rebuilds and verifies a full duplicate import. The fixture test also proves
a second clean rebuild has identical semantic records, duplicate imports are stable, and corrupt/missing files, enum/FK failures, immutable conflicts,
unauthorized imports and late install/import failures are rejected atomically.

The new import declarations also run through the local Clojure common-contract
suite (`node scripts/test_database.mjs --common`) and the native type suite.
The separate `make test-db-common` Neon runtime currently requires managed auth
on the dedicated test branch: its site-note SQL joins `neon_auth."user"`, which
that branch does not yet provide. Local tests provision a disposable auth fixture;
no fake managed-auth table is installed on Neon to bypass this prerequisite.

### Isolated cloud rollout

The cloud candidate is `finfolk-native-cloud` (`br-super-morning-a7wxtiq6`) in the
existing FinFolk project, branched from the working `finfolk-next` identity branch.
It uses its own endpoint and managed Auth service. The database remains named
`finfolk_next` because it retains the provider-managed identity database; branch
identity and endpoint are checked independently of that database name.

Foundation's `xt.substrate` owns the application's node/page/model backbone.
Its Neon session integration lives in `xt.db.system.impl-neon-session`,
`xt.net.addon-neon`, and the `scaffold.neon` / `src-js/neon-bridge` setup. The
Foundation scaffold targets its own project, so FinFolk follows its managed SDK
and auth-aware branching pattern without running that project-specific setup.

The candidate has the fresh native schema and retains its cloned managed users.
Administrative cloud scripts use Neon's WebSocket driver over HTTPS for an
interactive transaction; `FINFOLK_CLOUD_TRANSPORT=tcp` selects the direct TLS
Postgres path when available. Branch and endpoint checks apply to both paths.
A real SDK acceptance flow exercises sign-up, sign-in, session restoration,
JWKS-verified JWTs, native Clojure user creation joined to managed identity,
transaction rollback, sign-out and provider account cleanup. No auth tables are
fabricated and no SMTP/verification policy is weakened for the test.

Reference assets use the private `finfolk-reference` R2 bucket through
`finfolk-reference-assets`. Readers and uploaders have separate server-only
credentials. Asset URLs contain their SHA-256 address, with no bearer secrets in
URLs or the frontend. Native acquisition parts transfer from allowlisted
publishers with exact HTTP range checks. Derived geometry files transfer as
bounded gzip parts over HTTP/2. Publisher-issued signed redirects stay in memory
and are never written to manifests or logs. The R2 objects contain the original uncompressed bytes.
Every stored byte is verified against the pinned local files using bounded
SHA-256 range proofs; object ETags must stay constant throughout verification.
This avoids transferring multi-gigabyte assets through the local uplink merely
to copy or verify them. Source quality/licence reviews remain unchanged; raw
unreviewed assets are not made public.

```sh
make test-reference-assets
node scripts/provision_cloud_rebuild.mjs
node scripts/cloud_auth_acceptance.mjs
node scripts/publish_reference_assets.mjs
node scripts/cloud_rebuild_candidate.mjs plan
node scripts/cloud_rebuild_candidate.mjs install
node scripts/cloud_rebuild_candidate.mjs import
node scripts/cloud_rebuild_candidate.mjs inspect
```

These operational commands require the private records in
`.cache/cloud-rebuild/`. `install` verifies branch lineage, non-default status,
endpoint ownership and the selected database before removing only the copied
application schemas on that candidate. It refuses a candidate that already has
native release tables. Managed auth and the serving parent remain intact.
`import` requires verified HTTPS asset proofs before committing the reference
release. The acceptance receipts record what has passed; a provisioned schema
alone is not an imported or promoted release.

The native API cutover is still separate. The existing messaging Worker also
uses a database-name isolation guard: before using an auth-aware candidate with
the same database name, replace that check with explicit branch/endpoint and
native release identity verification, and test wrong-target rejection. Never
relax the guard merely to make the new endpoint pass. Existing member-owned
application content remains on the serving parent; its retention/initialization
must be resolved before live cutover. No DNS, serving binding, frontend auth URL
or live provider activation changes as part of candidate provisioning.


Cloud candidate acceptance completed on 6 November 2026: all 118 unique assets
(5,413,737,141 bytes) are verified in private R2, representing 128 source-linked
asset records. The reference release contains 2,309 sites, 92 depth datasets,
34,807 contour features and 4,133 coastline features. Native semantic fingerprints
match the accepted local rebuild; cloud asset URIs and release receipts are
checked separately because they differ by environment. The populated database is
about 148 MB. Managed-auth SDK and native user/join/rollback acceptance also pass
on the populated candidate. Receipts are in `.cache/cloud-rebuild/`.

The serving app remains on its existing API/database. Native API adaptation,
instance isolation checks, member-content handling and traffic cutover are the
remaining rollout stages; this receipt does not claim production activation.
