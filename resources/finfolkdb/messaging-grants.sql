-- Generated trusted entity messaging worker privileges. Apply explicitly to the fresh native database only.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_messaging') THEN CREATE ROLE finfolk_messaging NOLOGIN NOINHERIT; END IF; END $$;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc,neon_auth TO finfolk_messaging;
GRANT SELECT,INSERT,UPDATE ON finfolk."MessagingApplication",finfolk."MessagingAccount",finfolk."MessagingIdentity",finfolk."MessagingConversation",finfolk."MessagingMessage",finfolk."MessagingReceipt",finfolk."MessagingOutbox",finfolk."MessagingAudit",finfolk."MessagingIdempotency",finfolk."MessagingOauthState" TO finfolk_messaging;
GRANT SELECT(id,deleted) ON finfolk."User" TO finfolk_messaging;
GRANT SELECT(id,"emailVerified",banned) ON neon_auth."user" TO finfolk_messaging;
GRANT EXECUTE ON FUNCTION finfolk.as_jsonb(jsonb) TO finfolk_messaging;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' AND p.proname IN ('ret_messaging_account','record_messaging_audit','is_messaging_participant_allowed','receive_message','reconcile_messaging_work','claim_message','complete_message','retry_message','claim_delivery','record_delivery_result','ret_messaging_history','begin_messaging_oauth','ret_messaging_oauth_intent','consume_messaging_oauth','receive_chat_message','ret_chat_history','set_messaging_authorization','activate_messaging_account','disable_messaging_account','claim_messaging_refresh','save_messaging_refresh','release_messaging_refresh') LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_messaging',f.signature); END LOOP; END $$;
-- Separately grant this role to a dedicated server-only login, never finfolk_api or browser roles.
COMMIT;
