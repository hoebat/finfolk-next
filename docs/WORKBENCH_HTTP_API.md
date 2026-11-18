# App workbench HTTP API

Start `make manage`. The standard `app.manage.server` serves the UI and API at
http://127.0.0.1:8131. FinFolk enables it through `:http-api` in
`src/finfolkbuild/project/management.clj`; the reusable implementation belongs to
Foundation. After changing Foundation, reinstall `xyz.zcaudate/app.manage` locally
as described in [APP_MANAGE_INTEGRATION.md](APP_MANAGE_INTEGRATION.md#local-maven-installation)
and restart the workbench.

The OpenAPI document is available at `/api/v1/openapi.json` and reflects project
configuration. `GET /api/v1/checks` lists checks, named actions and recorded slice
evidence. To run a page check using HTTP:

```sh
TOKEN=$(curl -fsS http://127.0.0.1:8131/api/session | jq -r .token)
curl -fsS -X POST http://127.0.0.1:8131/api/v1/actions/page-health/runs \
  -H "X-App-Manage-Token: $TOKEN"
# Use the returned id:
curl -fsS http://127.0.0.1:8131/api/v1/runs/RUN_ID
```

Poll until the run's status is `ok` or `error`. The run result contains the same
check stdout, stderr and exit code used by the workbench. Both API and UI share
one queue and run history. The API starts checks against the running preview; it
does not start the preview or API backend for you.

```sh
# Latest report and a screenshot named in it:
curl -fsS http://127.0.0.1:8131/api/v1/artifacts/page-health-report
curl -fsS http://127.0.0.1:8131/api/v1/artifacts/page-health-screenshots/failure-1.png -o /tmp/page-failure.png
```

The report is the latest scan, not a run-specific snapshot. Inspect `checkedAt`
and retain results if needed. Run IDs and history are process-local and bounded;
404 means the ID is unknown or expired. POSTs require the current session token;
missing/invalid tokens return 403. These local endpoints do not enable CORS.

A small Node client manages token retrieval and polling:

```sh
node scripts/workbench_client.mjs checks
node scripts/workbench_client.mjs check-pages
node scripts/workbench_client.mjs runs
node scripts/workbench_client.mjs run RUN_ID
node scripts/workbench_client.mjs report
```

Set `WORKBENCH_URL` for another local port. `check-pages` exits nonzero when the
scan fails. For AI tooling, import `workbenchClient` from the same module and use
`checkPages()`, `wait(id)`, `run(id)`, and `report()`.

`POST /api/v1/runs` accepts existing workbench action JSON for operations allowed
by `:http-api :operations`. For example, `{"operation":"build","slice":"page-health","stage":"browser","tests":true}`
runs the same page-health stage. `check` only compares generated outputs; use
`build` with `tests: true` to execute checks. Named actions keep this detail in
project configuration so AI clients can call them consistently. The configuration
can expose fixed actions alone by omitting `:operations`, or disable the
versioned API with `:enabled false`. Existing UI endpoints remain available.
