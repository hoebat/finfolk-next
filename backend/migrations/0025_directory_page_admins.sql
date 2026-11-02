CREATE TABLE finfolk.directory_page_admins (
 page_id uuid NOT NULL REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES finfolk.members(user_id) ON DELETE CASCADE,
 added_by text REFERENCES finfolk.members(user_id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(page_id,user_id));
CREATE TABLE finfolk.directory_page_invites (
 token_hash text PRIMARY KEY, page_id uuid NOT NULL REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE,
 invited_by text NOT NULL REFERENCES finfolk.members(user_id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 redeemed_by text REFERENCES finfolk.members(user_id) ON DELETE SET NULL, redeemed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now());
REVOKE ALL ON finfolk.directory_page_admins,finfolk.directory_page_invites FROM PUBLIC,finfolk_api;
