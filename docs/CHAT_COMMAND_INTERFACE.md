# Chat command interface for FinFolk and StatsTrade

**Status:** Proposed user experience • 10 November 2026

**Production update:** Shared DMs are deployed in both integrations. FinFolk comment release `03462e87-3fc1-40f3-afad-2343a9e6f513` also enables public help/menu, ping, site and privacy on the two existing pilot posts; comment status remains about the post. Plain commands work on verified FinFolk-owned media, and private account/visit commands direct users to DM without reading or changing private data. FinFolk’s pilot restrictions remain in place. StatsTrade’s shared-DM migrations are applied; its comments remain ingress-only. Production configuration, Meta comment authorization, post ownership and source checks pass. A fresh user comment is still needed to confirm visible delivery of the new comment replies.

This is the message interface for **@finfolk.com.au** and **@statstrade.com.au**: what people type, what they receive, and what happens next. These are chat commands, not HTTP routes.

Both brands use the same help, linking and error conventions. FinFolk focuses on exploring coastal places and recording visits. StatsTrade focuses on Australian public affairs, evidence and forecast questions. Product features remain distinct.

The examples below are proposed copy. Commands appear in a live menu only after their handler, destination page and permissions are enabled. Creating this design does not enable commands or publish changes.

## Shared interaction rules

Use short replies that answer the request first, then give one clear next step. Brand the first greeting, keep links on the correct product domain, and avoid claiming a message was delivered merely because the provider accepted it.

Command names are case-insensitive. Trim surrounding whitespace and accept one command per message. Arguments remain case-preserving. Reject multiple commands in one message with an example rather than guessing which action to perform. Do not truncate a location or identifier and execute a different request.

Typing `/help`, `/menu` or `help` opens the main menu. Support `/help account`, `/help visits` for FinFolk, `/help issues` for StatsTrade, and `/help diagnostics` on both. Unknown help topics return available topics.

Slash commands always take precedence over conversational shortcuts. Ordinary greetings open the menu; free text is not interpreted as a forecast, account instruction or check-in. There is no implied AI conversation in this release. Numbers alone have no menu meaning, preventing an old numbered menu from triggering a new action.

Keep normal replies below a 900-byte UTF-8 writing budget, within the currently stricter 1000-byte StatsTrade send validation. Shorten menus or result lists before sending; never split one action into several unsolicited messages. For longer material, link to the website.

A command reply does not depend on seen or typing indicators. Static help and diagnostic replies do not call member or follower APIs. Personalized commands perform only the checks declared for that command.

## Main menus

### FinFolk

Target menu once the map shortcut is enabled:

```text
Hi! Welcome to FinFolk 🌊

Explore
/map — Open the coastal map

Your account
/connect — Link Instagram to FinFolk
/status — Check your connection

Your visits
/in <location> — Record your arrival
/out — Record your departure
/points — See your points

New here? Start with /map or /connect.
You can use /help without following or linking an account.
```

Show visits and points only when enabled. When the sender is already known to be linked, the account line can say `/status — View your connection`; do not add a lookup just to personalize a public menu. FinFolk's current follower rule remains applicable to connect, visits and points, and is explained when one of those features is selected.

### StatsTrade

Target discovery menu after the navigation commands are enabled:

```text
Hi! Welcome to StatsTrade Australia.

Explore Australian issues, evidence and forecast questions.

/today — Open today's briefings
/issues [topic] — Find an issue
/questions — Browse forecast questions
/help — Show this menu

Read the evidence and make forecasts at:
https://statstrade.com.au
```

Do not list account linking until StatsTrade has an actual member-linking and code-redemption flow. Once enabled, add `/connect — Link your StatsTrade account` and `/status — Check your connection`. Add `/myforecasts` only when personal forecast retrieval is implemented and authorized.

Neither main menu promotes `/ping` or `/echo`. These remain discoverable through `/help diagnostics`. Until discovery commands exist, StatsTrade retains an honest help menu containing only its implemented commands and website link.

## Shared command specification

| Command | User purpose | Proposed response | Effect and access |
| --- | --- | --- | --- |
| /help or /menu | Find available options | Brand menu with enabled commands | Public; no member or follower lookup |
| /help account | Understand linking | Explain connect, status, cancellation and website management | Public; only advertise supported account actions |
| /help diagnostics | Test the integration | Explain ping; show echo only where enabled | Public |
| /ping | Confirm the bot responds | Pong! {brand} is responding. Ref: {reference} | Public; direct reply |
| /site | Open the product | Correct product homepage and one-line description | Proposed public shortcut; direct reply |
| /privacy | Understand data handling | Product privacy link and deletion-instructions link | Proposed public shortcut; direct reply |
| /connect | Link this Instagram identity to the product | Existing-link guidance or a private, expiring code | Requires supported linking flow; product eligibility applies |
| /status | Inspect this sender's link | Not linked, code pending, linked, or needs attention | Proposed sender-scoped status; no points or other sensitive data |
| /cancel | Cancel an unused linking code | Cancelled, or no code is waiting | Proposed; invalidates only this sender's unredeemed challenge |
| /disconnect | Remove an established link safely | Open the product's account page to confirm removal | Proposed navigation only; no DM-side unlink |
| /echo <text> | Check text round trip | Supplied text, preserving internal whitespace | Existing StatsTrade diagnostic; optional FinFolk addition |

