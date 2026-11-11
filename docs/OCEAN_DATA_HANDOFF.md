# Ocean data handoff — updated 8 November 2026

## Next agent: start here

The current coastal acquisition is finished. No collector is running. The user's
preference is useful beach/dive-site bathymetry, ideally around 1m where available,
without collecting deep-sea or entire national datasets. The specific completed
task is Victoria's unblended 2.5m grid cropped to a 500m coastal band, including
bays and islands. This is 500m on **both sides** of the shoreline, not a verified
seaward-only strip. Do not interpret grid spacing as measurement accuracy.

### Machines and version control

- Authoritative payload machine: `zcaudate@goloka.tail15d041.ts.net`.
- Project there: `/Users/zcaudate/Development/greenways/finfolk-next`.
- Originating Mac: `/Users/chris/Development/greenways/finfolk-next`; it has the
  new scripts and metadata copies, not the complete coastal payloads.
- Last checked branches/HEADs: originating Mac `main` at
  `d879835e9493564c95b617187c84ee2478abecdd`; Goloka `fix/sign-in-theme-card` at
  `25f184b874f79fb33b7bfaa52fd4e93f8ea3b7ec`.
- The coastal work is uncommitted and has not been pushed or uploaded to Git LFS.
  The two worktrees differ and Goloka includes older unrelated local changes.
  Inspect before committing; scope staging to the coastal work. Do not overwrite
  the repository or use `git add .` to bundle unrelated changes.
- `.bin`, `.tif` and raw `original.geojson` files already match Git LFS rules.
  That does not mean their LFS objects have been uploaded.

### Completed data and evidence

All paths below are relative to the project on Goloka:

| Item | Path |
| --- | --- |
| 528 compressed native ZIP members, 2,073,909,683 bytes | `datasets/raw/ocean/vcdem-2021-coastal-500m/` |
| 512 numeric COGs, 744,464,503 bytes | `datasets/processed/vcdem-coastal-500m/` |
| Per-member source, checksum, processing and empty-tile records | `datasets/ocean/coastal/vcdem-500m.json` |
| Portable selection with ZIP member offsets, sizes and CRCs | `datasets/ocean/provenance/vcdem-coast-500m-selection.json` |
| Independent verification report | `datasets/ocean/provenance/vcdem-coast-500m-verification.json` |
| Detailed Vicmap coastline and query provenance | `datasets/raw/ocean/vicmap-coastline/` |
| Source registry entry with coastal summary | `datasets/ocean/records/vcdem-2021.json` |

Sixteen selected source tiles are empty/gaps in the band; no substitute depths
were invented. Every compressed source SHA256, inflated source SHA256/CRC32/size,
and COG SHA256/header/valid-cell count passed. All 8,701 independently sampled
valid pixel centres were within 500m of the detailed Vicmap coastline.

The archive is a 39,062,003,888-byte ZIP containing individually retrievable
tiles. Exact HTTP Range requests avoid downloading the full package. The native
tiles are nominally 5km square; the downloader retains the selected compressed
members and writes coastal-band COGs with NoData outside the band. Originals
remain compressed; do not inflate the entire 12.65GB selected ASCII set to disk.

### Remaining work

1. Review source lineage, vertical datum, units/sign and underlying survey
   resolution/accuracy. These are explicitly unverified; file integrity alone
   does not resolve them.
2. Measure actual valid-water coverage around beach and dive sites, retain gaps,
   and decide whether a seaward-only mask is needed. Survey/tile bounding boxes
   do not prove that a particular site has measured seabed values.
3. After that review, register suitable numeric rasters with the runtime
   inventory and implement public serving/tiles and depth lookup with provenance.
   No database, runtime inventory or deployment was changed by this acquisition.
4. Prepare a scoped code/metadata/data commit and Git LFS transfer if requested.
   Make a transfer/storage plan first; the payloads currently live on Goloka.
5. Any search for finer data in other states should target coastal beach/dive
   sites and geographic subsets, using native 0.5–1m surveys where available.

The recommended next step is datum/source review plus valid-water coverage for
priority sites, rather than another bulk download.

### Operations and checks

