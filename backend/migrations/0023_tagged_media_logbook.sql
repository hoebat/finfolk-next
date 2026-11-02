-- Private tagged-media inbox. Imports never create sessions or check-ins automatically.
CREATE TABLE finfolk.media_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id text NOT NULL REFERENCES finfolk.members(user_id) ON DELETE CASCADE,
 platform text NOT NULL CHECK(platform IN ('instagram','tiktok')),
 provider_id text NOT NULL,
 url text NOT NULL,
 kind text NOT NULL DEFAULT 'post',
 posted_at timestamptz,
 day date,
 beach_id text REFERENCES finfolk.beaches(id),
 location_name text NOT NULL DEFAULT '',
 candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
 notes text NOT NULL DEFAULT '',
 session_id uuid REFERENCES finfolk.sessions(id) ON DELETE SET NULL,
 state text NOT NULL DEFAULT 'active' CHECK(state IN ('active','hidden')),
 edited boolean NOT NULL DEFAULT false,
 assignment_key uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,platform,provider_id)
);
CREATE INDEX media_imports_inbox ON finfolk.media_imports(owner_id,created_at DESC,id DESC) WHERE session_id IS NULL AND state='active';
CREATE INDEX media_imports_session ON finfolk.media_imports(session_id) WHERE session_id IS NOT NULL;
CREATE TABLE finfolk.tiktok_connections (
 user_id text PRIMARY KEY REFERENCES finfolk.members(user_id) ON DELETE CASCADE,
 app_id text NOT NULL,
 open_id text,
 display_name text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','connected','disconnected','reconnect')),
 credential_ciphertext text,
 access_expires_at timestamptz,
 refresh_expires_at timestamptz,
 oauth_hash text,
 oauth_expires_at timestamptz,
 oauth_nonce_hash text,
 last_success timestamptz,
 next_at timestamptz NOT NULL DEFAULT now(),
 lease_until timestamptz,
 cursor text,
 failures integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(app_id,open_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk.media_imports,finfolk.tiktok_connections TO finfolk_api;
