# Australian freediving business pages

The source-backed directory now contains 35 businesses: NSW 11, VIC 6, QLD 8,
WA 7, TAS 2 and SA 1. All 35 are published as unclaimed pages on
[finfolk.com.au/directory](https://finfolk.com.au/directory); production
identities are recorded in `config/directory-businesses-publication.json`.
The authored business batch also seeds the app workbench directory.

The third batch adds Lead by Sea Freediving, Ocean Instinct Freediving,
Salty Hearts Freediving, Dive Free Academy Cairns, One Breath Diving and
Apnea Survival. Official websites support their offerings and locations;
Torquay is a verified Apnea Survival workshop location, not an asserted headquarters.
The original 19 pages and all ten second-batch pages were preserved unchanged.
Six manually reviewed Instagram post references are published on The Pressure
Project and Diving Adelaide pages, with original links and labelled summaries.
The originals and publication identities are recorded in the two
`config/directory-instagram-posts-*.json` files. Automatic collection stays disabled.

The second batch adds Apnea Art, The Pressure Project, Shellharbour Scuba,
Spearaus, Adreno Ocean Outfitters, Abyss Scuba Diving, Liv For The Sea,
Simple Dive, Marlon Quinn and Dive Spear and Sport 1770. Official websites
support each listing's offering and location. Multi-location providers have
one listing rather than duplicate branches. Listings include original summaries
and source links; prices and upcoming dates are deliberately left to operators.

`config/directory-businesses-australia.json` is the authored content batch,
researched on 28 November 2026. Each record has a stable identity, original
summary, location, website and public source links. Twenty-eight Instagram profile
links were read directly from official website links. Deep Sensations Freediving,
OceanSense Freediving, FreediveFNQ and Apnea Australia remain without a confirmed
Instagram link in the first batch. Spearaus and Abyss Scuba Diving also remain without confirmed links. No handles were guessed.

These are unclaimed pages. Source research does not verify ownership,
endorsement, current course availability or Instagram API eligibility. No
business has been contacted. No automated Instagram collection is enabled. ACT and
NT remain coverage gaps for later verified batches. Multi-location businesses
have one page, with their regions summarised rather than duplicate branch pages.

The old `config/directory-australia.json` launch research is retained. Matching
business keys are reused; clubs and personal instructor records were excluded
from this business-focused batch. Adelaide Scuba was left out because the
current course listing labels its freediving description as Sidemount Diver;
that offering needs clarification before adding a freediving page.

The workbench loader is `scripts/lib/preview_business_pages.mjs`. It creates
local public previews and preserves existing matching names, websites, owned,
archived and edited pages. Restarting or resetting the mock preview reloads the
batch without duplicating records. These previews are staged content, not fake
business fixtures. Only the separate Instagram demonstration page has fictional
captions. The explicit production sync publishes the source-backed metadata through the
existing native administrator RPC; Instagram post collection is separate.

Verification passed: 44 content, local example and page-model assertions, plus
a browser journey through the workbench directory and a real business page.
The original-batch browser check confirmed all 19 unclaimed pages, six state filters, website /
Instagram / source links, empty real-post feeds, correct ownership and zero
browser errors. Screenshots and receipts are under `.cache/business-pages`.


Superadmins open **Superadmin** from the account context menu (arrow or right-click)
to reach `/admin/businesses`. The default view shows unclaimed pages, with search,
state/publication filters and an editor for source links, social profiles, details
and publication status. Saves update the live directory directly and retain page
ownership. Revision checks prevent overwriting a newer edit. The server checks
administrator access independently of menu visibility. Ownership verification,
discovery, merge controls and audit history remain at `/pages/review`.

To sync a later reviewed batch, run `scripts/sync_business_directory.py` with
`--host` and `--receipt`. It rehearses inside a rollback transaction by default.
For publication, provide `--apply --backup-receipt <verified-receipt>` after an
encrypted off-server backup. The script calls the audited native admin RPC as the
application runtime role, takes a transaction lock and performs a second pass to
check idempotency. It skips recorded production IDs, matching research keys, normalised names and website
domains, including existing owned, archived or edited pages. It does not assign
owners, send invitations or fetch Instagram posts. The reviewed workbench draft
flags are retained in the authored batch; they do not automatically publish data.

The first production rehearsal exposed missing UUID-extension access for the
application login role. Sync bootstraps only that runtime role's extension access
and search path, refreshing older idle application connections when that setting
changes; it adds no application administrator roles. No database tables,
API code, schema pin or Instagram collector were changed for this release.

Production verification passed on 28 November 2026: real superadmin sign-in,
context-menu access, desktop/mobile saves, guest/member denial, revision
conflicts, all 19 public pages and their links. A final applied sync preserved
all 19 records and created none. Temporary fixtures were removed and the prior
preview origin restored. The release also retains the concurrent settings and
mobile account-navigation changes. Deployment: `6b0a0e1093de1667a194bf94`.

Second-batch publication used a freshly verified encrypted off-server backup,
a rollback rehearsal and the same audited native admin RPC. The rehearsal and
applied transaction each preserved all 19 original pages and created ten new
ones; the second pass preserved all 29. Evidence is under
`.cache/business-expansion`, including official-site snapshots, backup receipt,
publication receipt and public-directory verification. No schema or frontend
deployment is required for directory content publication.

Second-batch verification passed: the paginated live API returns 29 distinct
businesses, all researched document fields match, all pages remain unclaimed,
and the prior 19 public records are byte-for-byte unchanged. Desktop browser
checks cover all six state filters and all ten new detail pages; the mobile
check confirms no horizontal overflow. The refreshed workbench also shows all
29 records and 23 source-linked Instagram profiles with zero browser errors.

Repository generation, generated-source parity, `make test` and `make build` also passed for
this expansion. The app.manage `agent/test` and `agent/verify` wrappers could
not complete because their runner reported `Cannot read properties of
undefined (reading 'kind')`; the focused content, sync, workbench and live
browser checks above ran directly and passed.

Map search integration (source and local preview): the map reads the existing
public directory model without requiring sign-in, follows all directory pages,
and searches business names, categories, localities and state names alongside
dive spots. Business suggestions have a shop icon and an explicit Business label;
selection opens the map detail card and its directory-page link. Unmapped
businesses stay searchable without inventing coordinates. Search failure has a
retry control and does not disable beach search. The landing-page beach search
continues to use its existing beach-only catalogue.

Map business-page navigation uses an ordinary anchor, consistent with directory
links elsewhere in the app. This starts the community page with its own document
styles rather than retaining atlas styles from a Next client transition. The
regression `tests/test_nextjs_map_business_navigation.mjs` follows a real seeded
business from map search through selection and View page, checking readable
layout, website link, no horizontal overflow and no browser errors for guests
and members at desktop and mobile widths. Before/after evidence is under
`.cache/map-page-link`.

The third-batch rollback rehearsals and published repeat checks passed: six new
businesses, 29 preserved businesses, six new post references and zero duplicates
on a second run. Live checks covered all 35 public identities and original links,
plus both post feeds for guests on desktop and mobile, with zero browser errors
or horizontal overflow. Evidence is under `.cache/business-expansion-20261128`.
No schema, Worker, frontend deployment, ownership or credential changes were needed.
