# Ocean dataset records and coverage backlog

This catalog is independent of finfolkdb. JSON records stay in ordinary Git so
source reviews and missing-data decisions can be reviewed in diffs. Existing raw
and processed assets remain in their original `datasets/` paths and Git LFS.
No credentials or database connections are needed for these tools.

For another computer, start with [the ocean-data handoff](../../docs/OCEAN_DATA_HANDOFF.md).
The committed portable checkpoint preserves the paused batch budget and partial
downloads; restoring it never starts acquisition.

## Organization

- `records/`: one record per source product or discovery collection. Regional
  extracts are grouped as packages under that product, with raw, processed and
  service-metadata assets, byte sizes and SHA-256 checksums.
- `coverage-targets.json`: one backlog entry per configured browsing region,
  recording candidate products, priority, blockers, goals and next actions.
- `.cache/ocean-catalog/report.html` and `report.json`: generated regional and
  optional per-site evidence; never a replacement for source review.

A source collection is a discovery lead, not an assertion that all its surveys
cover every listed region. Split a collection into product records as particular
surveys are acquired. New records must have schema_version 1, a stable id, title,
source_url, licence, attribution and a review object. Review acquisition_status
is discovered, partial, acquired, verified or blocked. Discovery records may
retain unknown licensing/datum details explicitly; resolve them before acquiring
or publishing data. Candidate records include IMAS, AusBathyTopo 2026, WA surveys,
NSW numeric bathymetry, VCDEM, GBR, Northern Australia and local AusSeabed surveys.

`observed` is imported operational provenance, including the inventory checksum,
packages and assets. Metadata inside each package preserves survey dates,
publication/compilation information, download dates, resolution, datums and
limitations as supplied. Local extraction snapshots are not publisher releases.
Record `review` holds curated decisions; `discovery` holds manually researched
metadata. Grid spacing does not establish measurement precision. Unknown and
unverified values must remain explicit. Catalogue acquisition status does not
mean a region has complete surveyed coverage.

## Updating and checking

From the repository root:

```sh
.venv/bin/python scripts/ocean_catalog.py sync-existing
.venv/bin/python scripts/ocean_catalog.py validate --metadata-only
.venv/bin/python scripts/ocean_catalog.py validate
.venv/bin/python scripts/ocean_catalog.py report
.venv/bin/python scripts/ocean_catalog.py report --sites .cache/next-site/beaches.json
```

The app's existing inventory remains authoritative for acquisition outputs.
`sync-existing` imports that provenance in one direction and preserves curated
reviews, discovery metadata and backlog decisions. Validation detects drift,
removed inventory references, missing files and corrupted bytes. No command
connects to the database or refreshes upstream data. Acquisition tools still own
`datasets/inventory.json`; catalogue synchronization follows acquisition review.

Metadata-only validation does not require materialized data files. Full validation
streams checksums and reports LFS pointers separately from corruption, failing
until all required assets are available. CI performs full validation after LFS
checkout. To retrieve existing assets locally:

```sh
git lfs pull --include="datasets/**"
```

Add newly acquired files under `datasets/raw/` or `datasets/processed/` and confirm
tracking with `git check-attr filter -- path/to/file`. GeoTIFF, BAG, NetCDF, ASCII
grids, ZIP archives and the existing GeoJSON paths are covered by `.gitattributes`.
Keep manifests, source metadata and review notes as ordinary Git text. Before a
commit, synchronize, validate, review provenance and check `git lfs status`.
Neither the catalog CLI nor CI commits or pushes changes.

## Interpreting reports

Coverage goals are independent: numeric depths, contours, verified vertical datum
and source quality. There is no single complete/incomplete flag.

Reports include input hashes and reference the candidate records and asset
manifests. A report without site input shows a regional acquisition backlog;
site coverage is explicitly not checked. Site input comes from the local built
catalog, so reports do not require finfolkdb. Its hash identifies the exact input.

Contour checks measure approximate distance from the supplied reference point to
regional lines at 1km and 5km; context contours are excluded. This is proximity,
not a survey footprint or proof of coverage. Shapely is optional; missing geometry
support or unmaterialized assets makes the check unverified. Numeric checks sample
native cells where the existing raster reader supports the format, distinguishing
valid cells, NoData, no acquired raster and unsupported/unverified checks. Reference
points may be on land and do not establish coverage of an entire dive site.

A 250m context grid must not be represented as measured site detail. Even valid
numeric samples need source-quality and datum review. Existing datum codes are
preserved without automatically treating them as verified. Region priorities and
blockers are reviewed backlog decisions; computed cell counts do not overwrite them.

## Bulk native archive acquisition

The frozen `acquisition-manifest.json` records resolved public depth products,
source evidence, sizes and unresolved access failures. New originals are stored
as immutable 1 GiB-or-smaller `.bin` parts under `datasets/raw/ocean/`; their
ordered manifests live in each record's `acquisitions` array. These preserve the
original bytes without requiring oversized individual GitHub LFS objects.
`sync-existing` preserves acquisitions. New archives do not enter the runtime
inventory or production database automatically.

```sh
.venv/bin/python scripts/ocean_catalog.py discover-assets
.venv/bin/python scripts/ocean_catalog.py acquire
.venv/bin/python scripts/ocean_catalog.py verify-acquisitions
.venv/bin/python scripts/ocean_catalog.py materialize ASSET_ID
```