The cumulative ledger is `.cache/ocean-acquisition/ledger.json`: last checked
45,545,557,683 charged bytes against the persistent 100,000,000,000-byte ceiling.
Never reset or refund it. Retain the 100GiB disk reserve and the coastal runner's
128MiB additional margin. Free space was approximately 100.91GiB at the latest
handoff check and can change; inspect again before writing large files.

The former full-VCDEM partial (5.26GB) and national IMAS partial (3.52GB) were
audited and removed to reclaim space. Completed originals were preserved and the
two old bulk entries excluded. Do not restore those obsolete partials or run
`.cache/ocean-control/start-downloads`. The original bulk stop flag remains set.
There is no reason to restart the completed coastal job. For deliberate repair,
its recovery launcher is `.cache/ocean-control/start-coastal-tiles`; it verifies
completed files and resumes individual source members under the shared lock and
budget. Its own cooperative stop file is
`.cache/ocean-coastal-tiles/stop-request.json`.

Independent verification on Goloka:

```sh
cd /Users/zcaudate/Development/greenways/finfolk-next
.venv/bin/python -m scripts.verify_vcdem_coastal_tiles \
  --plan datasets/ocean/provenance/vcdem-coast-500m-selection.json \
  --coastline datasets/raw/ocean/vicmap-coastline/original.geojson \
  --output datasets/ocean/provenance/vcdem-coast-500m-verification.json
```

Scripts are `scripts/plan_vcdem_coastal_tiles.py`,
`scripts/acquire_vcdem_coastal_tiles.py` and
`scripts/verify_vcdem_coastal_tiles.py`. The 36 focused ocean tests passed on both
machines. `make generate`, `make check-generated`, `make test` and `make build`
passed on the originating Mac without changing tracked application sources.
The separate source catalog metadata validation passed on Goloka (13 records,
114 legacy observed assets); the 528 new members use the dedicated coastal
manifest above and are independently verified there.

For full implementation detail, read
[OCEAN_COASTAL_EXTRACTS.md](OCEAN_COASTAL_EXTRACTS.md). Everything after the current
coastal sections below is historical context, not the current acquisition goal.

## Current coastal scope — 8 November 2026

The user subsequently authorized **Victoria's unblended 2.5m tiles within 500m
of the coastline**, replacing the full-Victoria ZIP acquisition. The authoritative
downloads are on Goloka under `/Users/zcaudate/Development/greenways/finfolk-next`.
Use `.cache/ocean-control/start-coastal-tiles` for this workflow, not the older bulk
launcher. The original computer must not acquire in parallel.

The selection is 528 ZIP members (about 2.07GB compressed). The separate manifest
`datasets/ocean/coastal/vcdem-500m.json` records per-member integrity and cropped
COGs under `datasets/processed/vcdem-coastal-500m/`. Read its live state before
restarting anything. The band includes both sides of the mapped shoreline; datum
and scientific source quality still require review before runtime publication.

The coastal run is now **complete and independently verified**: 528 source
members, 512 COGs (744MB), and 16 empty/gap tiles. Verification checked every
source/output checksum and 8,701 pixel-distance samples. See
`datasets/ocean/provenance/vcdem-coast-500m-verification.json`. No collector needs
to be restarted for the completed selection. Payloads remain on Goloka; local
metadata copies are not a second full payload copy. This work has not been
committed or uploaded to Git LFS.

The older bulk batch remains stopped. Its unfinished 5.26GB Victoria ZIP prefix
was audited and removed to make room; its queue entry is excluded. Completed
originals and the cumulative charged-byte ledger were retained. Do not restore
that superseded partial as part of the coastal workflow. See
[OCEAN_COASTAL_EXTRACTS.md](OCEAN_COASTAL_EXTRACTS.md) for selection, paths, recovery
and verification commands. The historical instructions below describe the older
batch and are not authorization to resume it.

A later disk-reserve stop at 475 coastal tiles was resolved by auditing and
removing the older unfinished 3.52GB IMAS national-grid download. Its bulk entry
is also excluded; see `.cache/ocean-control/imas-bulk-partial-superseded.json`.
No completed originals or cumulative budget charges were removed.

## Historical state and authorization — 6 November 2026

