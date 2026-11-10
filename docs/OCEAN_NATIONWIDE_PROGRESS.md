# Nationwide coastal acquisition

The nationwide selection remains incomplete. The active runner uses the existing
100,000,000,000-byte cumulative acquisition ledger. The user waived the historical
100 GiB storage reserve; the downloader retains its actual disk safety margin.
Do not reset the ledger or start the legacy broad downloader.

The first nationwide publication snapshot is live at https://finfolk.com.au/map and contains 793 verified native COGs:
VIC 512, NSW 74, QLD 6, TAS 135, WA 25, NT 41, SA 0 and JBT 0. NSW's complete
native-grid rescreen supersedes its three Bondi-only windows. Historical runs and
public releases are retained. Existing numeric Pope's Eye sampling is preserved.
This snapshot is not evidence of complete jurisdiction coverage.

The refreshed GA register contains 3,295 publisher rows. The official jurisdiction
snapshot contains 12,844 polygons. Finalized 2024 DEA shorelines were retained
before review, filtered by good certainty and intersected with official ownership.
Invalid polygons, excluded shoreline features and reference gaps remain recorded.
Every jurisdiction's inventory/reference completeness flag remains false.

The WA custodian inventory contains 1,124 rows. Its unrestricted declared fine-grid
selection contains 927 rows; conservative near-coast screening gives 859 leads.
After canonical URL deduplication and pinned access probes, 707 reachable sources
total 65,383,370,184 bytes; 123 canonical sources have access/probe blockers.
Candidate footprints only rank acquisitions: native masks and every retained
pixel centre still require the final ellipsoidal 500 m verification. Native source
values, masks, grid and compound CRS are retained, without vertical reconciliation.

Acquisition and processing checkpoints live under
`datasets/ocean/coastal/nationwide/`; originals remain in the source acquisition
records and `datasets/raw/ocean/`. The active WA runner advances beyond the
793-COG snapshot. Do not rebuild an index while an export of that index is running.

Commands from the original checkout:

```sh
.venv/bin/python -m scripts.ocean_nationwide inventory
.venv/bin/python -m scripts.ocean_wa_batch --limit 150
.venv/bin/python -m scripts.ocean_nationwide_index
```

The WA batch resumes only unfinished work, keeps scientific review failures
separate from operational failures, and skips acquisitions that exceed the
remaining budget. A source without usable native CRS is withheld. A restricted
or embargoed source is not approved merely because another register lists it.

Jervis Bay's public 2 m archive has been acquired and passed ZIP CRC validation.
Its header and metadata link are retained in `jervis-native-headers.json`.
Four native-only coastal crops have since passed full-cell distance verification
(one JBT, three NSW); vertical units remain unstated. They are withheld from
contours/numeric depth and are not included in this publication snapshot. Southern Kangaroo Island's
expanded reviewed shoreline rescreen retained no valid cells. That result does
not establish the absence of qualifying surveys elsewhere in SA.

Remaining work: finish the ranked guarded acquisitions within the remaining cap;
review additional publisher/ELVIS leads across all seven non-Victorian
jurisdictions; resolve or explicitly retain scientific and access blockers;
verify new crops; publish further immutable releases; and verify their actual
map/download consumers. External territories remain outside this selection.

The original uncommitted application/database work is preserved. Source validation
and frontend publication use `.cache/ocean-release/app-release`. Dataset service
updates reuse the existing public Sites project and retain all prior releases.

Publication receipt: `datasets/ocean/coastal/publication-nationwide-20261110.json`.
Production browser verification passed in VIC, NSW and WA. Hosted directory SSR
returns HTTP 500 on both the previous production deployment and this candidate;
the permanent acceptance test retains its failure, and other hosted route checks
passed separately.

## Second verified publication

