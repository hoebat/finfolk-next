# Coastal bathymetry: partial retrieval investigation

Checked 8 November 2026. Scope: beach and dive-site extracts, preferably native
0.5–1m bathymetry, with coarser coastal products as fallbacks.

## Confirmed: Victoria's large ZIP supports selective tile retrieval

Source: [VCDEM 2021 publisher record](https://discover.data.vic.gov.au/dataset/victorian-coastal-digital-elevation-model-2021-vcdem-250cm).
Direct package: `https://cl-isd-prd-datashare-s3-delivery.s3.amazonaws.com/PrePackages/VicCoastDEM2021_250cm.zip`.

Live HTTP Range requests returned 206 with matching Content-Range. The archive is
39,062,003,888 bytes. Its ZIP64 central directory is 13,474,141 bytes and contains
74,467 entries, including 18,596 ASCII grid files across several product variants.
Those counts include overlapping representations, not unique survey footprints.
There are also four large TIFFs, overviews and supporting metadata. The package
is not just one indivisible raster.

A test retrieved two adjoining `Tiled_NoBlend/Z55` ASCII members around the
example Portsea coordinate 144.713, -38.32:

- `VCDEM_GDA2020z55_250cm_Gaps_e2999_n5760.asc`
- `VCDEM_GDA2020z55_250cm_Gaps_e2949_n5760.asc`

Both members decompressed independently and passed their ZIP CRC32 checks.
The two test requests transferred 10,571,810 bytes including header-read overhead,
excluding archive-index discovery. Each native tile is 2000 × 2000 cells at 2.5m,
covering 5km × 5km. A 2km × 2km extract is 800 × 800 cells and compressed to
1,099,996 bytes. Reopening the GeoTIFF confirmed dimensions, spacing and bounds.
637,970 of its 640,000 cells have source values; 248,062 values are negative.
Negative values alone are not a verified ocean mask.

This demonstrates selective retrieval and local cropping, not independently
measured 1m bathymetry. The example includes land. Horizontal CRS EPSG:7855 was
assigned from the GDA2020 zone-55 filename and checked against the accompanying
MapInfo TAB projection. Vertical datum, source provenance within the tile, quality
and water-only masking still require review before app use. Product names such as
`NoBlend` and `Gaps` were subsequently checked against the package README: these
retain source gaps, while the blended product fills gaps. Tile filename coordinates must be verified against native
headers; they are not exact lower-left coordinates.

## Other retrieval routes

- AusSeabed documents geographic GeoTIFF extraction in its
  [portal guide](https://www.ausseabed.gov.au/__data/assets/pdf_file/0011/95888/AusSeabed-Portal-User-Guide_v.03.pdf).
  A live WCS capabilities request returned part of its inventory but timed out.
  A guessed Merri coverage identifier returned 404. No numeric-depth WCS extract
  was verified in this investigation. Discover the actual coverage identifier and
  check band semantics: advertised hillshade/overview layers are not sufficient
  evidence of numeric-depth access. The guide's document-control dates are
  2020–2021; it does not prove current operation for every dataset.
- Victoria DataShare's public page and metadata show VCDEM is orderable. General
  geographic ordering support does not yet prove that VCDEM has a working
  server-side clipping order. No order was submitted.
- Direct remote COG window reads remain a useful route where actual public COG
  URLs and range support can be established. A COG compressed inside an ordinary
  ZIP is not automatically efficient to read by geographic window. See
  [GDAL virtual filesystem documentation](https://gdal.org/en/stable/user/virtual_file_systems.html).
- WA survey BAG downloads remain candidates for selecting small survey footprints;
  geographic window retrieval inside their HDF5 layout was not tested here.

## Proposed acquisition behavior

1. Start from reviewed beach/dive-site locations and small coastal areas of interest.
2. Discover survey footprints and native spacing; prefer 0.5–1m, retain 2–2.5m as
   explicitly labelled fallbacks. Never resample coarser data and label it native 1m.
3. Prefer verified numeric clipping services, direct remote raster windows, or
   independently retrievable intersecting tiles. Deduplicate tiles shared by sites.
4. For VCDEM, cache the ZIP64 index keyed by source size and immutable validator;
   retrieve only required members. Check 206/Content-Range, source validators,
   size limits and member CRC; retain SHA256 and source/member provenance.
5. Verify native headers and valid-water coverage; crop and write numeric COGs,
   retaining datum, units, acquisition dates, resolution, licence and source gaps.
6. Download full packages only when a verified partial route is unavailable and
   the package is justified by the selected coastal sites.

Evidence and example output are local research files under
`.cache/coastal-extract-investigation/`: `vcdem-zip-directory.json`,
`vcdem-central-directory.bin`, `portsea-test.json`, `portsea-tile.TAB`, and
`portsea-2km-extract.tif`. Cache files are not versioned or registered as runtime
datasets. Exploratory network traffic is outside the acquisition ledger. No
collector was started, stopped or reconfigured, and no acquisition queue changed.

## 500m coastal acquisition (8 November 2026)

The subsequent user-authorized implementation uses a detailed Vicmap coastline,
not the app's Natural Earth display coastline. The public
[State Boundary and Coastline layer](https://corp-gis.mapshare.vic.gov.au/arcgis/rest/services/VicmapBasemap/VicmapBasemapScaleUpTo800/MapServer/18)
was queried with `FEATURE_TYPE_CODE='coast'`. All 10,342 features were retrieved
with pagination, and the total and unique object-ID counts agreed. State-border
and map-boundary lines are excluded. Source geometry is longitude/latitude;
selection distances use MGA2020 metres separately in zones 54 and 55.

The unblended tile selection contains 528 members, totalling 2,073,909,683 bytes
compressed (about 2.07GB), versus the 39.06GB full package. Inflating every full
ASCII tile would require 12,649,682,450 bytes; instead, the downloader inflates
one tile per worker in memory and retains compressed source members plus cropped
COGs. At most four workers run concurrently. Tile selection is conservative for
truncated edge tiles. Tiles with no source values in the band are recorded as
empty rather than turned into fabricated depth grids.

The output band is **500m on either side of the mapped coastline**, including
bay and island shorelines; it is not a seaward-only mask. Pixel centres outside
the band become NoData. Horizontal grid spacing and source origin are retained.
Land/water classification, vertical datum and underlying survey quality remain
unverified. These files are not registered in the app's runtime raster inventory.

Scripts:

- `scripts/plan_vcdem_coastal_tiles.py`: offline selection and byte estimate.
- `scripts/acquire_vcdem_coastal_tiles.py`: exact HTTP Range retrieval, resume,
  ZIP CRC and SHA256 checks, and coastal-band COG production.
- `scripts/verify_vcdem_coastal_tiles.py`: independent source/output integrity,
  COG header and valid-cell checks, plus metric distance samples.

On Goloka, under `/Users/zcaudate/Development/greenways/finfolk-next`:

- Launcher: `.cache/ocean-control/start-coastal-tiles`.
- Log: `.cache/ocean-control/coastal-tiles.log`.
- Per-tile source bytes and ZIP provenance: `datasets/raw/ocean/vcdem-2021-coastal-500m/`.
- COGs: `datasets/processed/vcdem-coastal-500m/`.
- Non-DB acquisition/processing manifest: `datasets/ocean/coastal/vcdem-500m.json`.
- Detailed coastline source and query provenance: `datasets/raw/ocean/vicmap-coastline/`.
- Portable tile plan: `datasets/ocean/provenance/vcdem-coast-500m-selection.json`.
- Cooperative stop flag for this runner: `.cache/ocean-coastal-tiles/stop-request.json`.

The full bulk collector was already stopped at its protected disk reserve.
Its unfinished 5,259,657,216-byte Victoria ZIP prefix was removed after a
per-part size/SHA256 audit was saved to
`.cache/ocean-control/vcdem-full-archive-superseded.json`. Its bulk manifest entry
is excluded, completed datasets are unchanged, and its existing stop flag remains
intact. No transfer charges were refunded. Do not restore the obsolete full-ZIP
partial or restart the bulk launcher as part of this coastal workflow.

At 475/528 tiles, free space fell below the reserve again and the coastal job
stopped safely. The unfinished 3,523,215,360-byte IMAS national shallow-grid
download from the older bulk batch was then audited and removed, and its queue
entry excluded under the coastal-only scope. Audit:
`.cache/ocean-control/imas-bulk-partial-superseded.json`. Completed originals and
the charged-byte ledger were again unchanged. The coastal run resumed using its
verified per-tile checkpoints. Neither superseded bulk partial should be restored
as part of this workflow.

The coastal runner takes the same exclusive acquisition lock, guards the portable
checkpoint's ledger floor, uses the same durable cumulative transfer ledger and
100GB transfer ceiling, and retains the 100GiB disk reserve plus a 128MiB margin.
It requires the inspected ZIP size and ETag, checks every exact Content-Range,
and refuses HTTP 200 responses instead of accidentally downloading the archive.
The `.bin` sources and `.tif` outputs match the repository's existing Git LFS
rules; actual Git LFS staging/upload is a separate operation.

Validation: 36 focused ocean tests passed locally and on Goloka, including concurrent budget
accounting, rejected full-download responses, checksum failures, metric tile
selection, coastal-band pixel placement and transient network retry behavior.
Completed outputs were independently checked with:

```sh
.venv/bin/python -m scripts.verify_vcdem_coastal_tiles \
  --plan datasets/ocean/provenance/vcdem-coast-500m-selection.json \
  --coastline datasets/raw/ocean/vicmap-coastline/original.geojson \
  --output datasets/ocean/provenance/vcdem-coast-500m-verification.json
```

## Completed and independently verified

Acquisition finished on Goloka on 8 November 2026. Verification completed at
09:15 AEDT (7 November 22:15 UTC):

- All 528 selected compressed members: 2,073,909,683 bytes; every compressed
  SHA256, inflated SHA256, size and ZIP CRC32 passed.
- 512 coastal-band COGs: 744,464,503 bytes (about 744MB); every output SHA256,
  size, native 2.5m spacing, CRS, COG layout and valid-cell count passed.
- 16 tiles have no usable source values in the selected band, or truncated source
  extents outside it. They remain explicit empty/gap records.
- 8,701 valid pixel-centre samples were independently checked against nearest
  Vicmap coastline geometry; all were within the 500m metric limit.
- About 104.69GiB remained free. The cumulative charged-byte ledger was
  45,545,557,683 bytes; the earlier batch charges were retained.

The checked report is
`datasets/ocean/provenance/vcdem-coast-500m-verification.json`. The registry entry
`datasets/ocean/records/vcdem-2021.json` references the completed coastal scope.
The overall source review remains partial because scientific datum/quality review
and application raster registration remain pending. Files are on Goloka; local
metadata copies do not imply that the originating Mac has all payload files.
No database, runtime raster inventory, deployment, Git commit or Git LFS upload
was performed for this acquisition.

Repository checks also passed: `make generate`, `make check-generated`,
`make test`, and `make build`. Generation/build did not change tracked application
sources.
