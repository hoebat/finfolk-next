# Main-site production ownership

## Current frontend hosting (7 November 2026)

The native Next frontend is published on Netlify project `finfolk`
(`fe66fb45-09ab-4e37-8474-3a4f2e162123`). Cloudflare remains the authoritative
DNS provider and hosts `api.finfolk.com.au`; frontend publishing does not deploy
the API or install SQL. The apex uses a DNS-only flattened CNAME to
`apex-loadbalancer.netlify.com`; `www` uses a DNS-only CNAME to
`finfolk.netlify.app`. Netlify owns frontend HTTPS and the www redirect.

For a local frontend publish, run from this repository:

```sh
netlify deploy --filter @finfolk/web-main --site fe66fb45-09ab-4e37-8474-3a4f2e162123 --context production --prod
```

The CLI builds the project, including the Next adapter and server functions.
Verify generated-source checks, tests, the packaged server, browser acceptance,
the production pointer, public routes and exact offline assets. Keep the built
Netlify artifact as the asset-verification baseline if another local build runs.
The historical `wrangler.next.jsonc` has no domain routes so it cannot reclaim
the frontend hostnames. The older Worker release instructions below describe
the previous hosting arrangement; use `make deploy-api` only for an intentional,
separate API release.

## Account request lifecycle fix — 8 November 2026

The authored kernel now settles requests owned by a departing page immediately.
Pending reads can move to another client in the same actor scope; unconfirmed
writes are never replayed. A page suspended into the back/forward cache detaches
from the coordinator and rejoins on its next ping. Close every FinFolk tab before
reopening Settings to reset an existing shared worker.

`tests/test_kernel_transport_lifecycle.mjs` reproduces the former 30-second
timeout and verifies read recovery, orphan cancellation, write safety and
suspended-page reconnection. Generated-source checks and the repository test
suite passed. An isolated source release is retained in ignored
`.cache/account-timeout-source`; build with `NETLIFY=true` for Netlify routing.
Its packaged functions and all 355 offline assets passed consistency checks.
The broader local browser checks stalled on the live catalogue response and
did not establish authenticated browser acceptance.

Publication remains incomplete: draft `6af01805e1551af19fe0b561` is missing its
server-function upload after transfer timeouts. Production remains
`6aee52cbc3ba0e8797b143af`. Do not describe the fix as deployed; finish a fresh
source-based release and hosted verification before marking this resolved.

## Historical Worker hosting

`hoebat/finfolk-next` owns the production frontend at `finfolk.com.au` and API at `api.finfolk.com.au`. The internal Next Worker/database names and immutable SQL release are retained. Plain HTTP on the main site and all `www.finfolk.com.au` requests return a 308 redirect to `https://finfolk.com.au`, preserving the path and query. The former preview hostname is removed, without a redirect.

The frontend enables the Clojure-authored `xt.substrate` application backbone and SQLite/WASM workers. Production uses the existing Next Better Auth realm and database; legacy accounts and histories are not imported. Google sign-in remains enabled. Instagram keeps its two-account pilot and existing links; this change does not enable public rollout or TikTok messaging.

## Release and verification

Run `make generate`, `make check-generated`, `make test`, `make test-db`, `make test-browser` and `make build`. Require green GitHub CI, then use the authenticated operator's `make deploy` from this repository. CI publishes the tested production artifact; Cloudflare credentials are not copied into GitHub or source control. The legacy Pages workflow must never reclaim the production custom domain.

Before hostname changes, save Cloudflare domain bindings, public DNS answers, Worker deployment versions and legacy Pages configuration in ignored operator storage. Bind the main site, verify HTTPS/assets and same-origin API forwarding, update backend public links, and only then remove the preview binding/DNS and trusted auth origin. Retain the production and www trusted auth origins.

Check Google sign-in, Instagram connection status, account isolation, check-ins/settings, map/deep links, robots/canonical metadata, API health and signed webhook policy. Confirm the retired `next.finfolk.com.au` hostname has no DNS record or Worker binding. The browser upgrade test exercises the existing network-first shell while preserving IndexedDB maps and local preferences. Existing tabs may need reloading after the release; account and API requests are never stored by the shell worker.

## Legacy frontend

`hoebat/finfolk-app` publishes its static frontend through GitHub Pages at `old.finfolk.com.au`. Its root CNAME and workflow guard must only permit that hostname. Cloudflare holds a DNS-only CNAME from `old` to `hoebat.github.io`; GitHub Pages owns the custom-domain certificate. The main site continues to use the same Worker, Static Assets and API service binding previously used by the Next preview.

The legacy frontend uses its existing shared Next Better Auth realm and `api.finfolk.com.au` configuration. Add `https://old.finfolk.com.au` to managed-auth trusted origins and the Next API CORS allowlist; do not restore the retired legacy backend or database. Verify the legacy config at `/neon-config.json`, API preflight responses and sign-in return URL separately from the main site.

## Rollback

Use the saved Worker deployment versions and domain/DNS snapshot to restore the prior main-site frontend if verification fails. Keep the current Next API, auth realm, database, Instagram generation and connection state. Do not restore old database contents or replay provider messages. Legacy publishing at `old.finfolk.com.au` remains independent; moving it back to the production hostname requires an explicit rollback decision.
