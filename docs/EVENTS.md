# Events and the main directory

Discover includes Directory and Events alongside the existing location views.
Public routes are `/directory`, `/directory/<id>`, `/events` and `/events/<id>`.
Verified members use `/events/my` and manage events through My pages. Event
creators must currently own or administer a published, claimed Finfolk page.

One-off events support drafts, direct publication, cancellation, duplicate-to-draft,
public/private visibility and optional capacity. Dates are entered in the
organiser's browser timezone and saved as UTC instants with an IANA display zone.
Published visibility cannot change; events with active RSVPs cannot return to draft.
Capacity cannot be reduced below current attendance. RSVP closes at the start.

Private event links alone never grant access. The organiser enters an email and
shares a single-use invitation link manually. Tokens are hashed; invitations expire
after seven days or at event start. Redemption requires the matching verified
managed-Auth email. Acceptance grants access; the guest then RSVPs separately.
Only page managers see the attendee roster and invitation emails. Private event
operations are excluded from persistent SQLite caching. No email is sent by Finfolk.

Event business rules and projections live in generated finfolkdb functions.
The API role has function-only access to event tables; UI data uses xt.substrate.
Tests cover last-seat races, unauthorised edits, private discovery exclusion,
wrong-email invitations, revoked access and direct-table permission denial.

Release additive migrations through `0027_backbone_events.sql`, preserving the
existing readiness marker until the compatible API is deployed. During cutover,
`DB_SQL_SHA_PREVIOUS` may name the single known previous release, alongside the
current configured hash. Remove it after publishing the new readiness marker.
Deploy the matching frontend only after API verification. Never roll back data
or authentication accounts to roll back the frontend.
