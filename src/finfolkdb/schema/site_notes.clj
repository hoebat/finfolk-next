(ns finfolkdb.schema.site-notes
  "Explicit server-only privileges for the native notes adapter. Never auto-installed."
  (:require [clojure.string :as str]))
(def FUNCTIONS
  ["is_site_note_member" "require_site_note_member" "is_site_note_site" "site_note_score"
   "ret_site_note" "ret_site_notes" "save_site_note" "set_site_note_vote" "set_site_note_withdrawn"
   "report_site_note" "moderate_site_note"])
(defn grants-sql
  []
  (str
   "-- Generated native site-notes server privileges. Apply explicitly to the fresh entity database only.\nBEGIN;\n"
   "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_site_notes') THEN CREATE ROLE finfolk_site_notes NOLOGIN NOINHERIT; END IF; END $$;\n"
   "GRANT USAGE ON SCHEMA finfolk,finfolk_rpc,neon_auth TO finfolk_site_notes;\n"
   "GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk.\"SiteNote\",finfolk.\"SiteNoteVote\",finfolk.\"SiteNoteReport\" TO finfolk_site_notes;\n"
   "GRANT SELECT(id,deleted,profile) ON finfolk.\"User\" TO finfolk_site_notes;\n"
   "GRANT SELECT ON finfolk.\"UserBlock\",finfolk.\"Beach\" TO finfolk_site_notes;\n"
   "GRANT SELECT(beach_id,status) ON finfolk.\"SiteProfile\" TO finfolk_site_notes;\n"
   "GRANT SELECT(id,\"emailVerified\",banned) ON neon_auth.\"user\" TO finfolk_site_notes;\n"
   "GRANT EXECUTE ON FUNCTION finfolk.auth_uid(),finfolk.as_iso_time(bigint),finfolk.is_user_active(uuid),finfolk.is_user_blocked(uuid,uuid) TO finfolk_site_notes;\n"
   "DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' AND p.proname IN ("
   (str/join "," (map #(str "'" % "'") FUNCTIONS))
   ") LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_site_notes',f.signature); END LOOP; END $$;\n"
   "-- Grant this role only to the trusted notes server login. Actor/admin settings are set by that server, never browser input.\nCOMMIT;\n"))
