# Native coastal data release

This release preserves the existing 82 map sources and adds 20 independent survey contour sources, derived at native cell centres. All 709 acquired coastal COGs are published with signed values, hashes, source metadata, licences and coverage. Five retained source groups have no drawable below-reference contours.

Vertical references remain source specific and unverified for reconciliation. Native COG downloads are not registered for numeric water-depth sampling. Contours represent elevation below each source reference, without tide adjustment or cross-survey blending. Victoria retains its documented legacy coverage verification; non-Victorian crops passed full-cell shoreline distance checks.

Runtime release: `9c8eed2d09c42080c775a46df8f4006af3b9f15f3edde042c8fcbfc0d4303eca`. Coastal archive: `coastal-c47b919957525ff9`. The dataset service retains old release descriptors. Its immutable coastal alias exposes downloads and provenance under `/v1/coastal/coastal-c47b919957525ff9/`. Tiles use reversible bounded archives by source, zoom and x tile. Packaging preserves existing LFS pointers, changes coastal delivery URLs, and retains geometry and numeric values.

Rollback selects the prior app release pin and rebuilds. Old data releases and saved-region bytes remain available.
