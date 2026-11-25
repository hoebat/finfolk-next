# FinFolk Supabase API — 25 November 2026

The remaining migration and cleanup order is tracked in
[Finish the retired provider retirement](SUPABASE_ACCEPTANCE.md). Database health alone is not
evidence that the frontend, identities or background consumers have migrated.

`api.finfolk.com.au` now belongs to Cloudflare Worker `finfolk-supabase-api`.
It connects to FinFolk's dedicated PostgreSQL 17 Supabase database on SSDNodes
through Hyperdrive, Workers VPC and a private outbound Cloudflare Tunnel.
The database port is bound to localhost. TLS verifies the private CA and hostname;
Hyperdrive query caching is disabled. Auspo's database is separate.

The public Supabase origin is `https://supabase.finfolk.com.au`. All seven
FinFolk Supabase services are running with pinned image digests. Application
schemas are private. New users sign up through Supabase with email confirmation;
legacy users are not imported. See the fresh-user decision in the acceptance guide.

## Release and verification

- Deploy using `wrangler.supabase-api.jsonc`; `make deploy-api` and both package
  API deployment commands now select it. The retired provider configuration has no
  production hostname route. No frontend artifact was rebuilt or published.
- The generated native schema installed after a transaction/rollback rehearsal.
  The Worker checks the native table inventory and installed release marker;
  it does not use the retired provider `backbone_release` marker.
- The runtime login is a restricted member of `finfolk_account`, with explicit
  read access to deployment metadata. No browser role receives this membership.
- The reviewed frontend's 2,309 sourced site names were imported through the
  generated native reference RPC, with stable UUIDs and preserved source keys.
  Map/raster assets remain at their existing serving origins.
- All six release flags are stored as `off`. Anonymous accounts are rejected,
  and disabled routes return `feature_disabled`.
- Hosted acceptance tested real Supabase password sign-in and identity
  verification, persisted native preferences, actor isolation, role injection
  rejection, invalid tokens, deletion and rejection of deleted users. Temporary
  test accounts are removed afterward; no email is sent by these tests.
- The Auth transport was regenerated from Clojure with manual redirects.
  Workers does not support `redirect: "error"`; non-success responses remain
  rejected without forwarding credentials to a redirect target.

Schema fingerprint:
`b9f3ae8a0142cc4954fa37af9e317c57f9038a17d75f2c3410a16cab1f9d0cd5`.

The production configuration and evidence are retained in ignored
`.cache/supabase-api-release` and `.cache/supabase-api-*-verification.json`.
Server credentials remain mode 0600 at `/srv/finfolk/api-runtime.json`;
Cloudflare receives Auth keys as secret bindings. Never print these values.

## Boundaries and remaining migration

This is the native account, site-index and feature-control API. Unported legacy
operations return HTTP 501; there is no fallback to the retired provider or compatibility schema.
The existing public policy pages are retained. Instagram/TikTok queue workers
and their pending work have not been migrated or replayed by this release.

Existing legacy identities and application histories have **not** been imported.
The old project remains retained. The frontend still advertises its existing
the retired provider account configuration; it must receive a separately verified Supabase Auth
release after identity/provider migration. FinFolk Google credentials remain
pending. Passing API database health does not establish existing-user browser
sign-in, Google/GitHub acceptance, or completion of the wider native migration.

## Recovery

An off-server encrypted recovery archive contains the database, roles, signing
and deployment configuration, runtime credentials, private database CA and tunnel
credential. It is at
`.cache/production-recovery/finfolk-supabase/api-cutover-20261125.tar.cms`.
Its separate private decryption key exists only on this Mac, alongside the archive,
with mode 0600. Preserve it in secure recovery storage. Decryption and archive
integrity were checked; a complete isolated restore and scheduled WAL/PITR backups
remain separate work before completing the existing-account migration.
