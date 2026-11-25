# FinFolk production infrastructure

## Live migration — 26 November 2026

FinFolk Supabase is now running on this host. The live API uses the dedicated
`finfolk-supabase-api` Worker and private TLS-verified VPC/Hyperdrive connection.
The native schema and sourced site index are installed; all six release flags
are off. See [API release status](../../docs/SUPABASE_API_CUTOVER.md) for verification,
recovery and verification. The owner chose fresh users, and the Supabase-only
frontend is live. See [OAuth setup](OAUTH.md) for Google/GitHub credential
handoff and [mail remediation](MICROSOFT_DELIVERY_REMEDIATION.md) for the
remaining Microsoft block. Provider sign-in and external inbox delivery must
not be described as verified yet.

## Historical preparation notes

Target: `root@66.63.172.196`. Frontend remains on Netlify; application API remains
on Cloudflare. Map datasets remain on their existing hostname.

Hosting confirmed: `finfolk.com.au` stays on Netlify, `api.finfolk.com.au` stays
on Cloudflare, and only `supabase.finfolk.com.au` moves to this Docker host.
Do not repoint the website's DNS or package a website container for this release.

The complete pinned upstream Docker directory and prepared bundle are now on
the server under `/opt/finfolk/upstream` and
`/opt/finfolk/releases/supabase-v0.8.4-1`. Fresh symmetric and asymmetric keys
were generated server-side, with `.env` permissions verified as 0600. Production
URLs were configured. At this preparation stage Supabase itself had not started. Direct Postfix, the private
mail gateway and Traefik are running; mail DNS records are published. See
[mail operations](MAIL.md) for verification and remaining PTR/inbox checks.
Google credentials remain pending; no third-party mail provider is required.

## Bootstrap status recorded before the API connection

This directory prepares deployment configuration; it is **not a completed
production deployment**. Never start the upstream default Compose file: it
publishes the dashboard and pooler. Use the prepared production file instead.
The bootstrap package update and kernel reboot completed. The in-place upgrade
to Ubuntu 22.04.5 completed, followed by a verified reboot into kernel
5.15.0-204-generic. SSH, IPv4/IPv6 addresses, system services and the package
audit passed before the next stage.

The upgrade to **Ubuntu 24.04.5 completed**, including obsolete-package cleanup
and a verified reboot into kernel **6.8.0-151-generic**. SSH recovered after
temporary unavailability during package installation. The post-reboot package
audit, SSH configuration and system-service checks passed, both IP addresses
were retained, and no further reboot was required. Docker Engine 29.10.0 and
Compose v5.8.0 were installed using `install-docker.sh`; the daemon and a pulled
`hello-world` container passed verification. The install exit status is 0.
The install log is `/var/log/finfolk-docker-install.log`, and exact package
versions are saved in `/var/backups/finfolk-bootstrap/docker-versions.txt`.
Public listeners are SSH, HTTP and HTTPS. SMTP, database and Docker administration
ports are not published. The website remains on Netlify.

Upgrade logs: `/var/log/finfolk-noble-terminal.log` and `/var/log/dist-upgrade`. The verified
upgrader lives at `/var/backups/finfolk-bootstrap/noble-upgrader`. The completed
22.04 logs are retained under `/var/backups/finfolk-bootstrap/upgrade-22-logs`.

Implemented: pinned Supabase bundle transformation, private service topology,
Traefik edge configuration with restricted Docker API access, localhost-only
Studio, public Auth/REST routing, Google configuration and private SMTP relay.

Still required before full application deployment: remaining Supabase image validation,
Google credentials, Supabase TLS/DNS,
Hyperdrive/Tunnel, schema installation/reference import, native Worker release,
pgBackRest/R2 setup, monitoring, restore rehearsal and full browser acceptance.
No public cutover is authorized by a successful configuration preparation check.

## Prepare and validate

Use Python 3 with `requirements.txt` in an isolated virtual environment. Obtain
the official `supabase/supabase` repository at `self-hosted/v0.8.4` and record the
resolved commit in the deployment manifest. Run:

```sh
python ops/production/prepare.py /path/to/supabase/docker /path/to/new-release
python -m unittest discover -s ops/production -p 'test_*.py'
```

The source must be the complete upstream Docker directory, including gateway
templates, database initialization files and utilities. The generator copies
these resources and writes `compose.production.json`. It never starts services.
Keep the upstream source and resolved image digests with the release manifest.

Copy the upstream environment example into a mode-0600 server-only `.env`, then
apply `production.env.example` overrides. Generate new credentials using the
pinned upstream key utilities; enable asymmetric Auth signing as documented by
that release. Never retain example passwords or copy local development keys.
Configure Google only after its credential and callback are verified.

Validate the resolved configuration privately (`docker compose config` includes
credentials; do not put its output into CI logs). Ensure no database, SMTP,
dashboard or Docker API ports are publicly published. Pin all upstream and
additional images by digest before startup. Keep certificate and database data
under `/srv/finfolk`, separate from immutable release directories.

Start the edge project before the Supabase project so `finfolk_edge` exists.
Access Studio through `ssh -L 55433:127.0.0.1:55433 root@66.63.172.196`; never
publish it through the public gateway. The public router allows Auth and REST
paths only. Storage/Realtime/Functions require a separately reviewed enablement.

## Upgrade and release gates

1. Verify provider recovery console; copy bootstrap recovery archive off-server.
2. Reboot updated 20.04; confirm SSH/networking; upgrade sequentially to 22.04
   and 24.04, rebooting and checking networking after each stage.
3. Configure administrator SSH access and IPv4/IPv6 firewall rules before
   disabling root/password access. Verify a second login first.
4. Provision a new private database connection with TLS through Cloudflare
   Tunnel/Access and Hyperdrive; disable query caching and use restricted grants.
5. Install generated native SQL from Clojure sources, never historical migrations
   or legacy snapshot SQL. Import reviewed sites only. Bootstrap admin by UUID.
6. Replace the legacy Worker entrypoint and readiness contract; reconcile all
   required native UI operations. Do not reuse the the retired provider release marker.
7. Provision encrypted R2 physical backups/WAL with 15-minute RPO, four-hour RTO;
   verify an actual isolated restore before accepting production data.
8. Test signup, confirmation/reset email, Google, account isolation/deletion,
   sites, logbook, profiles, directory/events, backups and reboot recovery.
9. Freeze old writes/provider work, preserve recovery copy, promote matched
   frontend/API artifacts, clear old auth scope caches, then reopen writes.
   Keep Instagram/TikTok disabled. After new writes, preserve them and fix forward.