The user paused the acquisition goal and requested all agents stopped. No ocean
downloader is running on the originating computer. This commit/push is a transfer,
not authorization to restart collection, deploy, publish data or change a database.
Restore the checkpoint and inspect the state; wait for an explicit resume request.
Only one computer may acquire this batch at a time. Chat goal state is not Git data.

The objective on resume remains: complete the first native ocean-dataset batch
within its persistent 100,000,000,000-byte budget and 100 GiB disk reserve, seek
representation across eight source groups, verify completed originals and report
completed/pending/blocked assets. No purchases or contacting publishers.

This commit intentionally covers the independent ocean catalog, acquisition and
handoff work. The originating checkout contains extensive separate uncommitted
Next.js, messaging, database-model and environmental-service work. Those changes
are not bundled into this ocean commit. Do not assume the receiving branch has
the uncommitted app/API integrations described in earlier conversation.

## Get the same files on another computer

Delivery branch: **`handoff/ocean-data-2026-11-06`**. It initially carried code
and metadata only; a follow-up adds all completed originals and resumable partials.
Confirm the final delivery message before assuming the payload push is complete.

The first large uploads timed out or restarted after system/lid sleep. One final
checkpoint chunk was therefore repackaged into 62 transport segments of at most
16 MiB. `restore` checks each segment and the original whole-chunk checksum, then
reconstructs the same 1 GiB-or-smaller acquisition chunk. Saved offsets, original
bytes, source validators and the 100 GB ledger are unchanged.

The old full-data commits on the originating computer's `fix/sign-in-theme-card`
branch reference a superseded, unuploaded large checkpoint object. They are retained
locally for recovery; do not use that history for this delivery. The handoff branch
preserves the equivalent data with smaller transport objects and without requiring
the obsolete object. The original unsplit checkpoint copy remains in ignored cache.
Unrelated application/database working-tree changes are still local only.

If a transfer retry is needed on the originating computer, use this delivery branch:

```sh
git lfs push --all origin handoff/ocean-data-2026-11-06
git push origin handoff/ocean-data-2026-11-06
```

Completed remote objects are reused. Keep the computer awake and its lid open
until transfer completes. If bandwidth is limited, copying actual payload files
from `datasets/raw/ocean/` directly is also valid; verify and restore afterward.
Do not reset the budget or discard the local originals.