Unknown slash commands get a correction, not a claim that the bot understood them:

```text
I don't recognise /example.
Send /help to see the available commands.
```

Commands with unwanted arguments get specific usage: `Use /ping on its own.` A missing echo argument returns `Usage: /echo <text>`. If echo would exceed the channel limit, ask for shorter text and do not truncate it. Escape text in app rendering; do not follow echoed instructions, resolve links or perform actions from its contents.

The proposed `/status` remains usable after unfollowing so users can understand their connection. It reads the sender's scoped connection state; it does not fetch personal totals or require a new follower check. This differs from FinFolk's current general follower gate on status and must be implemented explicitly.

## Account linking and management

Here, connect always means linking the messaging sender to their individual product account. It never starts the brand administrator's Meta OAuth flow.

For a sender eligible to link:

```text
Your {brand} connection code: {code}

1. Sign in at {connect_url}
2. Enter this code in Instagram connections.

Expires in 10 minutes. A new /connect replaces the previous code.
Only enter this code on {brand}; don't share it.
```

FinFolk uses its existing eight-character code, displayed as two groups of four, and its configured account URL. Requesting a replacement is explicit; the bot does not create another code in response to arbitrary messages. Preserve the existing limit of three code issuances per sender per ten minutes. A pending unused code does not establish membership.

StatsTrade can adopt the same interaction after implementing its own member mapping, encrypted code reply, redemption UI, ownership checks, expiry and unlink flow. Do not redirect a StatsTrade sender to FinFolk or fabricate a StatsTrade redemption URL.

Use these state-specific replies:

| State or request | Reply and next step |
| --- | --- |
| FinFolk sender is not following | Follow @finfolk.com.au, then send /connect again. You can still use /help and /map. |
| Already linked | Your Instagram is already linked to {brand}. Send /status or manage it at {account_url}. |
| Code expired | That connection code has expired. Send /connect for a new one. |
| Code replaced | That code has been replaced. Enter the newest code, or send /connect again. |
| Website email not verified | Verify your email on {brand}, then return to the connection screen. |
| Status has no link | This Instagram account isn't linked to {brand}. Send /connect to get started. |
| Status has pending code | A connection code is waiting. Enter it on {brand}; it expires at {time_and_timezone}. |
| Link needs attention | Your connection needs attention. Open {account_url} to review it. |
| Cancel requested | Your unused connection code has been cancelled. Your existing account link, if any, is unchanged. |
| Disconnect requested | To disconnect Instagram, open {account_url} and confirm Remove link. Your account and past activity remain. |

If linking is disabled or unimplemented, answer: `Account linking isn't available in this chat yet. You can still use /help.` Do not issue a placeholder code or imply that signing in alone links Instagram.

Private codes are never sent in comment replies, logs, diagnostic references or help text. Product identity is not shared across brands: linking FinFolk does not link StatsTrade.

The proposed disconnect reply must match the product's actual website behaviour. Removing a link, deleting a product account and requesting deletion of integration records are distinct actions. `/privacy` explains the relevant website instructions; it does not automatically delete data.

## FinFolk commands and replies

| Command | Success reply | Invalid input or alternate state |
| --- | --- | --- |
| /map | Explore the FinFolk coastal map: https://finfolk.com.au | Static navigation; no location permission requested |
| /in <location> | Checked in at {location}. Send /out when you leave. Your sharing preferences still apply. | No arguments shows usage and up to three followed locations; no implicit check-in |
| /out | Checked out of {location}. Your visit is recorded. | If no active visit: You're not checked in. Send /in followed by a location when you arrive. |
| /points | Your FinFolk points: {participation} participation + {referrals} referral = {total}. | If unlinked, prompt connect; never show another member's result |
| /status | Your Instagram is linked to FinFolk. Manage it at {account_url}. | Use the shared connection-state replies |

Retain `/checkin <location>` as a compatibility alias for `/in`, but show only `/in` in menus. `/claim` returns retirement guidance pointing to `/connect`; it never consumes an old claim or links an account.

