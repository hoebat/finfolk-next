# Publish FinFolk from GitHub Actions

Open [Actions → Publish FinFolk frontend](https://github.com/hoebat/finfolk-next/actions/workflows/publish-frontend.yml),
choose **Run workflow**, select **main**, and run it. This action publishes the
committed main branch to https://finfolk.com.au. Commit and push local changes
before publishing them; files only on your computer are not part of the release.
Pushes and pull requests continue to run checks without publishing.

The workflow reuses the existing generation, test and build workflow. After
those checks pass, it builds with Netlify's production configuration, validates
the packaged output and Lambda runtime, deploys an isolated preview, and runs
the hosted HTTP acceptance checks. Only then does it publish that same build
with `--no-build`. The Actions summary links to the exact deployment and commit.
Production publishes are serialized; an in-progress publish is not cancelled.

The API Worker and database are separate releases. This action does not deploy
Cloudflare Workers, install SQL, change DNS or run database migrations.

## Credential

Configure `NETLIFY_AUTH_TOKEN` as an Actions repository secret or as a secret in
the `production` environment. It must belong to a Netlify operator authorized to
publish project `finfolk` (`fe66fb45-09ab-4e37-8474-3a4f2e162123`). Use a dedicated
publishing identity where available. Rotate the secret when that credential is
replaced. Tokens must never be committed, included in command arguments or
printed in workflow logs. Verification jobs do not receive the Netlify secret;
only the publishing job's credential-dependent steps receive it.

Netlify's existing production environment remains the configuration source.
The CLI is pinned to `27.16.2`. The workflow must be on the repository's default
branch before GitHub displays its **Run workflow** button. No release is
triggered merely by adding this workflow.

## Promote a reviewed preview without rebuilding

Open [Actions → Promote FinFolk preview](https://github.com/hoebat/finfolk-next/actions/workflows/promote-preview.yml),
choose **Run workflow** on **main**, and enter the reviewed Netlify deploy ID and
the current production deploy ID from Netlify. This publishes that exact existing
artifact. Uncommitted local files and later source changes are not included.

The action only accepts a ready preview belonging to FinFolk that is newer than
production and has never been published. It rechecks the production pointer before
publishing, and shares the publishing action's production concurrency group.
It checks the map, Sessions, real account configuration, absence of mock/local
requests and browser errors, and that all six currently disabled features remain
hidden (shop, events, progress, breathing, watch imports and breath check).
These feature expectations must be updated when intentionally enabling them.

The same browser checks run on production afterward. A failed post-publication
check reports failure; it does not automatically revert or publish another deploy.
These frontend checks do not establish backend readiness: the existing API 503
is a separate issue, and authentication and data writes remain unverified.
The action makes no API deployment, database, authentication or DNS changes.
