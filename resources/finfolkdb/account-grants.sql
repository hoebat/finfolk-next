-- Generated native site-notes server privileges. Apply explicitly to the fresh entity database only.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_site_notes') THEN CREATE ROLE finfolk_site_notes NOLOGIN NOINHERIT; END IF; END $$;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_site_notes;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk."SiteNote",finfolk."SiteNoteVote",finfolk."SiteNoteReport" TO finfolk_site_notes;
GRANT SELECT,INSERT,UPDATE ON finfolk."Rev",finfolk."RevLog",finfolk."Op" TO finfolk_site_notes;
GRANT SELECT(id,deleted,profile,email_verified) ON finfolk."User" TO finfolk_site_notes;
GRANT SELECT ON finfolk."UserBlock",finfolk."Site" TO finfolk_site_notes;
GRANT SELECT(site_id,status) ON finfolk."SiteProfile" TO finfolk_site_notes;
GRANT EXECUTE ON FUNCTION finfolk.as_bounded_text(text,integer,integer),finfolk.as_finite_date(date),finfolk.as_jsonb(jsonb),finfolk.op_fn(text,uuid,jsonb),finfolk.auth_uid(),finfolk.as_iso_time(bigint),finfolk.is_user_active(uuid),finfolk.is_user_blocked(uuid,uuid) TO finfolk_site_notes;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='finfolk_rpc' AND p.proname IN ('site_note_version','insert_site_note','record_site_note_revision','is_site_note_member','require_site_note_member','is_site_note_site','site_note_score','ret_site_note','ret_owned_site_note','ret_site_notes','save_site_note','set_site_note_vote','set_site_note_rating','set_site_note_withdrawn','report_site_note','moderate_site_note') LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_site_notes',f.signature); END LOOP; END $$;
-- Grant this role only to the trusted notes server login. Actor/admin settings are set by that server, never browser input.
COMMIT;
-- Generated from finfolkdb.schema.account-access.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('finfolk-account-role',0));
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_account') THEN CREATE ROLE finfolk_account NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_account;
REVOKE ALL ON finfolk."UserRole",finfolk."ApplicationFeature" FROM finfolk_account;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk."User",finfolk."UserBlock",finfolk."UserConnection" TO finfolk_account;
GRANT SELECT ON finfolk."Trip",finfolk."TripPublication" TO finfolk_account;
GRANT SELECT ON finfolk."DatabaseRelease",finfolk."MessagingReceipt",finfolk."EnvironmentJob",finfolk."EventInviteDelivery" TO finfolk_account;
GRANT INSERT,UPDATE ON finfolk."DiveSession" TO finfolk_account;
GRANT INSERT ON finfolk."UserCheckin" TO finfolk_account;
GRANT SELECT,INSERT,UPDATE ON finfolk."Op" TO finfolk_account;
GRANT SELECT ON finfolk."Site",finfolk."UserRole",finfolk."ApplicationFeature" TO finfolk_account;
GRANT SELECT,INSERT,UPDATE ON finfolk."Rev",finfolk."RevLog",finfolk."Audit",finfolk."AuditLog",finfolk."Activity",finfolk."ActivityLog" TO finfolk_account;
DO $$ DECLARE f record; BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE (n.nspname='finfolk_rpc' AND p.proname IN ('account_featured','account_link','account_list','account_portrait','buddy_call','call_native_directory','call_native_events','call_native_notes','call_native_site_review','complete_account_deletion','delete_private_session','discover_community_people','ensure_account','erase_account','event_delivery_claim','event_delivery_complete','event_delivery_enqueue','insert_dive_session','insert_user','lock_account_pair','native_directory_admin','native_directory_admin_remove','native_directory_admin_save','native_directory_claim','native_directory_claim_review','native_directory_discovery_finish','native_directory_discovery_start','native_directory_instagram_manage','native_directory_instagram_public','native_directory_instagram_refresh','native_directory_instagram_review','native_directory_instagram_save','native_directory_invite_create','native_directory_invite_redeem','native_directory_invite_revoke','native_directory_merge','native_directory_mine','native_directory_owner_create','native_directory_owner_save','native_directory_page_access','native_directory_public_detail','native_directory_public_list','native_directory_report','native_directory_report_resolve','native_events_accept','native_events_cancel','native_events_detail','native_events_invite','native_events_invite_retry','native_events_list','native_events_mine','native_events_moderate','native_events_public_detail','native_events_revoke','native_events_roster','native_events_rsvp','native_events_save','native_notes_list','native_notes_moderate','native_notes_public_list','native_notes_report','native_notes_save','native_notes_vote','native_notes_withdraw','native_public_popular','native_public_site_catalog','native_public_site_detail','native_site_review_admin','native_site_review_mine','native_site_review_publish','native_site_review_reject','native_site_review_save','native_site_review_submit','native_site_review_withdraw','pending_account_deletions','private_session_dives','private_session_row','private_session_values','profile_handle','profile_post_links','public_session_detail','public_session_row','record_account_deletion_failure','record_community_checkin','remove_community_checkin','ret_account','ret_account_blocks','ret_account_connections','ret_account_sites','ret_account_status','ret_community_checkins','ret_dive_session_owned','ret_my_profile_posts','ret_platform_status','ret_private_sessions','ret_profile_by_handle','ret_profile_statistics','ret_public_profile','ret_public_session','ret_public_sessions','ret_public_trips','ret_trip_public','ret_visible_profile','ret_visible_session','ret_visible_sessions','save_account_preferences','save_private_session','save_profile_setup','session_checkin','session_planning','session_plans','set_account_block','set_account_connection','set_session_visibility','sync_account_identity','validate_profile_handle')) OR (n.nspname='finfolk' AND p.proname IN ('op_fn','as_jsonb','is_user_active','is_user_blocked','insert_base_addons')) LOOP EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO finfolk_account',f.signature); END LOOP; END $$;
-- Cleanup follows only declared User foreign keys, with identifiers from pg_catalog.
DO $$ DECLARE t record; BEGIN FOR t IN SELECT c.relname,a.attname,k.confdeltype,a.attnotnull FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1] WHERE k.contype='f' AND k.confrelid='finfolk."User"'::regclass AND n.nspname='finfolk' AND cardinality(k.conkey)=1 LOOP EXECUTE format('GRANT SELECT ON finfolk.%I TO finfolk_account',t.relname); IF t.confdeltype='c' THEN EXECUTE format('GRANT DELETE ON finfolk.%I TO finfolk_account',t.relname); ELSIF NOT t.attnotnull THEN EXECUTE format('GRANT UPDATE(%I) ON finfolk.%I TO finfolk_account',t.attname,t.relname); END IF; END LOOP; END $$;
GRANT DELETE ON finfolk."SiteRevision",finfolk."SiteImport",finfolk."Rev",finfolk."Audit",finfolk."Activity" TO finfolk_account;
GRANT finfolk_directory,finfolk_site_notes TO finfolk_account;
GRANT SELECT,INSERT,UPDATE ON finfolk."Event",finfolk."EventRsvp",finfolk."AccessInviteEmail" TO finfolk_account;
GRANT EXECUTE ON FUNCTION finfolk_rpc.insert_event(uuid,jsonb,text,bigint,bigint,text,jsonb),finfolk_rpc.native_event_operation(text,jsonb),finfolk_rpc.native_event_manager(finfolk."Event",uuid),finfolk_rpc.native_event_active(finfolk."Event"),finfolk_rpc.native_event_visible(finfolk."Event",uuid,boolean),finfolk_rpc.native_event_row(finfolk."Event",uuid,boolean,boolean),finfolk.as_iso_time(bigint) TO finfolk_account;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk."EventInviteDelivery" TO finfolk_account;
GRANT EXECUTE ON FUNCTION finfolk_rpc.native_event_delivery_row(finfolk."EventInviteDelivery"),finfolk_rpc.native_event_delivery_operation(text,uuid,uuid,uuid,text,text,uuid,text,text) TO finfolk_account;
GRANT SELECT ON finfolk."SiteProfile",finfolk."SiteCatalog",finfolk."UserCheckin" TO finfolk_account;
GRANT EXECUTE ON FUNCTION finfolk_rpc.native_site_row(uuid),finfolk_rpc.native_site_catalog(),finfolk_rpc.native_site_detail(uuid),finfolk_rpc.native_discover_popular() TO finfolk_account;
GRANT SELECT,INSERT,UPDATE ON finfolk."SiteRevision",finfolk."SiteImport",finfolk."SiteProfile",finfolk."SiteCatalog",finfolk."Site" TO finfolk_account;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk."SiteAccessPoint",finfolk."SiteDepthEvidence" TO finfolk_account;
GRANT EXECUTE ON FUNCTION finfolk_rpc.native_site_url(text,boolean),finfolk_rpc.native_site_point(jsonb),finfolk_rpc.native_site_document(jsonb),finfolk_rpc.native_site_draft_row(finfolk."SiteRevision"),finfolk_rpc.native_site_review_operation(text,jsonb) TO finfolk_account;
-- Grant membership only to the trusted account server login.
COMMIT;
BEGIN;
CREATE TABLE IF NOT EXISTS finfolk."BuddyConversation"(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN ('direct','session')),low_id uuid REFERENCES finfolk."User"(id) ON DELETE CASCADE,high_id uuid REFERENCES finfolk."User"(id) ON DELETE CASCADE,session_id uuid UNIQUE REFERENCES finfolk."DiveSession"(id) ON DELETE CASCADE,archived boolean NOT NULL DEFAULT false,sequence bigint NOT NULL DEFAULT 0,CHECK((kind='direct' AND low_id<high_id AND session_id IS NULL) OR (kind='session' AND session_id IS NOT NULL AND low_id IS NULL AND high_id IS NULL)),UNIQUE(low_id,high_id));
CREATE TABLE IF NOT EXISTS finfolk."BuddyMembership"(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),conversation_id uuid NOT NULL REFERENCES finfolk."BuddyConversation"(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES finfolk."User"(id) ON DELETE CASCADE,first_sequence bigint NOT NULL,last_sequence bigint,CHECK(last_sequence IS NULL OR last_sequence>=first_sequence-1));
CREATE UNIQUE INDEX IF NOT EXISTS buddy_active_member ON finfolk."BuddyMembership"(conversation_id,user_id) WHERE last_sequence IS NULL;
CREATE INDEX IF NOT EXISTS buddy_membership_history ON finfolk."BuddyMembership"(conversation_id,user_id,first_sequence,last_sequence);
CREATE TABLE IF NOT EXISTS finfolk."BuddyMessage"(conversation_id uuid NOT NULL REFERENCES finfolk."BuddyConversation"(id) ON DELETE CASCADE,sequence bigint NOT NULL,sender_id uuid NOT NULL REFERENCES finfolk."User"(id) ON DELETE CASCADE,request_id uuid NOT NULL,body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 4000),sent_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(conversation_id,sequence),UNIQUE(sender_id,request_id));
CREATE TABLE IF NOT EXISTS finfolk."BuddyRead"(conversation_id uuid NOT NULL REFERENCES finfolk."BuddyConversation"(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES finfolk."User"(id) ON DELETE CASCADE,sequence bigint NOT NULL DEFAULT 0,PRIMARY KEY(conversation_id,user_id));
CREATE OR REPLACE FUNCTION finfolk_rpc.buddy_sync(cid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c finfolk."BuddyConversation"; eligible uuid[]; s finfolk."DiveSession";
BEGIN
 SELECT * INTO STRICT c FROM finfolk."BuddyConversation" WHERE id=cid FOR UPDATE;
 IF c.kind='direct' THEN
  IF EXISTS(SELECT 1 FROM finfolk."UserConnection" WHERE user_id=c.low_id AND target_id=c.high_id AND status='accepted') THEN eligible:=ARRAY[c.low_id,c.high_id]; ELSE eligible:='{}'; END IF;
 ELSE
  SELECT * INTO STRICT s FROM finfolk."DiveSession" WHERE id=c.session_id;
  SELECT ARRAY[s.owner_id]||coalesce(array_agg(key::uuid) FILTER(WHERE value->>'state'='joined'),'{}') INTO eligible FROM jsonb_each(coalesce(s.detail->'plan'->'members','{}'));
 END IF;
 UPDATE finfolk."BuddyMembership" SET last_sequence=c.sequence WHERE conversation_id=cid AND last_sequence IS NULL AND NOT(user_id=ANY(eligible));
 INSERT INTO finfolk."BuddyMembership"(conversation_id,user_id,first_sequence) SELECT cid,u,c.sequence+1 FROM unnest(eligible) u WHERE NOT EXISTS(SELECT 1 FROM finfolk."BuddyMembership" WHERE conversation_id=cid AND user_id=u AND last_sequence IS NULL);
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.buddy_membership_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,finfolk,finfolk_rpc AS $$
DECLARE cid uuid;
BEGIN
 IF TG_TABLE_NAME='DiveSession' THEN
  FOR cid IN SELECT id FROM finfolk."BuddyConversation" WHERE session_id=NEW.id LOOP PERFORM finfolk_rpc.buddy_sync(cid); END LOOP;
 ELSE
  FOR cid IN SELECT id FROM finfolk."BuddyConversation" WHERE kind='direct' AND low_id=least(OLD.user_id,OLD.target_id) AND high_id=greatest(OLD.user_id,OLD.target_id) LOOP PERFORM finfolk_rpc.buddy_sync(cid); END LOOP;
 END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS buddy_session_members ON finfolk."DiveSession";
CREATE TRIGGER buddy_session_members AFTER UPDATE ON finfolk."DiveSession" FOR EACH ROW EXECUTE FUNCTION finfolk_rpc.buddy_membership_change();
DROP TRIGGER IF EXISTS buddy_connection_members ON finfolk."UserConnection";
CREATE TRIGGER buddy_connection_members AFTER UPDATE OR DELETE ON finfolk."UserConnection" FOR EACH ROW EXECUTE FUNCTION finfolk_rpc.buddy_membership_change();
CREATE OR REPLACE FUNCTION finfolk_rpc.buddy_allowed(actor uuid,cid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM finfolk."BuddyMembership" WHERE conversation_id=cid AND user_id=actor)
 AND NOT EXISTS(SELECT 1 FROM finfolk."BuddyMembership" m JOIN finfolk."User" u ON u.id=m.user_id WHERE m.conversation_id=cid AND (m.last_sequence IS NULL OR (SELECT kind FROM finfolk."BuddyConversation" WHERE id=cid)='direct') AND (u.deleted OR finfolk.is_user_blocked(actor,m.user_id)))
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.buddy_call(actor uuid,v jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE mode text:=v->>'mode'; cid uuid:=(v->>'conversation')::uuid; target uuid:=(v->>'target')::uuid; sid uuid:=(v->>'session')::uuid; c finfolk."BuddyConversation"; s finfolk."DiveSession"; result jsonb; seq bigint; oldmsg finfolk."BuddyMessage"; owner uuid; uid uuid;
BEGIN
 PERFORM finfolk_rpc.ret_account(actor);
 IF mode='inbox' THEN
  SELECT jsonb_build_object('conversations',coalesce(jsonb_agg(x ORDER BY x->>'updatedAt' DESC),'[]')) INTO result FROM (
   SELECT jsonb_build_object('id',c.id,'kind',c.kind,'session',c.session_id,'archived',c.archived,'title',CASE WHEN c.kind='session' THEN s.detail->'plan'->>'title' ELSE u.profile->>'displayName' END,'updatedAt',(SELECT max(sent_at) FROM finfolk."BuddyMessage" WHERE conversation_id=c.id),'unread',(SELECT count(*) FROM finfolk."BuddyMessage" msg WHERE msg.conversation_id=c.id AND msg.sender_id<>actor AND msg.sequence>coalesce(r.sequence,0) AND EXISTS(SELECT 1 FROM finfolk."BuddyMembership" m WHERE m.conversation_id=c.id AND m.user_id=actor AND msg.sequence>=m.first_sequence AND (m.last_sequence IS NULL OR msg.sequence<=m.last_sequence)))) x
   FROM finfolk."BuddyConversation" c LEFT JOIN finfolk."DiveSession" s ON s.id=c.session_id LEFT JOIN finfolk."User" u ON u.id=CASE WHEN c.low_id=actor THEN c.high_id ELSE c.low_id END LEFT JOIN finfolk."BuddyRead" r ON r.conversation_id=c.id AND r.user_id=actor WHERE finfolk_rpc.buddy_allowed(actor,c.id)
  ) q; RETURN result;
 END IF;
 IF mode='open' THEN
  IF sid IS NOT NULL THEN
   SELECT * INTO STRICT s FROM finfolk."DiveSession" WHERE id=sid FOR UPDATE;
   IF s.owner_id<>actor AND coalesce(s.detail->'plan'->'members'->actor::text->>'state','')<>'joined' THEN RAISE EXCEPTION 'Join this session first'; END IF;
   INSERT INTO finfolk."BuddyConversation"(kind,session_id) VALUES('session',sid) ON CONFLICT(session_id) DO NOTHING;
   SELECT id INTO cid FROM finfolk."BuddyConversation" WHERE session_id=sid;
  ELSE
   IF target IS NULL OR target=actor OR finfolk.is_user_blocked(actor,target) OR NOT EXISTS(SELECT 1 FROM finfolk."UserConnection" WHERE user_id=least(actor,target) AND target_id=greatest(actor,target) AND status='accepted') THEN RAISE EXCEPTION 'Accepted buddy required'; END IF;
   INSERT INTO finfolk."BuddyConversation"(kind,low_id,high_id) VALUES('direct',least(actor,target),greatest(actor,target)) ON CONFLICT(low_id,high_id) DO NOTHING;
   SELECT id INTO cid FROM finfolk."BuddyConversation" WHERE low_id=least(actor,target) AND high_id=greatest(actor,target);
  END IF;
  PERFORM finfolk_rpc.buddy_sync(cid);
  IF NOT finfolk_rpc.buddy_allowed(actor,cid) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
  RETURN jsonb_build_object('id',cid);
 END IF;
 SELECT * INTO STRICT c FROM finfolk."BuddyConversation" WHERE id=cid FOR UPDATE;
 PERFORM finfolk_rpc.buddy_sync(cid);
 IF NOT finfolk_rpc.buddy_allowed(actor,cid) THEN RAISE EXCEPTION 'Conversation unavailable'; END IF;
 IF c.session_id IS NOT NULL THEN SELECT * INTO STRICT s FROM finfolk."DiveSession" WHERE id=c.session_id; END IF;
 IF mode='thread' THEN
  SELECT jsonb_build_object('messages',coalesce(jsonb_agg(x ORDER BY (x->>'sequence')::bigint),'[]'),'canSend',NOT c.archived AND coalesce(s.detail->'plan'->>'state','')<>'cancelled' AND EXISTS(SELECT 1 FROM finfolk."BuddyMembership" WHERE conversation_id=cid AND user_id=actor AND last_sequence IS NULL),'canArchive',s.owner_id=actor,'archived',c.archived,'session',c.session_id) INTO result FROM (
   SELECT jsonb_build_object('sequence',msg.sequence,'sender',msg.sender_id,'name',u.profile->>'displayName','body',msg.body,'sentAt',msg.sent_at) x FROM finfolk."BuddyMessage" msg LEFT JOIN finfolk."User" u ON u.id=msg.sender_id WHERE msg.conversation_id=cid AND msg.sequence>coalesce((v->>'after')::bigint,0) AND msg.sequence<coalesce((v->>'before')::bigint,9223372036854775807) AND EXISTS(SELECT 1 FROM finfolk."BuddyMembership" m WHERE m.conversation_id=cid AND m.user_id=actor AND msg.sequence>=m.first_sequence AND (m.last_sequence IS NULL OR msg.sequence<=m.last_sequence)) ORDER BY CASE WHEN v ? 'after' THEN msg.sequence END ASC,msg.sequence DESC LIMIT 50
  ) q; RETURN result;
 END IF;
 IF mode='read' THEN
  SELECT coalesce(max(msg.sequence),0) INTO seq FROM finfolk."BuddyMessage" msg WHERE msg.conversation_id=cid AND msg.sequence<=coalesce((v->>'sequence')::bigint,0) AND EXISTS(SELECT 1 FROM finfolk."BuddyMembership" m WHERE m.conversation_id=cid AND m.user_id=actor AND msg.sequence>=m.first_sequence AND (m.last_sequence IS NULL OR msg.sequence<=m.last_sequence));
  INSERT INTO finfolk."BuddyRead" VALUES(cid,actor,seq) ON CONFLICT(conversation_id,user_id) DO UPDATE SET sequence=greatest(finfolk."BuddyRead".sequence,excluded.sequence); RETURN '{"ok":true}';
 END IF;
 IF mode='archive' THEN
  IF s.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Organiser access required'; END IF;
  UPDATE finfolk."BuddyConversation" SET archived=coalesce((v->>'archived')::boolean,true) WHERE id=cid; RETURN '{"ok":true}';
 END IF;
 IF mode='send' THEN
  IF c.archived OR coalesce(s.detail->'plan'->>'state','')='cancelled' OR NOT EXISTS(SELECT 1 FROM finfolk."BuddyMembership" WHERE conversation_id=cid AND user_id=actor AND last_sequence IS NULL) THEN RAISE EXCEPTION 'Conversation is read only'; END IF;
  SELECT * INTO oldmsg FROM finfolk."BuddyMessage" WHERE sender_id=actor AND request_id=(v->>'requestId')::uuid;
  IF FOUND THEN IF oldmsg.conversation_id<>cid OR oldmsg.body<>v->>'body' THEN RAISE EXCEPTION 'Request already used'; END IF; RETURN jsonb_build_object('sequence',oldmsg.sequence); END IF;
  UPDATE finfolk."BuddyConversation" SET sequence=sequence+1 WHERE id=cid RETURNING sequence INTO seq;
  INSERT INTO finfolk."BuddyMessage"(conversation_id,sequence,sender_id,request_id,body) VALUES(cid,seq,actor,(v->>'requestId')::uuid,v->>'body'); RETURN jsonb_build_object('sequence',seq);
 END IF;
 RAISE EXCEPTION 'Unknown buddy operation';
END $$;
REVOKE ALL ON FUNCTION finfolk_rpc.buddy_call(uuid,jsonb),finfolk_rpc.buddy_sync(uuid),finfolk_rpc.buddy_allowed(uuid,uuid),finfolk_rpc.buddy_membership_change() FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON finfolk."BuddyConversation",finfolk."BuddyMembership",finfolk."BuddyMessage",finfolk."BuddyRead" TO finfolk_account;
GRANT EXECUTE ON FUNCTION finfolk_rpc.buddy_call(uuid,jsonb),finfolk_rpc.buddy_sync(uuid),finfolk_rpc.buddy_allowed(uuid,uuid) TO finfolk_account;
COMMIT;