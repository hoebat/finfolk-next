# Environmental data

Active environmental types are authored in `src/finfolkdb/common/type_environment_base.clj`; site links live in `type_site_base.clj`. The running API retains its historical migration schema; see [the database model](DATABASE_REBUILD.md).
Migration `0030_environment.sql` installs them; normal generation and deployment
do not install SQL. Existing site IDs and the published backbone SQL hash remain
unchanged. `CONDITIONS_ENABLED` and `DEPTH_CATALOG_ENABLED` default to false.

## Sources and activation

Review `config/environment-sources.json` before importing it. The Open-Meteo
source is disabled. Enable only with suitable API usage rights; commercial API
access uses `OPEN_METEO_CUSTOMER=true` and the `OPEN_METEO_API_KEY` Worker secret.
The free endpoint remains available for permitted non-commercial use. Secrets
are never stored in source metadata. Both source permissions and feature flags
must permit collection. Forecasts are predictions, not observed conditions.

`node scripts/environment_import.mjs preview bundle.json` validates without a DB.
`DATABASE_URL_UNPOOLED=... node scripts/environment_import.mjs publish bundle.json`
is an explicit operator publication. The authenticated admin API provides
`POST /v1/admin/environment/imports/preview` and `/publish`; publish requires
`{confirmed:true,bundle:...}`. Imports are transactional.

Bundles contain `version:1`, `sources`, and optional `datasets`, `stations`,
`predictions`. Sources carry id, enabled and metadata (url, licence, attribution,
cacheAllowed, redistributionAllowed, retentionSeconds). No source is implicitly
enabled. A changed immutable dataset requires a new version and ID.

## Depth assets

`node scripts/environment_inventory.mjs datasets OUTPUT_DIRECTORY` calculates
processed-file checksums and writes content-addressed assets under `data/depth`.
Its stdout is a reviewable import bundle. The site build performs this export and
publishes `data/depth-manifest.json`; import that deployed manifest after verifying
its asset availability. Metadata preserves source dates, datums, licences and
source resolution. Unknown datums remain unknown. The exporter includes numeric
rasters, regional contours and national context. It never refreshes upstream data.
Retain assets referenced by published dataset versions when retiring source files;
the registry intentionally does not delete dataset versions or assets.

Site associations use `POST /v1/admin/environment/site-links/:revisionId` with
`{version,datasets:[{id,relationship,evidence}],stationId,evidence}`. Relationships
are candidate or confirmed. Station evidence requires reason and sourceUrl; the
server records the reviewer. Links can be edited only on draft/submitted revisions
and increment the revision version. Publish using the existing site review API.
A bounding envelope is a coverage candidate, not proof of a valid depth sample.

`environment_timezones.mjs catalog.json` produces a review report and proposed
site documents using pinned geo-tz boundary data. Submit corrections through site
drafts. Existing timezone provenance is preserved; ambiguous zones require review.
Site payloads now retain coordinate purpose/provenance, timezone provenance,
optional marine_point, and depth evidence datum/uncertainty.

## Conditions and tides

`GET /v1/sites/:id/conditions?date=YYYY-MM-DD&days=1` accepts a window entirely
within today and the next two dates at the site. Default is all three dates.
Components have independent statuses, provenance and freshness. Instants are UTC;
dates and daylight are resolved in the site's IANA timezone. Units are Celsius,
metres, m/s and degrees. SunCalc calculates standard-horizon sunrise, sunset and
civil twilight; absent events are null. Terrain is not modelled.

Weather/marine targets share identical provider/configuration keys. Initial reads
attempt a bounded refresh, with a database lease preventing concurrent collection.
The existing 15-minute scheduler refreshes up to 20 due targets per invocation,
only for targets requested in the last seven days. Failures back off and preserve
last valid data. Weather/marine stale display is limited to six hours after expiry
and never continues beyond the prediction validity window. Retention is capped
by source permissions and seven days. Last errors, attempts, leases and success
timestamps are available in environment_jobs for operational inspection.

Tides require an active station, a reviewed site assignment and an authorized
source. A station has id, source_id, upstream_id and metadata (point, timezone,
datums). A prediction has stationId, source_id and payload containing datum,
issuedAt, attribution and ordered samples `{time,height}` or events
`{time,height,type:'high'|'low'}`. Import rejects unsupported station datums.
Automatic tide collection is intentionally inactive pending an authorized feed;
reviewed bundles provide the ingestion hook. Import only a current, bounded
prediction window, not an historical archive.

Local tides remain unavailable without an assigned valid prediction. Modelled sea
level is a separate component referenced to global mean sea level. It is never
added to chart depth or substituted for local tide predictions. Inland sites omit
marine/tides; unknown waterbodies do not inherit marine coverage.

Public operation cache keys must include date/days. Responses include siteRevision
and snapshot freshness; saved responses must retain these values and be labelled
stale offline. This change registers backend operations without redesigning screens.

## Verification

`node tests/test_environment.mjs` exercises normalization, daylight dates, source
permissions and lease behaviour. `make test-db` includes transactional import,
concurrent collection, datum and feature-flag checks alongside migrated/fresh
schema parity. Run generation checks, repository tests, build, and Worker dry-run
before release. Activate flags only after the migration, source setup and asset
publication. Disable flags to roll back service exposure without removing data.
