-- Generated fresh-install schema. External prerequisites: finfolk_api and managed Neon Auth.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') OR to_regclass('neon_auth."user"') IS NULL THEN RAISE EXCEPTION 'Provision finfolk_api and Neon Auth before installing the schema'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) THEN RAISE EXCEPTION 'Fresh schema requires empty application schemas'; END IF; END $$;
CREATE SCHEMA IF NOT EXISTS finfolk;
CREATE SCHEMA IF NOT EXISTS finfolk_rpc;
CREATE TABLE finfolk.beaches (id text NOT NULL, name text NOT NULL, timezone text NOT NULL, area_name text NOT NULL DEFAULT ''::text, state text NOT NULL DEFAULT ''::text, PRIMARY KEY (id));
CREATE TABLE finfolk.blocks (owner_id text NOT NULL, target_id text NOT NULL, CHECK ((owner_id <> target_id)), PRIMARY KEY (owner_id, target_id));
CREATE TABLE finfolk.checkins (user_id text NOT NULL, beach_id text NOT NULL, visit_day date NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), checked_in_at timestamptz, checked_out_at timestamptz, PRIMARY KEY (user_id, beach_id, visit_day), CHECK (((checked_out_at IS NULL) OR ((checked_in_at IS NOT NULL) AND (checked_out_at >= checked_in_at)))));
CREATE TABLE finfolk.community_referrals (day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Australia/Sydney'::text))::date, platform text NOT NULL, clicks bigint NOT NULL DEFAULT 0, PRIMARY KEY (day, platform), CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text]))));
CREATE TABLE finfolk.connections (a text NOT NULL, b text NOT NULL, requested_by text NOT NULL, status text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((a < b)), CHECK (((requested_by = a) OR (requested_by = b))), PRIMARY KEY (a, b), CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'removed'::text]))));
CREATE TABLE finfolk.directory_audit (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid, actor text, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.directory_claims (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, user_id text, challenge text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval), state text NOT NULL DEFAULT 'pending'::text, evidence text NOT NULL DEFAULT ''::text, reviewed_by text, created_at timestamptz NOT NULL DEFAULT now(), CHECK ((state = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))), PRIMARY KEY (id));
CREATE TABLE finfolk.directory_listings (id uuid NOT NULL DEFAULT gen_random_uuid(), document jsonb NOT NULL, status text NOT NULL DEFAULT 'candidate'::text, owner_id text, revision integer NOT NULL DEFAULT 1, reviewed_at timestamptz, outreach text NOT NULL DEFAULT 'Not contacted'::text, notes text NOT NULL DEFAULT ''::text, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((status = ANY (ARRAY['candidate'::text, 'published'::text, 'rejected'::text, 'archived'::text, 'suppressed'::text]))), PRIMARY KEY (id));
CREATE TABLE finfolk.directory_page_admins (page_id uuid NOT NULL, user_id text NOT NULL, added_by text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (page_id, user_id));
CREATE TABLE finfolk.directory_page_invites (token_hash text NOT NULL, page_id uuid NOT NULL, invited_by text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval), redeemed_by text, redeemed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (token_hash));
CREATE TABLE finfolk.directory_reports (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, user_id text, message text NOT NULL, resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.directory_runs (id uuid NOT NULL DEFAULT gen_random_uuid(), query text NOT NULL, state text NOT NULL DEFAULT 'running'::text, error text NOT NULL DEFAULT ''::text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.directory_socials (identity text NOT NULL, listing_id uuid NOT NULL, PRIMARY KEY (identity));
CREATE TABLE finfolk.event_audit (id uuid NOT NULL DEFAULT gen_random_uuid(), event_id uuid, actor text, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.event_invites (token_hash text NOT NULL, event_id uuid NOT NULL, email text NOT NULL, expires_at timestamptz NOT NULL, accepted_by text, revoked boolean NOT NULL DEFAULT false, PRIMARY KEY (token_hash));
CREATE TABLE finfolk.event_rsvps (event_id uuid NOT NULL, user_id text NOT NULL, state text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((state = ANY (ARRAY['going'::text, 'cancelled'::text]))), PRIMARY KEY (event_id, user_id));
CREATE TABLE finfolk.events (id uuid NOT NULL DEFAULT gen_random_uuid(), page_id uuid NOT NULL, document jsonb NOT NULL, state text NOT NULL DEFAULT 'draft'::text, visibility text NOT NULL DEFAULT 'public'::text, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, timezone text NOT NULL, capacity integer, revision integer NOT NULL DEFAULT 1, hidden boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((state = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text]))), CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text]))), CHECK ((capacity > 0)), CHECK ((ends_at > starts_at)), PRIMARY KEY (id));
CREATE TABLE finfolk.instagram_actions (id uuid NOT NULL DEFAULT gen_random_uuid(), source_id text NOT NULL, owner_id text, sender_id text, kind text NOT NULL, state text NOT NULL DEFAULT 'review'::text, data jsonb NOT NULL DEFAULT '{}'::jsonb, member_confirmed boolean NOT NULL DEFAULT false, session_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((kind = ANY (ARRAY['reply'::text, 'stats'::text, 'dive'::text, 'points'::text]))), PRIMARY KEY (id), UNIQUE (source_id, kind));
CREATE TABLE finfolk.instagram_audit (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, action_id uuid, actor text NOT NULL, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.instagram_claims (user_id text NOT NULL, code_hash text, state text NOT NULL DEFAULT 'waiting'::text, sender_id text, handle text, error text NOT NULL DEFAULT ''::text, expires_at timestamptz NOT NULL, follow_checked_at timestamptz, review_requested_at timestamptz, verified_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), claim_id uuid NOT NULL DEFAULT gen_random_uuid(), provider_scope text NOT NULL DEFAULT 'facebook-login:legacy'::text, UNIQUE (claim_id), UNIQUE (code_hash), PRIMARY KEY (user_id), CHECK ((state = ANY (ARRAY['waiting'::text, 'checking'::text, 'follow_required'::text, 'failed'::text, 'review_requested'::text, 'claimed'::text, 'cancelled'::text]))));
CREATE TABLE finfolk.instagram_commands (id text NOT NULL, context text NOT NULL, actor_id text NOT NULL, namespace text NOT NULL, media_id text, owner_id text, command text NOT NULL, args jsonb NOT NULL DEFAULT '{}'::jsonb, source_url text, comment_at timestamptz, received_at timestamptz NOT NULL DEFAULT now(), state text NOT NULL DEFAULT 'new'::text, result text, beach_id text, visit_day date, reply text, send_state text NOT NULL DEFAULT 'pending'::text, reply_id text, updated_at timestamptz NOT NULL DEFAULT now(), send_started_at timestamptz, CHECK ((context = ANY (ARRAY['mention'::text, 'owned'::text]))), PRIMARY KEY (id), CHECK ((send_state = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'uncertain'::text, 'skipped'::text]))), CHECK ((state = ANY (ARRAY['new'::text, 'confirmation'::text, 'done'::text, 'cancelled'::text, 'limited'::text]))));
CREATE TABLE finfolk.instagram_comment_identities (user_id text NOT NULL, namespace text NOT NULL, actor_id text, sender_id text NOT NULL, handle text NOT NULL, challenge_hash text, expires_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), connection_scope text NOT NULL DEFAULT 'facebook-login:legacy'::text, connection_version uuid, UNIQUE (challenge_hash), UNIQUE (namespace, actor_id), PRIMARY KEY (user_id));
CREATE TABLE finfolk.instagram_connect_codes (id uuid NOT NULL DEFAULT gen_random_uuid(), code_hash text NOT NULL, sender_id text NOT NULL, handle text NOT NULL, provider_scope text NOT NULL, generation integer NOT NULL, event_id text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + '00:10:00'::interval), invalidated boolean NOT NULL DEFAULT false, consumed_by text, consumed_version uuid, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (code_hash), UNIQUE (event_id), PRIMARY KEY (id));
CREATE TABLE finfolk.instagram_connect_limits (bucket text NOT NULL, count integer NOT NULL, resets_at timestamptz NOT NULL, PRIMARY KEY (bucket));
CREATE TABLE finfolk.instagram_connections (user_id text NOT NULL, handle text NOT NULL, sender_id text, status text NOT NULL DEFAULT 'pending'::text, challenge_hash text, expires_at timestamptz, public_points boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), share_posts boolean NOT NULL DEFAULT false, media_owner_id text, provider_scope text NOT NULL DEFAULT 'facebook-login:legacy'::text, identity_version uuid NOT NULL DEFAULT gen_random_uuid(), PRIMARY KEY (user_id));
CREATE TABLE finfolk.instagram_discoveries (id uuid NOT NULL DEFAULT gen_random_uuid(), media_id text, url text NOT NULL, owner_id text, author_id text, author text, beach_id text, candidates jsonb NOT NULL DEFAULT '[]'::jsonb, caption text NOT NULL DEFAULT ''::text, posted_at timestamptz, state text NOT NULL DEFAULT 'pending'::text, automatic boolean NOT NULL DEFAULT false, sources jsonb NOT NULL DEFAULT '[]'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), checked_at timestamptz, CHECK (((media_id IS NULL) OR (media_id ~ '^[0-9]{1,40}$'::text))), UNIQUE (media_id), PRIMARY KEY (id), CHECK ((state = ANY (ARRAY['pending'::text, 'published'::text, 'hidden'::text, 'rejected'::text, 'unavailable'::text]))), UNIQUE (url));
CREATE TABLE finfolk.instagram_discovery_audit (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, discovery_id uuid, actor text NOT NULL, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.instagram_dm_events (id text NOT NULL, sender_id text NOT NULL, recipient_id text NOT NULL, command text NOT NULL, args text NOT NULL DEFAULT ''::text, challenge_hash text, message_at timestamptz NOT NULL, status text NOT NULL DEFAULT 'queued'::text, attempts integer NOT NULL DEFAULT 0, lease uuid, reply text, send_state text NOT NULL DEFAULT 'pending'::text, error text NOT NULL DEFAULT ''::text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), owner_id text, event_id uuid NOT NULL DEFAULT gen_random_uuid(), provider_scope text NOT NULL DEFAULT 'facebook-login:legacy'::text, correlation_id uuid NOT NULL DEFAULT gen_random_uuid(), processing_state text NOT NULL DEFAULT 'ignored'::text, generation integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), follow_checked_at timestamptz, sender_handle text, rate_limit_key text, UNIQUE (event_id), PRIMARY KEY (id), CHECK ((processing_state = ANY (ARRAY['received'::text, 'queued'::text, 'processing'::text, 'completed'::text, 'ignored'::text, 'blocked'::text, 'paused'::text, 'failed'::text]))), CHECK ((send_state = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'uncertain'::text, 'skipped'::text]))), CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'done'::text, 'error'::text]))));
CREATE TABLE finfolk.instagram_dm_limits (sender_id text NOT NULL, minute timestamptz NOT NULL DEFAULT date_trunc('minute'::text, now()), count integer NOT NULL DEFAULT 0, prompted_at timestamptz, PRIMARY KEY (sender_id));
CREATE TABLE finfolk.instagram_events (id text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'queued'::text, attempts integer NOT NULL DEFAULT 0, error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.instagram_post_reports (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, discovery_id uuid NOT NULL, reason text NOT NULL, day date NOT NULL DEFAULT CURRENT_DATE, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (discovery_id, reason, day), PRIMARY KEY (id), CHECK ((reason = ANY (ARRAY['wrong_location'::text, 'inappropriate'::text, 'removed'::text, 'other'::text]))));
CREATE TABLE finfolk.instagram_sources (key text NOT NULL, kind text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, checkpoint text, last_success timestamptz, next_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, failures integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'ready'::text, CHECK ((kind = ANY (ARRAY['tags'::text, 'hashtag'::text, 'recheck'::text]))), PRIMARY KEY (key));
CREATE TABLE finfolk.instagram_suppressed_sources (author_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (author_id));
CREATE TABLE finfolk.invitation_joins (invitee_id text NOT NULL, inviter_id text NOT NULL, verified_sender_id text, rewarded_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), CHECK ((invitee_id <> inviter_id)), PRIMARY KEY (invitee_id), UNIQUE (verified_sender_id));
CREATE TABLE finfolk.invitations (code text NOT NULL, inviter_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (inviter_id), PRIMARY KEY (code));
CREATE TABLE finfolk.media_imports (id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id text NOT NULL, platform text NOT NULL, provider_id text NOT NULL, url text NOT NULL, kind text NOT NULL DEFAULT 'post'::text, posted_at timestamptz, day date, beach_id text, location_name text NOT NULL DEFAULT ''::text, candidates jsonb NOT NULL DEFAULT '[]'::jsonb, notes text NOT NULL DEFAULT ''::text, session_id uuid, state text NOT NULL DEFAULT 'active'::text, edited boolean NOT NULL DEFAULT false, assignment_key uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (owner_id, platform, provider_id), PRIMARY KEY (id), CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text]))), CHECK ((state = ANY (ARRAY['active'::text, 'hidden'::text]))));
CREATE TABLE finfolk.members (user_id text NOT NULL, profile jsonb NOT NULL DEFAULT '{}'::jsonb, deleted boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(), invite_eligible boolean NOT NULL DEFAULT false, joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id));
CREATE TABLE finfolk.messaging_accounts (id text NOT NULL, account_id text, username text, credential_ciphertext text, token_expires_at timestamptz, mode text NOT NULL DEFAULT 'disabled'::text, enabled_commands jsonb NOT NULL DEFAULT '["ping", "help"]'::jsonb, pilot_sender_ids jsonb NOT NULL DEFAULT '[]'::jsonb, generation integer NOT NULL DEFAULT 1, checks jsonb NOT NULL DEFAULT '{}'::jsonb, last_webhook_at timestamptz, last_command_at timestamptz, last_reply_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), backoff_until timestamptz, provider_scope text, CHECK ((id = 'instagram'::text)), CHECK ((mode = ANY (ARRAY['disabled'::text, 'pilot'::text, 'live'::text]))), PRIMARY KEY (id));
CREATE TABLE finfolk.messaging_audit (id uuid NOT NULL DEFAULT gen_random_uuid(), actor text NOT NULL, event text NOT NULL, correlation_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.messaging_idempotency (user_id text NOT NULL, key_hash text NOT NULL, request_hash text NOT NULL, response_ciphertext text, response_status integer NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, key_hash));
CREATE TABLE finfolk.messaging_oauth_states (state_hash text NOT NULL, user_id text NOT NULL, expires_at timestamptz NOT NULL, consumed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), flow_key text, PRIMARY KEY (state_hash));
CREATE TABLE finfolk.messaging_outbox (id uuid NOT NULL DEFAULT gen_random_uuid(), event_id text NOT NULL, body text NOT NULL, correlation_id uuid NOT NULL, state text NOT NULL DEFAULT 'pending'::text, attempts integer NOT NULL DEFAULT 0, lease uuid, next_attempt_at timestamptz NOT NULL DEFAULT now(), deadline timestamptz NOT NULL, provider_message_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), body_ciphertext text, reply_kind text NOT NULL DEFAULT 'text'::text, connect_code_id uuid, CHECK ((length(body) <= 2000)), UNIQUE (event_id), PRIMARY KEY (id), CHECK ((reply_kind = ANY (ARRAY['text'::text, 'connect_code'::text, 'connect_guidance'::text]))), CHECK ((state = ANY (ARRAY['pending'::text, 'sending'::text, 'provider_accepted'::text, 'failed'::text, 'uncertain'::text, 'cancelled'::text, 'expired'::text]))));
CREATE TABLE finfolk.points_ledger (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id text NOT NULL, action_id uuid NOT NULL, day date NOT NULL, points integer NOT NULL DEFAULT 1, reversed boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (action_id), PRIMARY KEY (id), CHECK ((points = 1)), UNIQUE (user_id, day));
CREATE TABLE finfolk.post_reports (id uuid NOT NULL DEFAULT gen_random_uuid(), post_id uuid NOT NULL, reporter_id text NOT NULL, reason text NOT NULL, status text NOT NULL DEFAULT 'open'::text, resolved_by text, resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), UNIQUE (post_id, reporter_id), CHECK (((length(reason) >= 1) AND (length(reason) <= 1000))), CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text]))));
CREATE TABLE finfolk.post_reviews (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, post_id uuid NOT NULL, actor text NOT NULL, decision text NOT NULL, reason text NOT NULL DEFAULT ''::text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.posts (id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id text NOT NULL, beach_id text NOT NULL, url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'pending'::text, public_consent boolean NOT NULL DEFAULT false, creator_handle text NOT NULL DEFAULT ''::text, platform text NOT NULL DEFAULT ''::text, rejection_reason text NOT NULL DEFAULT ''::text, reviewed_by text, reviewed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (owner_id, beach_id, url), PRIMARY KEY (id), CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'removed'::text]))));
CREATE TABLE finfolk.reports (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, owner_id text NOT NULL, target_id text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.request_limits (user_id text NOT NULL, minute timestamptz NOT NULL, count integer NOT NULL, PRIMARY KEY (user_id));
CREATE TABLE finfolk.sessions (id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id text NOT NULL, beach_id text, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.site_access_points (id uuid NOT NULL DEFAULT gen_random_uuid(), revision_id uuid NOT NULL, mode text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY (id), CHECK ((mode = ANY (ARRAY['shore'::text, 'departure'::text]))));
CREATE TABLE finfolk.site_catalog (id integer NOT NULL, revision bigint NOT NULL DEFAULT 0, metadata jsonb NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (id), CHECK ((id = 1)), CHECK ((revision >= 0)));
CREATE TABLE finfolk.site_depth_evidence (id uuid NOT NULL DEFAULT gen_random_uuid(), revision_id uuid NOT NULL, kind text NOT NULL, payload jsonb NOT NULL, PRIMARY KEY (id), CHECK ((kind = ANY (ARRAY['surveyed'::text, 'reported'::text]))));
CREATE TABLE finfolk.site_imports (id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id text, preview jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'draft'::text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text]))));
CREATE TABLE finfolk.site_profiles (id text NOT NULL, revision bigint NOT NULL, waterbody text NOT NULL, access_mode text NOT NULL, status text NOT NULL, payload jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), CHECK ((waterbody = ANY (ARRAY['ocean'::text, 'lake'::text, 'river'::text, 'quarry'::text, 'sinkhole'::text, 'pool'::text, 'unknown'::text]))), CHECK ((access_mode = ANY (ARRAY['shore'::text, 'boat_only'::text, 'shore_or_boat'::text, 'unknown'::text]))), CHECK ((status = ANY (ARRAY['published'::text, 'archived'::text]))));
CREATE TABLE finfolk.site_revisions (id uuid NOT NULL DEFAULT gen_random_uuid(), site_id text NOT NULL, owner_id text, import_id uuid, base_revision bigint NOT NULL DEFAULT 0, version bigint NOT NULL DEFAULT 1, status text NOT NULL, payload jsonb NOT NULL, reason text NOT NULL DEFAULT ''::text, reviewed_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'published'::text, 'rejected'::text, 'withdrawn'::text]))));
CREATE TABLE finfolk.tiktok_connections (user_id text NOT NULL, app_id text NOT NULL, open_id text, display_name text NOT NULL DEFAULT ''::text, status text NOT NULL DEFAULT 'pending'::text, credential_ciphertext text, access_expires_at timestamptz, refresh_expires_at timestamptz, oauth_hash text, oauth_expires_at timestamptz, oauth_nonce_hash text, last_success timestamptz, next_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, cursor text, failures integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (app_id, open_id), PRIMARY KEY (user_id), CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'disconnected'::text, 'reconnect'::text]))));
CREATE TABLE finfolk.trip_dives (import_id uuid NOT NULL, ordinal integer NOT NULL, day date NOT NULL, data jsonb NOT NULL, PRIMARY KEY (import_id, ordinal));
CREATE TABLE finfolk.trip_import_batches (import_id uuid NOT NULL, batch_index integer NOT NULL, rows jsonb NOT NULL, CHECK (((batch_index >= 0) AND (batch_index <= 9999))), PRIMARY KEY (import_id, batch_index));
CREATE TABLE finfolk.trip_imports (id uuid NOT NULL DEFAULT gen_random_uuid(), trip_id uuid NOT NULL, expected_rows integer NOT NULL, state text NOT NULL DEFAULT 'uploading'::text, fingerprint text, created_at timestamptz NOT NULL DEFAULT now(), CHECK (((expected_rows >= 1) AND (expected_rows <= 10000))), PRIMARY KEY (id), CHECK ((state = ANY (ARRAY['uploading'::text, 'complete'::text]))));
CREATE TABLE finfolk.trip_reviews (id bigint GENERATED ALWAYS AS IDENTITY NOT NULL, trip_id uuid NOT NULL, actor text NOT NULL, decision text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE finfolk.trips (id uuid NOT NULL DEFAULT gen_random_uuid(), owner_id text NOT NULL, draft jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, active_import uuid, published jsonb, pending jsonb, published_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
ALTER TABLE finfolk.blocks ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.blocks ADD FOREIGN KEY (target_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.checkins ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.checkins ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.connections ADD FOREIGN KEY (a) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.connections ADD FOREIGN KEY (b) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_audit ADD FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id);
ALTER TABLE finfolk.directory_claims ADD FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id);
ALTER TABLE finfolk.directory_claims ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_listings ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.directory_page_admins ADD FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_page_admins ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_page_admins ADD FOREIGN KEY (added_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.directory_page_invites ADD FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_page_invites ADD FOREIGN KEY (invited_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.directory_page_invites ADD FOREIGN KEY (redeemed_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.directory_reports ADD FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id);
ALTER TABLE finfolk.directory_reports ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.directory_socials ADD FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE;
ALTER TABLE finfolk.event_audit ADD FOREIGN KEY (event_id) REFERENCES finfolk.events(id);
ALTER TABLE finfolk.event_invites ADD FOREIGN KEY (event_id) REFERENCES finfolk.events(id);
ALTER TABLE finfolk.event_invites ADD FOREIGN KEY (accepted_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.event_rsvps ADD FOREIGN KEY (event_id) REFERENCES finfolk.events(id);
ALTER TABLE finfolk.event_rsvps ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.events ADD FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id);
ALTER TABLE finfolk.instagram_actions ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_audit ADD FOREIGN KEY (action_id) REFERENCES finfolk.instagram_actions(id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_claims ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_commands ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.instagram_commands ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_comment_identities ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_connect_codes ADD FOREIGN KEY (consumed_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_connect_codes ADD FOREIGN KEY (event_id) REFERENCES finfolk.instagram_dm_events(id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_connections ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_discoveries ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.instagram_discoveries ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.instagram_discovery_audit ADD FOREIGN KEY (discovery_id) REFERENCES finfolk.instagram_discoveries(id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_dm_events ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.instagram_post_reports ADD FOREIGN KEY (discovery_id) REFERENCES finfolk.instagram_discoveries(id) ON DELETE CASCADE;
ALTER TABLE finfolk.invitation_joins ADD FOREIGN KEY (invitee_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.invitation_joins ADD FOREIGN KEY (inviter_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.invitations ADD FOREIGN KEY (inviter_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.media_imports ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.media_imports ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.media_imports ADD FOREIGN KEY (session_id) REFERENCES finfolk.sessions(id) ON DELETE SET NULL;
ALTER TABLE finfolk.messaging_idempotency ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.messaging_oauth_states ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.messaging_outbox ADD FOREIGN KEY (connect_code_id) REFERENCES finfolk.instagram_connect_codes(id) ON DELETE SET NULL;
ALTER TABLE finfolk.messaging_outbox ADD FOREIGN KEY (event_id) REFERENCES finfolk.instagram_dm_events(id) ON DELETE CASCADE;
ALTER TABLE finfolk.points_ledger ADD FOREIGN KEY (action_id) REFERENCES finfolk.instagram_actions(id);
ALTER TABLE finfolk.points_ledger ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.post_reports ADD FOREIGN KEY (post_id) REFERENCES finfolk.posts(id) ON DELETE CASCADE;
ALTER TABLE finfolk.post_reports ADD FOREIGN KEY (reporter_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.post_reviews ADD FOREIGN KEY (post_id) REFERENCES finfolk.posts(id) ON DELETE CASCADE;
ALTER TABLE finfolk.posts ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.posts ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.reports ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.request_limits ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.sessions ADD FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.sessions ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.site_access_points ADD FOREIGN KEY (revision_id) REFERENCES finfolk.site_revisions(id) ON DELETE CASCADE;
ALTER TABLE finfolk.site_depth_evidence ADD FOREIGN KEY (revision_id) REFERENCES finfolk.site_revisions(id) ON DELETE CASCADE;
ALTER TABLE finfolk.site_imports ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.site_profiles ADD FOREIGN KEY (id) REFERENCES finfolk.beaches(id);
ALTER TABLE finfolk.site_revisions ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.site_revisions ADD FOREIGN KEY (reviewed_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL;
ALTER TABLE finfolk.site_revisions ADD FOREIGN KEY (import_id) REFERENCES finfolk.site_imports(id) ON DELETE CASCADE;
ALTER TABLE finfolk.tiktok_connections ADD FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
ALTER TABLE finfolk.trip_dives ADD FOREIGN KEY (import_id) REFERENCES finfolk.trip_imports(id) ON DELETE CASCADE;
ALTER TABLE finfolk.trip_import_batches ADD FOREIGN KEY (import_id) REFERENCES finfolk.trip_imports(id) ON DELETE CASCADE;
ALTER TABLE finfolk.trip_imports ADD FOREIGN KEY (trip_id) REFERENCES finfolk.trips(id) ON DELETE CASCADE;
ALTER TABLE finfolk.trip_reviews ADD FOREIGN KEY (trip_id) REFERENCES finfolk.trips(id) ON DELETE CASCADE;
ALTER TABLE finfolk.trips ADD FOREIGN KEY (active_import) REFERENCES finfolk.trip_imports(id) ON DELETE SET NULL;
ALTER TABLE finfolk.trips ADD FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE;
CREATE UNIQUE INDEX checkins_active_member ON finfolk.checkins USING btree (user_id) WHERE ((checked_in_at IS NOT NULL) AND (checked_out_at IS NULL));
CREATE INDEX checkins_beach_recent ON finfolk.checkins USING btree (beach_id, visit_day, user_id);
CREATE INDEX directory_owner ON finfolk.directory_listings USING btree (owner_id);
CREATE UNIQUE INDEX directory_pending_claim ON finfolk.directory_claims USING btree (listing_id, user_id) WHERE (state = 'pending'::text);
CREATE INDEX directory_public ON finfolk.directory_listings USING btree (status, lower((document ->> 'name'::text)), id);
CREATE INDEX instagram_actions_owner ON finfolk.instagram_actions USING btree (owner_id, created_at DESC);
CREATE INDEX instagram_commands_owner ON finfolk.instagram_commands USING btree (owner_id, received_at DESC);
CREATE INDEX instagram_commands_post ON finfolk.instagram_commands USING btree (media_id, received_at DESC);
CREATE INDEX instagram_commands_recent ON finfolk.instagram_commands USING btree (received_at DESC);
CREATE INDEX instagram_commands_send ON finfolk.instagram_commands USING btree (updated_at) WHERE (send_state = ANY (ARRAY['pending'::text, 'sending'::text, 'uncertain'::text]));
CREATE INDEX instagram_commands_sender ON finfolk.instagram_commands USING btree (namespace, actor_id, received_at DESC);
CREATE INDEX instagram_commands_sent_recent ON finfolk.instagram_commands USING btree (send_started_at DESC) WHERE (send_started_at IS NOT NULL);
CREATE INDEX instagram_comment_connection ON finfolk.instagram_comment_identities USING btree (user_id, connection_scope, connection_version);
CREATE INDEX instagram_connect_sender ON finfolk.instagram_connect_codes USING btree (provider_scope, sender_id);
CREATE UNIQUE INDEX instagram_connected_handle ON finfolk.instagram_connections USING btree (lower(handle)) WHERE (status = 'connected'::text);
CREATE INDEX instagram_discovery_feed ON finfolk.instagram_discoveries USING btree (beach_id, created_at DESC, id DESC) WHERE (state = 'published'::text);
CREATE INDEX instagram_discovery_owner ON finfolk.instagram_discoveries USING btree (owner_id, created_at DESC);
CREATE INDEX instagram_discovery_review ON finfolk.instagram_discoveries USING btree (created_at) WHERE (state = 'pending'::text);
CREATE INDEX instagram_dm_claim ON finfolk.instagram_dm_events USING btree (challenge_hash, sender_id);
CREATE INDEX instagram_dm_owner ON finfolk.instagram_dm_events USING btree (owner_id) WHERE (owner_id IS NOT NULL);
CREATE INDEX instagram_dm_pending ON finfolk.instagram_dm_events USING btree (status, created_at);
CREATE UNIQUE INDEX instagram_media_owner ON finfolk.instagram_connections USING btree (media_owner_id) WHERE (media_owner_id IS NOT NULL);
CREATE UNIQUE INDEX instagram_sender_scope ON finfolk.instagram_connections USING btree (provider_scope, sender_id) WHERE (sender_id IS NOT NULL);
CREATE INDEX media_imports_inbox ON finfolk.media_imports USING btree (owner_id, created_at DESC, id DESC) WHERE ((session_id IS NULL) AND (state = 'active'::text));
CREATE INDEX media_imports_session ON finfolk.media_imports USING btree (session_id) WHERE (session_id IS NOT NULL);
CREATE INDEX messaging_events_work ON finfolk.instagram_dm_events USING btree (processing_state, next_attempt_at);
CREATE INDEX messaging_outbox_work ON finfolk.messaging_outbox USING btree (state, next_attempt_at);
CREATE INDEX posts_public_feed ON finfolk.posts USING btree (beach_id, created_at DESC, id DESC) WHERE ((status = 'approved'::text) AND public_consent);
CREATE INDEX posts_review_queue ON finfolk.posts USING btree (status, created_at DESC);
CREATE INDEX sessions_owner_beach ON finfolk.sessions USING btree (owner_id, beach_id);
CREATE INDEX site_revisions_import_idx ON finfolk.site_revisions USING btree (import_id);
CREATE INDEX site_revisions_owner_idx ON finfolk.site_revisions USING btree (owner_id, updated_at);
CREATE INDEX site_revisions_status_idx ON finfolk.site_revisions USING btree (status, updated_at);
CREATE INDEX trip_dives_day ON finfolk.trip_dives USING btree (import_id, day);
CREATE INDEX trip_import_trip ON finfolk.trip_imports USING btree (trip_id);
CREATE INDEX trips_owner ON finfolk.trips USING btree (owner_id, updated_at DESC);
CREATE INDEX trips_public_beach ON finfolk.trips USING btree (((published ->> 'beachId'::text)), published_at DESC, id DESC) WHERE (published IS NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA finfolk FROM PUBLIC;
GRANT USAGE ON SCHEMA finfolk TO finfolk_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA finfolk TO finfolk_api;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA finfolk TO finfolk_api;
-- Generated by scripts/generate_db.mjs from finfolkdb source declarations.
CREATE SCHEMA IF NOT EXISTS finfolk_rpc;


-- finfolkdb.common.fn-system-auth/actor-id 
CREATE OR REPLACE FUNCTION "finfolk_rpc".actor_id() RETURNS TEXT AS $$

  SELECT coalesce(current_setting('finfolk.actor_id',true),'');

$$ LANGUAGE 'sql';

-- finfolkdb.common.fn-system-auth/member-permitted 
CREATE OR REPLACE FUNCTION "finfolk_rpc".member_permitted(
  verified_required BOOLEAN
) RETURNS BOOLEAN AS $$

  SELECT (EXISTS (SELECT 1 FROM "neon_auth"."user" WHERE (("id")::TEXT = "finfolk_rpc".actor_id()) AND (coalesce("banned",false) = false) AND ((verified_required = false) OR ("emailVerified" = true))));

$$ LANGUAGE 'sql' SECURITY DEFINER;

-- finfolkdb.common.fn-system-auth/auth-identity 
CREATE OR REPLACE FUNCTION "finfolk_rpc".auth_identity(
  i_user_id TEXT
) RETURNS JSONB AS $$

  SELECT jsonb_build_object('id',("id")::TEXT,'name',"name",'verified',"emailVerified") FROM "neon_auth"."user" WHERE (("id")::TEXT = i_user_id) AND (coalesce("banned",false) = false);

$$ LANGUAGE 'sql' SECURITY DEFINER;

-- finfolkdb.fn.member.member-profile/member-profile 
CREATE OR REPLACE FUNCTION "finfolk_rpc".member_profile() RETURNS JSONB AS $$

  SELECT "profile" FROM "finfolk"."members" WHERE ("user_id" = "finfolk_rpc".actor_id()) AND ("deleted" = false) AND "finfolk_rpc".member_permitted(false);

$$ LANGUAGE 'sql';

-- finfolkdb.fn.member.member-profile/profile-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".profile_save(
  value JSONB
) RETURNS JSONB AS $$

  UPDATE "finfolk"."members" SET "profile" = value,"updated_at" = now() WHERE ("user_id" = "finfolk_rpc".actor_id()) AND ("deleted" = false) AND ("jsonb_typeof"(value) = 'object') AND "finfolk_rpc".member_permitted(coalesce(value ->> 'open','false') = 'true') RETURNING "profile";

$$ LANGUAGE 'sql';

-- finfolkdb.fn.member.member-profile/checkin-record 
CREATE OR REPLACE FUNCTION "finfolk_rpc".checkin_record(
  i_beach_id TEXT
) RETURNS JSONB AS $$

  WITH eligible AS (SELECT "id","timezone" FROM "finfolk"."beaches" WHERE ("id" = i_beach_id) AND NOT EXISTS (SELECT 1 FROM "finfolk"."site_profiles" WHERE ("id" = i_beach_id) AND ("status" = 'archived')) AND EXISTS (SELECT 1 FROM "finfolk"."members" WHERE ("user_id" = "finfolk_rpc".actor_id()) AND ("deleted" = false) AND "finfolk_rpc".member_permitted(true))), inserted AS (  
    INSERT INTO "finfolk"."checkins" ("user_id","beach_id","visit_day") SELECT
      "finfolk_rpc".actor_id(),
      "id",
      ("timezone"("timezone",now()))::DATE
    FROM eligible ON CONFLICT DO NOTHING RETURNING "visit_day") SELECT jsonb_build_object('day',("timezone"("timezone",now()))::DATE,'selfReported',true) FROM eligible;

$$ LANGUAGE 'sql';


ALTER FUNCTION finfolk_rpc.member_permitted(boolean) SET search_path=pg_catalog;
ALTER FUNCTION finfolk_rpc.auth_identity(text) SET search_path=pg_catalog;
REVOKE ALL ON FUNCTION finfolk_rpc.auth_identity(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION finfolk_rpc.actor_id(),finfolk_rpc.member_permitted(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION finfolk_rpc.member_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION finfolk_rpc.profile_save(jsonb),finfolk_rpc.checkin_record(text) FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') THEN
GRANT USAGE ON SCHEMA finfolk_rpc TO finfolk_api;
GRANT EXECUTE ON FUNCTION finfolk_rpc.auth_identity(text),finfolk_rpc.actor_id(),finfolk_rpc.member_permitted(boolean),finfolk_rpc.member_profile(),finfolk_rpc.profile_save(jsonb),finfolk_rpc.checkin_record(text) TO finfolk_api;
END IF; END $$;

CREATE OR REPLACE FUNCTION finfolk_rpc.site_document_valid(doc jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_typeof(doc)='object' AND coalesce(doc->>'id','') ~ '^[a-z0-9][a-z0-9_-]{0,127}$'
 AND length(coalesce(doc->>'name','')) BETWEEN 1 AND 160
 AND doc->>'waterbody' IN ('ocean','lake','river','quarry','sinkhole','pool','unknown')
 AND doc->>'access_mode' IN ('shore','boat_only','shore_or_boat','unknown')
 AND jsonb_typeof(doc->'point')='array' AND jsonb_array_length(doc->'point')=2
 AND jsonb_typeof(doc->'point'->0)='number' AND jsonb_typeof(doc->'point'->1)='number'
 AND (doc->'point'->>0)::numeric BETWEEN -180 AND 180 AND (doc->'point'->>1)::numeric BETWEEN -90 AND 90
 AND jsonb_typeof(doc->'access_points')='array' AND jsonb_typeof(doc->'depth_evidence')='array'
 AND jsonb_array_length(doc->'access_points')<=20 AND jsonb_array_length(doc->'depth_evidence')<=20
 AND length(coalesce(doc->>'source_url','')) BETWEEN 9 AND 2048 AND doc->>'source_url' ~ '^https://'
 AND length(coalesce(doc->>'area_id','')) BETWEEN 1 AND 128 AND length(coalesce(doc->>'state_id','')) BETWEEN 1 AND 8
 AND length(coalesce(doc->>'timezone','')) BETWEEN 1 AND 100;
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.site_draft_save(i_actor text,i_admin boolean,i_doc jsonb,i_id uuid,i_version bigint,i_import uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r finfolk.site_revisions; item jsonb; base bigint;
BEGIN
 IF NOT coalesce((finfolk_rpc.auth_identity(i_actor)->>'verified')::boolean,false) OR NOT EXISTS(SELECT 1 FROM finfolk.members WHERE user_id=i_actor AND NOT deleted) THEN RAISE EXCEPTION 'verified_member_required' USING ERRCODE='42501'; END IF;
 IF NOT coalesce(finfolk_rpc.site_document_valid(i_doc),false) OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=i_doc->>'timezone') THEN RAISE EXCEPTION 'invalid_site_document' USING ERRCODE='22023'; END IF;
 IF i_import IS NOT NULL AND (NOT i_admin OR NOT EXISTS(SELECT 1 FROM finfolk.site_imports WHERE id=i_import AND status='draft')) THEN RAISE EXCEPTION 'invalid_site_import' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM finfolk.site_revisions WHERE id=i_id FOR UPDATE;
 IF FOUND THEN
  IF NOT i_admin AND r.owner_id IS DISTINCT FROM i_actor THEN RAISE EXCEPTION 'site_owner_required' USING ERRCODE='42501'; END IF;
  IF r.status NOT IN ('draft','submitted') OR r.version<>i_version OR r.site_id<>i_doc->>'id' OR r.import_id IS DISTINCT FROM i_import THEN RAISE EXCEPTION 'site_revision_conflict' USING ERRCODE='40001'; END IF;
  UPDATE finfolk.site_revisions SET payload=i_doc,version=version+1,updated_at=now() WHERE id=i_id RETURNING * INTO r;
 ELSE
  IF i_version<>0 THEN RAISE EXCEPTION 'site_revision_conflict' USING ERRCODE='40001'; END IF;
  SELECT revision INTO base FROM finfolk.site_profiles WHERE id=i_doc->>'id';
  INSERT INTO finfolk.site_revisions(id,site_id,owner_id,import_id,base_revision,status,payload)
  VALUES(i_id,i_doc->>'id',i_actor,i_import,coalesce(base,0),CASE WHEN i_admin THEN 'draft' ELSE 'submitted' END,i_doc) RETURNING * INTO r;
 END IF;
 DELETE FROM finfolk.site_access_points WHERE revision_id=i_id;
 DELETE FROM finfolk.site_depth_evidence WHERE revision_id=i_id;
 FOR item IN SELECT value FROM jsonb_array_elements(i_doc->'access_points') LOOP
  IF NOT coalesce(item->>'mode' IN ('shore','departure') AND jsonb_typeof(item->'point')='array' AND jsonb_array_length(item->'point')=2 AND jsonb_typeof(item->'point'->0)='number' AND jsonb_typeof(item->'point'->1)='number' AND (item->'point'->>0)::numeric BETWEEN -180 AND 180 AND (item->'point'->>1)::numeric BETWEEN -90 AND 90 AND item->>'source_url' ~ '^https://',false) THEN RAISE EXCEPTION 'invalid_access_point' USING ERRCODE='22023'; END IF;
  INSERT INTO finfolk.site_access_points(revision_id,mode,payload) VALUES(i_id,item->>'mode',item);
 END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(i_doc->'depth_evidence') LOOP
  IF NOT coalesce(item->>'kind' IN ('surveyed','reported') AND jsonb_typeof(item->'depth_m')='number' AND (item->>'depth_m')::numeric>0 AND (item->>'depth_m')::numeric<=1500 AND length(item->>'reference')>0 AND item->>'source_url' ~ '^https://',false) THEN RAISE EXCEPTION 'invalid_depth_evidence' USING ERRCODE='22023'; END IF;
  INSERT INTO finfolk.site_depth_evidence(revision_id,kind,payload) VALUES(i_id,item->>'kind',item);
 END LOOP;
 RETURN to_jsonb(r);
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.site_publish(i_actor text,i_id uuid,i_version bigint) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r finfolk.site_revisions; current_version bigint; next_version bigint; next_catalog bigint; doc jsonb;
BEGIN
 IF NOT coalesce((finfolk_rpc.auth_identity(i_actor)->>'verified')::boolean,false) THEN RAISE EXCEPTION 'verified_member_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('finfolk:site-catalog'));
 SELECT * INTO r FROM finfolk.site_revisions WHERE id=i_id FOR UPDATE;
 IF NOT FOUND OR r.status NOT IN ('draft','submitted','published') THEN RAISE EXCEPTION 'site_revision_conflict' USING ERRCODE='40001'; END IF;
 IF r.status='published' THEN RETURN jsonb_build_object('id',r.site_id,'published',true); END IF;
 IF r.version<>i_version THEN RAISE EXCEPTION 'site_revision_conflict' USING ERRCODE='40001'; END IF;
 SELECT revision INTO current_version FROM finfolk.site_profiles WHERE id=r.site_id;
 IF coalesce(current_version,0)<>r.base_revision THEN RAISE EXCEPTION 'site_revision_conflict' USING ERRCODE='40001'; END IF;
 doc=r.payload;next_version=coalesce(current_version,0)+1;
 INSERT INTO finfolk.beaches(id,name,timezone,area_name,state) VALUES(r.site_id,doc->>'name',doc->>'timezone',doc->>'area_name',doc->>'state_id')
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,timezone=excluded.timezone,area_name=excluded.area_name,state=excluded.state;
 INSERT INTO finfolk.site_profiles(id,revision,waterbody,access_mode,status,payload) VALUES(r.site_id,next_version,doc->>'waterbody',doc->>'access_mode',CASE WHEN coalesce((doc->>'archived')::boolean,false) THEN 'archived' ELSE 'published' END,doc)
 ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,waterbody=excluded.waterbody,access_mode=excluded.access_mode,status=excluded.status,payload=excluded.payload,updated_at=now();
 UPDATE finfolk.site_revisions SET status='published',version=version+1,reviewed_by=i_actor,updated_at=now() WHERE id=i_id;
 UPDATE finfolk.site_catalog SET revision=revision+1 WHERE id=1 RETURNING revision INTO next_catalog;
 RETURN jsonb_build_object('id',r.site_id,'revision',next_version,'catalogRevision',next_catalog,'published',true);
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.site_catalog_read() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT metadata || jsonb_build_object('revision',revision,'beaches',coalesce((SELECT jsonb_agg(payload || jsonb_build_object('revision',p.revision,'catalog_managed',true) ORDER BY payload->>'name',id) FROM finfolk.site_profiles p WHERE status='published'),'[]'::jsonb)) FROM finfolk.site_catalog WHERE id=1 AND metadata ? 'states';
$$;
ALTER FUNCTION finfolk_rpc.site_document_valid(jsonb) SET search_path=pg_catalog;
ALTER FUNCTION finfolk_rpc.site_draft_save(text,boolean,jsonb,uuid,bigint,uuid) SET search_path=pg_catalog;
ALTER FUNCTION finfolk_rpc.site_publish(text,uuid,bigint) SET search_path=pg_catalog;
ALTER FUNCTION finfolk_rpc.site_catalog_read() SET search_path=pg_catalog;
REVOKE ALL ON FUNCTION finfolk_rpc.site_document_valid(jsonb),finfolk_rpc.site_draft_save(text,boolean,jsonb,uuid,bigint,uuid),finfolk_rpc.site_publish(text,uuid,bigint),finfolk_rpc.site_catalog_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finfolk_rpc.site_document_valid(jsonb),finfolk_rpc.site_draft_save(text,boolean,jsonb,uuid,bigint,uuid),finfolk_rpc.site_publish(text,uuid,bigint),finfolk_rpc.site_catalog_read() TO finfolk_api;

CREATE OR REPLACE FUNCTION finfolk_rpc.discover_popular() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT jsonb_build_object('places',coalesce(jsonb_agg(x.beach_id ORDER BY x.people DESC,x.beach_id),'[]'::jsonb)) FROM (SELECT c.beach_id,count(DISTINCT c.user_id) people FROM finfolk.checkins c JOIN finfolk.members m ON m.user_id=c.user_id WHERE NOT m.deleted AND m.profile->'sharing'->>'visits'='true' AND c.visit_day BETWEEN current_date-89 AND current_date GROUP BY c.beach_id HAVING count(DISTINCT c.user_id)>=3) x $$;
REVOKE ALL ON FUNCTION finfolk_rpc.discover_popular() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finfolk_rpc.discover_popular() TO finfolk_api;

CREATE TABLE IF NOT EXISTS finfolk.directory_listings (id uuid NOT NULL DEFAULT gen_random_uuid(), document jsonb NOT NULL, status text NOT NULL DEFAULT 'candidate'::text, owner_id text, revision integer NOT NULL DEFAULT 1, reviewed_at timestamptz, outreach text NOT NULL DEFAULT 'Not contacted'::text, notes text NOT NULL DEFAULT ''::text, updated_at timestamptz NOT NULL DEFAULT now(), CHECK ((status = ANY (ARRAY['candidate'::text, 'published'::text, 'rejected'::text, 'archived'::text, 'suppressed'::text]))), PRIMARY KEY (id), FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS finfolk.directory_socials (identity text NOT NULL, listing_id uuid NOT NULL, PRIMARY KEY (identity), FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS finfolk.directory_claims (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, user_id text, challenge text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval), state text NOT NULL DEFAULT 'pending'::text, evidence text NOT NULL DEFAULT ''::text, reviewed_by text, created_at timestamptz NOT NULL DEFAULT now(), CHECK ((state = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))), PRIMARY KEY (id), FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id), FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS finfolk.directory_runs (id uuid NOT NULL DEFAULT gen_random_uuid(), query text NOT NULL, state text NOT NULL DEFAULT 'running'::text, error text NOT NULL DEFAULT ''::text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id));
CREATE TABLE IF NOT EXISTS finfolk.directory_reports (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid NOT NULL, user_id text, message text NOT NULL, resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id), FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS finfolk.directory_audit (id uuid NOT NULL DEFAULT gen_random_uuid(), listing_id uuid, actor text, event text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (id), FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id));
CREATE TABLE IF NOT EXISTS finfolk.directory_page_admins (page_id uuid NOT NULL, user_id text NOT NULL, added_by text, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (page_id, user_id), FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE, FOREIGN KEY (added_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS finfolk.directory_page_invites (token_hash text NOT NULL, page_id uuid NOT NULL, invited_by text NOT NULL, expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval), redeemed_by text, redeemed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (token_hash), FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE, FOREIGN KEY (invited_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE, FOREIGN KEY (redeemed_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL);
CREATE UNIQUE INDEX IF NOT EXISTS directory_pending_claim ON finfolk.directory_claims(listing_id,user_id) WHERE state='pending';
CREATE INDEX IF NOT EXISTS directory_public ON finfolk.directory_listings(status,lower(document->>'name'),id);
CREATE INDEX IF NOT EXISTS directory_owner ON finfolk.directory_listings(owner_id);
CREATE OR REPLACE FUNCTION finfolk_rpc.directory_public(r finfolk.directory_listings) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('id',r.id,'name',r.document->>'name','category',r.document->>'category','state',r.document->>'state','country',coalesce(r.document->>'country','Australia'),'locality',r.document->>'locality','description',r.document->>'description','website',r.document->>'website','image',coalesce(r.document->>'image',''),'sources',r.document->'sources','socials',coalesce((SELECT jsonb_agg(CASE WHEN value LIKE 'instagram:%' THEN 'https://www.instagram.com/'||split_part(value,':',2)||'/' ELSE 'https://www.tiktok.com/@'||split_part(value,':',2) END) FROM jsonb_array_elements_text(r.document->'socials')),'[]'::jsonb),'managed',r.owner_id IS NOT NULL,'reviewedAt',r.reviewed_at,'revision',r.revision);
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.directory_operation(op text,v jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
#variable_conflict use_variable
DECLARE actor text:=finfolk_rpc.actor_id(); adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'false')='true'; r finfolk.directory_listings; t finfolk.directory_listings; claim finfolk.directory_claims; doc jsonb; social jsonb:='[]'; s text; ident text; ids text[]; id uuid; result jsonb; off integer; inserted integer; invitation finfolk.directory_page_invites; token text;
BEGIN
 IF op='public-list' THEN
 off:=greatest(0,least(100000,coalesce((v->>'offset')::integer,0)));
 SELECT jsonb_build_object('listings',coalesce(jsonb_agg(x.public ORDER BY x.name,x.id) FILTER(WHERE x.n<=20),'[]'::jsonb),'next',CASE WHEN count(*)>20 THEN off+20 ELSE NULL END) INTO result FROM (SELECT finfolk_rpc.directory_public(l) AS public,lower(l.document->>'name') AS name,l.id,row_number() OVER(ORDER BY lower(l.document->>'name'),l.id) - off AS n FROM finfolk.directory_listings l WHERE status='published' AND (coalesce(v->>'q','')='' OR document->>'name' ILIKE '%'||(v->>'q')||'%') AND(coalesce(v->>'category','')='' OR document->>'category'=v->>'category') AND(coalesce(v->>'state','')='' OR document->>'state'=v->>'state') AND(coalesce(v->>'locality','')='' OR document->>'locality' ILIKE '%'||(v->>'locality')||'%') ORDER BY lower(document->>'name'),id LIMIT 21 OFFSET off) x; RETURN result;
 ELSIF op='public-detail' THEN
 SELECT * INTO r FROM finfolk.directory_listings WHERE directory_listings.id=(v->>'id')::uuid AND status='published'; IF NOT FOUND THEN RAISE EXCEPTION 'Listing unavailable' USING ERRCODE='P0002'; END IF; RETURN finfolk_rpc.directory_public(r);
 END IF;
 IF NOT finfolk_rpc.member_permitted(true) OR NOT EXISTS(SELECT 1 FROM finfolk.members WHERE user_id=actor AND NOT deleted) THEN RAISE EXCEPTION 'Verified member required' USING ERRCODE='42501'; END IF;
 IF op NOT IN ('mine','owner-save','claim','report','page-access','invite-create','invite-redeem','invite-revoke','admin-remove') AND NOT adm THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF op='mine' THEN
 RETURN jsonb_build_object('admin',adm,'listings',coalesce((SELECT jsonb_agg((to_jsonb(l)-'notes'-'outreach')||jsonb_build_object('role',CASE WHEN owner_id=actor THEN 'owner' ELSE 'admin' END)) FROM finfolk.directory_listings l WHERE owner_id=actor OR EXISTS(SELECT 1 FROM finfolk.directory_page_admins a WHERE a.page_id=l.id AND a.user_id=actor)),'[]'::jsonb),'claims',coalesce((SELECT jsonb_agg(c) FROM finfolk.directory_claims c WHERE user_id=actor),'[]'::jsonb));
 ELSIF op='admin' THEN
 RETURN jsonb_build_object('listings',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM finfolk.directory_listings ORDER BY updated_at DESC LIMIT 500)x),'[]'::jsonb),'claims',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM finfolk.directory_claims ORDER BY created_at DESC LIMIT 200)x),'[]'::jsonb),'runs',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM finfolk.directory_runs ORDER BY created_at DESC LIMIT 30)x),'[]'::jsonb),'reports',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM finfolk.directory_reports WHERE NOT resolved LIMIT 200)x),'[]'::jsonb),'audit',coalesce((SELECT jsonb_agg(x) FROM (SELECT * FROM finfolk.directory_audit ORDER BY created_at DESC LIMIT 100)x),'[]'::jsonb));
 ELSIF op IN ('admin-save','owner-save') THEN
 id:=coalesce((v->>'id')::uuid,gen_random_uuid()); SELECT * INTO r FROM finfolk.directory_listings WHERE directory_listings.id=id FOR UPDATE;
 IF op='owner-save' AND(r.id IS NULL OR (r.owner_id IS DISTINCT FROM actor AND NOT EXISTS(SELECT 1 FROM finfolk.directory_page_admins a WHERE a.page_id=r.id AND a.user_id=actor))) THEN RAISE EXCEPTION 'You do not manage this listing' USING ERRCODE='42501'; END IF;
 IF r.id IS NOT NULL AND r.revision IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Listing changed. Reload before saving' USING ERRCODE='40001'; END IF;
 doc:=v->'document';
 IF jsonb_typeof(doc) IS DISTINCT FROM 'object' OR length(trim(coalesce(doc->>'name','')))=0 OR length(doc->>'name')>160 OR NOT coalesce(doc->>'category'=ANY(ARRAY['School','Instructor','Business','Club','Group','Freediver']),false) OR (doc->>'category'<>'Freediver' AND NOT coalesce(doc->>'state'=ANY(ARRAY['VIC','NSW','QLD','SA','WA','TAS','NT','ACT']),false)) THEN RAISE EXCEPTION 'Name, category and Australian state are required' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(doc->'socials') IS DISTINCT FROM 'array' OR jsonb_typeof(doc->'sources') IS DISTINCT FROM 'array' OR jsonb_array_length(doc->'socials')>10 OR jsonb_array_length(doc->'sources')>10 THEN RAISE EXCEPTION 'Invalid link lists' USING ERRCODE='22023'; END IF;
 FOR s IN SELECT jsonb_array_elements_text(doc->'socials') LOOP
 s:=lower(s); IF s ~ '^https://(www\.)?instagram\.com/[a-z0-9._]+/?([?].*)?$' THEN ident:='instagram:'||substring(s FROM 'instagram\.com/([a-z0-9._]+)'); ELSIF s ~ '^https://(www\.)?tiktok\.com/@[a-z0-9._]+/?([?].*)?$' THEN ident:='tiktok:'||substring(s FROM 'tiktok\.com/@([a-z0-9._]+)'); ELSE RAISE EXCEPTION 'Use Instagram or TikTok profile links' USING ERRCODE='22023'; END IF;
 IF ident=ANY(ARRAY['instagram:p','instagram:reel','instagram:explore','instagram:stories','instagram:accounts']) THEN RAISE EXCEPTION 'Use profile links' USING ERRCODE='22023'; END IF;
 IF NOT social @> jsonb_build_array(ident) THEN social:=social||jsonb_build_array(ident); END IF;
 END LOOP;
 FOR s IN SELECT jsonb_array_elements_text(doc->'sources') UNION ALL SELECT doc->>'website' LOOP
 IF coalesce(s,'')<>'' AND(s !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR length(s)>2048) THEN RAISE EXCEPTION 'Use HTTPS source and website links' USING ERRCODE='22023'; END IF; END LOOP;
 IF coalesce(doc->>'image','')<>'' AND(length(doc->>'image')>65558 OR doc->>'image' !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/]+=*$') THEN RAISE EXCEPTION 'Invalid listing image' USING ERRCODE='22023'; END IF;
 doc:=jsonb_build_object('name',trim(doc->>'name'),'category',doc->>'category','state',coalesce(doc->>'state',''),'country',left(coalesce(nullif(trim(doc->>'country'),''),'Australia'),100),'locality',left(coalesce(doc->>'locality',''),160),'description',left(coalesce(doc->>'description',''),2000),'website',coalesce(doc->>'website',''),'image',coalesce(doc->>'image',''),'socials',social,'sources',doc->'sources');
 IF op='owner-save' AND social IS DISTINCT FROM r.document->'socials' THEN RAISE EXCEPTION 'Social identity changes require administrator review' USING ERRCODE='42501'; END IF;
 s:=CASE WHEN op='owner-save' THEN r.status ELSE v->>'status' END;
 IF NOT coalesce(s=ANY(ARRAY['candidate','published','rejected','archived','suppressed']),false) OR(s='published' AND jsonb_array_length(social)=0 AND jsonb_array_length(doc->'sources')=0) THEN RAISE EXCEPTION 'Choose status and publication sources' USING ERRCODE='22023'; END IF;
 INSERT INTO finfolk.directory_listings AS l(id,document,status,reviewed_at) VALUES(id,doc,s,CASE WHEN s='published' THEN now() END) ON CONFLICT ON CONSTRAINT directory_listings_pkey DO UPDATE SET document=excluded.document,status=excluded.status,revision=l.revision+1,updated_at=now(),reviewed_at=CASE WHEN op='admin-save' THEN now() ELSE l.reviewed_at END;
 DELETE FROM finfolk.directory_socials WHERE listing_id=id;
 FOR ident IN SELECT jsonb_array_elements_text(social) UNION SELECT 'website:'||rtrim(doc->>'website','/') WHERE coalesce(doc->>'website','')<>'' LOOP INSERT INTO finfolk.directory_socials VALUES(ident,id); END LOOP;
 IF op='admin-save' THEN UPDATE finfolk.directory_listings l SET notes=left(coalesce(v->>'notes',''),2000),outreach=CASE WHEN v->>'outreach'=ANY(ARRAY['Not contacted','Contacted','Responded','Claimed']) THEN v->>'outreach' ELSE 'Not contacted' END,owner_id=CASE WHEN coalesce((v->>'revokeOwner')::boolean,false) THEN NULL ELSE owner_id END WHERE l.id=id; END IF;
 IF op='admin-save' AND coalesce((v->>'revokeOwner')::boolean,false) THEN DELETE FROM finfolk.directory_page_admins WHERE page_id=id;DELETE FROM finfolk.directory_page_invites WHERE page_id=id;END IF;
 result:=jsonb_build_object('id',id);
 ELSIF op='claim' THEN
 id:=(v->>'id')::uuid; SELECT * INTO r FROM finfolk.directory_listings l WHERE l.id=id FOR UPDATE;
 IF r.id IS NULL OR r.status<>'published' OR r.owner_id IS NOT NULL THEN RAISE EXCEPTION 'Listing unavailable or already managed' USING ERRCODE='40001'; END IF;
 INSERT INTO finfolk.directory_claims(listing_id,user_id,challenge) VALUES(id,actor,'FINFOLK-'||replace(gen_random_uuid()::text,'-','')) ON CONFLICT(listing_id,user_id) WHERE state='pending' DO UPDATE SET challenge=excluded.challenge,expires_at=now()+interval '7 days' RETURNING * INTO claim; result:=to_jsonb(claim);
 ELSIF op='claim-review' THEN
 SELECT * INTO claim FROM finfolk.directory_claims c WHERE c.id=(v->>'id')::uuid FOR UPDATE;
 IF claim.id IS NULL OR claim.state<>'pending' THEN RAISE EXCEPTION 'Claim no longer pending' USING ERRCODE='40001'; END IF;
 id:=claim.listing_id;
 IF coalesce((v->>'approve')::boolean,false) THEN
 IF claim.expires_at<=now() OR length(trim(coalesce(v->>'evidence','')))=0 THEN RAISE EXCEPTION 'Challenge expired or verification evidence missing' USING ERRCODE='22023'; END IF;
 UPDATE finfolk.directory_listings l SET owner_id=claim.user_id,outreach='Claimed',revision=revision+1 WHERE l.id=id AND owner_id IS NULL AND status='published'; IF NOT FOUND THEN RAISE EXCEPTION 'Listing already managed or unavailable' USING ERRCODE='40001'; END IF;
 END IF;
 UPDATE finfolk.directory_claims c SET state=CASE WHEN coalesce((v->>'approve')::boolean,false) THEN 'approved' ELSE 'rejected' END,evidence=left(coalesce(v->>'evidence',''),2000),reviewed_by=actor WHERE c.id=claim.id; result:='{"ok":true}';
 ELSIF op='report' THEN
 id:=(v->>'id')::uuid; IF length(trim(coalesce(v->>'message','')))=0 THEN RAISE EXCEPTION 'Describe your request' USING ERRCODE='22023'; END IF;
 INSERT INTO finfolk.directory_reports(listing_id,user_id,message) VALUES(id,actor,left(v->>'message',2000));result:='{"ok":true}';
 ELSIF op='report-resolve' THEN
 UPDATE finfolk.directory_reports c SET resolved=true WHERE c.id=(v->>'id')::uuid RETURNING listing_id INTO id;result:='{"ok":true}';
 ELSIF op='merge' THEN
 IF v->>'source'=v->>'target' THEN RAISE EXCEPTION 'Choose another listing' USING ERRCODE='22023'; END IF;
 PERFORM l.id FROM finfolk.directory_listings l WHERE l.id IN ((v->>'source')::uuid,(v->>'target')::uuid) ORDER BY l.id FOR UPDATE;
 SELECT * INTO r FROM finfolk.directory_listings l WHERE l.id=(v->>'source')::uuid; SELECT * INTO t FROM finfolk.directory_listings l WHERE l.id=(v->>'target')::uuid;
 IF r.id IS NULL OR t.id IS NULL OR r.owner_id IS NOT NULL THEN RAISE EXCEPTION 'Only unclaimed listings can be merged' USING ERRCODE='40001'; END IF;
 doc:=t.document||jsonb_build_object('socials',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements((t.document->'socials')||(r.document->'socials'))),'sources',(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements((t.document->'sources')||(r.document->'sources'))));
 UPDATE finfolk.directory_socials SET listing_id=t.id WHERE listing_id=r.id;UPDATE finfolk.directory_listings l SET document=doc,revision=revision+1,updated_at=now() WHERE l.id=t.id;UPDATE finfolk.directory_listings l SET status='archived',document=jsonb_set(document,'{socials}','[]'),revision=revision+1 WHERE l.id=r.id;id:=t.id;result:='{"ok":true}';
 ELSIF op IN ('page-access','invite-create','invite-revoke','admin-remove') THEN
 id:=(v->>'id')::uuid;SELECT * INTO r FROM finfolk.directory_listings l WHERE l.id=id FOR UPDATE;
 IF r.id IS NULL OR (r.owner_id IS DISTINCT FROM actor AND NOT EXISTS(SELECT 1 FROM finfolk.directory_page_admins a WHERE a.page_id=id AND a.user_id=actor)) THEN RAISE EXCEPTION 'Page access required' USING ERRCODE='42501'; END IF;
 IF op='page-access' THEN RETURN jsonb_build_object('owner',r.owner_id,'role',CASE WHEN r.owner_id=actor THEN 'owner' ELSE 'admin' END,'admins',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.user_id,'name',coalesce(m.profile->>'displayName',a.user_id))) FROM finfolk.directory_page_admins a JOIN finfolk.members m ON m.user_id=a.user_id WHERE a.page_id=id),'[]'::jsonb),'invites',CASE WHEN r.owner_id=actor THEN coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.token_hash,'expiresAt',i.expires_at)) FROM finfolk.directory_page_invites i WHERE i.page_id=id AND i.redeemed_at IS NULL AND i.expires_at>now() AND i.invited_by=r.owner_id),'[]'::jsonb) ELSE '[]'::jsonb END); END IF;
 IF r.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Only the page owner can manage administrators' USING ERRCODE='42501'; END IF;
 IF op='invite-create' THEN token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');INSERT INTO finfolk.directory_page_invites(token_hash,page_id,invited_by) VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),id,actor);result:=jsonb_build_object('token',token);
 ELSIF op='invite-revoke' THEN DELETE FROM finfolk.directory_page_invites i WHERE i.page_id=id AND i.token_hash=v->>'invite';result:='{"ok":true}';
 ELSE DELETE FROM finfolk.directory_page_admins a WHERE a.page_id=id AND a.user_id=v->>'user';result:='{"ok":true}'; END IF;
 ELSIF op='invite-redeem' THEN
 -- Read the page id before taking the page lock so all access mutations lock page then invite.
 SELECT * INTO invitation FROM finfolk.directory_page_invites i WHERE i.token_hash=encode(sha256(convert_to(coalesce(v->>'token',''),'UTF8')),'hex');
 IF invitation.token_hash IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='40001'; END IF;
 id:=invitation.page_id;SELECT * INTO r FROM finfolk.directory_listings l WHERE l.id=id FOR UPDATE;
 SELECT * INTO invitation FROM finfolk.directory_page_invites i WHERE i.token_hash=invitation.token_hash FOR UPDATE;
 IF invitation.token_hash IS NULL OR invitation.redeemed_at IS NOT NULL OR invitation.expires_at<=now() OR invitation.invited_by IS DISTINCT FROM r.owner_id OR r.owner_id=actor THEN RAISE EXCEPTION 'Invitation expired or already used' USING ERRCODE='40001'; END IF;
 INSERT INTO finfolk.directory_page_admins(page_id,user_id,added_by) VALUES(id,actor,r.owner_id) ON CONFLICT DO NOTHING;
 UPDATE finfolk.directory_page_invites i SET redeemed_by=actor,redeemed_at=now() WHERE i.token_hash=invitation.token_hash;result:=jsonb_build_object('id',id);
 ELSIF op='run-start' THEN
 id:=gen_random_uuid();INSERT INTO finfolk.directory_runs(id,query) VALUES(id,left(v->>'query',500));result:=jsonb_build_object('id',id);id:=NULL;
 ELSIF op='candidate' THEN
 ident:=v->>'identity';IF ident IS NULL OR ident='' THEN RAISE EXCEPTION 'Candidate identity required' USING ERRCODE='22023'; END IF;
 id:=gen_random_uuid();INSERT INTO finfolk.directory_listings(id,document,notes) VALUES(id,v->'document',left(coalesce(v->>'notes',''),2000));INSERT INTO finfolk.directory_socials(identity,listing_id) VALUES(ident,id) ON CONFLICT DO NOTHING;GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted=0 THEN DELETE FROM finfolk.directory_listings l WHERE l.id=id;id:=NULL; END IF;result:=jsonb_build_object('inserted',inserted);
 ELSIF op='run-finish' THEN
 UPDATE finfolk.directory_runs c SET state=CASE WHEN v->>'state'='complete' THEN 'complete' ELSE 'failed' END,error=left(coalesce(v->>'error',''),500) WHERE c.id=(v->>'id')::uuid;result:='{"ok":true}';
 ELSE RAISE EXCEPTION 'Unknown directory operation' USING ERRCODE='22023';
 END IF;
 INSERT INTO finfolk.directory_audit(listing_id,actor,event) VALUES(id,actor,op);RETURN result;
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Identity already belongs to another listing' USING ERRCODE='40001';
END $$;
REVOKE ALL ON FUNCTION finfolk_rpc.directory_public(finfolk.directory_listings),finfolk_rpc.directory_operation(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finfolk_rpc.directory_operation(text,jsonb) TO finfolk_api;
REVOKE ALL ON finfolk.directory_listings,finfolk.directory_socials,finfolk.directory_claims,finfolk.directory_reports,finfolk.directory_runs,finfolk.directory_audit,finfolk.directory_page_admins,finfolk.directory_page_invites FROM finfolk_api;

CREATE TABLE IF NOT EXISTS finfolk.events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),page_id uuid NOT NULL REFERENCES finfolk.directory_listings(id),document jsonb NOT NULL,state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published','cancelled')),visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')),starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,timezone text NOT NULL,capacity integer CHECK(capacity>0),revision integer NOT NULL DEFAULT 1,hidden boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),CHECK(ends_at>starts_at));
CREATE TABLE IF NOT EXISTS finfolk.event_rsvps(event_id uuid NOT NULL REFERENCES finfolk.events(id),user_id text NOT NULL REFERENCES finfolk.members(user_id) ON DELETE CASCADE,state text NOT NULL CHECK(state IN ('going','cancelled')),updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(event_id,user_id));
CREATE TABLE IF NOT EXISTS finfolk.event_invites(token_hash text PRIMARY KEY,event_id uuid NOT NULL REFERENCES finfolk.events(id),email text NOT NULL,expires_at timestamptz NOT NULL,accepted_by text REFERENCES finfolk.members(user_id) ON DELETE CASCADE,revoked boolean NOT NULL DEFAULT false);
CREATE TABLE IF NOT EXISTS finfolk.event_audit(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid REFERENCES finfolk.events(id),actor text,event text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION finfolk_rpc.event_operation(op text,v jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
#variable_conflict use_variable
DECLARE actor text:=finfolk_rpc.actor_id(); adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'false')='true'; e finfolk.events; p finfolk.directory_listings; invitation finfolk.event_invites; id uuid; manager boolean; allowed boolean; active_page boolean; token text; mail text; count_going integer; result jsonb; start_time timestamptz; end_time timestamptz;
BEGIN
 IF op='list' THEN RETURN jsonb_build_object('events',coalesce((SELECT jsonb_agg(x) FROM (SELECT a.id,a.page_id,a.document,a.starts_at,a.ends_at,a.timezone,a.capacity,l.document->>'name' AS organiser FROM finfolk.events a JOIN finfolk.directory_listings l ON l.id=a.page_id WHERE a.state='published' AND a.visibility='public' AND NOT a.hidden AND l.status='published' AND l.owner_id IS NOT NULL AND a.ends_at>now() AND(coalesce(v->>'page','')='' OR a.page_id=(v->>'page')::uuid) AND(coalesce(v->>'q','')='' OR a.document->>'title' ILIKE '%'||(v->>'q')||'%') AND(coalesce(v->>'location','')='' OR a.document->>'location' ILIKE '%'||(v->>'location')||'%') AND(coalesce(v->>'category','')='' OR a.document->>'category'=v->>'category') AND(coalesce(v->>'from','')='' OR a.starts_at>=(v->>'from')::timestamptz) ORDER BY a.starts_at,a.id LIMIT 20 OFFSET greatest(0,least(100000,coalesce((v->>'offset')::integer,0)))) x),'[]'::jsonb));END IF;
 IF op='mine' THEN
 IF NOT finfolk_rpc.member_permitted(true) THEN RAISE EXCEPTION 'Verify your email' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('events',coalesce((SELECT jsonb_agg(to_jsonb(a)||jsonb_build_object('organiser',l.document->>'name')) FROM finfolk.events a JOIN finfolk.directory_listings l ON l.id=a.page_id WHERE l.owner_id=actor OR EXISTS(SELECT 1 FROM finfolk.directory_page_admins pa WHERE pa.page_id=l.id AND pa.user_id=actor) OR (a.visibility='public' AND EXISTS(SELECT 1 FROM finfolk.event_rsvps r WHERE r.event_id=a.id AND r.user_id=actor)) OR EXISTS(SELECT 1 FROM finfolk.event_invites i WHERE i.event_id=a.id AND i.accepted_by=actor AND NOT i.revoked)),'[]'::jsonb));END IF;
 IF op='accept' THEN
 IF NOT finfolk_rpc.member_permitted(true) THEN RAISE EXCEPTION 'Verify your email' USING ERRCODE='42501';END IF;
 SELECT * INTO invitation FROM finfolk.event_invites i WHERE token_hash=encode(sha256(convert_to(coalesce(v->>'token',''),'UTF8')),'hex');
 IF invitation.token_hash IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='40001';END IF;id:=invitation.event_id;
 ELSE id:=coalesce((v->>'id')::uuid,gen_random_uuid());END IF;
 SELECT * INTO e FROM finfolk.events a WHERE a.id=id FOR UPDATE;
 IF e.id IS NULL AND op<>'save' THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='P0002';END IF;
 SELECT * INTO p FROM finfolk.directory_listings l WHERE l.id=coalesce(e.page_id,(v->>'page')::uuid);
 manager:=finfolk_rpc.member_permitted(true) AND(p.owner_id=actor OR EXISTS(SELECT 1 FROM finfolk.directory_page_admins a WHERE a.page_id=p.id AND a.user_id=actor));manager:=coalesce(manager,false);
 active_page:=coalesce(p.status='published' AND p.owner_id IS NOT NULL,false);
 allowed:=manager OR (e.state IN ('published','cancelled') AND NOT e.hidden AND active_page AND(e.visibility='public' OR (finfolk_rpc.member_permitted(true) AND EXISTS(SELECT 1 FROM finfolk.event_invites i WHERE i.event_id=id AND i.accepted_by=actor AND NOT i.revoked))));
 IF op='detail' THEN
 IF NOT allowed AND NOT(adm AND finfolk_rpc.member_permitted(true)) THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='P0002';END IF;
 RETURN (to_jsonb(e)-'hidden')||jsonb_build_object('organiser',p.document->>'name','canManage',manager,'canModerate',adm AND finfolk_rpc.member_permitted(true),'going',(SELECT count(*) FROM finfolk.event_rsvps r WHERE r.event_id=id AND r.state='going'),'myRsvp',(SELECT r.state FROM finfolk.event_rsvps r WHERE r.event_id=id AND r.user_id=actor));END IF;
 IF NOT finfolk_rpc.member_permitted(true) OR NOT EXISTS(SELECT 1 FROM finfolk.members WHERE user_id=actor AND NOT deleted) THEN RAISE EXCEPTION 'Verified member required' USING ERRCODE='42501';END IF;
 IF op IN ('save','cancel','roster','invite','revoke') AND NOT manager THEN RAISE EXCEPTION 'Page owner or admin required' USING ERRCODE='42501';END IF;
 IF op='save' THEN
 IF NOT active_page THEN RAISE EXCEPTION 'Publish and claim the organising page first' USING ERRCODE='22023';END IF;
 IF e.id IS NOT NULL AND e.revision IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Event changed; reload' USING ERRCODE='40001';END IF;
 start_time:=(v->>'starts')::timestamptz;end_time:=(v->>'ends')::timestamptz;
 IF start_time IS NULL OR end_time IS NULL OR end_time<=start_time OR length(trim(coalesce(v->>'title','')))=0 OR length(v->>'title')>160 OR length(trim(coalesce(v->>'location','')))=0 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v->>'timezone') OR NOT coalesce(v->>'visibility'=ANY(ARRAY['public','private']),false) OR NOT coalesce(v->>'state'=ANY(ARRAY['draft','published']),false) THEN RAISE EXCEPTION 'Check title, venue, dates, timezone and visibility' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO count_going FROM finfolk.event_rsvps r WHERE r.event_id=id AND r.state='going';
 IF ((v->>'capacity')::integer IS NOT NULL AND (v->>'capacity')::integer<count_going) OR(e.state='published' AND v->>'state'='draft' AND count_going>0) OR(e.state='published' AND e.visibility IS DISTINCT FROM v->>'visibility') THEN RAISE EXCEPTION 'Cancel attendance before unpublishing; keep published visibility unchanged; capacity cannot exclude attendees' USING ERRCODE='40001';END IF;
 INSERT INTO finfolk.events AS a(id,page_id,document,state,visibility,starts_at,ends_at,timezone,capacity) VALUES(id,p.id,jsonb_build_object('title',trim(v->>'title'),'description',left(coalesce(v->>'description',''),5000),'location',left(v->>'location',300),'category',left(coalesce(v->>'category','Meetup'),60)),v->>'state',v->>'visibility',start_time,end_time,v->>'timezone',(v->>'capacity')::integer) ON CONFLICT ON CONSTRAINT events_pkey DO UPDATE SET document=excluded.document,state=excluded.state,visibility=excluded.visibility,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,capacity=excluded.capacity,revision=a.revision+1,updated_at=now();result:=jsonb_build_object('id',id);
 ELSIF op='cancel' THEN UPDATE finfolk.events a SET state='cancelled',revision=revision+1,updated_at=now() WHERE a.id=id;result:='{"ok":true}';
 ELSIF op='moderate' THEN IF NOT adm THEN RAISE EXCEPTION 'Superadmin required' USING ERRCODE='42501';END IF;UPDATE finfolk.events a SET hidden=true,revision=revision+1 WHERE a.id=id;result:='{"ok":true}';
 ELSIF op='roster' THEN RETURN jsonb_build_object('attendees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.user_id,'name',m.profile->>'displayName')) FROM finfolk.event_rsvps r JOIN finfolk.members m ON m.user_id=r.user_id WHERE r.event_id=id AND r.state='going'),'[]'::jsonb),'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.token_hash,'email',i.email,'expires',i.expires_at,'revoked',i.revoked)) FROM finfolk.event_invites i WHERE i.event_id=id),'[]'::jsonb));
 ELSIF op='invite' THEN
 mail:=lower(trim(v->>'email'));IF e.visibility<>'private' OR e.starts_at<=now() OR mail IS NULL OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid invitation email for an upcoming private event' USING ERRCODE='22023';END IF;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');INSERT INTO finfolk.event_invites(token_hash,event_id,email,expires_at) VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),id,mail,least(now()+interval '7 days',e.starts_at));result:=jsonb_build_object('token',token);
 ELSIF op='revoke' THEN UPDATE finfolk.event_rsvps r SET state='cancelled',updated_at=now() WHERE r.event_id=id AND r.user_id IN(SELECT i.accepted_by FROM finfolk.event_invites i WHERE i.token_hash=v->>'invite' AND i.event_id=id);UPDATE finfolk.event_invites i SET revoked=true WHERE i.event_id=id AND i.email IN(SELECT j.email FROM finfolk.event_invites j WHERE j.token_hash=v->>'invite' AND j.event_id=id);result:='{"ok":true}';
 ELSIF op='accept' THEN
 SELECT * INTO invitation FROM finfolk.event_invites i WHERE i.token_hash=invitation.token_hash FOR UPDATE;
 SELECT lower(trim(to_jsonb(u)->>'email')) INTO mail FROM neon_auth."user" u WHERE u.id::text=actor;
 IF invitation.revoked OR invitation.accepted_by IS NOT NULL OR invitation.expires_at<=now() OR mail IS NULL OR mail<>invitation.email OR NOT active_page OR e.hidden OR e.state<>'published' THEN RAISE EXCEPTION 'Invitation unavailable for this verified account' USING ERRCODE='40001';END IF;
 UPDATE finfolk.event_invites i SET accepted_by=actor WHERE i.token_hash=invitation.token_hash;result:=jsonb_build_object('id',id);
 ELSIF op='rsvp' THEN
 IF coalesce(v->>'state','')='going' THEN
 IF NOT allowed OR NOT active_page OR e.hidden OR e.state<>'published' OR e.starts_at<=now() THEN RAISE EXCEPTION 'Event is closed or unavailable' USING ERRCODE='40001';END IF;
 SELECT count(*) INTO count_going FROM finfolk.event_rsvps r WHERE r.event_id=id AND r.state='going' AND r.user_id<>actor;
 IF e.capacity IS NOT NULL AND count_going>=e.capacity THEN RAISE EXCEPTION 'This event is full' USING ERRCODE='40001';END IF;
 ELSE IF coalesce(v->>'state','')<>'cancelled' OR (NOT allowed AND NOT EXISTS(SELECT 1 FROM finfolk.event_rsvps r WHERE r.event_id=id AND r.user_id=actor)) THEN RAISE EXCEPTION 'Invalid RSVP' USING ERRCODE='22023';END IF;END IF;
 INSERT INTO finfolk.event_rsvps(event_id,user_id,state) VALUES(id,actor,v->>'state') ON CONFLICT(event_id,user_id) DO UPDATE SET state=excluded.state,updated_at=now();result:='{"ok":true}';
 ELSE RAISE EXCEPTION 'Unknown event action' USING ERRCODE='22023';END IF;
 INSERT INTO finfolk.event_audit(event_id,actor,event) VALUES(id,actor,op);RETURN result;
END $$;
REVOKE ALL ON FUNCTION finfolk_rpc.event_operation(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finfolk_rpc.event_operation(text,jsonb) TO finfolk_api;
REVOKE ALL ON finfolk.events,finfolk.event_rsvps,finfolk.event_invites,finfolk.event_audit FROM PUBLIC,finfolk_api;

INSERT INTO finfolk.site_catalog(id) VALUES(1);
INSERT INTO finfolk.messaging_accounts(id) VALUES('instagram');
INSERT INTO finfolk.instagram_sources(key,kind) VALUES('tags','tags'),('recheck','recheck');
INSERT INTO finfolk.instagram_sources(key,kind,data) SELECT 'hashtag:'||tag,'hashtag',jsonb_build_object('tag',tag) FROM unnest(ARRAY['portphillipbay','edithvale','morningtonpeninsula','portseabeach','bondibeach','maroubrabeach','gordonsbay','clovellybeach','jervisbay','hyamsbeach']) tag;
COMMIT;
