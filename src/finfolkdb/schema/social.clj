(ns finfolkdb.schema.social
  "Explicit privileges for trusted social adapters; never granted to browser roles."
  (:require [finfolkdb.schema.page-instagram :as page-instagram] [clojure.string :as str]))

(def TABLES
  ["SocialAccount" "SocialConnection" "SocialConnectionProof" "SocialSource"
   "SocialSuppressedSource" "SocialAction" "SocialDiscovery" "SocialDiscoveryReport" "SocialCommand"
   "SocialEvent" "SocialRateLimit"])

(def FUNCTIONS
  (concat ["ret_social_page_claim_proof" "prepare_social_page_claim" "complete_social_page_claim" "activate_social_comments" "record_social_comment_acceptance" "lock_social_member" "ret_social_operator_event" "ret_social_operator_health" "record_social_acceptance" "activate_social_inbox" "scrub_social_content" "purge_social_diagnostics" "ret_social_redemption_replay" "ret_social_member_connection" "ret_social_redemption_proof" "prepare_social_redemption" "complete_social_redemption" "new_social_operation" "ret_social_adapter_scope" "social_delivery_result"
           "record_social_delivery_audit" "social_delivery_policy_error" "claim_social_delivery"
           "confirm_social_delivery" "complete_social_delivery" "reconcile_social_work" "social_member_allowed"
           "social_rollout_error" "social_work_policy_error" "expire_social_action"]
          ["enqueue_social_action" "finish_social_command_reply" "claim_social_action"
           "complete_social_action" "reserve_social_rate" "redeem_social_connection"
           "disconnect_social_connection" "invalidate_social_personal_work"
           "retire_social_code_deliveries"]
          ["receive_social_event" "process_social_event" "reserve_social_command_rate"
           "social_command_registry" "parse_social_command" "social_command_help"
           "social_public_reply" "receive_social_message" "resolve_social_member"
           "begin_social_message_proof" "create_social_audit" "record_social_audit"
           "insert_social_account" "begin_social_proof" "verify_social_proof"
           "connect_social_account" "set_social_sharing" "disconnect_social_account"
           "insert_social_discovery" "publish_social_discovery" "ret_social_discovery_public"]))

(defn grants-sql
  []
  (str
   "-- Trusted native social adapter privileges. Install explicitly on a fresh schema.\nBEGIN;\n"
   "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_social') THEN CREATE ROLE finfolk_social NOLOGIN NOINHERIT; END IF; END $$;\n"
   "GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_social;\n"
   "GRANT SELECT,INSERT,UPDATE ON "
   (str/join ","
             (map #(str "finfolk.\"" % "\"")
                  (concat TABLES
                          ["Audit" "AuditLog" "Op" "MessagingIdentity" "MessagingConversation"
                           "MessagingMessage" "MessagingReceipt" "MessagingAudit" "MessagingOutbox"
                           "MessagingAccount"])))
   " TO finfolk_social;\n"
   "DO $$ BEGIN IF to_regclass('finfolk.\"DirectoryListing\"') IS NOT NULL THEN\n"
   "GRANT SELECT ON finfolk.\"DirectoryListing\",finfolk.\"AccessRole\" TO finfolk_social;\n"
   "GRANT UPDATE(id) ON finfolk.\"DirectoryListing\" TO finfolk_social;\n"
   "GRANT INSERT,UPDATE ON finfolk.\"AccessRole\" TO finfolk_social;\nEND IF; END $$;\n"
   "GRANT DELETE ON finfolk.\"SocialRateLimit\",finfolk.\"Audit\",finfolk.\"SocialAction\",finfolk.\"SocialCommand\",finfolk.\"SocialConnectionProof\",finfolk.\"SocialEvent\",finfolk.\"MessagingOutbox\",finfolk.\"MessagingMessage\",finfolk.\"MessagingAudit\" TO finfolk_social;\n"
   "GRANT SELECT ON finfolk.\"MessagingAccount\",finfolk.\"User\",finfolk.\"UserBlock\",finfolk.\"SocialPost\" TO finfolk_social;\n"
   "GRANT EXECUTE ON FUNCTION finfolk.as_jsonb(jsonb),finfolk.as_bounded_text(text,integer,integer),finfolk.as_bounded_integer(integer,integer,integer),finfolk.op_fn(text,uuid,jsonb),finfolk.is_user_active(uuid),finfolk.is_user_blocked(uuid,uuid),finfolk.as_iso_time(bigint),finfolk_rpc.receive_message(uuid,uuid,jsonb),finfolk_rpc.ret_messaging_account(uuid,uuid),finfolk_rpc.record_messaging_audit(uuid,uuid,text,uuid),finfolk_rpc.ret_social_post_public(uuid,uuid) TO finfolk_social;\n"
   "DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' AND p.proname IN ("
   (str/join "," (map #(str "'" % "'") FUNCTIONS))
   ") LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_social',f.signature); END LOOP; END $$;\n"
   "-- Grant finfolk_social only to a dedicated trusted server login.\nCOMMIT;\n"
   (str "DO $page$ BEGIN IF to_regclass('finfolk.\"PageInstagramSource\"') IS NOT NULL THEN\n" (-> (page-instagram/grants-sql) (clojure.string/replace "finfolk_page_instagram" "finfolk_social") (clojure.string/replace "BEGIN;" "") (clojure.string/replace "COMMIT;" "")) "\nEND IF; END $page$;\n")))