Git LFS is required for data work. Clone the code/handoff delivery branch:

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone --branch handoff/ocean-data-2026-11-06 git@github.com:hoebat/finfolk-next.git
cd finfolk-next
git lfs install --local
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m unittest discover -s tests -p 'test_ocean*.py'
.venv/bin/python scripts/ocean_catalog.py validate --metadata-only
```

Once the payload follow-up on the same handoff branch has been successfully
pushed, pull that branch, then hydrate/verify/restore (or copy actual payload files
directly from the original computer):

```sh
git lfs pull --include='datasets/**,resources/atlas/**' --exclude=''
.venv/bin/python scripts/ocean_catalog.py validate
.venv/bin/python scripts/ocean_catalog.py verify-acquisitions
.venv/bin/python scripts/ocean_checkpoint.py restore
.venv/bin/python scripts/ocean_catalog.py acquisition-status
```

These ocean commands need Python and the requirements file, not Java, a database
connection, production credentials or a full application build. On Linux the live
process ownership check also requires `lsof`. POSIX file locking is used.

For code-only work while the asset upload is pending, install requirements and
run the ocean unit tests above, then `scripts/ocean_catalog.py validate
--metadata-only`. Full asset verification and checkpoint restoration still require
the materialized originals and checkpoint parts.

Bulk ocean objects are deliberately excluded from default LFS fetches by
`.lfsconfig`; the explicit `--exclude=''` above is necessary. A pointer file is
not the dataset. The transfer contains approximately 8.794 GB of unique new
payload bytes: 4.298 GB of completed originals and 4.496 GB of resumable partials,
plus the repository's pre-existing assets. Leave room for another partial copy
during restore and keep the 100 GiB free-space reserve. Materializing originals
requires additional space.

`restore` checks every checkpoint chunk and refuses conflicting newer local
partials. It restores the ledger before partials and creates a stop request. It
does not start downloads. Acquisition rejects a missing or older ledger when the
portable checkpoint exists. Do not delete/reset the ledger to regain allowance.

## Budget and integrity

The frozen checkpoint has:

- Charged budget: **30,895,411,715 bytes**.
- Remaining allowance: **69,104,588,285 bytes**.
- Completed originals: **10**, totalling **4,297,706,021 bytes**.
- Partial originals: **5**, totalling **4,496,293,888 saved bytes** in seven logical chunks
  transported in 68 files (one logical chunk uses 62 smaller segments).
- `received_bytes_is_lower_bound: true`.

The charged amount is not usable acquired data or an exact measured traffic
count. An older lock-unaware runner previously overlapped replacement runners,
causing raced counters and suspect partials. A conservative historical debit of
24,648,779,756 bytes was retained; the cap was not reset. Accounting evidence is
in `datasets/ocean/provenance/accounting-recovery/`. Later reservations are atomic
and shared across up to four worker threads. Failed reads may overcount safely.

On 7 November 2026 the user requested local cleanup and a lean transfer to Goloka.
The two temporary ocean verification worktrees, reconstructed inspection originals,
unusable quarantined buffers and superseded checkpoint copies were removed after
retaining checksums and audit metadata under `.cache/ocean-cleanup-evidence/`.
All completed dataset parts, current checkpoint transport segments, valid partial
downloads, source reviews, Git history and uncommitted application work remain.
The historical conservative budget debit and live ledger were not reduced.

Completed originals have per-part and whole-file SHA-256 checks. All six completed
ZIP containers passed full member CRC checks. These are locally computed integrity
checks, not necessarily publisher-supplied checksums. They do not establish survey
accuracy or verified datums. Native-header inspection evidence is committed.

## Source status

| Source group | Completed | Pending/paused work |
| --- | --- | --- |
| AusBathyTopo 2026 | National 250 m depth grid, source grid and source list package | Review quality/datum before public use |
| AusSeabed local surveys | Hunter/Worimi 5 m, Port Phillip drift algae 2 m, Merri 1 m, Mudjimba 0.5 m | Lord Mayor/Pitt Shoals partial plus 135 queued candidates |
| Western Australia | Three native BAG survey files | 1,014 queued candidate links; per-product review still required |
| NSW combined bathymetry | Marine LiDAR/MBES native package | Native datum review; no new transfer needed |
| IMAS EEZ composite | Hadal grid | Shallow grid timed out; six other grids queued |
| GBR 2020 | None | 2,399,141,888 / 3,779,796,743 bytes saved |
| Northern Australia 2018 | None | 830,472,192 / 4,370,423,526 bytes saved |
| Victoria VCDEM 2021 | None | 1,031,798,784 / 39,062,003,888 bytes saved |

Other saved partials:

- IMAS `01_shallow_bathy.tif`: 218,103,808 / 23,524,659,971 bytes.
- Local `LordMayorShoaltoPittShoals-HIPP-SI-1042-Bathymetry-30m-2023.zip`:
  16,777,216 / 24,558,084 bytes.

The frozen manifest still labels four interrupted transfers `downloading`; that
is persisted pre-stop state, not evidence of a live process. The IMAS shallow
entry is `blocked` after three read timeouts and is skipped automatically until
reviewed/requeued. Do not interpret it as permanently unavailable.

## Resuming only when requested

1. Complete the LFS hydration, verification and checkpoint restoration above.
2. Check for actual live acquisition processes; do not rely on a runner/PID file.
   The CLI takes an exclusive lock and checks same-worktree Python runners.
3. Recheck the paused sources' size and ETag/Last-Modified. At the last check,
   all five saved partial layouts were valid; the four large publisher files
   had matching source validators and sizes. HTTP 206 and the exact Content-Range
   are required for appending. Never bypass those checks.
4. Review/requeue only the transiently blocked IMAS shallow entry after confirming
   its source identity. Restore must happen before editing the frozen manifest;
   otherwise its checkpoint hash will intentionally fail.
5. Remove `.cache/ocean-acquisition/stop-request.json`, then run
   `.venv/bin/python -u scripts/ocean_catalog.py acquire` once. Do not run discovery
   while acquisition is active: discovery replaces the frozen manifest.
6. Keep the computer awake. macOS logs confirmed lid-closed sleep interrupted
   previous connections; resumed reads may time out before reconnecting.
7. Poll actual process state and the ledger/partial file sizes. A live process
   alone does not prove progress. An observation timeout alone is not a reason
   to spawn another runner. Preserve the ledger and partials across restarts.
8. For another machine move, stop acquisition, verify process exit and export a
   fresh checkpoint. Never run both computers against this budget independently.

At the batch's terminal budget/queue/disk condition, verify all completed originals,
inspect new native packages, audit budget/parts/LFS rules, and write a final report.
The current batch is incomplete and the paused goal must not be marked complete.

## Important source and format findings

- NSW's SEED mirror resolves the native archive. Signed GET redirects can reject
  HEAD; bounded Range probes handle that without retaining signed credentials.
  Planning Portal/SEED mirrors of the same resource are aliases, not two products.
- The NSW 1.686 GB ZIP contains roughly **116.65 GB uncompressed**, with 5 m
  float32 ESRI binary grids `ml_mb_dem0` and `ml_mb_slp`. Only the former is the
  elevation/depth candidate; the latter is slope. Both headers were inspected
  directly through `/vsizip/`; do not blindly unpack. Embedded CRS reports an
  unspecified GRS80 datum; horizontal and vertical datums need review.
- BAGs contain depth/elevation and uncertainty bands. At least one WA header uses
  Instantaneous Water Level Height; do not relabel it AHD or chart datum.
- IMAS is a compilation; advertised grid spacing does not imply equally precise
  measured coverage everywhere. The hadal TIFF was independently re-downloaded
  and matched the stored whole-file SHA-256.
- AusBathyTopo 250 m supplies national context and a source/type grid, not detailed
  surveyed depth at every dive site. Preserve its source-grid lineage.
- Standalone ECW imagery, chart PDFs and video links were excluded from the depth
  queue; exclusions remain listed. Source collections are candidate links, not a
  verified assertion of complete numeric coverage.

## Files and commands

- `scripts/ocean_catalog.py`: sync existing inventory provenance, validate, report,
  discovery, acquisition, status, verification and original materialization.
- `scripts/ocean_acquisition.py`: guarded downloader, shared budget, 1 GiB parts,
  immutable source validators, exact range resumption and atomic manifests.
- `scripts/ocean_checkpoint.py`: offline export/restore of a paused transfer.
- `datasets/ocean/records/`: 13 independent source/product records, checksums,
  acquisitions, review decisions and existing-inventory provenance.
- `datasets/ocean/coverage-targets.json`: 76 regional backlog targets.
- `datasets/ocean/acquisition-manifest.json`: frozen eight-source candidate queue.
- `datasets/ocean/checkpoint.json`: portable ledger and partial manifests.
- `datasets/raw/ocean/<source>/<asset>/`: completed original chunks in Git LFS.
- `datasets/raw/ocean/_checkpoint/<asset>/`: paused chunks in Git LFS.
- `datasets/ocean/provenance/`: publisher discovery and native inspection evidence.

Use `materialize ASSET_ID` to reconstruct a verified original under ignored
`.cache/ocean-acquisition/materialized/`. Never open the `.bin` parts directly as
rasters. QGIS is the recommended desktop viewer; GDAL handles inspection/conversion.

## Public access design discussed, not implemented by this commit

Preserve originals; review licences, CRS, datum, sign, units, NoData and quality;
prepare lossless numeric COGs and regional map tiles/contours; host public assets
on object storage/CDN; keep provenance/version/site associations in a database.
Public depth samples should retain source, resolution, datum and uncertainty.
Do not add tides to depths without verified compatible reference levels.

The user also requested future superadmin access to reconstructed raw originals,
validation and processing history, authenticated resumable downloads and publication
review. A hosted private raw archive, access service and admin console are still
to be built. Git LFS alone does not implement app-level access controls.

No new bulk archives have been imported into runtime inventory or a production
database, and no new public raw-data service was deployed. Earlier environment
migration/service work was present in the originating working tree; its local
documentation reports migration 0030 was applied, but the receiving agent must
independently inspect database state before any future migration or integration.
