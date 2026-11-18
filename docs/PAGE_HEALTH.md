# Check rendered pages

Start the local app and API, then run from the repository root:

```sh
corepack yarn check:pages
# Another local server, or just specific pages:
NEXTJS_TEST_URL=http://127.0.0.1:3010 corepack yarn check:pages /account/settings /account/privacy
```

`make check-pages` also scans all static app routes. The checker opens Chromium for each route and flags browser console errors, uncaught exceptions, failed requests, same-origin HTTP errors, empty pages, Next.js error overlays and the application's error screen. It exits nonzero when any page fails, including an error screen returned with HTTP 200. Failures on one route do not stop the scan. It saves full diagnostics in `.cache/page-health/latest.json` and screenshots alongside it.

The default is an isolated guest session with service workers blocked, against port 3010. Supply concrete URLs for dynamic routes printed at the end (for example `/members/<existing-id>`); the checker cannot infer valid IDs. Set `PAGE_HEALTH_STORAGE_STATE` to a locally saved Playwright storage-state file to inspect signed-in pages. Keep that file in `.cache/` because it can contain session credentials. The report records which session mode ran.

This is a page-load smoke check. It waits for page load plus 1.5 seconds of client rendering, and does not exercise every control, delayed interaction or offline service worker flow. Use the existing account and native browser suites for those workflows. A successful guest scan does not establish signed-in coverage.

Run `corepack yarn test:page-health` to verify the detector against a local fixture containing both a healthy page and a handled error screen with console, JavaScript and HTTP failures. This detector test also runs under `make test`; the live scan is explicit because it requires a running app and API.

## App workbench

Open the app workbench (`make manage`, normally http://127.0.0.1:8131). Start the **Next.js development server** under **Servers**, then select **Slices → Live page health → Rendered routes** and **Build**, with **Include checks** enabled. This runs the browser scan against the configured preview origin, including `/people` and `/account/settings`, without rebuilding the database or frontend bundles.

A failing scan records **Failed** on the slice and **Error** for `page-health` under **Checks**. Open the run under **Run history** for the failing URLs and diagnostics; screenshots and the JSON report remain in `.cache/page-health/`. A subsequent passing scan records verified evidence. Source edits mark prior evidence stale. **Generate** and **Check outputs** alone do not run browser checks.

The check scans the running preview as it exists, so a stopped server or an unavailable API fails the check. Start the correct preview and API before rerunning. The result is evidence from the last run, not continuous uptime monitoring; rerun after changing server configuration or data even when sources have not changed. It uses the same preview URL as the workbench (`FINFOLK_PREVIEW_ORIGIN`, the detected running Next server, or port 3010). `PAGE_HEALTH_STORAGE_STATE` optionally selects a saved signed-in session. Native preview and dynamic-ID coverage are separate from this default guest scan.
