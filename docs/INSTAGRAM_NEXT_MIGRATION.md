# Instagram on FinFolk Next

Next owns its own PostgreSQL database, Better Auth service, Hyperdrive binding and Instagram queue/dead-letter queue. Member accounts, sessions, links and historical messages are not copied from the legacy database. Members sign in with Google or email on Next and connect Instagram again with `/connect`.

The API Worker runs HTTP, queue processing and recovery schedules behind the same database-name and immutable SQL-release guard. Instagram identity checks use the existing protected `finfolk_rpc.auth_identity` function; the runtime role does not receive direct auth-table access. Browser operation declarations remain authored in Clojure/XTalk. No database migration or release-hash change is required.

## Addresses and authorization

`api.finfolk.com.au` moves to `finfolk-next-api`. This preserves Meta's existing `/instagram/webhook` and `/v1/integrations/instagram/oauth/callback` addresses. Next also forwards its same-origin webhook path. Private connect/help links use `FINFOLK_PUBLIC_URL=https://next.finfolk.com.au`.

The existing brand Page grant is verified and encrypted again with a fresh Next key, held in Worker secrets. Only brand authorization and pilot settings are transferred. Direct messages retain the existing pilot audience and commands; comments, discovery and publishing stay disabled. New live acceptance must be recorded from Next events.

The API also preserves the existing public privacy/deletion pages and the disabled TikTok registration callback. The callback still does not exchange authorization codes or enable TikTok messaging.

Google uses the existing managed Better Auth provider through the Neon SDK. Its button is enabled in the source and build configuration; the Next and FinFolk domains are trusted callback origins. Never put OAuth secrets in browser configuration.

## Handover

The operator-only `scripts/migrate_instagram_next.mjs` takes an ignored, mode-0600 private JSON input. The local input is `.env.instagram-migration.local.json`; it contains credentials and must never be committed, pasted into issues or logged.

1. `inspect` checks the source/target, actual Meta brand and subscription, and outstanding legacy deliveries.
2. `stage` records a private snapshot and imports only the verified brand grant into disabled Next settings.
3. Deploy Next with ingress paused; verify health, webhook challenge, protected identity reads, Google sign-in and the required local suites.
4. `pause-legacy` requires a drained outbox, disables legacy processing, invalidates unused legacy codes and records a handover timestamp.
5. Activate the Next pilot, which persists `checks.cutoverAt` as the replay boundary, then attach the API custom domain to Next with `wrangler triggers deploy`. `INSTAGRAM_CUTOVER_AT` remains a fallback for isolated tests. Next ingress can be deployed beforehand while its managed mode remains disabled. Verify the domain serves the Next release immediately.
6. Send new pilot `/ping`, `/help` and `/connect` messages. Check seen/typing display and link/unlink/relink from the verified Next account. Older provider retries are ignored rather than replayed into the new database.

The `rollback` action refuses outstanding Next delivery and pauses Next. Restore routing before explicitly restoring legacy processing. Do not replay old messages, codes or uncertain sends. Historical member data remains in the legacy database.

## Checks

Run `make generate`, `make check-generated`, `make test`, `make test-db` and `make build`, plus the Next API Worker dry-run. Publication and timeout tests also revoke runtime auth-schema access. The Next Worker tests cover HTTP/background release guards, independent webhook verification, paused ingress and timestamp filtering.
