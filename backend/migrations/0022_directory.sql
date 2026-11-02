-- Public directory and private ownership/research records.
CREATE TABLE finfolk.directory_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document jsonb NOT NULL,
 status text NOT NULL DEFAULT 'candidate' CHECK(status IN ('candidate','published','rejected','archived','suppressed')),
 owner_id text REFERENCES finfolk.members(user_id) ON DELETE SET NULL,
 revision integer NOT NULL DEFAULT 1, reviewed_at timestamptz,
 outreach text NOT NULL DEFAULT 'Not contacted', notes text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE finfolk.directory_socials (
 identity text PRIMARY KEY, listing_id uuid NOT NULL REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE);
CREATE TABLE finfolk.directory_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES finfolk.directory_listings(id),
 user_id text REFERENCES finfolk.members(user_id) ON DELETE CASCADE, challenge text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','rejected')),
 evidence text NOT NULL DEFAULT '', reviewed_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX directory_pending_claim ON finfolk.directory_claims(listing_id,user_id) WHERE state='pending';
CREATE TABLE finfolk.directory_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), query text NOT NULL, state text NOT NULL DEFAULT 'running', error text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE finfolk.directory_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES finfolk.directory_listings(id), user_id text REFERENCES finfolk.members(user_id) ON DELETE SET NULL, message text NOT NULL, resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE finfolk.directory_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid REFERENCES finfolk.directory_listings(id), actor text, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX directory_public ON finfolk.directory_listings(status,lower(document->>'name'),id);
CREATE INDEX directory_owner ON finfolk.directory_listings(owner_id);
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk.directory_listings,finfolk.directory_socials,finfolk.directory_claims,finfolk.directory_runs,finfolk.directory_reports,finfolk.directory_audit TO finfolk_api;