Discovery resolves public publisher resources and snapshots provenance. Metadata
queries and HEAD requests do not fetch large grids. Discovery must not run while
acquisition is active: it replaces the frozen manifest. Access failures remain
visible and are not treated as empty coverage. Bulk acquisition skips separate
hillshades, slopes, backscatter and point clouds; native depth archives may contain
inseparable supporting files. Survey collection entries may include overlapping
compilations and require further individual coverage review.

Acquisition uses at most four parallel transfers with a shared, locked budget ledger, is resumable, and is limited to
100,000,000,000 charged data bytes across restarts, with a 100 GiB free-space guard.
A durable ledger in `.cache/ocean-acquisition/ledger.json` reserves bytes before
reading. Interrupted reads can overcount conservatively; never delete this ledger
to evade a batch's budget. Partials are kept in ignored cache storage. A process
lock prevents competing acquisition runners. Validated HTTP range responses and
unchanged ETag/Last-Modified validators are required for appending partial files.
Known files that exceed the remaining budget are deferred while smaller ones
continue. Each acquired original has a whole-file and per-part SHA-256 checksum;
these are locally computed unless a publisher checksum is separately supplied.
Scientific accuracy and datum verification remain distinct from transfer integrity.

`.lfsconfig` excludes bulk raw archives from default LFS fetches, retaining the
existing runtime asset workflow. To explicitly retrieve archive payloads:

```sh
git lfs pull --include='datasets/raw/ocean/**' --exclude=''
```

`verify-acquisitions` checks materialized parts and complete source checksums.
Ordinary validation checks acquisition manifest structure without hydrating those
archives. Reconstruction writes an ignored native file and requires sufficient
additional disk space. It never overwrites or publishes runtime data. Review the
frozen manifest and `.cache/ocean-acquisition/report.json` for completed assets,
remaining products and blockers. No command commits, pushes, purchases access or
contacts publishers.

Use `acquisition-status` to inspect the durable budget ledger and current manifest
states while a long acquisition run is active. Partial transfers are not counted
as complete originals. `materialize` additionally writes a native raster-header
or ZIP-member inspection alongside its output; it does not infer datum correctness
or unpack potentially enormous archives. Discovery listings and collection sizes
can change; each run's frozen manifest is the acquisition scope, not a claim that
an entire publisher's future collection is complete.

### Runner ownership and accounting recovery

Startup checks both the filesystem lock and live Python acquisition processes in
this worktree, preventing an older lock-unaware runner from sharing output paths.
Per-run receipts retain initial/final ledgers under `.cache/ocean-acquisition/runs`.
For maintenance, create `.cache/ocean-acquisition/stop-request.json` and wait for
the verified live process to exit; in-flight reads can take up to the configured
socket timeout. Remove the request before resuming. Maintenance exits are not a
completed acquisition batch.

The initial overlapping-run incident is documented in
`.cache/ocean-acquisition/reconciliation/20261104T224745Z`. Exact historic transfer
counts could not be recovered from the raced ledger. A documented conservative
pre-repair debit of 24,648,779,756 bytes covers retained data, possible replaced
originals, failed read buffers across known runs and metadata traffic. This is a
budget allowance, not a claim that this many bytes were received. Reports retain
`received_bytes_is_lower_bound=true`; subsequent single-run receipts and budget
updates are serialized and atomic. The 100,000,000,000-byte cap is unchanged.

Publisher download redirects may sign GET while rejecting HEAD. Discovery probes
such endpoints using a bounded Range GET and closes the body immediately; signed
redirect credentials are not stored. NSW Planning Portal and SEED mirror links
for the same resource are recorded as aliases of one preferred product. Archive
queues exclude standalone rendered imagery, chart PDFs and video URLs found in
survey download attributes. These exclusions remain listed in the manifest.

### Moving a paused batch to another computer

With acquisition stopped, `scripts/ocean_checkpoint.py export` writes
`datasets/ocean/checkpoint.json` and copies verified partial chunks to
`datasets/raw/ocean/_checkpoint/` for Git LFS transfer. Commit and push the
checkpoint together with its matching acquisition manifest and payloads.
Quarantined suspect downloads are not exported as usable data.

On the destination, explicitly fetch the bulk LFS objects, then run:

```sh
git lfs pull --include='datasets/raw/ocean/**' --exclude=''
.venv/bin/python scripts/ocean_checkpoint.py restore
.venv/bin/python scripts/ocean_catalog.py verify-acquisitions
```

Restore verifies payload hashes and the frozen manifest, refuses conflicting
local partials, preserves a higher existing budget charge, and leaves a stop
request in place. Acquisition refuses to start from a missing or older ledger
when a portable checkpoint exists. Keep only one computer acquiring this batch.
Read the handoff before explicitly resuming. A later transfer needs a fresh
export; the committed checkpoint is an immutable snapshot, not live shared state.

For an interrupted large LFS object, `scripts/ocean_checkpoint.py segment
--asset-id ASSET_ID` can split its checkpoint transport payload into 16 MiB
segments. Restore verifies segment and original chunk hashes and reconstructs the
exact original acquisition layout. Exclude superseded payload paths from the
delivery tree; if those objects never uploaded, earlier commits referencing them
cannot be included in the delivery history. Preserve them locally and follow the
handoff's delivery branch. This does not alter the acquisition budget or offsets.
