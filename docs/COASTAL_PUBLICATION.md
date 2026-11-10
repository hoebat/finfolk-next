# Native coastal data release

This release preserves the existing 82 map sources and adds 20 independent survey contour sources, derived at native cell centres. All 709 acquired coastal COGs are published with signed values, hashes, source metadata, licences and coverage. Five retained source groups have no drawable below-reference contours.

Vertical references remain source specific and unverified for reconciliation. Native COG downloads are not registered for numeric water-depth sampling. Contours represent elevation below each source reference, without tide adjustment or cross-survey blending. Victoria retains its documented legacy coverage verification; non-Victorian crops passed full-cell shoreline distance checks.

Runtime release: `9c8eed2d09c42080c775a46df8f4006af3b9f15f3edde042c8fcbfc0d4303eca`. Coastal archive: `coastal-c47b919957525ff9`. The dataset service retains old release descriptors. Its immutable coastal alias exposes downloads and provenance under `/v1/coastal/coastal-c47b919957525ff9/`. Tiles use reversible bounded archives by source, zoom and x tile. Packaging preserves existing LFS pointers, changes coastal delivery URLs, and retains geometry and numeric values.

Rollback selects the prior app release pin and rebuilds. Old data releases and saved-region bytes remain available.

## Publication verification — 10 November 2026

The dataset service is live at https://datasets.finfolk.com.au (Sites version 7, source `f8508f07c3de27a084da05ec779145e90c6b75a6`). The frontend production deployment is `6af271fc312c60cf8dadee1c`, serving https://finfolk.com.au/map. The durable source tag `ocean-coastal-2026-11-10` retains the data commit `5bec816eb38b28b772e9e9d181a7f6f019118a79`.

All 2,050 unique release LFS objects (1,635,241,094 stored bytes) were acknowledged before service publication. Every one of the 709 public native COG URLs passed HEAD, content type, size and ETag checks; downloaded COG hashes were checked in VIC, NSW, QLD, TAS, WA and NT. The public coverage archive matched its complete source SHA-256. All native COGs have scale 1, offset 0 and one retained elevation band. The original source archives remain separate.

The isolated checkout passed `make generate`, `make check-generated`, `make test` and `make build`, plus release/MVT integrity tests, the official Netlify adapter build, and packaged-output checks covering 355 exact offline assets. The hosted preview passed SSR, route, geography, compression and offline-header acceptance. The live dataset service passed compression, CORS and exact tile checksum checks. Browser traces on the production map confirmed the new 709-COG catalogue, all 102 source descriptors, and native coastal MVT responses with source attribution and signed elevations.

Per-COG contour checkpoints include the raster hash; earlier source-level checkpoints link to the source collection metadata and its COG hashes. Neither representation asserts a verified vertical reconciliation.
