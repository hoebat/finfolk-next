# Beach web content

Explore map results and survey beach details share `BeachWebContent`. It reads the selected published catalog site, the authored `beach-web-sources.js` registry, and existing reviewed `src/social.json` posts. No database migration, provider credentials or background scraping are required.

Beach panels show available media inline. Reviewed Instagram posts embed automatically, licensed photographs load lazily without a click gate, and authored YouTube IDs render in the official privacy-enhanced player without autoplay. Port Melbourne Beach includes WANDER’s beach walking tour (video metadata and embed eligibility checked with YouTube oEmbed on 26 November 2026). Search-result page links have been removed from the panel; search pages themselves are not used as frames.

`BeachPhotoResults` calls Wikimedia Commons’ public geosearch/imageinfo API directly for coastal photographs within 1.2 km of the selected catalog coordinates. It renders at most four JPEG/PNG/WebP thumbnails, requires a Creative Commons BY/BY-SA/CC0/public-domain licence and creator credit, and accepts only Wikimedia image/file origins and Creative Commons licence origins. Metadata is rendered as text. These are explicitly nearby images, not an assertion that every image depicts the exact beach. Results are cached in browser memory for one hour (40 locations maximum); switching beaches aborts old requests. Loading, empty and retry states remain visible. This requires no search-provider key or new backend endpoint.

The initial reviewed source collection is Becher Point, WA. Reviewed Instagram associations cover Bondi, Hyams, Whitehaven, Lucky Bay, Hellfire Bay, Brighton (Victoria) and the Surfers Paradise area. Regional material retains nearby labels. This is not a claim of live Instagram or YouTube search coverage for the entire catalog.

To add a collection:

1. Verify the exact location against the native catalog. Record native site IDs, state, explicit name aliases and a tight geographic bounding box. Name fallback requires both state and coordinates; do not match a namesake or every beach in an area.
2. Open each original source. Record its title, publisher, a short original summary, URL, review date and `beach` or `nearby` association. Inland wetlands, regional guides and nearby pools need the nearby label. Retain proof of social location in `association_source` in `social.json`.
3. Link to copyrighted images rather than copying them. A reusable image needs a verified licence, credit, licence URL and original source link. The initial Becher photograph is Calistemon’s July 2023 photograph, CC BY-SA 4.0, displayed unmodified with attribution.
4. Reuse `socialPostURL` and `PostCard` for supported Instagram/X posts. Never accept arbitrary embed HTML. The beach panel embeds known posts and photographs directly, with original source links retained when providers block or remove content.
5. Run `node --test tests/test_beach_web_content.mjs` and `node tests/test_nextjs_beach_web_content.mjs` against the local preview, `node --test tests/test_beach_photo_results.mjs`, followed by required repository checks. Inspect desktop/mobile and all four appearance themes.

The catalog source is location provenance and may be a registry homepage. It is labelled separately from reviewed beach articles. Historical imagery and descriptions are not current water conditions.