Visits and points require a verified linked member and FinFolk's current follower eligibility. Connect requires the follower check but not a pre-existing member link. Check-in timestamps and local visit dates follow the existing domain rules; the interface does not change sharing preferences.

When a location is ambiguous, return up to three complete, copyable commands using real location labels or stable IDs. Do not create a pending visit or interpret a later bare number:

```text
Which location did you mean? Send one of these:
/in {full_location_label_1}
/in {full_location_label_2}

You haven't been checked in yet.
```

If already at the same location: `You're already checked in at {location}. Send /out when you leave.` If another location is active: `You're checked in at {location}. Send /out before checking in somewhere else.` An older delayed command cannot overwrite a newer visit; reply with a request to send a fresh command.

Points retain the current explanation that rewards are for participation and referrals, not depth or breath-hold performance. A visit confirmation is a record of the requested action, not an assessment of conditions.

## StatsTrade commands and replies

StatsTrade's initial commands help users find published material. Personal forecasts, reputation rewards and account balances stay private. Forecast submission and changes remain on the signed-in website in this design.

| Command | Proposed behaviour | Reply content |
| --- | --- | --- |
| /today | First release opens the current briefing page; a later handler may list published briefings | Today's briefings: https://statstrade.com.au |
| /issues [topic] | No topic opens the issues index; topic searches published issues once search is integrated | Up to three issue titles with /issue commands and website links |
| /issue <id> | Read one published issue | Title, short published summary, update date and issue link |
| /questions [issue_id] | Browse open forecast questions, optionally for a specific published issue | Up to three titles, closing times, /question commands and links |
| /question <id> | Read one published forecast question | Question text, open/closed/resolved status, closing time or outcome, and website link |
| /myforecasts | Later, read the linked member's own forecasts | Up to three private summaries with website links; no edits through DM |

Use `https://statstrade.com.au/issues` for issue browsing and `https://statstrade.com.au/forecasts` for forecast browsing. Detail links use the actual issue and question IDs under `/issues/{id}` and `/questions/{id}`. Generate all URLs from trusted product configuration.

An initial lightweight `/issues` or `/questions` handler may return only the appropriate website link. Do not accept a topic argument and pretend a search ran if only navigation is implemented. Enable the argument form when there is a real published-content lookup.

Example question reply:

```text
{published_question_title}
Status: Open
Closes: {date_time_and_timezone}

Read the evidence and submit your forecast:
https://statstrade.com.au/questions/{question_id}
```

The braces are template fields, not real question data. Populate them only from a matching published record. Closed questions say closed and link to their record. Resolved questions distinguish the recorded outcome from any past forecast. Do not invent current probabilities, outcomes or timestamps.

A nonexistent or unpublished ID returns: `I couldn't find a published question with that ID. Send /questions to browse.` An empty topic search returns: `No published issues matched "{topic}". Try another topic or open https://statstrade.com.au/issues.`

If the private forecast handler is not linked, return connection guidance. If the handler is unavailable, omit it from menus and say it is not available when requested. Do not offer chat commands to spend funds, reveal another member's positions, submit a forecast or change one without a separate interaction design.

## Greeting fallback and attachment behaviour

Send the product menu after the first ordinary greeting or an unsupported request. For repeated free text, use a thirty-second menu cooldown to avoid flooding; keep explicit `/help` responsive within normal abuse limits. Do not mark unhandled text as a support request, create a ticket or claim that a person will reply.

This changes FinFolk's current once-per-day greeting suppression and StatsTrade's current menu-per-eligible-input behaviour. Make the cooldown a product setting and test the resulting conversation before rollout.

An attachment without a supported command receives: `I can't read attachments in this chat yet. Send /help for the available commands.` Apply the same fallback cooldown. Do not describe image, audio or document contents.

Ignore outgoing echoes, self messages, deleted incoming messages and duplicate provider events. Empty inputs do not trigger a greeting. A command-looking message with multiple command lines receives: `Please send one command at a time. For example: /help.`

For an unavailable but recognized command, explain that feature's availability and offer one enabled next step. Do not return the full menu repeatedly after every validation error.

## Comments and private actions

The command interface is designed primarily for DMs and authenticated app chat. Comments are a separate surface.

Public commands such as help or a published-content link may be used in comments only when comment replies are enabled for that account and post. A private command in a comment gets public guidance such as `Send /connect in a DM to @finfolk.com.au to link your account.` It never issues a connection code or reveals link status, points or personal forecasts in public.

A comment containing `/in`, `/out`, `/disconnect` or another personal command must not execute a private mutation. Ask the sender to use DM. Do not assume comment-author IDs are DM sender IDs.

