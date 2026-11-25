# FinFolk mail delivery

## Resend relay migration (26 November 2026)

The owner selected Resend instead of Cloudflare. Use the Free plan initially;
no paid upgrade is authorized by this selection. Cloudflare's Workers upgrade
was not purchased, and its staged relay overlay must not be applied.

Resend account sign-in is complete. Domain `finfolk.com.au` is registered with ID
`7c63cbbc-7a51-498f-9604-233e85bb21b9` in Tokyo (`ap-northeast-1`). Resend is
now reports **Verified**, with Forge **Ready**. The SMTP key is installed privately
and Resend SMTP authentication succeeded. Keep the existing From address
`FinFolk <noreply@finfolk.com.au>`. Add only the DNS records Resend supplies for
outbound authentication; preserve apex incoming MX/forwarding and DMARC. Leave
receiving, open tracking, and click tracking disabled for authentication mail.

The `compose.resend-relay.yml` overlay uses `[smtp.resend.com]:465`, username
`resend`, implicit TLS, certificate/hostname verification and no direct-delivery
fallback. The password is read from `/run/secrets/resend_smtp_token`, mounted
from root-owned mode-0600 `/srv/finfolk/secrets/resend-smtp-token` (parent 0700).
Never include the key in chat, logs, shell arguments or Compose environment values.

Apply only after the account/domain/key prerequisites are satisfied. Back up the
live deployment inputs, merge the existing production/mail inputs with this overlay,
validate with `docker compose config --quiet`, and recreate only `postfix`. Preserve
the relay in future deployment inputs so a later recreation cannot silently revert
to direct sending. Supabase's private `postfix:587` submission, queue, DKIM mounts
and incoming mail routing stay unchanged. Do not combine both provider overlays.

Verify effective TLS/SASL settings without printing the credential map, then send
one identified test to the authorized `zcaudate@outlook.com` inbox and correlate
Postfix acceptance with the Resend email record. Inbox placement and headers still
require inspection.

**Active:** both live Compose deployment inputs now persist the Resend relay and
secret-file mount; only Postfix was recreated. Container health is healthy,
effective TLS policy is `verify`, wrapper mode and SMTP SASL authentication are
enabled, and fallback relay is empty. The key file is root-owned mode 0600.
Prior inputs are backed up under
`/var/backups/finfolk-supabase/resend-20261125T212211Z-l87x32xw`.

One authorized test to `zcaudate@outlook.com` was submitted through Postfix,
queue ID `5D3B8E6FAC`. Resend accepted it as
`01a21497-0f23-74e9-b83a-bea4e87d127e`; its dashboard shows **Delivered**.
Postfix removed the sent message and the queue is empty. This establishes
provider-reported delivery to the recipient server, not inbox placement.
Evidence: `/var/backups/finfolk-supabase/resend-delivery-test-20261126.json`.

