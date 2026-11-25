# Microsoft delivery remediation — prepared requests

Status: Microsoft request prepared and authorized, **not submitted**.
The consumer-support portal requires owner account sign-in approval.
No test message was sent.
The owner has since received an SSDNodes reply confirming the PTR change and
recommending `https://sender.office.com`; do not create a duplicate SSDNodes ticket.

## Verified on 26 November 2026 (Melbourne time)

- Sending IPv4: `66.63.172.196`.
- PTR now returns **only** `mail.finfolk.com.au`; that hostname resolves back to
  the sending IPv4. Postfix uses the same HELO name.
- SPF authorizes the IPv4. The FinFolk DKIM selector is present. DMARC remains
  monitoring-only. The mail queue is empty.
- A TLS-verified SMTP session to Microsoft's Outlook.com consumer MX accepted
  EHLO/STARTTLS, then rejected `MAIL FROM` with `550 5.7.1`, `S3140`.
- No `RCPT TO` or `DATA` was issued. No inbox test or redelivery was attempted.
- Current evidence: `/var/backups/finfolk-bootstrap/mail-envelope-recheck-20261126.json`.
  The rejection was observed at **2026-11-25 19:36:37 UTC**.

## Request to Microsoft Outlook.com Sender Support

Destination: [Outlook.com Sender Support](https://olcsupport.office.com/).
Use the consumer Outlook.com route for this consumer MX rejection; do not assume
that the separate Microsoft 365 delisting portal addresses this S3140 block.

Subject: Review Outlook.com S3140 sending-network block — 66.63.172.196

We operate low-volume transactional email for FinFolk (`finfolk.com.au`) from
`66.63.172.196`, hosted by SSDNodes. Please review the Outlook.com S3140 block
and advise what remediation or provider allocation evidence is required.

At 2026-11-25 19:36:37 UTC, a connection to
`outlook-com.olc.protection.outlook.com` completed EHLO and certificate-verified
STARTTLS, but the envelope sender was rejected before a recipient or message
body was submitted:

> 550 5.7.1 Unfortunately, messages from [66.63.172.196] weren't sent. Please
> contact your Internet service provider since part of their network is on our
> block list (S3140).

The response included `Name=Protocol Filter Agent`, `AGT=PFA`,
`MxId=11BE95515E977485`, and receiver
`DM3PEPF000265B1.namprd02.prod.outlook.com`.

The IPv4 PTR is now `mail.finfolk.com.au`, its forward A record points back to
`66.63.172.196`, and Postfix uses that hostname for HELO. SPF includes the IPv4;
DKIM is configured with selector `finfolk202611`; DMARC is monitoring-only.
SMTP submission is private to the application network, and the queue is empty.

Please review the block and advise whether SSDNodes must supply allocation or
network-level information. We will not send repeated delivery tests while the
block remains active.

## Request to SSDNodes network support

Destination: the existing SSDNodes customer support portal/account.

Subject: Microsoft Outlook.com S3140 network block — 66.63.172.196

Please assist with Microsoft's S3140 rejection of outbound transactional mail
from our VPS IPv4 `66.63.172.196`.

The PTR is now correctly set to `mail.finfolk.com.au`, which resolves back to the
same IPv4. Postfix's HELO matches it. SPF, DKIM and monitoring-only DMARC are
configured. The SMTP submission service is private and the queue is empty.

At 2026-11-25 19:36:37 UTC, Microsoft's Outlook.com consumer MX rejected the
sender before a recipient or message body was submitted with:

> 550 5.7.1 Unfortunately, messages from [66.63.172.196] weren't sent. Please
> contact your Internet service provider since part of their network is on our
> block list (S3140).

Please investigate the sending IP/network's reputation and assist with Microsoft
remediation. If required, please supply confirmation that this IPv4 is allocated
to our account and its allocation date for Microsoft Sender Support. No paid
service, replacement IP or billing changes are requested.

## Acceptance after remediation

Require an explicit provider/Microsoft resolution or a successful envelope
recheck, then obtain approval for one message to an identified operator-owned
Outlook inbox. Verify arrival and SPF/DKIM/DMARC results. SMTP acceptance alone
is not inbox placement. Do not change incoming MX routing or disable signup
confirmation to work around the block.

## Provider response and Microsoft portal

SSDNodes confirmed the PTR change to `mail.finfolk.com.au` and identified IP
reputation/Microsoft filtering as the remaining issue. Their suggested
`https://sender.office.com` is Microsoft's **Office 365** Anti-Spam IP Delist
Portal. It requires a verification email, CAPTCHA and email confirmation. Our
observed rejecting MX is Outlook.com consumer infrastructure, so retain the
Outlook.com Sender Support route if the Office 365 portal does not list this IP.
Do not report delisting or inbox delivery as successful until verified.

The owner subsequently completed the Office 365 portal check and reported:
“the IP address in question is not currently blocked in our system.” The portal
explicitly directed Hotmail/Live/Outlook.com blocks to its consumer support form:

https://support.microsoft.com/en-us/getsupport?oaspworkflow=start_1.0.0.0&wfname=capsub&productkey=edfsmsbl3&locale=en-us&ccsid=635900597399910848

This result is limited to the Office 365 system; it does not establish that the
observed Outlook.com S3140 rejection has been removed. Continue with the
consumer support request and retain the envelope-only diagnostic.
