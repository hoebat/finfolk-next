# FinFolk: fresh Supabase cutover

The owner explicitly chose **new users and a fresh application database** on
26 November 2026 (Melbourne time). Do not import legacy identities, password hashes,
sessions, profiles or pending social publishing work. Existing users must create
a new Supabase account. This decision supersedes the earlier preservation/export
blocker; restoring legacy service quota is no longer required for this cutover.

## Current implementation

- The dedicated SSDNodes Supabase instance is `https://supabase.finfolk.com.au`.
  `api.finfolk.com.au` uses the native schema through a private, TLS-verified
  Hyperdrive connection. Runtime permissions do not include database ownership.
- Production deploy `6b07574884aae18f046d68dd` uses Supabase Auth and native account operations.
  Public configuration includes only the URL and public key, fails closed when
  incomplete, and has no fallback to the retired provider. The release includes the redesigned settings, fixed account widget, guest
  navigation and community feed, and ocean depth shading.
- New email accounts require confirmation. GoTrue submits through private
  Postfix. Recovery uses the SDK's verifier-bound PKCE exchange; the reset screen
  is enabled only by a successful recovery exchange. Normal sign-ins cannot
  enable it through query parameters.
- GitHub sign-in is enabled with the dedicated FinFolk client and passed Brave
  PKCE, native-account, reload and sign-out acceptance. Google remains disabled.
  See `ops/production/OAUTH.md`; other applications’ credentials must not be reused.
- The sourced public catalog contains 2,309 sites and profiles. Attribution and
  existing map/reference delivery are retained. All six release flags stay off.
- Local legacy URLs/settings, obsolete Wrangler configurations and cloud setup/
  release tools have been removed. Four retired SDK dependencies and unused
  Better Auth have been removed; Supabase Auth is pinned explicitly.
- Immutable migration history and local historical-schema test fixtures remain.
  They do not require a legacy cloud connection. Source is committed on `main`. Historical SQL remains byte-identical; local
  archived fixtures adapt its old identity namespace only during execution.
  Preview promotion publishes the verified artifact without rebuilding.

## Retirement acceptance

The hosted preview and production both passed:
email sign-in, persistent preferences after reload, refresh, sign-out, private
Postfix confirmation/recovery, password update, account isolation and deletion;
map rendering; closed feature routes; and no legacy-provider requests. GitHub Actions run `45633242501` promoted the ready, newer, never-published
artifact with a guard against production changing during publication.

Both old Workers' four schedules were removed and both queue consumers detached. Preserve queue contents, dead-letter queues, Meta settings and secret
bindings; do not replay messages or restart social publication. The three old Worker entrypoints now return 410, their workers.dev access is
disabled, and both old Hyperdrive configurations were removed after checking all
account Workers for references. The legacy hostname redirects at Cloudflare; old
DNS answers can persist in recursive caches until their previous TTL expires.
Source-build publishing remains manually controlled; preview promotion is enabled.
The latest source release is `445938e`. Native public community reads, sourced
site-fact contracts, restricted-role execution and published-trip privacy were
verified before release. Dataset fix `854fbc0` restores OpenFreeMap backup tiles.

Archived cloud resources are outside the source cleanup.
Provider-specific local settings were archived encrypted before cleanup. The
Supabase encrypted recovery archive and its private decryption key are stored
separately outside source control. No real-recipient email campaign is part of
acceptance. Existing Microsoft delivery rejection/PTR issues are documented in
`ops/production/MAIL.md`; private SMTP acceptance is not proof of inbox delivery.

Read-only audit:

```sh
node scripts/native_stack_status.mjs --live --output .cache/native-acceptance/status.json
node --test tests/test_native_stack_status.mjs
```

Deployment, signup, browser, cleanup and settings receipts are held privately
under `.cache/fresh-supabase-release`. Never commit credentials or these receipts.

## Verification limits

`make generate` and `make check-generated` pass. The frontend production package,
real Node 22 Lambda bundle, hosted HTTP/browser checks, native API/auth/recovery
unit tests and disposable PostgreSQL RPC test pass. After updating the obsolete
static publication assertion, the generated build and publication checks pass.
The broad `make test` run still has unrelated ocean-audit/VCDEM fixture failures;
the two static-shell failures caused by retirement were corrected and rerun.
No claim is made that the entire dirty working tree passes CI.

The private Postfix test domain, Mailpit container, test account and preview
redirect/CORS exception were removed after production acceptance. The API still
passes readiness and all six flags remain off.

## Recovery acceptance

The fresh encrypted archive was copied off SSDNodes and its SHA-256 matched:
`31d570c84a6138d7f08d58049f998ab692a48681eb161f0a5347d08de16a1360`.
An isolated PostgreSQL 17.11 container with networking disabled restored both
roles and the full database successfully. Validation found all 91 native tables,
2,309 site profiles, the installed native schema marker, zero Auth accounts and
the restricted runtime role; that role could read the release marker. The
container was removed afterward. Initialize a restore with the source bootstrap
superuser `supabase_admin`; a `postgres` bootstrap cannot be demoted to the source
restricted `postgres` role, and PostgreSQL 17 role-grant ownership must match.

This verifies database/global-role recovery. It is not a full DNS, TLS, mail,
Cloudflare tunnel or external-provider disaster-recovery rehearsal. The existing
Microsoft mail-delivery restriction remains unresolved.
