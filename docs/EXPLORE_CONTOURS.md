# Explore map contour migration

The Explore map now consumes vector tiles made from the existing published
contour data. Original survey GeoJSON, area context and source licences remain
unchanged. This is a display migration; it does not import data into a new
database or change the live API.

`scripts/build_explore_contours.mjs` runs during the existing production static
build. It reads `data/catalog.json` and each area's `detail_file`, including
compressed legacy assets. Local published contours become survey sources;
AusBathyTopo contours become separate regional sources. Metres, vertical datum,
survey dates, attribution, licence and source links are retained. Nonpositive
and missing depths are excluded. Clipping and simplification produce MVT version
2 tiles, with stable content hashes in their URLs.

Each source includes bounded empty tiles, so genuine coverage gaps do not cause
missing-file errors. Survey tiles cover zooms 10–12 and regional tiles 9–10;
MapLibre overscales these at closer zooms. Overscaling adds no measurement detail.
Only sources intersecting the viewport are attached, and only visible tiles are
requested. Moving out of an area releases its sources. Country-wide browsing
does not download all source geometry.

Explore's Layers panel controls published surveys and regional model contours
independently. Solid lines represent published surveys and dashed lines represent
regional model context. Labels display metres. Selecting a line opens its datum,
date, source, licence and limitations; this is not a point-depth measurement.
The existing depth/survey view still provides raster inspection, profiles,
measurement tools and coverage information. Those tools are the next migration
phase; the broad ETOPO1 background colour ramp remains separate from these local
contour sources.

Verification:

- `node tests/test_explore_contours_build.mjs` decodes generated MVTs and checks
  metadata, geometry, compressed input support, empty tiles, determinism and
  source preservation.
- `NEXTJS_TEST_URL=http://localhost:3220 node tests/test_nextjs_explore_contours.mjs`
  checks real WebGL lines, zoom-bounded requests, source inspection, toggles and
  recovery on desktop and phone.

## Coastline and scale handling

The basemap water polygons also define a land mask above contours and below
roads and markers. This hides linework and labels over land, including islands;
unloaded coastline areas stay masked until classified. Land clicks do not open
underlying contour geometry. The original survey coordinates remain unchanged.

The coarse ETOPO1 colour layer fades between zooms 8 and 10, rather than
stretching its grid into artificial close-up bands. Regional model contours
appear below zoom 12. Published contour spacing is 10 m at wider zooms, 5 m from
zoom 13 and 2 m from zoom 16, with fewer labels and lighter minor lines.

`tests/test_explore_coast_mask.mjs` covers water, land, islands and buffered tile
overlap. The browser contour test includes a line crossing a synthetic shoreline
and verifies that its land segment is hidden and cannot be selected.

## Application navigation

The Atelier menu structure is shared by the native atlas and community layouts:
Explore, Community, Events, Practice and You. Explore opens the map; its Browse
places link retains the detailed Discover filters. Community groups People,
Groups & outlets and Finfolk Coop. Practice provides Sessions and explicitly
marks prototype-only tools as unavailable. You groups profile, connections,
pages, settings and the existing account walkthrough. Both layouts share the
same utility menu, focus handling, Escape dismissal and active-section rules.
The three public overview pages have generated route and static offline policies;
no fictional member balances or Atelier URLs are published.
