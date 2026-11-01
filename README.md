# FinFolk Next

The Clojure-authored database and substrate backbone for [next.finfolk.com.au](https://next.finfolk.com.au). This is the source of truth for Next development. The `hoebat/finfolk-app` implementation remains a frozen legacy copy; it is not a build dependency.

## Source and output

| Authored source | Generated output |
| --- | --- |
| `src/finfolkdb` | `resources/finfolkdb/pilot.sql` and browser RPC contracts |
| `src-app/finfolk_web/groups` | The 103-operation browser registry, including HTTP bindings and invalidation domains |
| `src-app/finfolk_web/lib` | `js/finfolk-next/packages/edge`: actor lifecycle, substrate models, xt.db cache, application state and public HTTP adapter |
| Pinned `ref/foundation/src-lang` | Required `@xtalk/*` workspace packages under `js/finfolk-next/packages/libs` |
| Existing JavaScript in `js/finfolk-next/site/web-main/src` | The DOM/map site and versioned browser bundles |

The backbone implementations are written as genuine `l/script :js` Clojure declarations. Emitted JavaScript is not handwritten or loaded from an old JavaScript implementation. `next-backbone.js` and `app-backbone.js` are esbuild bundles of that emitted code. The shared runtime remains in memory; this migration does not introduce SharedWorker/SQLite or convert the DOM UI to React.

The table declarations retain the StatsDB-style domain layout. The deployed SQL slice contains profile/check-in and identity functions. Table default/constraint metadata remains an inventory, not a replacement for the full migration history. All existing migrations and the SQL release hash are preserved. The SQL header retains its historical generator label to preserve those exact bytes.

## Setup and workflow

Use JDK 27, Leiningen 2.12+, Node 22+, Corepack, Git LFS and Python 3.12 (3.13 is also supported). The root Yarn 4.9.4 workspace contains the generated application tree under `js/finfolk-next`. Foundation is pinned by commit and version; no sibling StatsTrade checkout or private secrets repository is required.

```sh
git clone --recurse-submodules https://github.com/hoebat/finfolk-next.git
cd finfolk-next
make bootstrap
make check-generated
make test
make build
make dev
```

`make bootstrap` installs Foundation from its pinned source, installs the immutable Yarn dependencies, creates the Python environment and emits the packages. `make generate` regenerates all SQL, contracts, runtime modules and browser bundles. `make check-generated` regenerates in a temporary directory and compares every generated artifact. Generated files are committed for review; edit their Clojure source instead.

`make dev` serves on port 8000. It watches Clojure sources and regenerates their modules; reload the browser after generation. DOM/CSS edits are served directly, while atlas inputs come from the built site. Account access uses the separate Next API/Auth service; local origins must be trusted by that Auth service. Public browsing and fixture tests do not require credentials.

## Data and verification

Public survey sources are stored in Git LFS. The frozen national directory and coastline inputs are under `resources/atlas`; a fresh clone can reproduce the public site without a developer's cache. Existing publisher attribution, metadata and survey limitations are retained. To refresh upstream sources deliberately, use the acquisition scripts; normal builds do not refresh them automatically.

`make test` runs Clojure contract/release checks, Python atlas tests, and the existing generated-runtime, SQL/API and desktop/mobile UI tests. Tests cover cache keys, concurrency, invalidation, committed-write refresh failures, authentication changes, navigation/history, public forwarding, member actions and admin restrictions. External Meta messaging remains governed by its existing feature switches.

## Preview deployment

```sh
make deploy
```

This builds and deploys only `finfolk-next-api` and `finfolk-next-site`, retaining the existing `next.finfolk.com.au` domain, isolated Neon branch/database/Auth service and Hyperdrive binding. The current machine's Wrangler login can be reused. GitHub Actions runs generation checks, tests and builds; it does not deploy automatically or need Cloudflare credentials.

After deployment check [preview health](https://next.finfolk.com.au/_next/health), public routes, account/profile/check-in behavior and sign-out. Rollback uses the preceding Next Worker versions. The production FinFolk site/API are not deployed by this repository.

No SQL installation is performed by generation or ordinary site deployment. For an intentional database release, create a new immutable migration, update release hashes together, and use `make db-release` with ignored `.env.next.local`. That command refuses another database or endpoint. Copy `.env.example` only as a starting point; never commit real credentials. Provider secrets remain in Cloudflare bindings/secrets.

`resources/migration/source.json` records the original source revision and imported working-copy hashes. The empty GitHub repository received a new initial history; the original working tree, its changes and its older worktrees were preserved.
