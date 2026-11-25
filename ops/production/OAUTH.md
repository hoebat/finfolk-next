# FinFolk Google/GitHub sign-in

The dedicated Supabase callback for **both providers** is:

`https://supabase.finfolk.com.au/auth/v1/callback`

The public website/origin is `https://finfolk.com.au`; the app callback is
`https://finfolk.com.au/account`. Never use wildcard callbacks or substitute
Auspo/StatsTrade Newsroom's OAuth credentials.

## Provider-console state (26 November 2026)

The dedicated **FinFolk** GitHub OAuth application is registered at
`https://github.com/settings/applications/4054911`, with client ID
`Ov23liTLvfNlk7uRILkn`, homepage `https://finfolk.com.au`, and the exact Supabase
callback above. Device flow and wildcard matching are off. Credentials were
installed privately on the Auth host on 26 November; only Auth was recreated and
its health check passed. `/auth/v1/settings` reports GitHub enabled, and the
provider authorization redirect uses the dedicated client, exact callback, and
`user:email` scope. The owner completed GitHub consent. Brave then passed an
app-initiated PKCE sign-in, native account restoration, reload persistence and
sign-out on the isolated candidate. Supabase has one GitHub identity and one
matching native account; signing in again did not duplicate either.

The verified artifact `6b074c20f5bc42e454453ee2` was promoted with the production
pointer guard to `https://finfolk.com.au`. The production GitHub flag is enabled;
Google remains disabled. Live GitHub sign-in returned to a clean `/account` URL
and the native account survived reload in Brave. Hosted frontend acceptance
passed with all six release flags unchanged, map rendering, API 200 and no browser
errors. Unrelated local UI edits were excluded from this release.

The temporary candidate Auth redirect and API CORS exception were removed after
acceptance. Auth redirects are restricted to the production account callback.
Keep client secrets out of commits, logs and browser bundles.

Google's project picker found no FinFolk project. Creating a new project is
blocked by the account's project quota. The existing Statstrade project is
`gen-lang-client-0652799147`; it currently has the separate StatsTrade Newsroom
client. A new FinFolk client in that project would have its own credentials and
callback, but share the project's consent-screen branding. The owner requested automatic completion; preparation therefore uses a separate
FinFolk client in the existing project to avoid creating or deleting projects. Do not delete
another project or change Newsroom's existing client/branding to make room.

For a Google client, choose **Web application**, use origin
`https://finfolk.com.au`, and the exact Supabase callback. Request only ordinary
sign-in identity/email/profile scopes. Publishing/testing status and any test-user
restriction must be checked before enabling the production button.

## Private credential handoff

The private local file `.cache/oauth-mail-remediation/providers.env` is mode
0600 and holds private credential slots:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

The server-only `.env` uses `GOOGLE_CLIENT_ID` / `GOOGLE_SECRET` and
`GITHUB_CLIENT_ID` / `GITHUB_SECRET`, with `GOOGLE_ENABLED` / `GITHUB_ENABLED`.
The production generator now supports both sets of GoTrue variables and defaults
both providers to disabled. GitHub server wiring is now enabled; installation recreated only Auth. Google
remains separate and is not enabled by the GitHub installation.
A private before-change copy is under
`/var/backups/finfolk-bootstrap/oauth-prepare-20261126`.

After the credentials exist:

1. Validate they belong to the dedicated FinFolk client and callback. Write them
   server-side over SSH stdin/in memory; do not put them into command arguments
   or logs. Back up the current `.env` and Compose file privately first.
2. Resolve Compose with `config --quiet` and recreate only Auth. Check health,
   `/auth/v1/settings` and each provider's authorization redirect. A successful
   redirect does not prove the secret or end-to-end callback works.
3. Enable the corresponding `FINFOLK_GOOGLE_AUTH_ENABLED` /
   `FINFOLK_GITHUB_AUTH_ENABLED` public flags only for configured providers.
   Provider secrets stay exclusively on the Supabase host.
4. Build from the reviewed isolated frontend source, preserving all six feature
   flags and excluding unrelated local UI edits. Verify the packaged/hosted
   candidate and promote the exact artifact with the production-pointer guard.
5. Have the owner complete the provider consent round trip, then verify Supabase
   identity, native account persistence, reload, sign-out and no requests to retired identity services.
   Do not silently link two users merely because email addresses match.

Credential creation, OAuth consent and any acceptance of new binding provider
terms require the applicable browser handoff/confirmation. GitHub consent and native-account creation were completed with the owner; Google remains pending.

The local helper `.cache/oauth-mail-remediation/install-provider.mjs` validates
private-file permissions and credential formatting before installing one provider
through SSH stdin. `--check google|github` never changes services; `--apply`
backs up the server config, writes credentials privately, validates Compose and
recreates only Auth. It deliberately leaves frontend provider buttons unchanged
until the configured provider has passed acceptance. With the empty handoff file,
its check refuses to proceed and makes no server changes.
