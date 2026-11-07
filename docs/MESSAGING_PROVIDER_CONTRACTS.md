# Messaging provider contract references

Reviewed 5 November 2026. Tests use synthetic messages matching these contracts;
they do not establish that an app has been approved or send live messages.

## TikTok Business Messaging

Primary references:

- [Getting started](https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3)
- [Access requirements](https://business-api.tiktok.com/portal/docs/access-to-business-messaging-api/v1.3)
- [Business Messaging webhook events](https://business-api.tiktok.com/portal/docs/subscribe-to-business-messaging-webhook-events-via-webhooks-api/v1.3)
- [Webhook verification](https://business-api.tiktok.com/portal/docs/webhook-verification/v1.3)
- [Send a message](https://business-api.tiktok.com/portal/docs/send-a-message-to-a-conversation/v1.3)
- [Messaging limits](https://business-api.tiktok.com/portal/docs/messaging-limits-for-business-messaging-api/v1.3)

The public documentation page renders its body in JavaScript. Its public content
API is `/gateway/api/doc/client/node/get/v2/`, with `content_slug`, `version=1.3`
and `language=ENGLISH`. This was used to read the primary source, rather than
inferring TikTok contracts from Douyin or third-party libraries.

Incoming text is `im_receive_msg` with matching `client_key` and `user_openid`.
The `content` property is serialized JSON. Its stable fields include
`from_user.id`, `to_user.id`, participant roles, `conversation_id`, `message_id`,
`timestamp` in milliseconds, `type`, and `text.body`. The outer `create_time`
is notification time in seconds and is not substituted for message time.
Outgoing echoes and restricted-region events are not processed as incoming text.

Webhook signatures use the app secret and SHA256 HMAC over the header timestamp,
a dot and the raw request bytes. The adapter applies a five-minute timestamp
window and constant-time signature comparison. The current implementation
requires one timestamp and one signature; ambiguous duplicate header fields
are rejected.

Text replies use the fixed Business Messaging endpoint
`https://business-api.tiktok.com/open_api/v1.3/business/message/send/`, with the
`Access-Token` header, business ID, conversation recipient, and a text body.
Success requires a zero response code and a nested message acknowledgement ID.
Conversation IDs are preserved as JSON strings, including plus signs and slashes.
Login/Display API tokens are not assumed to authorize this endpoint.

The shared core conservatively supports text of at most 2,000 characters and one
reply per incoming receipt. The TikTok adapter allows a configured reply deadline
of no more than 48 hours after message time. It does not implement late inactive
conversation allowances, comment-to-message, attachments or proactive messages.
Transient response codes must be configured from the applicable provider contract;
unknown formal rejections are terminal and ambiguous responses are uncertain.

Before live use, confirm Business Messaging approval, required privacy/security
reviews, authorized token scopes, business account entitlement, supported regions,
and the webhook subscription. The public docs describe these prerequisites;
the repository cannot infer that they have been granted from video-import tokens.

## Instagram

- [Instagram messaging](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api)
- [Instagram webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/)

The new adapter follows the raw-body HMAC and configured-account checks already
used by the repository's tested Instagram ingress and `InstagramProvider` client.
Meta's public documentation returned HTTP 429 during this review. Existing
provider tests remain the local regression reference; live app permissions,
authorization variant, message window and subscription must still be verified
before activation. The adapter takes its reply window explicitly from trusted
configuration rather than asserting that one policy fits every authorization.

## Authorization and refresh references

- [Business Messaging authentication](https://business-api.tiktok.com/portal/docs/business-messaging-api-authentication/v1.3)
- [Token scopes and account binding](https://business-api.tiktok.com/portal/docs/get-the-authorized-tiktok-account-permission-scopes-via-access-token/v1.3)
- [Account entitlement fields](https://business-api.tiktok.com/portal/docs/get-profile-data-of-a-tiktok-account/v1.3)
- [Messaging conversation access](https://business-api.tiktok.com/portal/docs/get-a-list-of-conversations/v1.3)
- [Configured webhook subscription](https://business-api.tiktok.com/portal/docs/get-a-business-messaging-webhook-configuration/v1.3)

The TikTok authorization client checks the token's `app_id`, `creator_id` and
messaging scopes, queries `has_advanced_access`, makes a real read-only messaging
request, and verifies the exact app-level callback. The entitlement query also
requires `user.account.type`. OAuth code exchange and refresh use the Business
API's `client_id`/`client_secret`, not the Display API client-key exchange. Provider
responses must match the expected account and contain valid token lifetimes.

The public documentation content endpoint can fall back to the introductory page
when a slug does not exist. Contract research checked the returned document
identity and content, not just a successful HTTP/code response.

The Business Messaging authorization guide directs developers to use the TikTok
account-holder authorization URL issued in the developer portal. It can include a
bound state, and disabling automatic authorization redirects ensures the callback
includes a fresh `auth_code`. The opt-in router must use that configured portal
URL rather than reconstruct a Login/Display API authorization URL.
