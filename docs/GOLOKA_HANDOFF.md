# Goloka development handoff — 7 November 2026

## Development repositories

The application is `hoebat/finfolk-next`, branch
`handoff/goloka-2026-11-07`. It includes the previously uncommitted native Next
app, Atelier navigation, coastal map and contour rendering, community notes,
offline support, page models, database declarations, messaging integrations,
environment tooling, tests and deployment configuration. Some backend features
remain gated or unreleased; this handoff does not install SQL or enable them.

The independent design workspace is `hoebat/finfolk-app`, branch
`handoff/atelier-goloka-2026-11-07`, checked out locally as `finfolk-atelier`.
Keep it separate from the application. It contains the current Atelier and its
source artwork, examples and prototype tools. See its `GOLOKA.md`.

## Clone the application

```sh
GIT_LFS_SKIP_SMUDGE=1 git clone --recurse-submodules --branch handoff/goloka-2026-11-07 git@github.com:hoebat/finfolk-next.git
cd finfolk-next
git lfs install --local
make bootstrap
make check-generated
make test
make build
make dev-nextjs
```

Prerequisites and supported tool versions are in the repository README. The
bootstrap materializes the ordinary build inputs. Bulk ocean acquisitions stay
excluded by default; see `docs/OCEAN_DATA_HANDOFF.md` for their explicit LFS fetch,
verification and checkpoint restoration commands. Ocean acquisition remains
paused; cloning or consolidating these repositories does not resume it.

The application branch starts from the portable ocean handoff history. Its
starting source tree was identical to the prior app checkout, while excluding
the superseded large checkpoint history from the development branch ancestry.
The original branches remain available for recovery.

## Local configuration and recovery

Credentials, `.env` files, `.neon`, `.wrangler`, dependencies and build caches are
not committed. Configure Goloka independently; private local configuration from
retired worktrees is preserved only in restricted local recovery archives.

On the originating Mac, the recovery inventory, checksummed working-file
archives and verified Git bundles are under
`/Users/chris/Development/greenways/.finfolk-consolidation/2026-11-07/`.
The Git bundles preserve historical branches and stashes. Working-file archives
preserve uncommitted source and non-reproducible ignored files, including local
configuration; treat those archives as private and do not publish them.

The legacy repository also retains `archive/legacy-workingcopy-2026-11-07` and
`archive/auth-workingcopy-2026-11-07` for the old main/auth working copies. They
are recovery references, not application deployment branches. The current app
has its own Clojure source and native React implementation; legacy snapshots
must be reviewed before reusing any code.

## Production ownership

The frontend is Netlify project `finfolk`, with `finfolk.com.au` and `www`
pointing to Netlify. The API remains the Cloudflare Worker at
`api.finfolk.com.au`. The last verified frontend release from this session is
`6aee483a5b6da4b3d8b36959`. See `docs/MAIN_SITE_CUTOVER.md` for deployment.
This consolidation does not publish another release or change production data.
