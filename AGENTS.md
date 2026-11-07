# FinFolk Next source ownership

Author the backbone and operation declarations under src-app/finfolk_web in Clojure/XTalk. Database sources belong under src/finfolkdb. Generated packages and browser bundles must be regenerated; never edit their JavaScript implementations by hand. Next.js/React pages are authored under js/finfolk-next/site/web-main/app. Legacy DOM/map UI remains under src during staged migration.

Run make generate, make check-generated, make test and make build. Database generation never installs SQL. Migrations remain immutable; this extraction retains the deployed SQL hash. The frontend is being migrated to Next.js on Netlify; keep the API Worker on api.finfolk.com.au. Do not cut over the frontend until all staged acceptance checks pass. The preview hostname is retired.

Do not read dependencies from sibling repositories. ref/foundation is pinned and its own AGENTS.md applies when modifying that dependency. Never commit .env files, .cache, .neon or .wrangler. Retain data attribution and third-party licenses.
