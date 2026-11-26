# Publish FinFolk from GitHub Actions

Push committed changes to `main`. The **Generate, test and build FinFolk Next**
workflow checks that commit. A successful main-branch push run automatically starts
[**Publish FinFolk frontend**](https://github.com/hoebat/finfolk-next/actions/workflows/publish-frontend.yml).
Pull requests, failed/cancelled checks, forks and checks of an older main commit
cannot publish production.

To publish manually, open that action, choose **Run workflow**, select **main**,
and run it. Manual runs execute the same complete verification workflow first.
Only committed files are included; local files and ignored release snapshots are
not build inputs. Both automatic and manual releases check out the exact verified
SHA. The existing Netlify production configuration supplies public app settings.

The publishing job records the current production deployment, builds once using
Netlify CLI `27.16.2` with production settings, and uploads a draft. The CLI creates
the draft before building so deployment-tagged assets use its skew-protection
token. Package integrity, Lambda runtime, hosted public routes and desktop/mobile
header behavior must pass before publication. The header checks use controlled
signed-in/guest fixtures and make no private backend writes.

Immediately before publication, the workflow requires that main still points to
its commit and production still points to the captured deployment. It promotes
that exact ready draft without rebuilding or uploading a second production build.
The candidate must belong to FinFolk, be newer than production, never have been
published and carry this commit's Actions release title. A newer push or an
out-of-band production release stops an older workflow from overwriting it.

The same hosted checks run against https://finfolk.com.au afterward. The Actions
summary and uploaded `frontend-publish-receipts` link the commit, exact artifact,
previous production and verification reports. A failed post-publication check
reports failure; it does not automatically revert production. Production publishes
and manual preview promotions share one concurrency group and are not cancelled
mid-publication. Superseded queued runs fail the source/pointer checks safely.

The API Worker and database remain separate releases. This action does not deploy
Workers, install SQL, change DNS or run production database migrations. CI database
checks run against isolated local test databases.

## Credentials and settings

`NETLIFY_AUTH_TOKEN` must be an Actions repository secret or a secret in the
`production` environment. It must authorize project `finfolk`
(`fe66fb45-09ab-4e37-8474-3a4f2e162123`). Use a dedicated publishing identity where
available and rotate it when replaced. Never commit or print tokens. Only the
credential-dependent publishing steps receive the Netlify secret; GitHub source
checks use the workflow's read-only `GITHUB_TOKEN`.

The workflow must be merged into the default branch. GitHub Actions owns the
production publishing flow; leave Netlify's separate Git auto-publishing disabled
to avoid a second deployment path. An existing Netlify production lock must not be
silently overridden by a different process.

## Promote an independently reviewed preview

[**Promote FinFolk preview**](https://github.com/hoebat/finfolk-next/actions/workflows/promote-preview.yml)
remains available for an exceptional, already-reviewed preview. Run it on **main**
and supply the never-published candidate ID and current production ID. It uses the
same forward-only guards and production concurrency group, checks the hosted
preview, publishes its existing artifact and verifies production afterward.

Public checks currently require shop, events, progress, breathing, watch imports
and breath check to remain disabled. Update those assertions when intentionally
enabling these features. Authenticated fixture checks verify presentation and
navigation; real OAuth and private data writes require separate acceptance.