The next immutable snapshot is live: **821 COGs**, 64 source groups and 130 map
sources. Counts: VIC 512, NSW 77, QLD 6, TAS 135, WA 49, NT 41, JBT 1, SA 0.
Jervis contributes native-only downloads, with contours/numeric depth withheld
because vertical units remain unstated. All 821 public native URLs passed access,
size and ETag checks; download checksum samples passed in all seven represented
jurisdictions. Production map/browser checks passed in VIC, NSW and WA. Previous
reviewed numeric file descriptors remain unchanged. Receipt:
`datasets/ocean/coastal/publication-nationwide-jbt-20261110.json`.

GA acquisition now supports an explicitly selected URL from the official coastal
footprint screen: `python -m scripts.ocean_ga_batch --url URL`. It reuses verified
registered parts before making requests and canonicalizes only exact native
grid/pixel/mask equivalents, while retaining both original archive members.
Beagle Marine Park 2018 yielded three verified native 1 m coastal crops. Sydney
Harbour 2004 yielded two unique crops; its identical alternate representation
and run are retained outside the accepted-plan registry. These later products
are not yet part of the 821-COG release. WA acquisition has resumed.

The additional official WCS snapshot contains 1,057 coverage discovery records.
The four Adelaide 1 m HS/OV records did not intersect the reviewed SA shoreline
with the conservative discovery margin; these display-layer names do not approve
native numeric data. SA inventories and reference gaps remain unresolved.

## Continued publication and recoverable acquisition

The current map now uses **885 native coastal COGs**, 122 source groups and 170
map sources. Counts: VIC 512, NSW 79, QLD 6, TAS 138, WA 106, NT 43, JBT 1, SA 0.
The 64-COG increase from the previous production snapshot includes the verified
Beagle, unique Sydney and Bynoe Harbour crops. Five source groups remain explicitly
native-only: Jervis NSW/JBT, Beagle, Sydney and Bynoe. No new numeric water-depth
eligibility was introduced; the reviewed Pope's Eye raster remains unchanged.

All 885 public native URLs passed size, hash-ETag, MIME and CORS checks. Exact
download samples passed in seven jurisdictions and for all seven new-source
crops in NT/TAS/Sydney. The coverage archive hash matched. Hosted preview and
production browser checks passed in VIC, NSW and WA. The prior directory HTTP
500 persists on both baseline and candidate; other hosted routes passed.
Receipt: `datasets/ocean/coastal/publication-nationwide-885-20261110.json`.

The previous runner exhausted actual space while writing repeated statewide gap
audits. Transparent filesystem compression reclaimed 28,364,943,360 allocated
bytes, with every logical SHA checked before replacement. Reversible eviction of
verified isolated-checkout runtime copies retained their originals and LFS CAS
objects. Originals and the original dirty app/database checkout were preserved.
Future WA/GA runs optionally compact immutable audit JSON on macOS. Index assembly
keeps only native coverage evidence in memory and caches it against the original
audit SHA; corruption is rejected and the cache has an idempotent reset.

A bounded run may reconsider retained BAGs with actual spacing above 1 m and at
most 5 m as fallbacks. It preserves exact spacing and never rounds these into the
preferred <=1 m tier. Use `--allow-fallback --reuse-only` to refuse all forecast
new source bytes. The BAG eligibility check examines elevation-band scale/offset,
allowing the separate uncertainty band. The first selection attempt incorrectly
expected a single scale entry and acquired additional candidates; that was fixed
and the retained-only run subsequently showed zero received/charged-byte change.
Its later products require coverage review and another immutable publication.

The source cap remains cumulative 100 GB. The user's waived historical reserve
remains waived; actual filesystem safety checks remain active. NSW's official
2018 marine LiDAR metadata states 5 m published grids and 3.4 m marine sounding
spacing; 0.5 m terrestrial spot spacing is not a native 1 m marine grid. Retain
the 5 m fallback classification. SA inventories and jurisdiction reference gaps
remain under review; nationwide completion is still false.
