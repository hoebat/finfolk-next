-- Generated from finfolkdb.schema.feature-flags. Additive; never resets existing flags.
BEGIN;
CREATE SCHEMA IF NOT EXISTS finfolk_flags;
CREATE TABLE IF NOT EXISTS finfolk_flags.flags (id text PRIMARY KEY, mode text NOT NULL DEFAULT 'off' CHECK(mode IN ('off','testers','everyone')), testers uuid[] NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL DEFAULT 'installation');
CREATE TABLE IF NOT EXISTS finfolk_flags.history (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, flag_id text NOT NULL REFERENCES finfolk_flags.flags(id), revision integer NOT NULL, previous jsonb NOT NULL, current jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), changed_by text NOT NULL, UNIQUE(flag_id,revision));
INSERT INTO finfolk_flags.flags(id) VALUES ('shop'),('events'),('practice.progress'),('practice.breathing'),('practice.watch-imports'),('practice.breath-check') ON CONFLICT DO NOTHING;
REVOKE ALL ON SCHEMA finfolk_flags FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA finfolk_flags FROM PUBLIC;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON SCHEMA finfolk_flags FROM %I',r); EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA finfolk_flags FROM %I',r); EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA finfolk_flags FROM %I',r); END IF; END LOOP; END $$;
DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['finfolk_api','finfolk_next_api','finfolk_account'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('GRANT USAGE ON SCHEMA finfolk_flags TO %I',r); EXECUTE format('REVOKE ALL ON finfolk_flags.flags,finfolk_flags.history FROM %I',r); EXECUTE format('GRANT SELECT,UPDATE ON finfolk_flags.flags TO %I',r); EXECUTE format('GRANT SELECT,INSERT ON finfolk_flags.history TO %I',r); EXECUTE format('GRANT USAGE ON ALL SEQUENCES IN SCHEMA finfolk_flags TO %I',r); END IF; END LOOP; END $$;
COMMIT;
