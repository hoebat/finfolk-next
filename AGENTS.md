# FinFolk Next source ownership

Author the backbone and operation declarations under src-app/finfolk_web in Clojure/XTalk. Database sources belong under src/finfolkdb. Generated packages and browser bundles must be regenerated; never edit their JavaScript implementations by hand. Next.js/React pages are authored under js/finfolk-next/site/web-main/app. Legacy DOM/map UI remains under src during staged migration.

Run make generate, make check-generated, make test and make build. Database generation never installs SQL. Historical migrations remain immutable records. Current SQL is generated exclusively from finfolkdb.*; generated .sql files must never be used as source templates or copied to preserve historical output hashes. Publish SQL and JSON as separate targets. The frontend is being migrated to Next.js on Netlify; keep the API Worker on api.finfolk.com.au. Do not cut over the frontend until all staged acceptance checks pass. The preview hostname is retired.

Do not read dependencies from sibling repositories. ref/foundation is pinned and its own AGENTS.md applies when modifying that dependency. Never commit .env files, .cache or .wrangler. Retain data attribution and third-party licenses.

Product names are **FinFolk** and **ChiFolk** in user-facing copy. Code identifiers, namespaces, package names and paths use lowercase `finfolk` and `chifolk`.

<!-- BEGIN app.manage agent-kit -->

## app.manage agent workflows

Read [orientation](./.app-manage/workflows/orientation.md) and the workflow for your task before editing. Repository-specific instructions above remain applicable.

Use `./scripts/agent/context`, `./scripts/agent/plan`, and `./scripts/agent/doctor`. Full-stack changes follow database → typed contracts → xt.db → xt.substrate → runtime/worker → UI → verification. Edit authored sources and regenerate outputs.

Project: **FinFolk**.

<!-- END app.manage agent-kit -->
