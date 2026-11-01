# FinFolk Next source ownership

Author the backbone and operation declarations under src-app/finfolk_web in Clojure/XTalk. Database sources belong under src/finfolkdb. Generated packages and browser bundles must be regenerated; never edit their JavaScript implementations by hand. The DOM/map UI remains authored JavaScript under js/finfolk-next/site/web-main/src.

Run make generate, make check-generated, make test and make build. Database generation never installs SQL. Migrations remain immutable; this extraction retains the deployed SQL hash. Deploy the Next Workers as the production FinFolk site/API on finfolk.com.au and api.finfolk.com.au. The preview hostname is retired.

Do not read dependencies from sibling repositories. ref/foundation is pinned and its own AGENTS.md applies when modifying that dependency. Never commit .env files, .cache, .neon or .wrangler. Retain data attribution and third-party licenses.
