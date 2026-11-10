# Nationwide coastal acquisition

The nationwide selection remains incomplete. The active runner uses the existing
100,000,000,000-byte cumulative acquisition ledger. The user waived the historical
100 GiB storage reserve; the downloader retains its actual disk safety margin.
Do not reset the ledger or start the legacy broad downloader.

The first nationwide publication snapshot contains 793 verified native COGs:
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
It is a fallback candidate, with native band semantics still under review; it is
not included in the verified/publication count. Southern Kangaroo Island's
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
