# Finfolk Coop

Finfolk Coop is at `/shop`. Verified members can spend Finnies on published outlet rewards and retrieve their claim codes in **Your rewards**. Members confirm the price before a purchase. A successful purchase creates a receipt with the original title, outlet, instructions and price; later offer edits do not change it.

Existing participation points and verified referral rewards carry over at 1:1. The wallet imports changes under a per-member lock, so repeated reads cannot award the same points again. Reversed earnings reduce the balance; any debt is settled before subsequent earnings become spendable. Finnies purchases are separate from the existing Stripe cash checkout.

## Publish real rewards

Install `backend/migrations/0031_finnies_shop.sql` with the existing migration runner before releasing the API. Fresh database installations must also apply `resources/finfolkdb/shop.sql`. Both are generated from `src/finfolkdb/shop.clj`; database generation alone does not install SQL. The shop uses its own `finfolk_shop` schema, alongside the existing application schema. No real offers are seeded.

A verified administrator can open `/shop/manage`, create a reward, specify the outlet, Finnies price, optional stock and expiry, and write collection instructions. Check **Published** to show it in the shop. Administrative access uses the existing `INSTAGRAM_ADMIN_IDS` member ID allowlist; the API enforces it independently of the screen. Store operators currently ask a FinFolk administrator to publish their rewards and complete claims.

Members present their claim code to the outlet. An administrator marks the claim fulfilled once the reward is supplied. An unused claim can instead be refunded, returning its original Finnies cost and restoring reserved stock once. Fulfilled claims cannot be refunded. Administrator edits use a revision check so a concurrent purchase cannot be overwritten with stale stock.

The same screen lets administrators award Finnies to an existing member, with a reason. Award and purchase request keys make retries idempotent. Wallet balances and private claims require a live authenticated connection and are excluded from persistent offline caches.

## Verification

- `make test-finnies` runs the application service and ownership checks against disposable local PostgreSQL, including earned points carry-over/reversal, concurrent purchases, last-item stock races, immutable receipts, refunds and account erasure.
- `make test-finnies-neon` runs the same core transaction scenarios directly against the isolated `finfolkdb-test` Neon database configured by `make neon-test-setup`. It temporarily recreates only `finfolk_shop` there and removes it after the run; do not point it at an application database.
- `corepack yarn test:nextjs-finnies` runs browser flow checks against a native Next.js server on localhost:3218 (override `NEXTJS_TEST_URL`). Authentication and catalogue fixtures are local; transaction behavior is covered by the database suite.

The browser suite also checks that signing out hides claim codes and that the shop fits a narrow mobile viewport. Full repository checks remain `make generate`, `make check-generated`, `make test` and `make build-netlify`.

Finnies use a round, spiky pufferfish face with round goggles and crooked teeth. The SVG is colocated with the native shop screen as `finnie-symbol.svg`. It follows the theme colour beside balances and prices; the visible Finnies label remains, and screen readers ignore the decorative mark.
