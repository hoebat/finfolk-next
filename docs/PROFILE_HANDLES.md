# Profile handles and account presentation

Profiles have a canonical, case-insensitive handle. Edit profile accepts 3–40
lowercase letters, digits, underscores or hyphens, starting and ending with a
letter or digit. Reserved application names and another member's reserved default
handle cannot be claimed. A database constraint and unique index enforce canonical
storage; a transaction lock serialises competing claims. Handle changes use the
existing preferences action and are included in profile revision history.

`User.handle` is the canonical optional column. Existing and new members without a
chosen handle receive `diver-<UUID without hyphens>` in profile responses. This is
computed from the stable account ID and needs no bulk profile rewrite. Choosing a
handle replaces the default public URL; existing `/profile` and `/members/<id>`
links remain supported. Account erasure clears the chosen handle.

`/u/<handle>` uses the declared `publicProfileByHandle` operation. Its server RPC
always binds an anonymous viewer, even if the HTTP request contains a bearer.
It reuses the existing profile visibility rules and public-session filtering.
Closed profiles return a restricted view without biography, portrait, sharing
preferences or sessions. Missing/malformed handles produce an unavailable page.
Uppercase URLs redirect to the canonical lowercase path. The shared profile view
supports both signed-in viewers and anonymous public visitors. People cards link
to handles when the server supplies one; older member-ID links still work.

The account widget's presentation snapshot contains only actor ID, display name,
portrait and timestamp. It is local to the browser origin, expires after seven
days, and grants no authenticated access. The widget uses it during SDK/session
restoration and profile revalidation; confirmed guest state, sign-out, another
actor and access denials clear or reject it. An empty cold-start skeleton replaces
the previous generic name and illustrated avatar while no identity is known.

Illustrations use existing static WebP assets. Saved raster portraits are decoded
to short-lived Blob URLs for rendering, with URL cleanup on change/unmount. The
image bytes remain in the existing profile storage, but base64 image data is no
longer repeated in the shared portrait's `img.src` attributes.

Authored changes are under `src/finfolkdb`, `src-app/finfolk_web` and the Next.js
app/lib sources. Regenerate SQL, typed contracts and backbone packages together.
Production rollout requires the normal reviewed schema/API release before the
frontend that uses the new operation. Generation and the mock preview do not
install production SQL. The release preserves the existing API source and service bindings, including
profile setup, People search and page integrations already running in production.
The frontend is published from committed main through GitHub Actions after its
verification gates pass.

Verification: `tests/db/profile_handles.mjs` uses disposable native PostgreSQL and
the real HTTP adapter; it covers defaults, normalisation, collisions, concurrent
claims, rollback, reserved names, lengths, the account role and public privacy.
`test_account_presentation.mjs` checks presentation cache boundaries and portrait
bytes. Browser journeys cover delayed auth/profile restoration, avatar URLs,
widget dimensions, sign-out, editable handles, anonymous profiles, canonical
URLs and mobile layout. Receipts are under `.cache/profile-handles`.