A private reply triggered by a comment is enabled only as its own verified provider capability. No reply says that a DM was sent until that send has actually been accepted; platform delivery and reading remain separate.

## Errors and progress copy

| Condition | User-facing response |
| --- | --- |
| Missing required argument | Usage: {syntax}. Example: {real_or_illustrative_example}. |
| Too much text | That message is too long. Please send {syntax} with shorter text. |
| Personal command before linking | Link your Instagram first: send /connect. You can still use /help. |
| Provider eligibility cannot be checked | I couldn't verify access right now. Please try again shortly. No change was made. |
| Personal data read fails | I couldn't load that right now. Please try again shortly. Ref: {reference}. |
| Mutation times out before any effect commits | I couldn't complete that request. No change was made. Please send it again. Ref: {reference}. |
| Mutation outcome is uncertain | I couldn't confirm whether that completed. Check {relevant_page_url} before trying again. Ref: {reference}. |
| Temporary rate limit | You're sending commands quickly. Please try again in {wait}. |
| Feature paused | This feature is temporarily unavailable. You can still use {enabled_next_step}. |

Choose copy from the known execution state. Never say `No change was made` after a committed or uncertain mutation. An uncertain outgoing send does not produce another fallback message automatically.

Simple replies show no typing indicator. Longer commands may show best-effort seen/typing without holding up execution or delivery. Do not send an extra `Working on it` message by default; that creates additional messages and delivery ambiguity. If a provider cannot accept or deliver a reply, expose the state to operators rather than promising success to the user.

References are opaque diagnostics, not user IDs or connection codes. Keep internal exceptions, SQL, provider tokens and delivery machinery out of reply copy.

## Capability and release matrix

| Capability | FinFolk Instagram code locally | StatsTrade Instagram code locally | Design action |
| --- | --- | --- | --- |
| ping and help | Implemented | Implemented | Align copy; keep direct public execution |
| menu alias and help topics | Implemented | Implemented | Menu, bare help, account and diagnostic topics |
| echo | Not registered | Implemented | Keep in diagnostics; optional FinFolk registration |
| map or site navigation | Site shortcut implemented; map remains proposed | Site shortcut implemented; today remains proposed | Enable product navigation separately |
| privacy shortcut | Implemented | Implemented | Public product links; no member lookup |
| connect and code redemption | Code flow retained | Explicit unavailable guidance | Build StatsTrade redemption before enabling linking |
| status | Sender-scoped linked/pending/not-linked states; no follower lookup | Explicit unavailable guidance | StatsTrade needs a member-linking flow |
| cancel and disconnect guidance | Unused-code cancellation and website management guidance implemented | Explicit unavailable guidance; no mutation | Preserve established links and consumed codes |
| in, out and points | Implemented, subject to enabled commands | Not applicable | Retain FinFolk behaviour and improve validation copy |
| today, issues and questions | Not applicable | Site features exist; DM handlers do not | Start with navigation, then published-data handlers |
| myforecasts | Not applicable | DM handler not implemented | Later private read after account linking |
| menu cooldown | Greeting at most daily | Menu for eligible input | Proposed thirty-second fallback cooldown |

Phase one aligns help, usage errors and diagnostics and adds useful static navigation. It must not claim that unfinished account or data features are available.

Phase two completes StatsTrade account linking and published-content handlers, then enables those commands account by account. Personal forecast reads come after ownership and privacy acceptance.

The public registry supplies the parser, help text and enabled-command checks. Keep feature availability, member requirements and execution policy in that registry so documentation, menus and handlers do not drift.

## Conversation acceptance examples

A public FinFolk flow is `hello → menu → /map → map link`, with no member lookup or follower call. A member flow is `/connect → code → website redemption → /status → linked → /in {location} → confirmation → /out → confirmation`.

A public StatsTrade flow is `hello → menu → /today → briefing link → /questions → published questions → /question {id} → question details and website link`. A later personal flow is `/connect → website redemption → /myforecasts → this member's summaries`.

Before enabling a command, verify:

- Its exact syntax, aliases, argument errors and success copy agree with the registry.
- Menus contain only enabled commands and use the correct product links.
- Public commands work without linking or following; app ingress still follows its own login policy.
- FinFolk member features preserve follow, ownership and verification requirements.
- StatsTrade has no inherited FinFolk follower requirement unless explicitly chosen.
- Duplicate inputs cannot repeat visits, code issuance or other effects.
- Uncertain outcomes do not invite blind retries.
- Codes and personal information never appear in public comments.
- Disabled features, empty results, deleted records and expired codes all have honest replies.
- Replies fit the channel byte limit and typing failures do not delay text.

All example copy is a target for implementation and review. The existing bot behaviour remains until the corresponding handlers and settings are changed.

