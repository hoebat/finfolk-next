(ns finfolkdb.schema.account-access
  "Trusted account-server role. Never grant this role to browser/PostgREST roles."
  (:require [clojure.string :as str]
            [finfolkdb.schema.account-contracts :as contracts]
            [finfolkdb.schema.events :as events]
            [finfolkdb.schema.event-delivery :as delivery]
            [finfolkdb.schema.site-catalog :as sites]
            [finfolkdb.schema.site-review :as site-review]
            [finfolkdb.schema.site-notes :as notes]))
(defn grants-sql []
  (str (notes/grants-sql) "-- Generated from finfolkdb.schema.account-access.\nBEGIN;\n"
       "SELECT pg_advisory_xact_lock(hashtextextended('finfolk-account-role',0));\n"
       "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_account') THEN CREATE ROLE finfolk_account NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;\n"
       "GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_account;\n"
       "REVOKE ALL ON finfolk.\"UserRole\",finfolk.\"ApplicationFeature\" FROM finfolk_account;\n"
       "GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk.\"User\",finfolk.\"UserBlock\",finfolk.\"UserConnection\" TO finfolk_account;\n"
       "GRANT INSERT,UPDATE ON finfolk.\"DiveSession\" TO finfolk_account;\n"
       "GRANT INSERT ON finfolk.\"UserCheckin\" TO finfolk_account;\n"
       "GRANT SELECT,INSERT,UPDATE ON finfolk.\"Op\" TO finfolk_account;\n"
       "GRANT SELECT ON finfolk.\"Site\",finfolk.\"UserRole\",finfolk.\"ApplicationFeature\" TO finfolk_account;\n"
       "GRANT SELECT,INSERT,UPDATE ON finfolk.\"Rev\",finfolk.\"RevLog\",finfolk.\"Audit\",finfolk.\"AuditLog\",finfolk.\"Activity\",finfolk.\"ActivityLog\" TO finfolk_account;\n"
       "DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='finfolk_rpc' AND p.proname IN ("
       (str/join "," (map #(str "'" % "'")
         (sort (into #{"event_delivery_enqueue" "event_delivery_claim" "event_delivery_complete" "call_native_site_review" "native_directory_discovery_finish" "call_native_notes" "sync_account_identity" "call_native_events" "call_native_directory" "profile_post_links" "account_portrait" "account_featured" "public_session_row" "ret_private_sessions" "private_session_values" "private_session_row" "insert_dive_session" "ret_dive_session_owned" "record_account_deletion_failure" "complete_account_deletion" "pending_account_deletions" "ret_account_sites" "ret_account" "ensure_account" "insert_user" "account_list" "account_link" "lock_account_pair"} (map :rpc (vals contracts/OPERATIONS))))))
       ")) OR (n.nspname='finfolk' AND p.proname IN ('op_fn','as_jsonb','is_user_active','is_user_blocked','insert_base_addons')) LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_account',f.signature); END LOOP; END $$;\n"
       "-- Cleanup follows only declared User foreign keys, with identifiers from pg_catalog.\n"
       "DO $$ DECLARE t record; BEGIN FOR t IN SELECT c.relname,a.attname,k.confdeltype,a.attnotnull FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1] WHERE k.contype='f' AND k.confrelid='finfolk.\"User\"'::regclass AND n.nspname='finfolk' AND cardinality(k.conkey)=1 LOOP EXECUTE format('GRANT SELECT ON finfolk.%I TO finfolk_account',t.relname); IF t.confdeltype='c' THEN EXECUTE format('GRANT DELETE ON finfolk.%I TO finfolk_account',t.relname); ELSIF NOT t.attnotnull THEN EXECUTE format('GRANT UPDATE(%I) ON finfolk.%I TO finfolk_account',t.attname,t.relname); END IF; END LOOP; END $$;\n"
       "GRANT DELETE ON finfolk.\"SiteRevision\",finfolk.\"SiteImport\",finfolk.\"Rev\",finfolk.\"Audit\",finfolk.\"Activity\" TO finfolk_account;\n"
       "GRANT finfolk_directory,finfolk_site_notes TO finfolk_account;\n"
       (events/grants-sql) (delivery/grants-sql) (sites/grants-sql) (site-review/grants-sql)
       "-- Grant membership only to the trusted account server login.\nCOMMIT;\n"))