Reference: [Resend SMTP](https://resend.com/docs/send-with-smtp).

Domain delivery TLS is set to **Enforced**; tracking remains unconfigured/off.
The key creation form was prepared with name `FinFolk production SMTP`, permission
`Sending access`, and domain `finfolk.com.au` only. The owner supplied the key;
it was passed to the installer through stdin without including it in process
arguments, repository files, or logs.

`activate_resend.py` runs on SSDNodes and reads the key only from stdin. It tests
TLS-verified SMTP authentication before making changes, backs up both live Compose
files and `.env` privately, persists the relay in both deployment inputs, and
recreates only Postfix. It restores the inputs/previous secret on activation
failure. Regression tests verify rejected credentials do not mutate deployment,
successful activation preserves Auth/queue settings, and a recreation failure
restores previous inputs. No delivery claim follows from activation alone.

Published Resend-supplied records (public DNS resolution confirmed):

- TXT `resend._domainkey.finfolk.com.au`: Resend's public DKIM key.
- DNS-only CNAME `rsend.finfolk.com.au` → `rsend-apne1.forge.rmta.net`.
- DNS-only CNAME `send.finfolk.com.au` → `send.forge.rmta.net`.

The new-domain wizard selected Resend Forge infrastructure; these are the records
the wizard supplied, rather than legacy SES MX/SPF templates. Existing Statstrade
Resend settings were not changed. The relay overlay is staged on the server at
`/opt/finfolk/bootstrap/compose.resend-relay.yml`; merged Compose validation passed.
From SSDNodes, a TLS certificate-verified connection to Resend port 465 returned
EHLO 250 with AUTH available. No authentication or message submission was attempted.

## Superseded Cloudflare preparation (26 November 2026)

Cloudflare Email Sending was initially selected for outgoing mail. The sending domain
`finfolk.com.au` is registered (ID `d163a778818e49e29463c2571a500132`), and
Cloudflare reports its DNS status as `ready` with no errors. Its managed
`cf-bounce.finfolk.com.au` MX/SPF and `cf-bounce._domainkey.finfolk.com.au` DKIM
records are installed. Existing apex MX, SPF, DKIM and monitoring DMARC remain.

**Not active yet:** the account's sending limits still report
`recipient_mode=verified_only`. Production continues to use direct Postfix
delivery, including the Microsoft S3140 limitation below. Do not enable the
relay until arbitrary-recipient sending and a dedicated SMTP token are ready.

The connected Cloudflare API cannot manage billing or create account API tokens
(both return permission errors). The owner must enable Workers Paid / unrestricted
Email Sending in the Cloudflare dashboard and create a dedicated token with
**Account → Email Sending → Edit**, scoped to this account. Restrict its client
IP to `66.63.172.196/32`. This token can send from onboarded domains in the account;
it is not a DNS, account-management, or Workers-deployment token.

Store the token outside the repository at
`/srv/finfolk/secrets/cloudflare-smtp-token` (root-owned, mode 0600; parent 0700).
Do not put it in command arguments, Compose environment values, logs, or chat.
The reviewed `compose.cloudflare-relay.yml` overlay mounts it as a Docker secret.
The pinned Postfix image's startup scripts support `RELAYHOST_PASSWORD_FILE` and
redact the password in startup logs. The relay uses
`[smtp.mx.cloudflare.net]:465`, implicit TLS with certificate/hostname verification,
and username `api_token`. It has no direct-delivery fallback. Private GoTrue
submission on `postfix:587` and existing DKIM/queue mounts remain unchanged.

Once the account and token are ready, validate the merged Compose configuration,
then recreate only `postfix` using the existing production/mail Compose inputs
plus this overlay. Preserve the same inputs on subsequent recreation; omitting
the overlay would revert to direct delivery. Back up the deployment inputs first.
Do not deploy the overlay as a standalone Compose project or recreate the database.

Acceptance still required: check the effective Postfix TLS/SASL settings without
printing password maps; send one identified test to the authorized
`zcaudate@outlook.com` inbox; correlate its queue ID with Cloudflare's Message-ID
and delivery status; inspect inbox placement and authentication headers. SMTP
acceptance alone does not establish inbox delivery. Never blindly flush an old queue.

The overlay is staged at `/opt/finfolk/bootstrap/compose.cloudflare-relay.yml`.
Docker Compose validated it merged with the live production/mail inputs; it has
not been applied. The production-bundle regression test also passes. No SMTP
credential has been created or installed and no relay test message has been sent.

References: [Cloudflare SMTP](https://developers.cloudflare.com/email-service/api/send-emails/smtp/),
[sending limits](https://developers.cloudflare.com/email-service/platform/limits/),
[email pricing](https://developers.cloudflare.com/email-service/platform/pricing/).

## Previous direct delivery (historical baseline)

Before the Resend switch, FinFolk sent mail directly from `66.63.172.196`, using
Docker Postfix without an SMTP relay credential. Existing incoming-mail MX
records and registrar forwarding are preserved. The website stays on Netlify.

## Previous running configuration

- Postfix: `finfolk-supabase-postfix-1`, private `finfolk_supabase` Docker network,
  submission port 587, no published SMTP ports. `relayhost` is empty; IPv4 delivery
  goes to recipient MX servers on port 25, using opportunistic STARTTLS.
- Pinned image:
  `boky/postfix@sha256:0632783c64183446c4edeae9092a2e015fdc0c4e8a3976bdf8878a7fc2146361`.
- Sender: `FinFolk <noreply@finfolk.com.au>`. HELO: `mail.finfolk.com.au`.
- DKIM: persistent private key under `/srv/finfolk/dkim`, selector `finfolk202611`.
  OpenDKIM listens on `inet:8891@127.0.0.1`; Postfix defers if signing is unavailable.
  The image runs `/etc/opendkim/opendkim.conf`; `/etc/opendkim.conf` is not its
  effective configuration file. Preserve the existing key when recreating containers.
- Postfix's queue is the persistent `finfolk-supabase_mail-queue` volume.
- Authenticated HTTPS bridge: `https://mail.finfolk.com.au/v1/send`, routed through
  Traefik with a valid Let's Encrypt certificate. It accepts only invitation
  messages with FinFolk invitation links, caps request bodies and applies rate limits.
  The token is in `/srv/finfolk/mail-gateway/token` and Cloudflare's
  `MAIL_GATEWAY_TOKEN` secret. `MAIL_GATEWAY_URL` is also configured on the Worker.
- Gateway receipts: `/srv/finfolk/mail-gateway/data/receipts.sqlite`. A queue
  receipt means SMTP acceptance, not inbox delivery. Duplicate keys return the
  existing receipt; uncertain sends require reconciliation and are never repeated
  automatically. Back up the receipt database and Postfix queue together.
- Server configurations: `/opt/finfolk/releases/supabase-v0.8.4-1/compose.mail.json`
  and `/opt/finfolk/bootstrap/compose.mail-gateway.yml`, with pinned image digests.

## DNS published

- DNS-only A: `mail.finfolk.com.au` -> `66.63.172.196`.
- Apex SPF: `v=spf1 ip4:66.63.172.196 include:spf.efwd.registrar-servers.com ~all`.
- DKIM public key: `finfolk202611._domainkey.finfolk.com.au`.
- Monitoring-only DMARC: `v=DMARC1; p=none; adkim=r; aspf=r`.

## Verification completed

Outbound port 25 reached Google and Microsoft MX servers. Postfix and gateway
containers are healthy. Unauthenticated HTTPS submission returns 401. A local-only
SMTP sink received an authenticated gateway submission; repeating its delivery
key returned the same receipt without a second submission. Its actual Postfix
DKIM signature verified cryptographically against public DNS. Synthetic test mail
was routed exclusively to the local sink, which was removed afterward. Temporary
transport overrides were restored.

A subsequent operator-authorized live test to the connected account's Outlook
inbox was submitted on 23 November 2026. Postfix signed it successfully, but
Microsoft rejected the sending server at MAIL FROM with `550 5.7.1`, `S3140`:
the server's IP/network is on Microsoft's block list. It did not reach the inbox.
Do not resend until this block is remediated. Server evidence is recorded in
`/var/backups/finfolk-bootstrap/mail-external-test.json` and Postfix's logs.
The reverse zone's authoritative nameservers are `ns1.ssdnodes.com` and its
siblings; the provider is SSDNodes. PTR was still returning the old Statstrade names at that test; it has since
been corrected to `mail.finfolk.com.au` (verified 26 November 2026).

Run `npm run test:mail` for transport, persistent deduplication, retry/uncertainty
and input-validation tests. The wider bundle checks additionally require PyYAML.

## Remaining acceptance and application rollout

1. Reverse DNS/PTR now matches `mail.finfolk.com.au`. The Microsoft S3140
   rejection remains active after this correction; request provider/Microsoft
   review using `MICROSOFT_DELIVERY_REMEDIATION.md`.
2. Obtain an explicitly identified operator-owned test inbox, send a live message,
   and inspect inbox placement plus SPF/DKIM/DMARC headers. Do not infer delivery
   from SMTP banners or queue acceptance.
3. The native API's direct-delivery adapter is implemented in source and its
   gateway secrets are configured, but that API code has not been promoted to
   production. Publish it with the native Supabase/API release after its acceptance
   checks. Do not deploy the dirty shared checkout indiscriminately.
4. Once Supabase Auth is running, test confirmation and password-recovery emails
   through `postfix:587`. Test native event invitations through Cloudflare afterward.
5. Keep monitoring DMARC until real delivery is verified. Existing incoming mail
   routing must not be replaced by the outgoing Postfix setup.

## Provider support request (prepared, not submitted)

Subject: Reverse DNS update and Microsoft outbound mail block for 66.63.172.196

Please set a single IPv4 PTR for 66.63.172.196 to mail.finfolk.com.au, replacing
the old Statstrade PTR names. The forward A record already resolves to this IP.

This VPS sends low-volume transactional FinFolk mail directly through Postfix.
SPF, DKIM and monitoring-only DMARC are configured, and the actual Postfix DKIM
signature has been verified against public DNS. Outbound TCP port 25 works.

A test on 23 November 2026 to Outlook.com was rejected by Microsoft's receiving
server with this response: "550 5.7.1 Unfortunately, messages from [66.63.172.196]
weren't sent. Please contact your Internet service provider since part of their
network is on our block list (S3140)."

Please investigate the IP/network's outbound-mail reputation and assist with
Microsoft remediation/delisting. Please confirm the PTR change and advise when
the sending-IP block has been resolved. No paid service changes are requested.

## Fresh Supabase accounts (26 November 2026)

Email signup is enabled and confirmation remains required. GoTrue submits on the
private Docker SMTP network. Internal Postfix `smtpd_tls_security_level=none`
avoids advertising an untrusted self-signed certificate to GoTrue; outbound
`smtp_tls_security_level=may` remains enabled. No SMTP port is published.

Private-domain browser acceptance verified confirmation, PKCE recovery and a
password change. The temporary Mailpit service and recipient/transport overrides
were removed; normal sender and recipient restrictions were restored. Temporary
Netlify preview redirect origins were removed after production acceptance.
These tests do not establish delivery to Microsoft inboxes; the existing block
above still applies.

On 26 November 2026, an envelope-only TLS-verified recheck still received S3140
at MAIL FROM. No recipient or DATA was sent. The queue was empty. Prepared
Microsoft/SSDNodes support requests are in `MICROSOFT_DELIVERY_REMEDIATION.md`;
submission requires the owner's explicit authorization.
