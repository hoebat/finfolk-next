# Native page migration checkpoint

The agreed destination is fresh development accounts on Supabase Auth, mock external providers, and preservation of current Next.js routes/layouts. Replace functional groups incrementally. Existing account/data transfer and hosted deployment are excluded.

## Implemented foundation

`finfolkbuild.project.page-coverage` inventories every registered page, assigns it to exactly one of ten migration groups, and enumerates model/action/auth/SDK/resource/effect/composition/lifecycle capabilities. Static screens require browser evidence, HTTP resources require request evidence, and build-only entries require artifact evidence.

The inventory rejects missing pages, stale page assignments and duplicate assignments. Native contract readiness requires an explicit native RPC, request shape and result shape; old REST/action declarations do not qualify. The manager exposes the group, required capability count and contract readiness for every page. These are inventory facts, not evidence of a completed migration.

Commands:

- `make page-migration-status`: inspect the machine-readable inventory and native contract gaps.
- `make check-page-migration`: enforce exhaustive assignment and truthful coverage reporting.

Existing logbook verification remains available. No group has been migrated to Supabase Auth or marked complete by this checkpoint.

## Remaining implementation, in dependency order

1. Native RPC request/result schemas, validators, generated UI types and shared DTO adapters. Generate the allowlisted Worker dispatch from the same source; bind actor from verified auth rather than request payloads.
2. Real local Supabase Auth email/password/OTP flows, native UUID user provisioning and fixtures that own/clean up their Auth users. Replace Neon session wiring; retain database authorization and actor/environment cache isolation.
3. Reuse native messaging/provider mocks and generalize the fixture runtime and Next.js preview. The application and verifier must share clients/adapters; remove the logbook-only verifier SDK shim after parity checks pass.
4. Migrate account → community → logbook → directory → events → atlas/sites → posts/trips → social/messaging → finnies → shells/compatibility. For each group: DB rules, RPC contracts, generated backbone/types, saved scenarios, actual screen wiring, browser acceptance, then removal of replaced legacy paths.
5. Expand app.manage with capability-driven execution, group filters and independent contract/RPC/backbone/browser/provider evidence. Missing coverage stays blocked/unverified; edits invalidate evidence.
6. Replace tests that still install removed SQL snapshots with current native fixtures. Track unrelated ocean/VCDEM asset failures separately without weakening their assertions.

Completion requires every registry entry and route accounted for, no unsupported required operation, generated parity/type checks, real local Auth/native DB tests, mock-provider failure scenarios, and browser journeys through the existing screens. Inventory completeness alone never establishes any of these gates.
