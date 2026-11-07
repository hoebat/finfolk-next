-- Generated standalone FinFolk entity schema.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') OR to_regclass('neon_auth."user"') IS NULL THEN RAISE EXCEPTION 'Provision finfolk_api and managed authentication first'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) THEN RAISE EXCEPTION 'Fresh entity schema requires empty application schemas'; END IF; END $$;
CREATE SCHEMA IF NOT EXISTS finfolk;
CREATE SCHEMA IF NOT EXISTS finfolk_rpc;
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- finfolkdb.common.type-system-seed/EnumClassType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumClassType" AS ENUM ('Activity',
    'ActivityLog',
    'DirectoryListing',
    'DiveSession',
    'Event',
    'Global',
    'Post',
    'Social',
    'SocialHandle',
    'SocialPost',
    'TaskProvider',
    'Trip',
    'User');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-system-seed/as-jsonb 
CREATE OR REPLACE FUNCTION "finfolk".as_jsonb(
  input JSONB
) RETURNS JSONB AS $$
BEGIN
  IF input is null  THEN
    RETURN ('{}')::JSONB;
  END IF;
  IF jsonb_typeof(input) != 'object' THEN
    RAISE EXCEPTION 'Expected a JSON object';
  END IF;
  RETURN input;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-system-seed/as-jsonb-array 
CREATE OR REPLACE FUNCTION "finfolk".as_jsonb_array(
  input JSONB
) RETURNS JSONB AS $$
BEGIN
  IF input is null  THEN
    RETURN ('[]')::JSONB;
  END IF;
  IF jsonb_typeof(input) != 'array' THEN
    RAISE EXCEPTION 'Expected a JSON array';
  END IF;
  RETURN input;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-system-site/Beach 
CREATE TABLE IF NOT EXISTS "finfolk"."Beach" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "area_name" TEXT NOT NULL DEFAULT '',
  "state" TEXT NOT NULL DEFAULT ''
);

-- finfolkdb.common.type-system-base/Op 
CREATE TABLE IF NOT EXISTS "finfolk"."Op" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "time" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "tag" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "user_id" TEXT
);

-- finfolkdb.common.type-system-base/Rev 
CREATE TABLE IF NOT EXISTS "finfolk"."Rev" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "class_ref" TEXT NOT NULL,
  "index" INTEGER NOT NULL DEFAULT 0,
  "current" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context),
  UNIQUE ("class_table","class_context","class_ref")
);

-- finfolkdb.common.type-system-base/RevLog 
CREATE TABLE IF NOT EXISTS "finfolk"."RevLog" (
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "rev_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "deltas" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (class_table,class_context,rev_id,version),
  CONSTRAINT fk_rev_log_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-system-base/Audit 
CREATE TABLE IF NOT EXISTS "finfolk"."Audit" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "class_ref" TEXT NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context),
  UNIQUE ("class_table","class_context","class_ref")
);

-- finfolkdb.common.type-system-base/AuditLog 
CREATE TABLE IF NOT EXISTS "finfolk"."AuditLog" (
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "audit_id" UUID NOT NULL,
  "entry" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (class_table,class_context,audit_id,op_created),
  CONSTRAINT fk_audit_log_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-system-base/sel-rev-all 
CREATE OR REPLACE FUNCTION "finfolk".sel_rev_all(
  i_class_table TEXT,
  i_class_context TEXT
) RETURNS JSONB AS $$

  WITH o AS (  
    SELECT "id" FROM "finfolk"."Rev"
    WHERE "class_table" = (i_class_table)::"finfolk"."EnumClassType"
    AND "class_context" = (i_class_context)::"finfolk"."EnumClassType") (SELECT jsonb_agg(o.id) FROM o);

$$ LANGUAGE 'sql';

-- finfolkdb.common.type-system-base/ret-rev-default 
CREATE OR REPLACE FUNCTION "finfolk".ret_rev_default(
  i_class_table TEXT,
  i_class_context TEXT,
  i_class_ref TEXT
) RETURNS JSONB AS $$

  WITH j_ret AS (  
    SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
    WHERE "class_table" = (i_class_table)::"finfolk"."EnumClassType"
    AND "class_context" = (i_class_context)::"finfolk"."EnumClassType"
    AND "class_ref" = i_class_ref
    LIMIT 1)
  SELECT to_jsonb(j_ret) FROM j_ret;

$$ LANGUAGE 'sql';

-- finfolkdb.common.type-system-base/Activity 
CREATE TABLE IF NOT EXISTS "finfolk"."Activity" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_ref" TEXT NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  UNIQUE ("class_table","class_ref")
);

-- finfolkdb.common.type-system-base/op-fn 
CREATE OR REPLACE FUNCTION "finfolk".op_fn(
  i_tag TEXT,
  i_user_id TEXT,
  i_data JSONB
) RETURNS JSONB AS $$

  WITH j_ret AS (  
    INSERT INTO "finfolk"."Op" ("tag","data","user_id") VALUES (
      (i_tag)::TEXT,
      ("finfolk".as_jsonb(i_data))::JSONB,
      (i_user_id)::TEXT
    ) RETURNING "id","time","tag","data","user_id")
  SELECT to_jsonb(j_ret) FROM j_ret;

$$ LANGUAGE 'sql';

-- finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialReferralPlatform" AS ENUM ('instagram','tiktok');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumUserConnectionStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumUserConnectionStatus" AS ENUM ('pending','accepted','declined','removed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumDepthDatasetStatus" AS ENUM ('staged','published','superseded');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumDirectoryClaimStatus" AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumDirectoryListingStatus" AS ENUM ('candidate','published','rejected','archived','suppressed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumEnvironmentTargetProduct" AS ENUM ('weather','marine','tides');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumEventRsvpStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumEventRsvpStatus" AS ENUM ('going','cancelled');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumEventStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumEventStatus" AS ENUM ('draft','published','cancelled');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumEventVisibility 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumEventVisibility" AS ENUM ('public','private');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramActionType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramActionType" AS ENUM ('reply','stats','dive','points');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramClaimStatus" AS ENUM ('waiting',
    'checking',
    'follow_required',
    'failed',
    'review_requested',
    'claimed',
    'cancelled');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramCommandContext 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramCommandContext" AS ENUM ('mention','owned');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramCommandSendState" AS ENUM ('pending','sending','sent','uncertain','skipped');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramCommandStatus" AS ENUM ('new','confirmation','done','cancelled','limited');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramDiscoveryStatus" AS ENUM ('pending','published','hidden','rejected','unavailable');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramPostReportReason" AS ENUM ('wrong_location','inappropriate','removed','other');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumInstagramSourceType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumInstagramSourceType" AS ENUM ('tags','hashtag','recheck');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumMediaImportPlatform 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMediaImportPlatform" AS ENUM ('instagram','tiktok');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumMediaImportStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMediaImportStatus" AS ENUM ('active','hidden');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumMessagingAccountMode 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingAccountMode" AS ENUM ('disabled','pilot','live');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingOutboxReplyKind" AS ENUM ('text','connect_code','connect_guidance');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingOutboxStatus" AS ENUM ('pending',
    'sending',
    'provider_accepted',
    'failed',
    'uncertain',
    'cancelled',
    'expired');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialPostReportStatus" AS ENUM ('open','resolved');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialPostStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialPostStatus" AS ENUM ('pending','approved','rejected','removed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteAccessPointMode" AS ENUM ('shore','departure');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteDepthDatasetRelationship" AS ENUM ('candidate','confirmed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteDepthEvidenceType" AS ENUM ('surveyed','reported');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteImportStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteImportStatus" AS ENUM ('draft','published');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteProfileWaterbody" AS ENUM ('ocean','lake','river','quarry','sinkhole','pool','unknown');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteProfileAccessMode" AS ENUM ('shore','boat_only','shore_or_boat','unknown');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteProfileStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteProfileStatus" AS ENUM ('published','archived');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteRevisionStatus" AS ENUM ('draft','submitted','published','rejected','withdrawn');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumTiktokConnectionStatus" AS ENUM ('pending','connected','disconnected','reconnect');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumTripImportStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumTripImportStatus" AS ENUM ('uploading','complete');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user/User 
CREATE TABLE IF NOT EXISTS "finfolk"."User" (
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('User')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "id" TEXT PRIMARY KEY,
  "profile" JSONB NOT NULL DEFAULT '{}',
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "invite_eligible" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "activity_id" UUID NOT NULL,
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  UNIQUE ("activity_id"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT fk_user_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_user_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id),
  CONSTRAINT fk_user_activity FOREIGN KEY (class_table,activity_id) REFERENCES "finfolk"."Activity"(class_table,id)
);

-- finfolkdb.common.type-user/UserBlock 
CREATE TABLE IF NOT EXISTS "finfolk"."UserBlock" (
  "owner_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  PRIMARY KEY (owner_id,target_id),
  CONSTRAINT different_users CHECK ("owner_id" != "target_id")
);

-- finfolkdb.common.type-user/UserCheckin 
CREATE TABLE IF NOT EXISTS "finfolk"."UserCheckin" (
  "user_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "beach_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "visit_day" DATE NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "checked_in_at" TIMESTAMPTZ,
  "checked_out_at" TIMESTAMPTZ,
  PRIMARY KEY (user_id,beach_id,visit_day),
  CONSTRAINT valid_checkout CHECK ("checked_out_at" IS NULL OR ("checked_in_at" IS NOT NULL AND ("checked_out_at" >= "checked_in_at")))
);

-- finfolkdb.common.type-user/UserConnection 
CREATE TABLE IF NOT EXISTS "finfolk"."UserConnection" (
  "user_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "requested_by_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumUserConnectionStatus" NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,target_id),
  CONSTRAINT ordered_users CHECK ("user_id" < "target_id"),
  CONSTRAINT valid_requester CHECK (("requested_by_id" = "user_id") OR ("requested_by_id" = "target_id"))
);

-- finfolkdb.common.type-site-note/EnumSiteNoteTopic 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteNoteTopic" AS ENUM ('access','facilities','wildlife','conditions');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-site-note/SiteNote 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNote" (
  "id" UUID PRIMARY KEY,
  "beach_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id") ON DELETE CASCADE,
  "author_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "topic" "finfolk"."EnumSiteNoteTopic" NOT NULL,
  "body" TEXT NOT NULL,
  "observed_on" DATE,
  "withdrawn" BOOLEAN NOT NULL DEFAULT false,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bounded_body CHECK ((length(btrim("body")) >= 10) AND (length("body") <= 1000)),
  CONSTRAINT observation_required CHECK (("topic" != 'conditions') OR "observed_on" IS NOT NULL),
  CONSTRAINT finite_observation CHECK ("observed_on" IS NULL OR "isfinite"("observed_on")),
  CONSTRAINT positive_revision CHECK ("revision" > 0)
);
CREATE INDEX ON "finfolk"."SiteNote" ("beach_id");
CREATE INDEX ON "finfolk"."SiteNote" ("author_id");

-- finfolkdb.common.type-site-note/SiteNoteVote 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNoteVote" (
  "note_id" UUID NOT NULL REFERENCES "finfolk"."SiteNote"("id") ON DELETE CASCADE,
  "voter_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id,voter_id)
);
CREATE INDEX ON "finfolk"."SiteNoteVote" ("voter_id");

-- finfolkdb.common.type-site-note/SiteNoteReport 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNoteReport" (
  "note_id" UUID NOT NULL REFERENCES "finfolk"."SiteNote"("id") ON DELETE CASCADE,
  "reporter_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolved_at" TIMESTAMPTZ,
  PRIMARY KEY (note_id,reporter_id),
  CONSTRAINT bounded_reason CHECK ((length(btrim("reason")) >= 1) AND (length("reason") <= 1000))
);
CREATE INDEX ON "finfolk"."SiteNoteReport" ("reporter_id");

-- finfolkdb.common.type-messaging-base/EnumMessagingProvider 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingProvider" AS ENUM ('instagram','tiktok','app');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-messaging-base/EnumMessagingDirection 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingDirection" AS ENUM ('inbound','outbound');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-messaging-base/EnumMessagingReceiptStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingReceiptStatus" AS ENUM ('received','processing','completed','failed','expired');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-messaging-base/MessagingApplication 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingApplication" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL
);

-- finfolkdb.common.type-messaging-base/MessagingAccount 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingAccount" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "application_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "provider" "finfolk"."EnumMessagingProvider" NOT NULL,
  "account_id" TEXT NOT NULL,
  "username" TEXT,
  "credential_ciphertext" TEXT,
  "token_expires_at" TIMESTAMPTZ,
  "credential_lease" UUID,
  "credential_lease_until" TIMESTAMPTZ,
  "mode" "finfolk"."EnumMessagingAccountMode" NOT NULL DEFAULT 'disabled',
  "enabled_commands" JSONB NOT NULL DEFAULT '["ping", "help"]',
  "pilot_sender_ids" JSONB NOT NULL DEFAULT '[]',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "checks" JSONB NOT NULL DEFAULT '{}',
  "last_webhook_at" TIMESTAMPTZ,
  "last_command_at" TIMESTAMPTZ,
  "last_reply_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "backoff_until" TIMESTAMPTZ,
  "provider_scope" TEXT,
  UNIQUE ("id","application_id"),
  UNIQUE ("application_id","provider","account_id"),
  CONSTRAINT credential_lease_pair CHECK (("credential_lease" IS NULL AND "credential_lease_until" IS NULL) OR ("credential_lease" IS NOT NULL AND "credential_lease_until" IS NOT NULL)),
  CONSTRAINT positive_generation CHECK ("generation" > 0),
  CONSTRAINT commands_array CHECK (jsonb_typeof("enabled_commands") = 'array'),
  CONSTRAINT pilot_array CHECK (jsonb_typeof("pilot_sender_ids") = 'array')
);
CREATE INDEX ON "finfolk"."MessagingAccount" ("application_id");

-- finfolkdb.common.type-messaging-base/MessagingAudit 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingAudit" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "actor" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "correlation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON "finfolk"."MessagingAudit" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingIdempotency 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingIdempotency" (
  "application_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "user_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "key_hash" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_ciphertext" TEXT,
  "response_status" INTEGER NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id,user_id,key_hash)
);

-- finfolkdb.common.type-messaging-base/MessagingOauthState 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingOauthState" (
  "application_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "state_hash" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "user_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "flow_key" TEXT NOT NULL,
  PRIMARY KEY (application_id,state_hash),
  CONSTRAINT fk_messaging_oauth_state_account_scope FOREIGN KEY (application_id,account_id) REFERENCES "finfolk"."MessagingAccount"(application_id,id)
);
CREATE INDEX ON "finfolk"."MessagingOauthState" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingIdentity 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingIdentity" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "external_id" TEXT NOT NULL,
  "user_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  UNIQUE ("id","account_id"),
  UNIQUE ("account_id","external_id")
);
CREATE INDEX ON "finfolk"."MessagingIdentity" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingConversation 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingConversation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "participant_id" UUID NOT NULL REFERENCES "finfolk"."MessagingIdentity"("id"),
  "external_id" TEXT NOT NULL,
  UNIQUE ("id","account_id"),
  UNIQUE ("account_id","external_id"),
  CONSTRAINT fk_messaging_conversation_participant_scope FOREIGN KEY (account_id,participant_id) REFERENCES "finfolk"."MessagingIdentity"(account_id,id)
);
CREATE INDEX ON "finfolk"."MessagingConversation" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingMessage 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingMessage" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "conversation_id" UUID NOT NULL REFERENCES "finfolk"."MessagingConversation"("id"),
  "direction" "finfolk"."EnumMessagingDirection" NOT NULL,
  "external_id" TEXT,
  "body" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sent_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("id","account_id"),
  UNIQUE ("account_id","direction","external_id"),
  CONSTRAINT body_limit CHECK (length("body") <= 2000),
  CONSTRAINT incoming_identity CHECK (("direction" != 'inbound') OR ("external_id" IS NOT NULL AND "sent_at" IS NOT NULL)),
  CONSTRAINT metadata_object CHECK (jsonb_typeof("metadata") = 'object'),
  CONSTRAINT fk_messaging_message_conversation_scope FOREIGN KEY (account_id,conversation_id) REFERENCES "finfolk"."MessagingConversation"(account_id,id)
);
CREATE INDEX ON "finfolk"."MessagingMessage" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingReceipt 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingReceipt" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "external_event_id" TEXT NOT NULL,
  "message_id" UUID NOT NULL REFERENCES "finfolk"."MessagingMessage"("id"),
  "status" "finfolk"."EnumMessagingReceiptStatus" NOT NULL DEFAULT 'received',
  "generation" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease" UUID,
  "lease_until" TIMESTAMPTZ,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deadline" TIMESTAMPTZ NOT NULL,
  "result" JSONB NOT NULL DEFAULT '{}',
  "correlation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("id","account_id"),
  UNIQUE ("account_id","external_event_id"),
  UNIQUE ("message_id"),
  CONSTRAINT attempts CHECK ("attempts" >= 0),
  CONSTRAINT lease_pair CHECK (("lease" IS NULL AND "lease_until" IS NULL) OR ("lease" IS NOT NULL AND "lease_until" IS NOT NULL)),
  CONSTRAINT processing_lease CHECK ((("status" = 'processing') AND "lease" IS NOT NULL) OR (("status" != 'processing') AND "lease" IS NULL)),
  CONSTRAINT result_object CHECK (jsonb_typeof("result") = 'object'),
  CONSTRAINT fk_messaging_receipt_message_scope FOREIGN KEY (account_id,message_id) REFERENCES "finfolk"."MessagingMessage"(account_id,id)
);
CREATE INDEX ON "finfolk"."MessagingReceipt" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingOutbox 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingOutbox" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" TEXT NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "receipt_id" UUID NOT NULL REFERENCES "finfolk"."MessagingReceipt"("id"),
  "message_id" UUID NOT NULL REFERENCES "finfolk"."MessagingMessage"("id"),
  "body" TEXT NOT NULL,
  "correlation_id" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "state" "finfolk"."EnumMessagingOutboxStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease" UUID,
  "lease_until" TIMESTAMPTZ,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "deadline" TIMESTAMPTZ NOT NULL,
  "provider_message_id" TEXT,
  "error_code" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "body_ciphertext" TEXT,
  "reply_kind" "finfolk"."EnumMessagingOutboxReplyKind" NOT NULL DEFAULT 'text',
  UNIQUE ("receipt_id"),
  UNIQUE ("message_id"),
  CONSTRAINT body_limit CHECK (length("body") <= 2000),
  CONSTRAINT sending_lease CHECK ((("state" = 'sending') AND "lease" IS NOT NULL) OR (("state" != 'sending') AND "lease" IS NULL)),
  CONSTRAINT attempts CHECK ("attempts" >= 0),
  CONSTRAINT lease_pair CHECK (("lease" IS NULL AND "lease_until" IS NULL) OR ("lease" IS NOT NULL AND "lease_until" IS NOT NULL)),
  CONSTRAINT fk_messaging_outbox_receipt_scope FOREIGN KEY (account_id,receipt_id) REFERENCES "finfolk"."MessagingReceipt"(account_id,id),
  CONSTRAINT fk_messaging_outbox_message_scope FOREIGN KEY (account_id,message_id) REFERENCES "finfolk"."MessagingMessage"(account_id,id)
);
CREATE INDEX ON "finfolk"."MessagingOutbox" ("account_id");

-- finfolkdb.common.type-messaging-base/__work_indexes__ 
CREATE INDEX IF NOT EXISTS "MessagingReceipt_ready" ON "finfolk"."MessagingReceipt" ("account_id","status","next_attempt_at");
CREATE INDEX IF NOT EXISTS "MessagingOutbox_ready" ON "finfolk"."MessagingOutbox" ("account_id","state","next_attempt_at");
CREATE INDEX IF NOT EXISTS "MessagingMessage_history" ON "finfolk"."MessagingMessage" ("conversation_id","created_at","id");

-- finfolkdb.fn.messaging.messaging-manage/ret-messaging-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_messaging_account(
  i_application TEXT,
  i_account TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR SHARE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    RETURN o_account;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/record-messaging-audit 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_messaging_audit(
  i_application TEXT,
  i_account TEXT,
  i_event TEXT,
  i_correlation UUID
) RETURNS JSONB AS $$

  DECLARE
    o_audit JSONB;
  BEGIN
    WITH j_ret AS (  
      INSERT INTO "finfolk"."MessagingAudit" ("account_id","actor","event","correlation_id") VALUES (
        (i_account)::TEXT,
        (i_application)::TEXT,
        (i_event)::TEXT,
        (i_correlation)::UUID
      ) RETURNING "id","account_id","actor","event","correlation_id","created_at")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    RETURN o_audit;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/is-messaging-participant-allowed 
CREATE OR REPLACE FUNCTION "finfolk_rpc".is_messaging_participant_allowed(
  o_account JSONB,
  i_conversation UUID
) RETURNS BOOLEAN AS $$

  DECLARE
    o_conversation JSONB;
    o_identity JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
      WHERE "id" = i_conversation
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_conversation;
    WITH j_ret AS (  
      SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
      WHERE "id" = (o_conversation ->> 'participant_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
    RETURN ((o_account ->> 'mode') = 'live') OR (((o_account ->> 'mode') = 'pilot') AND jsonb_exists(o_account -> 'pilot_sender_ids',o_identity ->> 'external_id'));
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/receive-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_message(
  i_application TEXT,
  i_account TEXT,
  i_envelope JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_envelope JSONB;
    o_metadata JSONB;
    v_body TEXT;
    v_conversation TEXT;
    v_deadline TIMESTAMPTZ;
    v_event TEXT;
    v_message TEXT;
    v_sender TEXT;
    v_sent TIMESTAMPTZ;
  BEGIN
    o_envelope := "finfolk".as_jsonb(i_envelope);
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    v_event := (o_envelope ->> 'eventId');
    v_message := (o_envelope ->> 'messageId');
    v_conversation := (o_envelope ->> 'conversationId');
    v_sender := (o_envelope ->> 'senderId');
    v_body := (o_envelope ->> 'body');
    v_sent := (o_envelope ->> 'sentAt')::TIMESTAMPTZ;
    v_deadline := (o_envelope ->> 'deadline')::TIMESTAMPTZ;
    o_metadata := "finfolk".as_jsonb(o_envelope -> 'metadata');
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF (jsonb_typeof(o_envelope -> 'eventId') != 'string') OR (jsonb_typeof(o_envelope -> 'messageId') != 'string') OR (jsonb_typeof(o_envelope -> 'conversationId') != 'string') OR (jsonb_typeof(o_envelope -> 'senderId') != 'string') OR (jsonb_typeof(o_envelope -> 'body') != 'string') OR NOT "isfinite"(v_sent) OR NOT "isfinite"(v_deadline) OR (coalesce(v_event,'') = '') OR (length(v_event) > 500) OR (coalesce(v_message,'') = '') OR (length(v_message) > 500) OR (coalesce(v_conversation,'') = '') OR (length(v_conversation) > 500) OR (coalesce(v_sender,'') = '') OR (length(v_sender) > 500) OR v_body IS NULL OR (length(v_body) > 2000) OR v_sent IS NULL OR v_deadline IS NULL OR (v_deadline <= v_sent) OR (v_sent > (now() + ('5 minutes')::INTERVAL)) THEN
      RAISE EXCEPTION 'Invalid normalized messaging envelope';
    END IF;
    DECLARE
      o_existing JSONB;
      o_existing_message JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "external_event_id",
          "message_id",
          "status",
          "generation",
          "attempts",
          "lease",
          "lease_until",
          "next_attempt_at",
          "deadline",
          "result",
          "correlation_id",
          "created_at"
        FROM "finfolk"."MessagingReceipt"
        WHERE "account_id" = i_account AND "external_event_id" = v_event
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "conversation_id",
          "direction",
          "external_id",
          "body",
          "metadata",
          "sent_at",
          "created_at"
        FROM "finfolk"."MessagingMessage"
        WHERE "account_id" = i_account
        AND "direction" = ('inbound')::"finfolk"."EnumMessagingDirection"
        AND "external_id" = v_message
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing_message;
      IF o_existing IS NOT NULL OR o_existing_message IS NOT NULL THEN
        DECLARE
        o_original JSONB;
          o_sender JSONB;
          o_thread JSONB;
      BEGIN
        WITH j_ret AS (  
            SELECT
              "id",
              "account_id",
              "conversation_id",
              "direction",
              "external_id",
              "body",
              "metadata",
              "sent_at",
              "created_at"
            FROM "finfolk"."MessagingMessage"
            WHERE "id" = coalesce(
              (o_existing ->> 'message_id')::UUID,
              (o_existing_message ->> 'id')::UUID
            )
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_original;
          WITH j_ret AS (  
            SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
            WHERE "id" = (o_original ->> 'conversation_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_thread;
          WITH j_ret AS (  
            SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
            WHERE "id" = (o_thread ->> 'participant_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_sender;
          IF ((o_original ->> 'external_id') != v_message) OR ((o_original ->> 'body') != v_body) OR ((o_original -> 'metadata') != o_metadata) OR ((o_original ->> 'sent_at')::TIMESTAMPTZ != v_sent) OR ((o_thread ->> 'external_id') != v_conversation) OR ((o_sender ->> 'external_id') != v_sender) THEN
            RAISE EXCEPTION 'Conflicting duplicate messaging event';
          END IF;
          IF o_existing is null  THEN
            DECLARE
            o_found JSONB;
          BEGIN
            WITH j_ret AS (  
                SELECT
                  "id",
                  "account_id",
                  "external_event_id",
                  "message_id",
                  "status",
                  "generation",
                  "attempts",
                  "lease",
                  "lease_until",
                  "next_attempt_at",
                  "deadline",
                  "result",
                  "correlation_id",
                  "created_at"
                FROM "finfolk"."MessagingReceipt"
                WHERE "message_id" = (o_original ->> 'id')::UUID
                LIMIT 1)
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_found;
              o_existing := o_found;
          END;
          END IF;
          RETURN jsonb_build_object('duplicate',true,'receipt',o_existing);
      END;
      END IF;
      DECLARE
        o_identity JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
          WHERE "account_id" = i_account AND "external_id" = v_sender
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
        IF o_identity is null  THEN
          DECLARE
          o_new JSONB;
        BEGIN
          WITH j_ret AS (INSERT INTO "finfolk"."MessagingIdentity" ("account_id","external_id") VALUES ((i_account)::TEXT,(v_sender)::TEXT) RETURNING "id","account_id","external_id","user_id")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
            o_identity := o_new;
        END;
        END IF;
        DECLARE
          o_conversation JSONB;
        BEGIN
          WITH j_ret AS (  
            SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
            WHERE "account_id" = i_account AND "external_id" = v_conversation
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_conversation;
          IF o_conversation is null  THEN
            DECLARE
            o_new JSONB;
          BEGIN
            WITH j_ret AS (  
                INSERT INTO "finfolk"."MessagingConversation" ("account_id","participant_id","external_id") VALUES (
                  (i_account)::TEXT,
                  (o_identity ->> 'id')::UUID,
                  (v_conversation)::TEXT
                ) RETURNING "id","account_id","participant_id","external_id")
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
              o_conversation := o_new;
          END;
          END IF;
          IF (o_conversation ->> 'participant_id') != (o_identity ->> 'id') THEN
            RAISE EXCEPTION 'Conversation participant mismatch';
          END IF;
          DECLARE
            o_audit JSONB;
            o_message JSONB;
            o_receipt JSONB;
          BEGIN
            WITH j_ret AS (  
              INSERT INTO "finfolk"."MessagingMessage" (
                "account_id",
                "conversation_id",
                "direction",
                "external_id",
                "body",
                "metadata",
                "sent_at"
              ) VALUES (
                (i_account)::TEXT,
                (o_conversation ->> 'id')::UUID,
                ('inbound')::"finfolk"."EnumMessagingDirection",
                (v_message)::TEXT,
                (v_body)::TEXT,
                (o_metadata)::JSONB,
                (v_sent)::TIMESTAMPTZ
              ) RETURNING
                "id",
                "account_id",
                "conversation_id",
                "direction",
                "external_id",
                "body",
                "metadata",
                "sent_at",
                "created_at")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."MessagingReceipt" (
                "account_id",
                "external_event_id",
                "message_id",
                "generation",
                "deadline"
              ) VALUES (
                (i_account)::TEXT,
                (v_event)::TEXT,
                (o_message ->> 'id')::UUID,
                (o_account ->> 'generation')::INTEGER,
                (v_deadline)::TIMESTAMPTZ
              ) RETURNING
                "id",
                "account_id",
                "external_event_id",
                "message_id",
                "status",
                "generation",
                "attempts",
                "lease",
                "lease_until",
                "next_attempt_at",
                "deadline",
                "result",
                "correlation_id",
                "created_at")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_receipt;
            o_audit := "finfolk_rpc".record_messaging_audit(
              i_application,
              i_account,
              'message_received',
              (o_receipt ->> 'correlation_id')::UUID
            );
            RETURN jsonb_build_object('duplicate',false,'receipt',o_receipt);
          END;
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/reconcile-messaging-work 
CREATE OR REPLACE FUNCTION "finfolk_rpc".reconcile_messaging_work(
  i_application TEXT,
  i_account TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_cancelled JSONB;
    o_deadline JSONB;
    o_exhausted JSONB;
    o_expired JSONB;
    o_uncertain JSONB;
    v_generation INTEGER;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    v_generation := (o_account ->> 'generation')::INTEGER;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingReceipt" SET
        "status" = ('expired')::"finfolk"."EnumMessagingReceiptStatus",
        "lease" = (null)::UUID,
        "lease_until" = (null)::TIMESTAMPTZ
      WHERE ("account_id" = i_account AND "status" != ('completed')::"finfolk"."EnumMessagingReceiptStatus" AND "status" != ('expired')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" <= now())
      OR ("account_id" = i_account AND "status" != ('completed')::"finfolk"."EnumMessagingReceiptStatus" AND "status" != ('expired')::"finfolk"."EnumMessagingReceiptStatus" AND "generation" != v_generation)
      RETURNING
        "id",
        "account_id",
        "external_event_id",
        "message_id",
        "status",
        "generation",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "result",
        "correlation_id",
        "created_at")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingReceipt" SET
        "status" = ('failed')::"finfolk"."EnumMessagingReceiptStatus",
        "lease" = (null)::UUID,
        "lease_until" = (null)::TIMESTAMPTZ
      WHERE "account_id" = i_account
      AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
      AND "attempts" >= 5
      AND "lease_until" <= now()
      RETURNING
        "id",
        "account_id",
        "external_event_id",
        "message_id",
        "status",
        "generation",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "result",
        "correlation_id",
        "created_at")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_exhausted;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingOutbox" SET
        "state" = ('uncertain')::"finfolk"."EnumMessagingOutboxStatus",
        "lease" = (null)::UUID,
        "lease_until" = (null)::TIMESTAMPTZ,
        "error_code" = ('delivery_lease_expired')::TEXT
      WHERE "account_id" = i_account
      AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "lease_until" <= now()
      RETURNING
        "id",
        "account_id",
        "receipt_id",
        "message_id",
        "body",
        "correlation_id",
        "generation",
        "state",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "provider_message_id",
        "error_code",
        "created_at",
        "updated_at",
        "body_ciphertext",
        "reply_kind")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_uncertain;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingOutbox" SET
        "state" = ('cancelled')::"finfolk"."EnumMessagingOutboxStatus",
        "error_code" = ('account_generation_changed')::TEXT
      WHERE "account_id" = i_account
      AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "generation" != v_generation
      RETURNING
        "id",
        "account_id",
        "receipt_id",
        "message_id",
        "body",
        "correlation_id",
        "generation",
        "state",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "provider_message_id",
        "error_code",
        "created_at",
        "updated_at",
        "body_ciphertext",
        "reply_kind")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_cancelled;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingOutbox" SET
        "state" = ('expired')::"finfolk"."EnumMessagingOutboxStatus"
      WHERE "account_id" = i_account
      AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "deadline" <= now()
      RETURNING
        "id",
        "account_id",
        "receipt_id",
        "message_id",
        "body",
        "correlation_id",
        "generation",
        "state",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "provider_message_id",
        "error_code",
        "created_at",
        "updated_at",
        "body_ciphertext",
        "reply_kind")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_deadline;
    RETURN jsonb_build_object('ok',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/claim-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_message(
  i_application TEXT,
  i_account TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_reconciled JSONB;
    v_generation INTEGER;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
    v_generation := (o_account ->> 'generation')::INTEGER;
    IF ((o_account ->> 'mode') = 'disabled') OR ((o_account ->> 'backoff_until')::TIMESTAMPTZ > now()) THEN
      RETURN null;
    END IF;
    DECLARE
      o_receipt JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "external_event_id",
          "message_id",
          "status",
          "generation",
          "attempts",
          "lease",
          "lease_until",
          "next_attempt_at",
          "deadline",
          "result",
          "correlation_id",
          "created_at"
        FROM "finfolk"."MessagingReceipt"
        WHERE ("account_id" = i_account AND "generation" = v_generation AND "status" = ('received')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > now() AND "next_attempt_at" <= now() AND "attempts" < 5)
        OR ("account_id" = i_account AND "generation" = v_generation AND "status" = ('failed')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > now() AND "next_attempt_at" <= now() AND "attempts" < 5)
        OR ("account_id" = i_account AND "generation" = v_generation AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > now() AND "lease_until" <= now() AND "attempts" < 5)
        ORDER BY "created_at","id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_receipt;
      IF o_receipt is null  THEN
        RETURN null;
      END IF;
      DECLARE
        o_conversation JSONB;
        o_message JSONB;
        o_participant JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "account_id",
            "conversation_id",
            "direction",
            "external_id",
            "body",
            "metadata",
            "sent_at",
            "created_at"
          FROM "finfolk"."MessagingMessage"
          WHERE "id" = (o_receipt ->> 'message_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
        WITH j_ret AS (  
          SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
          WHERE "id" = (o_message ->> 'conversation_id')::UUID
          AND "account_id" = i_account
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_conversation;
        WITH j_ret AS (  
          SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
          WHERE "id" = (o_conversation ->> 'participant_id')::UUID
          AND "account_id" = i_account
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_participant;
        IF NOT "finfolk_rpc".is_messaging_participant_allowed(o_account,(o_message ->> 'conversation_id')::UUID) THEN
          DECLARE
          o_expired JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."MessagingReceipt" SET
                "status" = ('expired')::"finfolk"."EnumMessagingReceiptStatus",
                "lease" = (null)::UUID,
                "lease_until" = (null)::TIMESTAMPTZ
              WHERE "id" = (o_receipt ->> 'id')::UUID
              RETURNING
                "id",
                "account_id",
                "external_event_id",
                "message_id",
                "status",
                "generation",
                "attempts",
                "lease",
                "lease_until",
                "next_attempt_at",
                "deadline",
                "result",
                "correlation_id",
                "created_at")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
            RETURN null;
        END;
        END IF;
        DECLARE
          o_claim JSONB;
        BEGIN
          WITH j_ret AS (  
            UPDATE "finfolk"."MessagingReceipt" SET
              "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus",
              "attempts" = ((o_receipt ->> 'attempts')::INTEGER + 1)::INTEGER,
              "lease" = (uuid_generate_v4())::UUID,
              "lease_until" = (now() + ('60 seconds')::INTERVAL)::TIMESTAMPTZ
            WHERE "id" = (o_receipt ->> 'id')::UUID
            RETURNING
              "id",
              "account_id",
              "external_event_id",
              "message_id",
              "status",
              "generation",
              "attempts",
              "lease",
              "lease_until",
              "next_attempt_at",
              "deadline",
              "result",
              "correlation_id",
              "created_at")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_claim;
          RETURN jsonb_build_object(
            'receipt',
            o_claim,
            'message',
            o_message,
            'provider',
            o_account ->> 'provider',
            'senderId',
            o_participant ->> 'external_id',
            'userId',
            o_participant ->> 'user_id'
          );
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/complete-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_message(
  i_application TEXT,
  i_account TEXT,
  i_receipt UUID,
  i_lease UUID,
  i_result JSONB,
  i_reply TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_receipt JSONB;
    o_result JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    o_result := "finfolk".as_jsonb(i_result);
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "external_event_id",
        "message_id",
        "status",
        "generation",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "result",
        "correlation_id",
        "created_at"
      FROM "finfolk"."MessagingReceipt"
      WHERE "id" = i_receipt
      AND "account_id" = i_account
      AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
      AND "lease" = i_lease
      AND "lease_until" > now()
      AND "deadline" > now()
      AND "generation" = (o_account ->> 'generation')::INTEGER
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_receipt;
    IF o_receipt IS NULL OR ((o_account ->> 'mode') = 'disabled') THEN
      RETURN null;
    END IF;
    IF i_lease IS NULL OR (length(i_reply) > 2000) THEN
      RAISE EXCEPTION 'Invalid messaging completion';
    END IF;
    DECLARE
      o_incoming JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "conversation_id",
          "direction",
          "external_id",
          "body",
          "metadata",
          "sent_at",
          "created_at"
        FROM "finfolk"."MessagingMessage"
        WHERE "id" = (o_receipt ->> 'message_id')::UUID
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_incoming;
      IF NOT "finfolk_rpc".is_messaging_participant_allowed(o_account,(o_incoming ->> 'conversation_id')::UUID) THEN
        RETURN null;
      END IF;
      IF i_reply is not null  THEN
        DECLARE
        o_message JSONB;
          o_outbox JSONB;
      BEGIN
        WITH j_ret AS (  
            INSERT INTO "finfolk"."MessagingMessage" ("account_id","conversation_id","direction","body") VALUES (
              (i_account)::TEXT,
              (o_incoming ->> 'conversation_id')::UUID,
              ('outbound')::"finfolk"."EnumMessagingDirection",
              (i_reply)::TEXT
            ) RETURNING
              "id",
              "account_id",
              "conversation_id",
              "direction",
              "external_id",
              "body",
              "metadata",
              "sent_at",
              "created_at")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
          WITH j_ret AS (  
            INSERT INTO "finfolk"."MessagingOutbox" (
              "account_id",
              "receipt_id",
              "message_id",
              "body",
              "correlation_id",
              "generation",
              "deadline"
            ) VALUES (
              (i_account)::TEXT,
              (i_receipt)::UUID,
              (o_message ->> 'id')::UUID,
              (i_reply)::TEXT,
              (o_receipt ->> 'correlation_id')::UUID,
              (o_receipt ->> 'generation')::INTEGER,
              (o_receipt ->> 'deadline')::TIMESTAMPTZ
            ) RETURNING
              "id",
              "account_id",
              "receipt_id",
              "message_id",
              "body",
              "correlation_id",
              "generation",
              "state",
              "attempts",
              "lease",
              "lease_until",
              "next_attempt_at",
              "deadline",
              "provider_message_id",
              "error_code",
              "created_at",
              "updated_at",
              "body_ciphertext",
              "reply_kind")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_outbox;
          null;
      END;
      END IF;
      DECLARE
        o_audit JSONB;
        o_complete JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingReceipt" SET
            "status" = ('completed')::"finfolk"."EnumMessagingReceiptStatus",
            "lease" = (null)::UUID,
            "lease_until" = (null)::TIMESTAMPTZ,
            "result" = (o_result)::JSONB
          WHERE "id" = i_receipt
          RETURNING
            "id",
            "account_id",
            "external_event_id",
            "message_id",
            "status",
            "generation",
            "attempts",
            "lease",
            "lease_until",
            "next_attempt_at",
            "deadline",
            "result",
            "correlation_id",
            "created_at")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_complete;
        o_audit := "finfolk_rpc".record_messaging_audit(
          i_application,
          i_account,
          'message_completed',
          (o_receipt ->> 'correlation_id')::UUID
        );
        RETURN o_complete;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/retry-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".retry_message(
  i_application TEXT,
  i_account TEXT,
  i_receipt UUID,
  i_lease UUID,
  i_delay INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    IF i_lease IS NULL OR i_delay IS NULL OR (i_delay < 1) OR (i_delay > 3600) THEN
      RAISE EXCEPTION 'Invalid messaging retry';
    END IF;
    DECLARE
      o_retry JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingReceipt" SET
          "status" = ('failed')::"finfolk"."EnumMessagingReceiptStatus",
          "lease" = (null)::UUID,
          "lease_until" = (null)::TIMESTAMPTZ,
          "next_attempt_at" = (now() + (i_delay * ('1 second')::INTERVAL))::TIMESTAMPTZ
        WHERE "id" = i_receipt
        AND "account_id" = i_account
        AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
        AND "lease" = i_lease
        AND "lease_until" > now()
        AND "deadline" > now()
        AND "generation" = (o_account ->> 'generation')::INTEGER
        RETURNING
          "id",
          "account_id",
          "external_event_id",
          "message_id",
          "status",
          "generation",
          "attempts",
          "lease",
          "lease_until",
          "next_attempt_at",
          "deadline",
          "result",
          "correlation_id",
          "created_at")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_retry;
      RETURN o_retry;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/claim-delivery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_delivery(
  i_application TEXT,
  i_account TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_reconciled JSONB;
    v_generation INTEGER;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    v_generation := (o_account ->> 'generation')::INTEGER;
    o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
    IF ((o_account ->> 'mode') = 'disabled') OR ((o_account ->> 'backoff_until')::TIMESTAMPTZ > now()) THEN
      RETURN null;
    END IF;
    DECLARE
      o_outbox JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "receipt_id",
          "message_id",
          "body",
          "correlation_id",
          "generation",
          "state",
          "attempts",
          "lease",
          "lease_until",
          "next_attempt_at",
          "deadline",
          "provider_message_id",
          "error_code",
          "created_at",
          "updated_at",
          "body_ciphertext",
          "reply_kind"
        FROM "finfolk"."MessagingOutbox"
        WHERE "account_id" = i_account
        AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
        AND "generation" = v_generation
        AND "deadline" > now()
        AND "next_attempt_at" <= now()
        AND "attempts" < 5
        ORDER BY "created_at","id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_outbox;
      IF o_outbox is null  THEN
        RETURN null;
      END IF;
      DECLARE
        o_conversation JSONB;
        o_identity JSONB;
        o_message JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "account_id",
            "conversation_id",
            "direction",
            "external_id",
            "body",
            "metadata",
            "sent_at",
            "created_at"
          FROM "finfolk"."MessagingMessage"
          WHERE "id" = (o_outbox ->> 'message_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
        WITH j_ret AS (  
          SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
          WHERE "id" = (o_message ->> 'conversation_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_conversation;
        WITH j_ret AS (  
          SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
          WHERE "id" = (o_conversation ->> 'participant_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
        IF NOT "finfolk_rpc".is_messaging_participant_allowed(o_account,(o_conversation ->> 'id')::UUID) THEN
          DECLARE
          o_cancelled JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."MessagingOutbox" SET
                "state" = ('cancelled')::"finfolk"."EnumMessagingOutboxStatus",
                "error_code" = ('participant_restricted')::TEXT
              WHERE "id" = (o_outbox ->> 'id')::UUID
              RETURNING
                "id",
                "account_id",
                "receipt_id",
                "message_id",
                "body",
                "correlation_id",
                "generation",
                "state",
                "attempts",
                "lease",
                "lease_until",
                "next_attempt_at",
                "deadline",
                "provider_message_id",
                "error_code",
                "created_at",
                "updated_at",
                "body_ciphertext",
                "reply_kind")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_cancelled;
            RETURN null;
        END;
        END IF;
        DECLARE
          o_claim JSONB;
        BEGIN
          WITH j_ret AS (  
            UPDATE "finfolk"."MessagingOutbox" SET
              "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus",
              "attempts" = ((o_outbox ->> 'attempts')::INTEGER + 1)::INTEGER,
              "lease" = (uuid_generate_v4())::UUID,
              "lease_until" = (now() + ('60 seconds')::INTERVAL)::TIMESTAMPTZ,
              "updated_at" = (now())::TIMESTAMPTZ
            WHERE "id" = (o_outbox ->> 'id')::UUID
            RETURNING
              "id",
              "account_id",
              "receipt_id",
              "message_id",
              "body",
              "correlation_id",
              "generation",
              "state",
              "attempts",
              "lease",
              "lease_until",
              "next_attempt_at",
              "deadline",
              "provider_message_id",
              "error_code",
              "created_at",
              "updated_at",
              "body_ciphertext",
              "reply_kind")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_claim;
          RETURN jsonb_build_object(
            'delivery',
            o_claim,
            'provider',
            o_account ->> 'provider',
            'accountId',
            o_account ->> 'account_id',
            'recipientId',
            o_identity ->> 'external_id',
            'conversationId',
            o_conversation ->> 'external_id'
          );
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/record-delivery-result 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_delivery_result(
  i_application TEXT,
  i_account TEXT,
  i_delivery UUID,
  i_lease UUID,
  i_outcome TEXT,
  i_provider_message TEXT,
  i_delay INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_outbox JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "receipt_id",
        "message_id",
        "body",
        "correlation_id",
        "generation",
        "state",
        "attempts",
        "lease",
        "lease_until",
        "next_attempt_at",
        "deadline",
        "provider_message_id",
        "error_code",
        "created_at",
        "updated_at",
        "body_ciphertext",
        "reply_kind"
      FROM "finfolk"."MessagingOutbox"
      WHERE "id" = i_delivery
      AND "account_id" = i_account
      AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "lease" = i_lease
      AND "lease_until" > now()
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_outbox;
    IF o_outbox is null  THEN
      RETURN null;
    END IF;
    IF i_lease IS NULL OR i_outcome IS NULL OR NOT ((i_outcome = 'accepted') OR (i_outcome = 'retry') OR (i_outcome = 'failed') OR (i_outcome = 'uncertain')) OR ((i_outcome = 'accepted') AND (coalesce(i_provider_message,'') = '')) OR ((i_outcome = 'retry') AND (i_delay IS NULL OR (i_delay < 1) OR (i_delay > 3600))) THEN
      RAISE EXCEPTION 'Invalid messaging delivery outcome';
    END IF;
    DECLARE
      v_state TEXT;
    BEGIN
      v_state := i_outcome;
      IF i_outcome = 'accepted' THEN
        v_state := 'provider_accepted';
      END IF;
      IF i_outcome = 'retry' THEN
        v_state := 'pending';
        IF (o_outbox ->> 'attempts')::INTEGER >= 5 THEN
          v_state := 'failed';
        END IF;
        IF ((o_outbox ->> 'generation')::INTEGER != (o_account ->> 'generation')::INTEGER) OR ((o_account ->> 'mode') = 'disabled') THEN
          v_state := 'cancelled';
        END IF;
        IF (o_outbox ->> 'deadline')::TIMESTAMPTZ <= now() THEN
          v_state := 'expired';
        END IF;
      END IF;
      DECLARE
        o_audit JSONB;
        o_finished JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingOutbox" SET
            "state" = (v_state)::"finfolk"."EnumMessagingOutboxStatus",
            "lease" = (null)::UUID,
            "lease_until" = (null)::TIMESTAMPTZ,
            "next_attempt_at" = (now() + (coalesce(i_delay,1) * ('1 second')::INTERVAL))::TIMESTAMPTZ,
            "provider_message_id" = (i_provider_message)::TEXT,
            "updated_at" = (now())::TIMESTAMPTZ
          WHERE "id" = i_delivery
          RETURNING
            "id",
            "account_id",
            "receipt_id",
            "message_id",
            "body",
            "correlation_id",
            "generation",
            "state",
            "attempts",
            "lease",
            "lease_until",
            "next_attempt_at",
            "deadline",
            "provider_message_id",
            "error_code",
            "created_at",
            "updated_at",
            "body_ciphertext",
            "reply_kind")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_finished;
        o_audit := "finfolk_rpc".record_messaging_audit(
          i_application,
          i_account,
          'delivery_' || v_state,
          (o_outbox ->> 'correlation_id')::UUID
        );
        IF i_outcome = 'accepted' THEN
          DECLARE
          o_message JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."MessagingMessage" SET
                "external_id" = (i_provider_message)::TEXT,
                "sent_at" = (now())::TIMESTAMPTZ
              WHERE "id" = (o_outbox ->> 'message_id')::UUID
              RETURNING
                "id",
                "account_id",
                "conversation_id",
                "direction",
                "external_id",
                "body",
                "metadata",
                "sent_at",
                "created_at")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
            null;
        END;
        END IF;
        RETURN o_finished;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/ret-messaging-history 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_messaging_history(
  i_application TEXT,
  i_account TEXT,
  i_conversation UUID
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_history JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "conversation_id",
        "direction",
        "external_id",
        "body",
        "metadata",
        "sent_at",
        "created_at"
      FROM "finfolk"."MessagingMessage"
      WHERE "account_id" = i_account AND "conversation_id" = i_conversation
      ORDER BY "created_at","id" DESC
      LIMIT 50)
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_history;
    RETURN coalesce(o_history,('[]')::JSONB);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-oauth/begin-messaging-oauth 
CREATE OR REPLACE FUNCTION "finfolk_rpc".begin_messaging_oauth(
  i_application TEXT,
  i_account TEXT,
  i_user TEXT,
  i_state TEXT,
  i_nonce TEXT,
  i_flow TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_user JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    WITH j_ret AS (  
      SELECT "id" FROM "finfolk"."User"
      WHERE "id" = i_user AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    IF o_user IS NULL OR ((o_account ->> 'provider') = 'app') OR i_state IS NULL OR i_nonce IS NULL OR i_flow IS NULL OR NOT "regexp_like"(i_state,'^[a-f0-9]{64}$') OR NOT "regexp_like"(i_nonce,'^[a-f0-9]{64}$') OR NOT "regexp_like"(i_flow,'^[a-f0-9]{64}$') THEN
      RAISE EXCEPTION 'Invalid messaging authorization intent';
    END IF;
    DECLARE
      o_intent JSONB;
    BEGIN
      WITH j_ret AS (  
        INSERT INTO "finfolk"."MessagingOauthState" (
          "application_id",
          "account_id",
          "state_hash",
          "nonce_hash",
          "generation",
          "user_id",
          "expires_at",
          "flow_key"
        ) VALUES (
          (i_application)::TEXT,
          (i_account)::TEXT,
          (i_state)::TEXT,
          (i_nonce)::TEXT,
          (o_account ->> 'generation')::INTEGER,
          (i_user)::TEXT,
          (now() + ('10 minutes')::INTERVAL)::TIMESTAMPTZ,
          (i_flow)::TEXT
        ) RETURNING
          "application_id",
          "account_id",
          "state_hash",
          "nonce_hash",
          "generation",
          "user_id",
          "expires_at",
          "consumed_at",
          "created_at",
          "flow_key")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_intent;
      RETURN jsonb_build_object(
        'generation',
        (o_intent ->> 'generation')::INTEGER,
        'expiresAt',
        o_intent ->> 'expires_at'
      );
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-oauth/ret-messaging-oauth-intent 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_messaging_oauth_intent(
  i_application TEXT,
  i_account TEXT,
  i_state TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_intent JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    WITH j_ret AS (  
      SELECT "generation","user_id","expires_at" FROM "finfolk"."MessagingOauthState"
      WHERE "application_id" = i_application
      AND "account_id" = i_account
      AND "state_hash" = i_state
      AND "consumed_at" IS NULL
      AND "expires_at" > now()
      AND "generation" = (o_account ->> 'generation')::INTEGER
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_intent;
    RETURN o_intent;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-oauth/consume-messaging-oauth 
CREATE OR REPLACE FUNCTION "finfolk_rpc".consume_messaging_oauth(
  i_application TEXT,
  i_account TEXT,
  i_user TEXT,
  i_state TEXT,
  i_nonce TEXT,
  i_flow TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_intent JSONB;
    o_user JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    WITH j_ret AS (  
      SELECT "id" FROM "finfolk"."User"
      WHERE "id" = i_user AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    WITH j_ret AS (  
      SELECT
        "application_id",
        "account_id",
        "state_hash",
        "nonce_hash",
        "generation",
        "user_id",
        "expires_at",
        "consumed_at",
        "created_at",
        "flow_key"
      FROM "finfolk"."MessagingOauthState"
      WHERE "user_id" = i_user
      AND "flow_key" = i_flow
      AND "application_id" = i_application
      AND "nonce_hash" = i_nonce
      AND "expires_at" > now()
      AND "generation" = (o_account ->> 'generation')::INTEGER
      AND "consumed_at" IS NULL
      AND "state_hash" = i_state
      AND "account_id" = i_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_intent;
    IF o_user IS NULL OR o_intent IS NULL THEN
      RETURN null;
    END IF;
    DECLARE
      o_consumed JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingOauthState" SET "consumed_at" = (now())::TIMESTAMPTZ WHERE "application_id" = i_application AND "state_hash" = i_state
        RETURNING
          "application_id",
          "account_id",
          "state_hash",
          "nonce_hash",
          "generation",
          "user_id",
          "expires_at",
          "consumed_at",
          "created_at",
          "flow_key")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_consumed;
      RETURN jsonb_build_object(
        'userId',
        i_user,
        'generation',
        (o_consumed ->> 'generation')::INTEGER
      );
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-logbook-base/DiveSession 
CREATE TABLE IF NOT EXISTS "finfolk"."DiveSession" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('DiveSession')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "beach_id" TEXT REFERENCES "finfolk"."Beach"("id"),
  "detail" JSONB NOT NULL DEFAULT '{}',
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("id","owner_id"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT fk_dive_session_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_dive_session_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."DiveSession" ("owner_id");
CREATE INDEX ON "finfolk"."DiveSession" ("beach_id");

-- finfolkdb.common.type-social-instagram/InstagramSource 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramSource" (
  "key" TEXT PRIMARY KEY NOT NULL,
  "kind" "finfolk"."EnumInstagramSourceType" NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "checkpoint" TEXT,
  "last_success" TIMESTAMPTZ,
  "next_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lease_until" TIMESTAMPTZ,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ready'
);

-- finfolkdb.common.type-social-instagram/InstagramSuppressedSource 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramSuppressedSource" (
  "author_id" TEXT PRIMARY KEY NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-social-instagram/InstagramAction 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramAction" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "source_id" TEXT NOT NULL,
  "owner_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "sender_id" TEXT,
  "kind" "finfolk"."EnumInstagramActionType" NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'review',
  "data" JSONB NOT NULL DEFAULT '{}',
  "member_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "session_id" UUID REFERENCES "finfolk"."DiveSession"("id"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("source_id","kind")
);

-- finfolkdb.common.type-social-instagram/InstagramAudit 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramAudit" (
  "id" BIGINT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  "action_id" UUID REFERENCES "finfolk"."InstagramAction"("id") ON DELETE CASCADE,
  "actor" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-social-instagram/InstagramConnection 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramConnection" (
  "user_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "handle" TEXT NOT NULL,
  "sender_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "challenge_hash" TEXT,
  "expires_at" TIMESTAMPTZ,
  "public_points" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "share_posts" BOOLEAN NOT NULL DEFAULT false,
  "media_owner_id" TEXT,
  "provider_scope" TEXT NOT NULL DEFAULT 'facebook-login:legacy',
  "identity_version" UUID NOT NULL DEFAULT gen_random_uuid()
);

-- finfolkdb.common.type-social-instagram/InstagramClaim 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramClaim" (
  "user_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "code_hash" TEXT,
  "state" "finfolk"."EnumInstagramClaimStatus" NOT NULL DEFAULT 'waiting',
  "sender_id" TEXT,
  "handle" TEXT,
  "error" TEXT NOT NULL DEFAULT '',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "follow_checked_at" TIMESTAMPTZ,
  "review_requested_at" TIMESTAMPTZ,
  "verified_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "claim_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_scope" TEXT NOT NULL DEFAULT 'facebook-login:legacy',
  UNIQUE ("code_hash"),
  UNIQUE ("claim_id")
);

-- finfolkdb.common.type-social-instagram/InstagramCommentIdentity 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramCommentIdentity" (
  "user_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "namespace" TEXT NOT NULL,
  "actor_id" TEXT,
  "sender_id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "challenge_hash" TEXT,
  "expires_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "connection_scope" TEXT NOT NULL DEFAULT 'facebook-login:legacy',
  "connection_version" UUID,
  UNIQUE ("namespace","actor_id"),
  UNIQUE ("challenge_hash")
);

-- finfolkdb.common.type-social-instagram/InstagramDiscovery 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramDiscovery" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "media_id" TEXT,
  "url" TEXT NOT NULL,
  "owner_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "author_id" TEXT,
  "author" TEXT,
  "beach_id" TEXT REFERENCES "finfolk"."Beach"("id"),
  "candidates" JSONB NOT NULL DEFAULT '[]',
  "caption" TEXT NOT NULL DEFAULT '',
  "posted_at" TIMESTAMPTZ,
  "state" "finfolk"."EnumInstagramDiscoveryStatus" NOT NULL DEFAULT 'pending',
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "checked_at" TIMESTAMPTZ,
  UNIQUE ("media_id"),
  UNIQUE ("url"),
  CONSTRAINT check_0 CHECK ("media_id" IS NULL OR "regexp_like"("media_id",'^[0-9]{1,40}$'))
);

-- finfolkdb.common.type-social-instagram/InstagramDiscoveryAudit 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramDiscoveryAudit" (
  "id" BIGINT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  "discovery_id" UUID REFERENCES "finfolk"."InstagramDiscovery"("id") ON DELETE CASCADE,
  "actor" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-social-instagram/InstagramPostReport 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramPostReport" (
  "id" BIGINT PRIMARY KEY NOT NULL GENERATED ALWAYS AS IDENTITY,
  "discovery_id" UUID NOT NULL REFERENCES "finfolk"."InstagramDiscovery"("id") ON DELETE CASCADE,
  "reason" "finfolk"."EnumInstagramPostReportReason" NOT NULL,
  "day" DATE NOT NULL DEFAULT (now())::DATE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("discovery_id","reason","day")
);

-- finfolkdb.common.type-social-instagram/InstagramCommand 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramCommand" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "context" "finfolk"."EnumInstagramCommandContext" NOT NULL,
  "actor_id" TEXT NOT NULL,
  "namespace" TEXT NOT NULL,
  "media_id" TEXT,
  "owner_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "command" TEXT NOT NULL,
  "args" JSONB NOT NULL DEFAULT '{}',
  "source_url" TEXT,
  "comment_at" TIMESTAMPTZ,
  "received_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "state" "finfolk"."EnumInstagramCommandStatus" NOT NULL DEFAULT 'new',
  "result" TEXT,
  "beach_id" TEXT REFERENCES "finfolk"."Beach"("id"),
  "visit_day" DATE,
  "reply" TEXT,
  "send_state" "finfolk"."EnumInstagramCommandSendState" NOT NULL DEFAULT 'pending',
  "reply_id" TEXT,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "send_started_at" TIMESTAMPTZ
);

-- finfolkdb.common.type-social-instagram/InstagramEvent 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramEvent" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-social-instagram/InstagramDmLimit 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramDmLimit" (
  "sender_id" TEXT PRIMARY KEY NOT NULL,
  "minute" TIMESTAMPTZ NOT NULL DEFAULT "date_trunc"('minute',now()),
  "count" INTEGER NOT NULL DEFAULT 0,
  "prompted_at" TIMESTAMPTZ
);

-- finfolkdb.common.type-social-instagram/InstagramConnectCode 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramConnectCode" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "code_hash" TEXT NOT NULL,
  "sender_id" TEXT NOT NULL,
  "handle" TEXT NOT NULL,
  "provider_scope" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "event_id" UUID NOT NULL REFERENCES "finfolk"."MessagingReceipt"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMPTZ NOT NULL DEFAULT now() + ('10 minutes')::INTERVAL,
  "invalidated" BOOLEAN NOT NULL DEFAULT false,
  "consumed_by_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "consumed_version" UUID,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("code_hash"),
  UNIQUE ("event_id")
);

-- finfolkdb.common.type-social-instagram/InstagramConnectLimit 
CREATE TABLE IF NOT EXISTS "finfolk"."InstagramConnectLimit" (
  "bucket" TEXT PRIMARY KEY NOT NULL,
  "count" INTEGER NOT NULL,
  "resets_at" TIMESTAMPTZ NOT NULL
);

-- finfolkdb.common.type-user-access/EnumAccessSetting 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumAccessSetting" AS ENUM ('public','open','closed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-access/Access 
CREATE TABLE IF NOT EXISTS "finfolk"."Access" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "class_ref" TEXT NOT NULL,
  "setting" "finfolk"."EnumAccessSetting" NOT NULL DEFAULT 'closed',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context),
  UNIQUE ("class_table","class_context","class_ref")
);

-- finfolkdb.common.type-user-access/EnumAccessRoleLevel 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumAccessRoleLevel" AS ENUM ('owner','admin','deleted','member');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-access/AccessRole 
CREATE TABLE IF NOT EXISTS "finfolk"."AccessRole" (
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "access_id" UUID NOT NULL,
  "member_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "from_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "level" "finfolk"."EnumAccessRoleLevel" NOT NULL DEFAULT 'member',
  "scope" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (class_table,class_context,access_id,member_id),
  CONSTRAINT fk_access_role_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id) ON DELETE CASCADE
);
CREATE INDEX ON "finfolk"."AccessRole" ("member_id");

-- finfolkdb.common.type-user-access/EnumAccessRequestStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumAccessRequestStatus" AS ENUM ('pending','cancelled','rejected','accepted');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-access/AccessRequest 
CREATE TABLE IF NOT EXISTS "finfolk"."AccessRequest" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "access_id" UUID NOT NULL,
  "from_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reply_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "status" "finfolk"."EnumAccessRequestStatus" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMPTZ NOT NULL DEFAULT now() + ('7 days')::INTERVAL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "log" JSONB NOT NULL DEFAULT '[]',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (id,class_table,class_context,access_id),
  CONSTRAINT fk_access_request_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id) ON DELETE CASCADE
);
CREATE INDEX ON "finfolk"."AccessRequest" ("from_id");

-- finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumAccessInviteExternalStatus" AS ENUM ('pending','expired','rejected','accepted');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-access/AccessInviteExternal 
CREATE TABLE IF NOT EXISTS "finfolk"."AccessInviteExternal" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "access_id" UUID NOT NULL,
  "secret" TEXT NOT NULL UNIQUE,
  "from_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reply_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "status" "finfolk"."EnumAccessInviteExternalStatus" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMPTZ NOT NULL DEFAULT now() + ('7 days')::INTERVAL,
  "accepted_at" TIMESTAMPTZ,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "log" JSONB NOT NULL DEFAULT '[]',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (id,class_table,class_context,access_id),
  CONSTRAINT fk_access_invite_external_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumAccessInviteEmailStatus" AS ENUM ('pending','expired','rejected','accepted');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-access/AccessInviteEmail 
CREATE TABLE IF NOT EXISTS "finfolk"."AccessInviteEmail" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "access_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "secret" TEXT NOT NULL UNIQUE,
  "from_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "reply_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumAccessInviteEmailStatus" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "accepted_at" TIMESTAMPTZ,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "log" JSONB NOT NULL DEFAULT '[]',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (id,class_table,class_context,access_id),
  CONSTRAINT fk_access_invite_email_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-user-access/__access_indexes__ 
CREATE UNIQUE INDEX IF NOT EXISTS "AccessRoleOwner" ON "finfolk"."AccessRole" ("class_table","class_context","access_id") WHERE ("level" = 'owner') AND ("is_active" = true);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessRequestPending" ON "finfolk"."AccessRequest" ("class_table","class_context","access_id","from_id") WHERE "status" = 'pending';

-- finfolkdb.common.type-social-base/Social 
CREATE TABLE IF NOT EXISTS "finfolk"."Social" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_ref" TEXT NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  UNIQUE ("class_table","class_ref")
);

-- finfolkdb.common.type-social-base/EnumSocialHandleType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialHandleType" AS ENUM ('instagram','tiktok');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-social-base/SocialHandle 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialHandle" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "social_id" UUID NOT NULL,
  "type" "finfolk"."EnumSocialHandleType" NOT NULL,
  "handle" TEXT NOT NULL,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" TIMESTAMPTZ,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (id,class_table),
  UNIQUE ("class_table","type","handle"),
  CONSTRAINT fk_social_handle_social FOREIGN KEY (class_table,social_id) REFERENCES "finfolk"."Social"(class_table,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-social-base/ret-social-url 
CREATE OR REPLACE FUNCTION "finfolk".ret_social_url(
  i_identity TEXT
) RETURNS TEXT AS $$

  SELECT CASE split_part(i_identity,':',1)
    WHEN 'instagram' THEN 'https://www.instagram.com/' || split_part(i_identity,':',2) || '/'
    WHEN 'tiktok' THEN 'https://www.tiktok.com/@' || split_part(i_identity,':',2)
    END;

$$ LANGUAGE 'sql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-social-base/ret-social-urls 
CREATE OR REPLACE FUNCTION "finfolk".ret_social_urls(
  i_identities JSONB
) RETURNS JSONB AS $$

  SELECT coalesce(jsonb_agg("finfolk".ret_social_url("value")),('[]')::JSONB) FROM jsonb_array_elements_text(coalesce(i_identities,('[]')::JSONB)) WHERE "finfolk".ret_social_url("value") IS NOT NULL;

$$ LANGUAGE 'sql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-directory-base/DirectoryListing 
CREATE TABLE IF NOT EXISTS "finfolk"."DirectoryListing" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('DirectoryListing')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "status" "finfolk"."EnumDirectoryListingStatus" NOT NULL DEFAULT 'candidate',
  "reviewed_at" TIMESTAMPTZ,
  "outreach" TEXT NOT NULL DEFAULT 'Not contacted',
  "notes" TEXT NOT NULL DEFAULT '',
  "detail" JSONB NOT NULL DEFAULT '{}',
  "social_id" UUID NOT NULL,
  "access_id" UUID NOT NULL,
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("social_id"),
  UNIQUE ("access_id"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT fk_directory_listing_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_directory_listing_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id),
  CONSTRAINT fk_directory_listing_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id),
  CONSTRAINT fk_directory_listing_social FOREIGN KEY (class_table,social_id) REFERENCES "finfolk"."Social"(class_table,id)
);
CREATE INDEX ON "finfolk"."DirectoryListing" ("status");

-- finfolkdb.common.type-directory-base/DirectoryReport 
CREATE TABLE IF NOT EXISTS "finfolk"."DirectoryReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "listing_id" UUID NOT NULL REFERENCES "finfolk"."DirectoryListing"("id"),
  "author_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "message" TEXT NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT
);
CREATE INDEX ON "finfolk"."DirectoryReport" ("listing_id");

-- finfolkdb.common.type-directory-base/DirectoryRun 
CREATE TABLE IF NOT EXISTS "finfolk"."DirectoryRun" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "query" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "error" TEXT NOT NULL DEFAULT '',
  "log" JSONB NOT NULL DEFAULT '[]',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT
);

-- finfolkdb.fn.helper.helper-entity/insert-base-addons 
CREATE OR REPLACE FUNCTION "finfolk".insert_base_addons(
  i_class_table TEXT,
  i_class_ref TEXT,
  i_current JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_audit JSONB;
    o_current JSONB;
    o_log JSONB;
    o_rev JSONB;
    o_revision JSONB;
  BEGIN
    o_current := "finfolk".as_jsonb(i_current);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Rev" (
        "class_table",
        "class_context",
        "class_ref",
        "index",
        "current",
        "op_created",
        "time_created"
      ) VALUES (
        (i_class_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_class_ref)::TEXT,
        (1)::INTEGER,
        (o_current)::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","index","current","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Audit" (
        "class_table",
        "class_context",
        "class_ref",
        "op_created",
        "time_created"
      ) VALUES (
        (i_class_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_class_ref)::TEXT,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."RevLog" (
        "class_table",
        "class_context",
        "rev_id",
        "version",
        "deltas",
        "op_created",
        "time_created"
      ) VALUES (
        (i_class_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        ((o_rev ->> 'id')::UUID)::UUID,
        (1)::INTEGER,
        (o_current)::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "rev_id","version","deltas","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_revision;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."AuditLog" (
        "class_table",
        "class_context",
        "audit_id",
        "entry",
        "op_created",
        "time_created"
      ) VALUES (
        (i_class_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        ((o_audit ->> 'id')::UUID)::UUID,
        "finfolk".as_jsonb((jsonb_build_object('event','create'))::JSONB),
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "audit_id","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
    RETURN jsonb_build_object('rev',(o_rev ->> 'id')::UUID,'audit',(o_audit ->> 'id')::UUID);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-manage/insert-directory-listing 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_directory_listing(
  i_document JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_access JSONB;
    o_base JSONB;
    o_document JSONB;
    o_listing JSONB;
    o_social JSONB;
    v_id UUID;
  BEGIN
    v_id := uuid_generate_v4();
    o_document := "finfolk".as_jsonb(i_document);
    o_base := "finfolk".insert_base_addons('DirectoryListing',(v_id)::TEXT,o_document,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Access" (
        "class_table",
        "class_context",
        "class_ref",
        "setting",
        "op_created",
        "time_created"
      ) VALUES (
        ('DirectoryListing')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (v_id)::TEXT,
        ('closed')::"finfolk"."EnumAccessSetting",
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","setting","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_access;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Social" ("class_table","class_ref","op_created","time_created") VALUES (
        ('DirectoryListing')::"finfolk"."EnumClassType",
        (v_id)::TEXT,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_social;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."DirectoryListing" (
        "id",
        "detail",
        "social_id",
        "access_id",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        "finfolk".as_jsonb((o_document)::JSONB),
        ((o_social ->> 'id')::UUID)::UUID,
        ((o_access ->> 'id')::UUID)::UUID,
        (o_base ->> 'audit')::UUID,
        (o_base ->> 'rev')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "status",
        "reviewed_at",
        "outreach",
        "notes",
        "detail",
        "social_id",
        "access_id",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_listing;
    RETURN o_listing;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-manage/ret-directory-public 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_directory_public(
  i_listing_id UUID
) RETURNS JSONB AS $$

  DECLARE
    o_document JSONB;
    o_listing JSONB;
    v_managed BOOLEAN;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","reviewed_at","detail","access_id" FROM "finfolk"."DirectoryListing"
      WHERE "id" = i_listing_id
      AND "status" = ('published')::"finfolk"."EnumDirectoryListingStatus"
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_listing;
    o_document := (o_listing -> 'detail');
    SELECT exists(SELECT 1 FROM "finfolk"."AccessRole"
    WHERE "class_table" = ('DirectoryListing')::"finfolk"."EnumClassType"
    AND "class_context" = ('Global')::"finfolk"."EnumClassType"
    AND "access_id" = (o_listing ->> 'access_id')::UUID
    AND "level" = ('owner')::"finfolk"."EnumAccessRoleLevel"
    AND "is_active" = true) INTO v_managed;
    IF o_listing is null  THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'id',
      o_listing ->> 'id',
      'name',
      o_document ->> 'name',
      'category',
      o_document ->> 'category',
      'state',
      o_document ->> 'state',
      'country',
      coalesce(o_document ->> 'country','Australia'),
      'locality',
      o_document ->> 'locality',
      'description',
      o_document ->> 'description',
      'website',
      o_document ->> 'website',
      'image',
      coalesce(o_document ->> 'image',''),
      'sources',
      o_document -> 'sources',
      'socials',
      "finfolk".ret_social_urls(o_document -> 'socials'),
      'managed',
      v_managed,
      'reviewedAt',
      o_listing -> 'reviewed_at'
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.helper.helper-access/is-user-blocked 
CREATE OR REPLACE FUNCTION "finfolk".is_user_blocked(
  i_viewer TEXT,
  i_owner TEXT
) RETURNS BOOLEAN AS $$

  DECLARE
    v_forward BOOLEAN;
    v_reverse BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserBlock"
    WHERE "owner_id" = i_viewer AND "target_id" = i_owner) INTO v_forward;
    SELECT exists(SELECT 1 FROM "finfolk"."UserBlock"
    WHERE "owner_id" = i_owner AND "target_id" = i_viewer) INTO v_reverse;
    RETURN v_forward OR v_reverse;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.helper.helper-access/is-user-active 
CREATE OR REPLACE FUNCTION "finfolk".is_user_active(
  i_user TEXT
) RETURNS BOOLEAN AS $$

  DECLARE
    v_active BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."User"
    WHERE "id" = i_user AND "deleted" = false) INTO v_active;
    RETURN v_active;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-trip-base/Trip 
CREATE TABLE IF NOT EXISTS "finfolk"."Trip" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Trip')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "beach_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT ordered_dates CHECK (("end_date" >= "start_date") AND (("end_date" - "start_date") <= 365)),
  CONSTRAINT fk_trip_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_trip_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."Trip" ("owner_id");
CREATE INDEX ON "finfolk"."Trip" ("beach_id");

-- finfolkdb.common.type-trip-base/TripImport 
CREATE TABLE IF NOT EXISTS "finfolk"."TripImport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "trip_id" UUID NOT NULL REFERENCES "finfolk"."Trip"("id") ON DELETE CASCADE,
  "expected_rows" INTEGER NOT NULL,
  "status" "finfolk"."EnumTripImportStatus" NOT NULL DEFAULT 'uploading',
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "fingerprint" TEXT,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  CONSTRAINT bounded_import CHECK (("expected_rows" >= 1) AND ("expected_rows" <= 10000)),
  CONSTRAINT active_complete CHECK (NOT "is_active" OR ("status" = 'complete'))
);
CREATE INDEX ON "finfolk"."TripImport" ("trip_id");

-- finfolkdb.common.type-trip-base/TripDive 
CREATE TABLE IF NOT EXISTS "finfolk"."TripDive" (
  "import_id" UUID NOT NULL REFERENCES "finfolk"."TripImport"("id") ON DELETE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "day" DATE NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (import_id,ordinal),
  CONSTRAINT positive_ordinal CHECK ("ordinal" > 0)
);

-- finfolkdb.common.type-trip-base/TripImportBatch 
CREATE TABLE IF NOT EXISTS "finfolk"."TripImportBatch" (
  "import_id" UUID NOT NULL REFERENCES "finfolk"."TripImport"("id") ON DELETE CASCADE,
  "index" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (import_id,index),
  CONSTRAINT bounded_batch CHECK (("index" >= 0) AND ("index" <= 9999)),
  CONSTRAINT array_rows CHECK (jsonb_typeof("rows") = 'array')
);

-- finfolkdb.common.type-trip-base/EnumTripReviewDecision 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumTripReviewDecision" AS ENUM ('approve','reject','remove');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-trip-base/EnumTripPublicationStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumTripPublicationStatus" AS ENUM ('pending','published');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-trip-base/TripPublication 
CREATE TABLE IF NOT EXISTS "finfolk"."TripPublication" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "trip_id" UUID NOT NULL REFERENCES "finfolk"."Trip"("id") ON DELETE CASCADE,
  "beach_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "status" "finfolk"."EnumTripPublicationStatus" NOT NULL DEFAULT 'pending',
  "public_consent" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("trip_id","status"),
  CONSTRAINT consented_publication CHECK (("status" != 'published') OR ("public_consent" AND "published_at" IS NOT NULL))
);

-- finfolkdb.common.type-trip-base/__trip_import_indexes__ 
CREATE UNIQUE INDEX IF NOT EXISTS "TripImportActive" ON "finfolk"."TripImport" ("trip_id") WHERE "is_active";

-- finfolkdb.common.fn-system-util/auth-uid 
CREATE OR REPLACE FUNCTION "finfolk".auth_uid() RETURNS TEXT AS $$

  SELECT coalesce(current_setting('finfolk.actor_id',true),'');

$$ LANGUAGE 'sql';

-- finfolkdb.common.fn-system-util/as-iso-time 
CREATE OR REPLACE FUNCTION "finfolk".as_iso_time(
  i_time TIMESTAMPTZ
) RETURNS TEXT AS $$

  SELECT to_char("timezone"('UTC',i_time),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

$$ LANGUAGE 'sql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.fn.user.user-manage-trips/insert-trip 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_trip(
  i_owner TEXT,
  i_draft JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_base JSONB;
    o_draft JSONB;
    o_trip JSONB;
    v_id UUID;
  BEGIN
    v_id := uuid_generate_v4();
    o_draft := "finfolk".as_jsonb(i_draft);
    o_base := "finfolk".insert_base_addons('Trip',(v_id)::TEXT,o_draft,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Trip" (
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "detail",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        (i_owner)::TEXT,
        (o_draft ->> 'beachId')::TEXT,
        (o_draft ->> 'start')::DATE,
        (o_draft ->> 'end')::DATE,
        "finfolk".as_jsonb((((o_draft - 'beachId') - 'start') - 'end')::JSONB),
        (o_base ->> 'audit')::UUID,
        (o_base ->> 'rev')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "detail",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    RETURN jsonb_build_object('id',(o_trip ->> 'id')::UUID,'revision',1);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/ret-trip-owned 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_trip_owned(
  i_trip_id UUID,
  i_owner TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_active JSONB;
    o_rev JSONB;
    o_trip JSONB;
    v_pending BOOLEAN;
    v_published BOOLEAN;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "detail",
        "rev_id"
      FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    WITH j_ret AS (  
      SELECT
        "id",
        "trip_id",
        "expected_rows",
        "status",
        "is_active",
        "fingerprint",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."TripImport"
      WHERE "trip_id" = i_trip_id AND "is_active" = true
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
    WITH j_ret AS (  
      SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
      WHERE "class_table" = ('Trip')::"finfolk"."EnumClassType"
      AND "class_context" = ('Global')::"finfolk"."EnumClassType"
      AND "id" = (o_trip ->> 'rev_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
    SELECT exists(SELECT 1 FROM "finfolk"."TripPublication"
    WHERE "trip_id" = i_trip_id
    AND "status" = ('published')::"finfolk"."EnumTripPublicationStatus") INTO v_published;
    SELECT exists(SELECT 1 FROM "finfolk"."TripPublication"
    WHERE "trip_id" = i_trip_id
    AND "status" = ('pending')::"finfolk"."EnumTripPublicationStatus") INTO v_pending;
    IF o_trip IS NULL OR NOT "finfolk".is_user_active(i_owner) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object('id',o_trip ->> 'id','draft',(o_trip -> 'detail') || jsonb_build_object(
      'beachId',
      o_trip ->> 'beach_id',
      'start',
      o_trip ->> 'start_date',
      'end',
      o_trip ->> 'end_date'
    ),'revision',(o_rev ->> 'index')::INTEGER,'activeImport',o_active -> 'id','published',v_published,'pending',v_pending);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/insert-trip-import 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_trip_import(
  i_trip_id UUID,
  i_owner TEXT,
  i_expected_rows INTEGER,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    IF o_trip is null  THEN
      RETURN null;
    END IF;
    DECLARE
      o_expired JSONB;
      o_import JSONB;
    BEGIN
      WITH j_ret AS (  
        DELETE FROM "finfolk"."TripImport" WHERE "trip_id" = i_trip_id
        AND "status" = ('uploading')::"finfolk"."EnumTripImportStatus"
        AND "time_created" < (1000000 * extract(epoch FROM now()))::BIGINT - 86400000000
        RETURNING
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
      WITH j_ret AS (  
        INSERT INTO "finfolk"."TripImport" (
          "trip_id",
          "expected_rows",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        ) VALUES (
          (i_trip_id)::UUID,
          (i_expected_rows)::INTEGER,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT,
          (o_op ->> 'time')::BIGINT
        ) RETURNING
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_import;
      RETURN o_import;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/save-trip-import-batch 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_trip_import_batch(
  i_trip_id UUID,
  i_owner TEXT,
  i_import_id UUID,
  i_index INTEGER,
  i_rows JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_import JSONB;
    o_rows JSONB;
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    WITH j_ret AS (  
      SELECT
        "id",
        "trip_id",
        "expected_rows",
        "status",
        "is_active",
        "fingerprint",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."TripImport"
      WHERE "id" = i_import_id
      AND "trip_id" = i_trip_id
      AND "status" = ('uploading')::"finfolk"."EnumTripImportStatus"
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_import;
    o_rows := "finfolk".as_jsonb_array(i_rows);
    IF o_trip IS NULL OR o_import IS NULL THEN
      RETURN null;
    END IF;
    IF (jsonb_array_length(o_rows) < 1) OR (jsonb_array_length(o_rows) > 200) THEN
      RAISE EXCEPTION 'Import a batch of 1 to 200 rows';
    END IF;
    DECLARE
      o_existing JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "import_id",
          "index",
          "rows",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."TripImportBatch"
        WHERE "import_id" = i_import_id AND "index" = i_index
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF o_existing is not null  THEN
        IF (o_existing -> 'rows') != o_rows THEN
          RETURN null;
        END IF;
        RETURN jsonb_build_object('ok',true);
      END IF;
      DECLARE
        o_batch JSONB;
      BEGIN
        WITH j_ret AS (  
          INSERT INTO "finfolk"."TripImportBatch" (
            "import_id",
            "index",
            "rows",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          ) VALUES (
            (i_import_id)::UUID,
            (i_index)::INTEGER,
            (o_rows)::JSONB,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT,
            (o_op ->> 'time')::BIGINT
          ) RETURNING
            "import_id",
            "index",
            "rows",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_batch;
        RETURN jsonb_build_object('ok',true);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/complete-trip-import 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_trip_import(
  i_trip_id UUID,
  i_owner TEXT,
  i_import_id UUID,
  i_revision INTEGER,
  i_fingerprint TEXT,
  i_replace BOOLEAN,
  i_duplicates_confirmed BOOLEAN,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","start_date","end_date","audit_id","rev_id" FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    IF o_trip is null  THEN
      RETURN null;
    END IF;
    DECLARE
      o_active JSONB;
      o_import JSONB;
      o_rev JSONB;
      v_revision INTEGER;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."TripImport"
        WHERE "id" = i_import_id AND "trip_id" = i_trip_id
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_import;
      WITH j_ret AS (  
        SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
        WHERE "class_table" = ('Trip')::"finfolk"."EnumClassType"
        AND "class_context" = ('Global')::"finfolk"."EnumClassType"
        AND "id" = (o_trip ->> 'rev_id')::UUID
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
      v_revision := (o_rev ->> 'index')::INTEGER;
      WITH j_ret AS (  
        SELECT
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."TripImport"
        WHERE "trip_id" = i_trip_id AND "is_active" = true
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
      IF o_import is null  THEN
        RETURN null;
      END IF;
      IF (o_import ->> 'status') = 'complete' THEN
        IF (o_import ->> 'is_active')::BOOLEAN = true THEN
          RETURN jsonb_build_object('unchanged',true,'revision',v_revision);
        END IF;
        RETURN null;
      END IF;
      IF i_fingerprint IS NULL OR (length(i_fingerprint) != 64) THEN
        RAISE EXCEPTION 'Choose a valid import fingerprint';
      END IF;
      DECLARE
        o_batches JSONB;
        o_rows JSONB;
        v_batch JSONB;
        v_index INTEGER;
      BEGIN
        WITH j_ret AS (  
          SELECT "index","rows" FROM "finfolk"."TripImportBatch"
          WHERE "import_id" = i_import_id
          ORDER BY "index" ASC)
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_batches;
        o_rows := ('[]')::JSONB;
        v_batch := null;
        v_index := 0;
        FOR v_batch IN SELECT jsonb_array_elements(coalesce(o_batches,('[]')::JSONB)) LOOP
          IF (v_batch ->> 'index')::INTEGER != v_index THEN
            RAISE EXCEPTION 'Some import batches are missing';
          END IF;
          o_rows := (o_rows || (v_batch -> 'rows'));
          v_index := (v_index + 1);
        END LOOP;
        IF jsonb_array_length(o_rows) != (o_import ->> 'expected_rows')::INTEGER THEN
          RAISE EXCEPTION 'Import row count does not match';
        END IF;
        IF o_active IS NOT NULL AND ((o_active ->> 'fingerprint') = i_fingerprint) THEN
          DECLARE
          o_discarded JSONB;
        BEGIN
          WITH j_ret AS (  
              DELETE FROM "finfolk"."TripImport" WHERE "id" = i_import_id
              RETURNING
                "id",
                "trip_id",
                "expected_rows",
                "status",
                "is_active",
                "fingerprint",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_discarded;
            RETURN jsonb_build_object('unchanged',true,'revision',v_revision);
        END;
        END IF;
        IF (i_revision != v_revision) OR (o_active IS NOT NULL AND NOT coalesce(i_replace,false)) THEN
          RETURN null;
        END IF;
        DECLARE
          o_deactivated JSONB;
          o_seen JSONB;
          v_identity TEXT;
          v_ordinal INTEGER;
          v_row JSONB;
        BEGIN
          WITH j_ret AS (  
            UPDATE "finfolk"."TripImport" SET
              "is_active" = (false)::BOOLEAN,
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "trip_id" = i_trip_id AND "is_active" = true
            RETURNING
              "id",
              "trip_id",
              "expected_rows",
              "status",
              "is_active",
              "fingerprint",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_deactivated;
          v_row := null;
          o_seen := ('{}')::JSONB;
          v_ordinal := 0;
          v_identity := null;
          FOR v_row IN SELECT jsonb_array_elements(o_rows) LOOP
            DECLARE
              v_day DATE;
            BEGIN
              v_day := (v_row ->> 'day')::DATE;
              IF v_day IS NULL OR (v_day < (o_trip ->> 'start_date')::DATE) OR (v_day > (o_trip ->> 'end_date')::DATE) THEN
                RAISE EXCEPTION 'Imported rows fall outside the trip';
              END IF;
              IF nullif(v_row ->> 'sourceId','') is not null  THEN
                v_identity := ((v_day)::TEXT || '|' || (v_row ->> 'sourceId'));
              ELSE
                v_identity := nullif(v_row ->> 'timestamp','');
              END IF;
              IF v_identity is not null  THEN
                IF jsonb_exists(o_seen,v_identity) AND NOT coalesce(i_duplicates_confirmed,false) THEN
                  RAISE EXCEPTION 'Review repeated dive identifiers before confirming';
                END IF;
                o_seen := (o_seen || jsonb_build_object(v_identity,true));
              END IF;
              DECLARE
                o_dive JSONB;
              BEGIN
                WITH j_ret AS (  
                  INSERT INTO "finfolk"."TripDive" (
                    "import_id",
                    "ordinal",
                    "day",
                    "detail",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated"
                  ) VALUES (
                    (i_import_id)::UUID,
                    (v_ordinal + 1)::INTEGER,
                    (v_day)::DATE,
                    "finfolk".as_jsonb((v_row)::JSONB),
                    (o_op ->> 'id')::UUID,
                    (o_op ->> 'id')::UUID,
                    (o_op ->> 'time')::BIGINT,
                    (o_op ->> 'time')::BIGINT
                  ) RETURNING
                    "import_id",
                    "ordinal",
                    "day",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_dive;
                v_ordinal := (v_ordinal + 1);
              END;
            END;
          END LOOP;
          DECLARE
            o_audit JSONB;
            o_complete JSONB;
            o_superseded JSONB;
            o_updated JSONB;
            o_version JSONB;
          BEGIN
            WITH j_ret AS (  
              UPDATE "finfolk"."TripImport" SET
                "status" = ('complete')::"finfolk"."EnumTripImportStatus",
                "is_active" = (true)::BOOLEAN,
                "fingerprint" = (i_fingerprint)::TEXT,
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "id" = i_import_id AND "trip_id" = i_trip_id
              RETURNING
                "id",
                "trip_id",
                "expected_rows",
                "status",
                "is_active",
                "fingerprint",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_complete;
            WITH j_ret AS (  
              UPDATE "finfolk"."Rev" SET "index" = (v_revision + 1)::INTEGER WHERE "id" = (o_trip ->> 'rev_id')::UUID
              AND "class_table" = ('Trip')::"finfolk"."EnumClassType"
              AND "class_context" = ('Global')::"finfolk"."EnumClassType"
              RETURNING "id","class_ref","index","current","op_created","time_created")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."RevLog" (
                "class_table",
                "class_context",
                "rev_id",
                "version",
                "deltas",
                "op_created",
                "time_created"
              ) VALUES (
                ('Trip')::"finfolk"."EnumClassType",
                ('Global')::"finfolk"."EnumClassType",
                (o_trip ->> 'rev_id')::UUID,
                (v_revision + 1)::INTEGER,
                (jsonb_build_object('importedRows',v_ordinal))::JSONB,
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT
              ) RETURNING "rev_id","version","deltas","op_created","time_created")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_version;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."AuditLog" (
                "class_table",
                "class_context",
                "audit_id",
                "entry",
                "op_created",
                "time_created"
              ) VALUES (
                ('Trip')::"finfolk"."EnumClassType",
                ('Global')::"finfolk"."EnumClassType",
                (o_trip ->> 'audit_id')::UUID,
                "finfolk".as_jsonb(
                (jsonb_build_object('event','import','rows',v_ordinal))::JSONB
              ),
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT
              ) RETURNING "audit_id","op_created","time_created")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
            WITH j_ret AS (  
              DELETE FROM "finfolk"."TripImport" WHERE "trip_id" = i_trip_id
              AND "is_active" = false
              AND "status" = ('complete')::"finfolk"."EnumTripImportStatus"
              RETURNING
                "id",
                "trip_id",
                "expected_rows",
                "status",
                "is_active",
                "fingerprint",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_superseded;
            RETURN jsonb_build_object('revision',v_revision + 1,'rows',v_ordinal);
          END;
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/ret-trip-publication-snapshot 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_trip_publication_snapshot(
  i_trip_id UUID,
  i_status TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_publication JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "beach_id","detail" FROM "finfolk"."TripPublication"
      WHERE "trip_id" = i_trip_id
      AND "status" = (i_status)::"finfolk"."EnumTripPublicationStatus"
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_publication;
    IF o_publication is null  THEN
      RETURN null;
    END IF;
    RETURN (o_publication -> 'detail') || jsonb_build_object('beachId',o_publication ->> 'beach_id');
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/set-trip-publication 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_trip_publication(
  i_trip_id UUID,
  i_owner TEXT,
  i_snapshot JSONB,
  i_revision INTEGER,
  i_consent BOOLEAN,
  i_own_posts BOOLEAN,
  i_approved BOOLEAN,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_snapshot JSONB;
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "beach_id",
        "start_date",
        "end_date",
        "audit_id",
        "rev_id"
      FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    o_snapshot := "finfolk".as_jsonb(i_snapshot);
    IF o_trip IS NULL OR NOT "finfolk".is_user_active(i_owner) THEN
      RETURN null;
    END IF;
    IF NOT coalesce(i_consent,false) OR NOT coalesce(i_own_posts,false) THEN
      RAISE EXCEPTION 'Confirm public consent and ownership of the linked posts';
    END IF;
    DECLARE
      o_active JSONB;
      o_rev JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
        WHERE "class_table" = ('Trip')::"finfolk"."EnumClassType"
        AND "class_context" = ('Global')::"finfolk"."EnumClassType"
        AND "id" = (o_trip ->> 'rev_id')::UUID
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
      WITH j_ret AS (  
        SELECT
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."TripImport"
        WHERE "trip_id" = i_trip_id
        AND "is_active" = true
        AND "status" = ('complete')::"finfolk"."EnumTripImportStatus"
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
      IF (i_revision != (o_rev ->> 'index')::INTEGER) OR o_snapshot ->> 'beachId' IS NULL OR ((o_snapshot ->> 'beachId') != (o_trip ->> 'beach_id')) THEN
        RETURN null;
      END IF;
      IF o_active is null  THEN
        RAISE EXCEPTION 'Import dives before publishing';
      END IF;
      DECLARE
        o_pending JSONB;
      BEGIN
        WITH j_ret AS (  
          DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
          AND "status" = ('pending')::"finfolk"."EnumTripPublicationStatus"
          RETURNING
            "id",
            "trip_id",
            "beach_id",
            "status",
            "public_consent",
            "published_at",
            "detail",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_pending;
        IF coalesce(i_approved,false) THEN
          DECLARE
          o_previous JSONB;
        BEGIN
          WITH j_ret AS (  
              DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
              AND "status" = ('published')::"finfolk"."EnumTripPublicationStatus"
              RETURNING
                "id",
                "trip_id",
                "beach_id",
                "status",
                "public_consent",
                "published_at",
                "detail",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_previous;
            o_previous := null;
        END;
        END IF;
        DECLARE
          v_status TEXT;
          v_time TIMESTAMPTZ;
        BEGIN
          v_status := 'pending';
          v_time := null;
          IF coalesce(i_approved,false) THEN
            v_status := 'published';
            v_time := now();
          END IF;
          DECLARE
            o_log JSONB;
            o_publication JSONB;
          BEGIN
            WITH j_ret AS (  
              INSERT INTO "finfolk"."TripPublication" (
                "trip_id",
                "beach_id",
                "status",
                "public_consent",
                "published_at",
                "detail",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              ) VALUES (
                (i_trip_id)::UUID,
                (o_snapshot ->> 'beachId')::TEXT,
                (v_status)::"finfolk"."EnumTripPublicationStatus",
                (true)::BOOLEAN,
                (v_time)::TIMESTAMPTZ,
                "finfolk".as_jsonb((o_snapshot - 'beachId')::JSONB),
                (o_op ->> 'id')::UUID,
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT,
                (o_op ->> 'time')::BIGINT
              ) RETURNING
                "id",
                "trip_id",
                "beach_id",
                "status",
                "public_consent",
                "published_at",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_publication;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."AuditLog" (
                "class_table",
                "class_context",
                "audit_id",
                "entry",
                "op_created",
                "time_created"
              ) VALUES (
                ('Trip')::"finfolk"."EnumClassType",
                ('Global')::"finfolk"."EnumClassType",
                (o_trip ->> 'audit_id')::UUID,
                "finfolk".as_jsonb(
                (jsonb_build_object('event','publication','status',v_status))::JSONB
              ),
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT
              ) RETURNING "audit_id","op_created","time_created")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
            RETURN jsonb_build_object('id',i_trip_id,'status',v_status);
          END;
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/ret-trip-public 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_trip_public(
  i_trip_id UUID
) RETURNS JSONB AS $$

  DECLARE
    o_data JSONB;
    o_publication JSONB;
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","owner_id" FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    WITH j_ret AS (  
      SELECT "beach_id","published_at","detail" FROM "finfolk"."TripPublication"
      WHERE "trip_id" = i_trip_id
      AND "status" = ('published')::"finfolk"."EnumTripPublicationStatus"
      AND "public_consent" = true
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_publication;
    o_data := (o_publication -> 'detail');
    IF o_trip IS NULL OR o_publication IS NULL OR NOT "finfolk".is_user_active(o_trip ->> 'owner_id') THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'id',
      i_trip_id,
      'title',
      o_data ->> 'title',
      'authorName',
      o_data ->> 'authorName',
      'story',
      o_data ->> 'story',
      'beachId',
      o_publication ->> 'beach_id',
      'beachName',
      o_data ->> 'beachName',
      'timezone',
      o_data ->> 'timezone',
      'start',
      o_data ->> 'start',
      'end',
      o_data ->> 'end',
      'links',
      o_data -> 'links',
      'summary',
      o_data -> 'summary',
      'selfReported',
      true,
      'publishedAt',
      "finfolk".as_iso_time((o_publication ->> 'published_at')::TIMESTAMPTZ)
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/review-trip-publication 
CREATE OR REPLACE FUNCTION "finfolk_rpc".review_trip_publication(
  i_trip_id UUID,
  i_decision TEXT,
  i_review_token TEXT,
  i_ownership_checked BOOLEAN,
  i_beach_checked BOOLEAN,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_pending JSONB;
    o_published JSONB;
    o_trip JSONB;
    v_decision TEXT;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","owner_id","audit_id" FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    v_decision := ((i_decision)::"finfolk"."EnumTripReviewDecision")::TEXT;
    o_pending := "finfolk_rpc".ret_trip_publication_snapshot(i_trip_id,'pending');
    o_published := "finfolk_rpc".ret_trip_publication_snapshot(i_trip_id,'published');
    IF o_trip IS NULL OR i_review_token IS NULL OR v_decision IS NULL OR NOT "finfolk".is_user_active(o_trip ->> 'owner_id') THEN
      RETURN null;
    END IF;
    IF v_decision = 'remove' THEN
      IF (o_pending IS NULL OR (i_review_token != md5((o_pending)::TEXT))) AND (o_published IS NULL OR (i_review_token != md5((o_published)::TEXT))) THEN
        RETURN null;
      END IF;
    ELSE
      IF o_pending IS NULL OR (i_review_token != md5((o_pending)::TEXT)) THEN
        RETURN null;
      END IF;
    END IF;
    IF v_decision = 'approve' THEN
      IF NOT coalesce(i_ownership_checked,false) OR NOT coalesce(i_beach_checked,false) THEN
        RAISE EXCEPTION 'Check ownership and beach location before approving';
      END IF;
      DECLARE
      o_approved JSONB;
        o_old JSONB;
    BEGIN
      WITH j_ret AS (  
          DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
          AND "status" = ('published')::"finfolk"."EnumTripPublicationStatus"
          RETURNING
            "id",
            "trip_id",
            "beach_id",
            "status",
            "public_consent",
            "published_at",
            "detail",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_old;
        WITH j_ret AS (  
          UPDATE "finfolk"."TripPublication" SET
            "status" = ('published')::"finfolk"."EnumTripPublicationStatus",
            "published_at" = (now())::TIMESTAMPTZ,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "trip_id" = i_trip_id
          AND "status" = ('pending')::"finfolk"."EnumTripPublicationStatus"
          AND "public_consent" = true
          RETURNING
            "id",
            "trip_id",
            "beach_id",
            "status",
            "public_consent",
            "published_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_approved;
        IF o_approved is null  THEN
          RAISE EXCEPTION 'The publication no longer has public consent';
        END IF;
    END;
    END IF;
    IF v_decision = 'reject' THEN
      DECLARE
      o_removed JSONB;
    BEGIN
      WITH j_ret AS (  
          DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
          AND "status" = ('pending')::"finfolk"."EnumTripPublicationStatus"
          RETURNING
            "id",
            "trip_id",
            "beach_id",
            "status",
            "public_consent",
            "published_at",
            "detail",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
        o_removed := null;
    END;
    END IF;
    IF v_decision = 'remove' THEN
      DECLARE
      o_removed JSONB;
    BEGIN
      WITH j_ret AS (  
          DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
          RETURNING
            "id",
            "trip_id",
            "beach_id",
            "status",
            "public_consent",
            "published_at",
            "detail",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
        o_removed := null;
    END;
    END IF;
    DECLARE
      o_log JSONB;
    BEGIN
      WITH j_ret AS (  
        INSERT INTO "finfolk"."AuditLog" (
          "class_table",
          "class_context",
          "audit_id",
          "entry",
          "op_created",
          "time_created"
        ) VALUES (
          ('Trip')::"finfolk"."EnumClassType",
          ('Global')::"finfolk"."EnumClassType",
          (o_trip ->> 'audit_id')::UUID,
          "finfolk".as_jsonb(
          (jsonb_build_object('event','review','decision',v_decision))::JSONB
        ),
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT
        ) RETURNING "audit_id","op_created","time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
      RETURN jsonb_build_object('ok',true);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/withdraw-trip-publication 
CREATE OR REPLACE FUNCTION "finfolk_rpc".withdraw_trip_publication(
  i_trip_id UUID,
  i_owner TEXT,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","audit_id" FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    IF o_trip is null  THEN
      RETURN null;
    END IF;
    DECLARE
      o_log JSONB;
      o_publications JSONB;
    BEGIN
      WITH j_ret AS (  
        DELETE FROM "finfolk"."TripPublication" WHERE "trip_id" = i_trip_id
        RETURNING
          "id",
          "trip_id",
          "beach_id",
          "status",
          "public_consent",
          "published_at",
          "detail",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_publications;
      WITH j_ret AS (  
        INSERT INTO "finfolk"."AuditLog" (
          "class_table",
          "class_context",
          "audit_id",
          "entry",
          "op_created",
          "time_created"
        ) VALUES (
          ('Trip')::"finfolk"."EnumClassType",
          ('Global')::"finfolk"."EnumClassType",
          (o_trip ->> 'audit_id')::UUID,
          "finfolk".as_jsonb((jsonb_build_object('event','unpublish'))::JSONB),
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT
        ) RETURNING "audit_id","op_created","time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
      RETURN jsonb_build_object('ok',true);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/update-trip-draft 
CREATE OR REPLACE FUNCTION "finfolk_rpc".update_trip_draft(
  i_trip_id UUID,
  i_owner TEXT,
  i_draft JSONB,
  i_revision INTEGER,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_draft JSONB;
    o_trip JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","audit_id","rev_id" FROM "finfolk"."Trip"
      WHERE "id" = i_trip_id AND "owner_id" = i_owner
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_trip;
    o_draft := "finfolk".as_jsonb(i_draft);
    IF o_trip IS NULL OR NOT "finfolk".is_user_active(i_owner) THEN
      RETURN null;
    END IF;
    DECLARE
      o_active JSONB;
      o_rev JSONB;
      v_after BOOLEAN;
      v_before BOOLEAN;
      v_end DATE;
      v_start DATE;
    BEGIN
      WITH j_ret AS (  
        SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
        WHERE "class_table" = ('Trip')::"finfolk"."EnumClassType"
        AND "class_context" = ('Global')::"finfolk"."EnumClassType"
        AND "id" = (o_trip ->> 'rev_id')::UUID
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
      WITH j_ret AS (  
        SELECT
          "id",
          "trip_id",
          "expected_rows",
          "status",
          "is_active",
          "fingerprint",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."TripImport"
        WHERE "trip_id" = i_trip_id AND "is_active" = true
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
      v_start := (o_draft ->> 'start')::DATE;
      v_end := (o_draft ->> 'end')::DATE;
      SELECT exists(SELECT 1 FROM "finfolk"."TripDive"
      WHERE "import_id" = (o_active ->> 'id')::UUID AND "day" < v_start) INTO v_before;
      SELECT exists(SELECT 1 FROM "finfolk"."TripDive"
      WHERE "import_id" = (o_active ->> 'id')::UUID AND "day" > v_end) INTO v_after;
      IF i_revision != (o_rev ->> 'index')::INTEGER THEN
        RETURN null;
      END IF;
      IF v_before OR v_after THEN
        RAISE EXCEPTION 'The date range must include all imported dives';
      END IF;
      DECLARE
        o_history JSONB;
        o_log JSONB;
        o_updated JSONB;
        o_version JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."Trip" SET
            "beach_id" = (o_draft ->> 'beachId')::TEXT,
            "start_date" = (v_start)::DATE,
            "end_date" = (v_end)::DATE,
            "detail" = "finfolk".as_jsonb((((o_draft - 'beachId') - 'start') - 'end')::JSONB),
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_trip_id AND "owner_id" = i_owner
          RETURNING
            "id",
            "owner_id",
            "beach_id",
            "start_date",
            "end_date",
            "audit_id",
            "rev_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
        WITH j_ret AS (  
          UPDATE "finfolk"."Rev" SET
            "index" = (i_revision + 1)::INTEGER,
            "current" = (o_draft)::JSONB
          WHERE "class_table" = ('Trip')::"finfolk"."EnumClassType"
          AND "class_context" = ('Global')::"finfolk"."EnumClassType"
          AND "id" = (o_trip ->> 'rev_id')::UUID
          RETURNING "id","class_ref","index","current","op_created","time_created")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_version;
        WITH j_ret AS (  
          INSERT INTO "finfolk"."RevLog" (
            "class_table",
            "class_context",
            "rev_id",
            "version",
            "deltas",
            "op_created",
            "time_created"
          ) VALUES (
            ('Trip')::"finfolk"."EnumClassType",
            ('Global')::"finfolk"."EnumClassType",
            (o_trip ->> 'rev_id')::UUID,
            (i_revision + 1)::INTEGER,
            (o_draft)::JSONB,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT
          ) RETURNING "rev_id","version","deltas","op_created","time_created")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_history;
        WITH j_ret AS (  
          INSERT INTO "finfolk"."AuditLog" (
            "class_table",
            "class_context",
            "audit_id",
            "entry",
            "op_created",
            "time_created"
          ) VALUES (
            ('Trip')::"finfolk"."EnumClassType",
            ('Global')::"finfolk"."EnumClassType",
            (o_trip ->> 'audit_id')::UUID,
            "finfolk".as_jsonb((jsonb_build_object('event','save'))::JSONB),
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT
          ) RETURNING "audit_id","op_created","time_created")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
        RETURN jsonb_build_object('id',i_trip_id,'revision',i_revision + 1);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-reward/UserInvitation 
CREATE TABLE IF NOT EXISTS "finfolk"."UserInvitation" (
  "code" TEXT PRIMARY KEY NOT NULL,
  "inviter_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("inviter_id")
);

-- finfolkdb.common.type-user-reward/UserInvitationJoin 
CREATE TABLE IF NOT EXISTS "finfolk"."UserInvitationJoin" (
  "invitee_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "inviter_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "verified_sender_id" TEXT,
  "rewarded_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("verified_sender_id"),
  CONSTRAINT check_0 CHECK ("invitee_id" != "inviter_id")
);

-- finfolkdb.common.type-user-reward/UserPointsEntry 
CREATE TABLE IF NOT EXISTS "finfolk"."UserPointsEntry" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "action_id" UUID NOT NULL REFERENCES "finfolk"."InstagramAction"("id"),
  "day" DATE NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 1,
  "reversed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("user_id","day"),
  UNIQUE ("action_id"),
  CONSTRAINT check_0 CHECK ("points" = 1)
);

-- finfolkdb.common.type-user-reward/UserRequestLimit 
CREATE TABLE IF NOT EXISTS "finfolk"."UserRequestLimit" (
  "user_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "minute" TIMESTAMPTZ NOT NULL,
  "count" INTEGER NOT NULL
);

-- finfolkdb.common.type-social-post/SocialPost 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialPost" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialPost')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "beach_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "url" TEXT NOT NULL,
  "platform" "finfolk"."EnumSocialHandleType" NOT NULL,
  "creator_handle" TEXT NOT NULL DEFAULT '',
  "status" "finfolk"."EnumSocialPostStatus" NOT NULL DEFAULT 'pending',
  "public_consent" BOOLEAN NOT NULL DEFAULT false,
  "rejection_reason" TEXT NOT NULL DEFAULT '',
  "reviewed_by_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "reviewed_at" TIMESTAMPTZ,
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("owner_id","beach_id","url"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT fk_social_post_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_social_post_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."SocialPost" ("owner_id");
CREATE INDEX ON "finfolk"."SocialPost" ("beach_id");
CREATE INDEX ON "finfolk"."SocialPost" ("status");

-- finfolkdb.common.type-social-post/SocialPostReport 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialPostReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "post_id" UUID NOT NULL REFERENCES "finfolk"."SocialPost"("id") ON DELETE CASCADE,
  "reporter_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" "finfolk"."EnumSocialPostReportStatus" NOT NULL DEFAULT 'open',
  "resolved_by_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "resolved_at" TIMESTAMPTZ,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("post_id","reporter_id"),
  CONSTRAINT bounded_reason CHECK ((length("reason") >= 1) AND (length("reason") <= 1000))
);
CREATE INDEX ON "finfolk"."SocialPostReport" ("status");

-- finfolkdb.common.type-social-post/SocialReferral 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialReferral" (
  "day" DATE NOT NULL DEFAULT ("timezone"('Australia/Sydney',now()))::DATE,
  "platform" "finfolk"."EnumSocialHandleType" NOT NULL,
  "clicks" BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (day,platform)
);

-- finfolkdb.common.type-event/Event 
CREATE TABLE IF NOT EXISTS "finfolk"."Event" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Event')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "listing_id" UUID NOT NULL REFERENCES "finfolk"."DirectoryListing"("id"),
  "status" "finfolk"."EnumEventStatus" NOT NULL DEFAULT 'draft',
  "visibility" "finfolk"."EnumEventVisibility" NOT NULL DEFAULT 'public',
  "starts_at" TIMESTAMPTZ NOT NULL,
  "ends_at" TIMESTAMPTZ NOT NULL,
  "timezone" TEXT NOT NULL,
  "capacity" INTEGER,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "access_id" UUID NOT NULL,
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("access_id"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT positive_capacity CHECK ("capacity" > 0),
  CONSTRAINT ordered_times CHECK ("ends_at" > "starts_at"),
  CONSTRAINT fk_event_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_event_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id),
  CONSTRAINT fk_event_access FOREIGN KEY (class_table,class_context,access_id) REFERENCES "finfolk"."Access"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."Event" ("listing_id");
CREATE INDEX ON "finfolk"."Event" ("status");

-- finfolkdb.common.type-event/EventRsvp 
CREATE TABLE IF NOT EXISTS "finfolk"."EventRsvp" (
  "event_id" UUID NOT NULL REFERENCES "finfolk"."Event"("id"),
  "member_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumEventRsvpStatus" NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (event_id,member_id)
);
CREATE INDEX ON "finfolk"."EventRsvp" ("member_id");

-- finfolkdb.fn.event.event-manage/insert-event 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_event(
  i_listing_id UUID,
  i_document JSONB,
  i_visibility TEXT,
  i_starts_at TIMESTAMPTZ,
  i_ends_at TIMESTAMPTZ,
  i_timezone TEXT,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_access JSONB;
    o_base JSONB;
    o_document JSONB;
    o_event JSONB;
    v_id UUID;
  BEGIN
    v_id := uuid_generate_v4();
    o_document := "finfolk".as_jsonb(i_document);
    o_base := "finfolk".insert_base_addons('Event',(v_id)::TEXT,o_document,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Access" (
        "class_table",
        "class_context",
        "class_ref",
        "setting",
        "op_created",
        "time_created"
      ) VALUES (
        ('Event')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (v_id)::TEXT,
        ('closed')::"finfolk"."EnumAccessSetting",
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","setting","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_access;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Event" (
        "id",
        "listing_id",
        "visibility",
        "starts_at",
        "ends_at",
        "timezone",
        "capacity",
        "detail",
        "access_id",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        (i_listing_id)::UUID,
        (i_visibility)::"finfolk"."EnumEventVisibility",
        (i_starts_at)::TIMESTAMPTZ,
        (i_ends_at)::TIMESTAMPTZ,
        (i_timezone)::TEXT,
        (o_document ->> 'capacity')::INTEGER,
        "finfolk".as_jsonb((o_document)::JSONB),
        ((o_access ->> 'id')::UUID)::UUID,
        (o_base ->> 'audit')::UUID,
        (o_base ->> 'rev')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "listing_id",
        "status",
        "visibility",
        "starts_at",
        "ends_at",
        "timezone",
        "capacity",
        "hidden",
        "detail",
        "access_id",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
    RETURN o_event;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-report/UserReport 
CREATE TABLE IF NOT EXISTS "finfolk"."UserReport" (
  "id" BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "author_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" TEXT REFERENCES "finfolk"."User"("id"),
  "trip_id" UUID REFERENCES "finfolk"."Trip"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  CONSTRAINT one_target CHECK (("target_id" IS NOT NULL AND "trip_id" IS NULL) OR ("target_id" IS NULL AND "trip_id" IS NOT NULL))
);
CREATE INDEX ON "finfolk"."UserReport" ("author_id");

-- finfolkdb.common.type-user-activity/EnumActionType 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumActionType" AS ENUM ('create',
    'read',
    'update',
    'delete',
    'login',
    'logout',
    'invite',
    'join',
    'leave',
    'share',
    'export',
    'import');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-activity/ActivityLog 
CREATE TABLE IF NOT EXISTS "finfolk"."ActivityLog" (
  "id" UUID DEFAULT uuid_generate_v1(),
  "class_table" "finfolk"."EnumClassType",
  "activity_id" UUID NOT NULL,
  "action" "finfolk"."EnumActionType" NOT NULL,
  "actor_id" TEXT REFERENCES "finfolk"."User"("id"),
  "detail" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  CONSTRAINT fk_activity_log_activity FOREIGN KEY (class_table,activity_id) REFERENCES "finfolk"."Activity"(class_table,id) ON DELETE CASCADE
);

-- finfolkdb.fn.user.user-manage/insert-user 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_user(
  i_user_id TEXT,
  i_profile JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_activity JSONB;
    o_activity_log JSONB;
    o_audit JSONB;
    o_audit_log JSONB;
    o_rev JSONB;
    o_user JSONB;
  BEGIN
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Rev" (
        "class_table",
        "class_context",
        "class_ref",
        "current",
        "op_created",
        "time_created"
      ) VALUES (
        ('User')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_user_id)::TEXT,
        ("finfolk".as_jsonb(i_profile))::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","index","current","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Audit" (
        "class_table",
        "class_context",
        "class_ref",
        "op_created",
        "time_created"
      ) VALUES (
        ('User')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_user_id)::TEXT,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Activity" ("class_table","class_ref","op_created","time_created") VALUES (
        ('User')::"finfolk"."EnumClassType",
        (i_user_id)::TEXT,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_activity;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."User" ("id","profile","activity_id","audit_id","rev_id") VALUES (
        (i_user_id)::TEXT,
        ("finfolk".as_jsonb(i_profile))::JSONB,
        ((o_activity ->> 'id')::UUID)::UUID,
        ((o_audit ->> 'id')::UUID)::UUID,
        ((o_rev ->> 'id')::UUID)::UUID
      ) RETURNING
        "id",
        "profile",
        "deleted",
        "invite_eligible",
        "joined_at",
        "updated_at",
        "activity_id",
        "audit_id",
        "rev_id")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."AuditLog" (
        "class_table",
        "class_context",
        "audit_id",
        "entry",
        "op_created",
        "time_created"
      ) VALUES (
        ('User')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        ((o_audit ->> 'id')::UUID)::UUID,
        "finfolk".as_jsonb((jsonb_build_object('status','created'))::JSONB),
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "audit_id","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit_log;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."ActivityLog" (
        "class_table",
        "activity_id",
        "action",
        "actor_id",
        "detail",
        "op_created",
        "time_created"
      ) VALUES (
        ('User')::"finfolk"."EnumClassType",
        ((o_activity ->> 'id')::UUID)::UUID,
        ('create')::"finfolk"."EnumActionType",
        (i_user_id)::TEXT,
        "finfolk".as_jsonb((jsonb_build_object('status','created'))::JSONB),
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "activity_id",
        "action",
        "actor_id",
        "op_created",
        "time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_activity_log;
    RETURN o_user;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-environment-base/DataSource 
CREATE TABLE IF NOT EXISTS "finfolk"."DataSource" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "metadata" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false
);

-- finfolkdb.common.type-environment-base/DepthDataset 
CREATE TABLE IF NOT EXISTS "finfolk"."DepthDataset" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "upstream_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "status" "finfolk"."EnumDepthDatasetStatus" NOT NULL DEFAULT 'staged',
  "metadata" JSONB NOT NULL,
  UNIQUE ("source_id","upstream_id","version")
);

-- finfolkdb.common.type-environment-base/TideStation 
CREATE TABLE IF NOT EXISTS "finfolk"."TideStation" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "upstream_id" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE ("source_id","upstream_id")
);

-- finfolkdb.common.type-environment-base/EnvironmentTarget 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentTarget" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "product" "finfolk"."EnumEnvironmentTargetProduct" NOT NULL,
  "configuration" JSONB NOT NULL,
  "last_requested_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-environment-base/EnvironmentSnapshot 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentSnapshot" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "target_id" TEXT NOT NULL REFERENCES "finfolk"."EnvironmentTarget"("id") ON DELETE CASCADE,
  "issued_at" TIMESTAMPTZ,
  "retrieved_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "valid_from" TIMESTAMPTZ NOT NULL,
  "valid_to" TIMESTAMPTZ NOT NULL,
  "fresh_until" TIMESTAMPTZ NOT NULL,
  "delete_after" TIMESTAMPTZ NOT NULL,
  "checksum" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  CONSTRAINT check_0 CHECK ("valid_to" > "valid_from"),
  CONSTRAINT check_1 CHECK ("delete_after" >= "retrieved_at"),
  CONSTRAINT check_2 CHECK ("schema_version" > 0)
);

-- finfolkdb.common.type-environment-base/EnvironmentJob 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentJob" (
  "target_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."EnvironmentTarget"("id") ON DELETE CASCADE,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lease_token" UUID,
  "lease_until" TIMESTAMPTZ,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_success" TIMESTAMPTZ,
  "error_code" TEXT,
  CONSTRAINT check_0 CHECK ("attempts" >= 0),
  CONSTRAINT check_1 CHECK (("lease_token" IS NULL AND "lease_until" IS NULL) OR ("lease_token" IS NOT NULL AND "lease_until" IS NOT NULL))
);

-- finfolkdb.fn.messaging.messaging-chat/receive-chat-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_chat_message(
  i_application TEXT,
  i_account TEXT,
  i_subject TEXT,
  i_key TEXT,
  i_body TEXT,
  i_window INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account IS NULL OR ((o_account ->> 'provider') != 'app') THEN
      RAISE EXCEPTION 'App chat account is outside application scope';
    END IF;
    IF (coalesce(i_subject,'') = '') OR (length(i_subject) > 500) OR (coalesce(i_key,'') = '') OR (length(i_key) > 128) OR i_window IS NULL OR (i_window < 1) OR (i_window > 604800) THEN
      RAISE EXCEPTION 'Invalid app chat message';
    END IF;
    DECLARE
      o_message JSONB;
      o_receipt JSONB;
      v_deadline TIMESTAMPTZ;
      v_key TEXT;
      v_sent TIMESTAMPTZ;
    BEGIN
      v_key := "encode"(
        "digest"((jsonb_build_array(i_subject,i_key))::TEXT,'sha256'),
        'hex'
      );
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "external_event_id",
          "message_id",
          "status",
          "generation",
          "attempts",
          "lease",
          "lease_until",
          "next_attempt_at",
          "deadline",
          "result",
          "correlation_id",
          "created_at"
        FROM "finfolk"."MessagingReceipt"
        WHERE "account_id" = i_account AND "external_event_id" = v_key
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_receipt;
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "conversation_id",
          "direction",
          "external_id",
          "body",
          "metadata",
          "sent_at",
          "created_at"
        FROM "finfolk"."MessagingMessage"
        WHERE "id" = (o_receipt ->> 'message_id')::UUID
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
      v_sent := coalesce((o_message ->> 'sent_at')::TIMESTAMPTZ,now());
      v_deadline := coalesce(
        (o_receipt ->> 'deadline')::TIMESTAMPTZ,
        v_sent + (i_window * ('1 second')::INTERVAL)
      );
      RETURN "finfolk_rpc".receive_message(i_application,i_account,jsonb_build_object(
        'eventId',
        v_key,
        'messageId',
        v_key,
        'conversationId',
        i_subject,
        'senderId',
        i_subject,
        'body',
        i_body,
        'sentAt',
        v_sent,
        'deadline',
        v_deadline,
        'metadata',
        ('{}')::JSONB
      ));
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-chat/ret-chat-history 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_chat_history(
  i_application TEXT,
  i_account TEXT,
  i_subject TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    IF (o_account ->> 'provider') != 'app' THEN
      RAISE EXCEPTION 'History is available only on an app chat account';
    END IF;
    DECLARE
      o_conversation JSONB;
      o_participant JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
        WHERE "account_id" = i_account AND "external_id" = i_subject
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_conversation;
      WITH j_ret AS (  
        SELECT "id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
        WHERE "id" = (o_conversation ->> 'participant_id')::UUID
        AND "account_id" = i_account
        AND "external_id" = i_subject
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_participant;
      IF o_participant is null  THEN
        RETURN ('[]')::JSONB;
      END IF;
      RETURN "finfolk_rpc".ret_messaging_history(i_application,i_account,(o_conversation ->> 'id')::UUID);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/set-messaging-authorization 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_messaging_authorization(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER,
  i_ciphertext TEXT,
  i_expires TIMESTAMPTZ,
  i_proof JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_proof JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    o_proof := "finfolk".as_jsonb(i_proof);
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF (o_account ->> 'generation')::INTEGER != i_generation THEN
      RETURN null;
    END IF;
    IF i_generation IS NULL OR (coalesce(i_ciphertext,'') = '') OR (coalesce(o_proof ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_proof ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce(o_proof -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (i_expires IS NOT NULL AND (NOT "isfinite"(i_expires) OR (i_expires <= now()))) OR (i_expires IS NULL AND (coalesce(o_proof -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB)) THEN
      RAISE EXCEPTION 'Invalid verified messaging authorization';
    END IF;
    DECLARE
      o_audit JSONB;
      o_reconciled JSONB;
      o_saved JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_ciphertext" = (i_ciphertext)::TEXT,
          "token_expires_at" = (i_expires)::TIMESTAMPTZ,
          "credential_lease" = (null)::UUID,
          "credential_lease_until" = (null)::TIMESTAMPTZ,
          "mode" = ('disabled')::"finfolk"."EnumMessagingAccountMode",
          "generation" = (i_generation + 1)::INTEGER,
          "checks" = (o_proof)::JSONB,
          "updated_at" = (now())::TIMESTAMPTZ
        WHERE "id" = i_account
        RETURNING
          "id",
          "application_id",
          "provider",
          "account_id",
          "username",
          "credential_ciphertext",
          "token_expires_at",
          "credential_lease",
          "credential_lease_until",
          "mode",
          "enabled_commands",
          "pilot_sender_ids",
          "generation",
          "checks",
          "last_webhook_at",
          "last_command_at",
          "last_reply_at",
          "updated_at",
          "backoff_until",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_saved;
      o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
      o_audit := "finfolk_rpc".record_messaging_audit(
        i_application,
        i_account,
        'authorization_replaced',
        uuid_generate_v4()
      );
      RETURN jsonb_build_object(
        'generation',
        (o_saved ->> 'generation')::INTEGER,
        'mode',
        'disabled'
      );
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/activate-messaging-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".activate_messaging_account(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER,
  i_mode TEXT,
  i_senders JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_senders JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    o_senders := "finfolk".as_jsonb_array(i_senders);
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF (o_account ->> 'generation')::INTEGER != i_generation THEN
      RETURN null;
    END IF;
    IF i_generation IS NULL OR i_mode IS NULL OR NOT ((i_mode = 'pilot') OR (i_mode = 'live')) THEN
      RAISE EXCEPTION 'Invalid messaging activation mode';
    END IF;
    IF ((o_account ->> 'provider') != 'app') AND (o_account ->> 'credential_ciphertext' IS NULL OR (coalesce((o_account -> 'checks') ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce((o_account -> 'checks') ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce((o_account -> 'checks') -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (coalesce((o_account -> 'checks') -> 'subscribed',('false')::JSONB) != ('true')::JSONB) OR ((o_account ->> 'token_expires_at')::TIMESTAMPTZ <= now()) OR (o_account ->> 'token_expires_at' IS NULL AND (coalesce((o_account -> 'checks') -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB))) THEN
      RAISE EXCEPTION 'Messaging authorization and subscription must be verified';
    END IF;
    DECLARE
      o_sender JSONB;
    BEGIN
      o_sender := null;
      FOR o_sender IN SELECT jsonb_array_elements(o_senders) LOOP
        IF jsonb_typeof(o_sender) != 'string' THEN
          RAISE EXCEPTION 'Pilot sender identifiers must be strings';
        END IF;
      END LOOP;
    END;
    IF (i_mode = 'pilot') AND (jsonb_array_length(o_senders) = 0) THEN
      RAISE EXCEPTION 'Pilot activation requires allowed senders';
    END IF;
    DECLARE
      o_active JSONB;
      o_audit JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "mode" = (i_mode)::"finfolk"."EnumMessagingAccountMode",
          "pilot_sender_ids" = (o_senders)::JSONB,
          "updated_at" = (now())::TIMESTAMPTZ
        WHERE "id" = i_account
        RETURNING
          "id",
          "application_id",
          "provider",
          "account_id",
          "username",
          "credential_ciphertext",
          "token_expires_at",
          "credential_lease",
          "credential_lease_until",
          "mode",
          "enabled_commands",
          "pilot_sender_ids",
          "generation",
          "checks",
          "last_webhook_at",
          "last_command_at",
          "last_reply_at",
          "updated_at",
          "backoff_until",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
      o_audit := "finfolk_rpc".record_messaging_audit(i_application,i_account,'account_activated',uuid_generate_v4());
      RETURN jsonb_build_object('generation',i_generation,'mode',o_active ->> 'mode');
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/disable-messaging-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".disable_messaging_account(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER,
  i_disconnect BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF i_generation IS NULL OR i_disconnect IS NULL THEN
      RAISE EXCEPTION 'Invalid messaging account transition';
    END IF;
    IF (o_account ->> 'generation')::INTEGER != i_generation THEN
      RETURN null;
    END IF;
    DECLARE
      o_disabled JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_lease" = (null)::UUID,
          "credential_lease_until" = (null)::TIMESTAMPTZ,
          "mode" = ('disabled')::"finfolk"."EnumMessagingAccountMode",
          "generation" = (i_generation + 1)::INTEGER,
          "updated_at" = (now())::TIMESTAMPTZ
        WHERE "id" = i_account
        RETURNING
          "id",
          "application_id",
          "provider",
          "account_id",
          "username",
          "credential_ciphertext",
          "token_expires_at",
          "credential_lease",
          "credential_lease_until",
          "mode",
          "enabled_commands",
          "pilot_sender_ids",
          "generation",
          "checks",
          "last_webhook_at",
          "last_command_at",
          "last_reply_at",
          "updated_at",
          "backoff_until",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_disabled;
      IF i_disconnect THEN
        DECLARE
        o_cleared JSONB;
      BEGIN
        WITH j_ret AS (  
            UPDATE "finfolk"."MessagingAccount" SET
              "credential_ciphertext" = (null)::TEXT,
              "token_expires_at" = (null)::TIMESTAMPTZ,
              "checks" = ('{}')::JSONB
            WHERE "id" = i_account
            RETURNING
              "id",
              "application_id",
              "provider",
              "account_id",
              "username",
              "credential_ciphertext",
              "token_expires_at",
              "credential_lease",
              "credential_lease_until",
              "mode",
              "enabled_commands",
              "pilot_sender_ids",
              "generation",
              "checks",
              "last_webhook_at",
              "last_command_at",
              "last_reply_at",
              "updated_at",
              "backoff_until",
              "provider_scope")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_cleared;
          null;
      END;
      END IF;
      DECLARE
        o_audit JSONB;
        o_reconciled JSONB;
      BEGIN
        o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
        o_audit := "finfolk_rpc".record_messaging_audit(i_application,i_account,'account_disabled',uuid_generate_v4());
        RETURN jsonb_build_object('generation',i_generation + 1,'mode','disabled');
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/claim-messaging-refresh 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_messaging_refresh(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF i_generation IS NULL OR ((o_account ->> 'generation')::INTEGER != i_generation) OR o_account ->> 'credential_ciphertext' IS NULL OR ((o_account ->> 'credential_lease_until')::TIMESTAMPTZ > now()) THEN
      RETURN null;
    END IF;
    DECLARE
      o_claim JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_lease" = (uuid_generate_v4())::UUID,
          "credential_lease_until" = (now() + ('2 minutes')::INTERVAL)::TIMESTAMPTZ
        WHERE "id" = i_account
        RETURNING
          "id",
          "application_id",
          "provider",
          "account_id",
          "username",
          "credential_ciphertext",
          "token_expires_at",
          "credential_lease",
          "credential_lease_until",
          "mode",
          "enabled_commands",
          "pilot_sender_ids",
          "generation",
          "checks",
          "last_webhook_at",
          "last_command_at",
          "last_reply_at",
          "updated_at",
          "backoff_until",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_claim;
      RETURN o_claim;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/release-messaging-refresh 
CREATE OR REPLACE FUNCTION "finfolk_rpc".release_messaging_refresh(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER,
  i_lease UUID
) RETURNS JSONB AS $$
BEGIN
  IF i_lease is null  THEN
    RETURN null;
  END IF;
  DECLARE
    o_release JSONB;
  BEGIN
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingAccount" SET
        "credential_lease" = (null)::UUID,
        "credential_lease_until" = (null)::TIMESTAMPTZ
      WHERE "id" = i_account
      AND "application_id" = i_application
      AND "generation" = i_generation
      AND "credential_lease" = i_lease
      RETURNING
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_release;
    RETURN jsonb_build_object('released',o_release IS NOT NULL);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/save-messaging-refresh 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_messaging_refresh(
  i_application TEXT,
  i_account TEXT,
  i_generation INTEGER,
  i_lease UUID,
  i_ciphertext TEXT,
  i_expires TIMESTAMPTZ,
  i_proof JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_proof JSONB;
  BEGIN
    o_proof := "finfolk".as_jsonb(i_proof);
    WITH j_ret AS (  
      SELECT
        "id",
        "application_id",
        "provider",
        "account_id",
        "username",
        "credential_ciphertext",
        "token_expires_at",
        "credential_lease",
        "credential_lease_until",
        "mode",
        "enabled_commands",
        "pilot_sender_ids",
        "generation",
        "checks",
        "last_webhook_at",
        "last_command_at",
        "last_reply_at",
        "updated_at",
        "backoff_until",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account
      AND "application_id" = i_application
      AND "generation" = i_generation
      AND "credential_lease" = i_lease
      AND "credential_lease_until" > now()
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account IS NULL OR i_lease IS NULL THEN
      RETURN null;
    END IF;
    IF (coalesce(i_ciphertext,'') = '') OR (coalesce(o_proof ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_proof ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce(o_proof -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (coalesce(o_proof -> 'subscribed',('false')::JSONB) != ('true')::JSONB) OR (i_expires IS NOT NULL AND (NOT "isfinite"(i_expires) OR (i_expires <= now()))) OR (i_expires IS NULL AND (coalesce(o_proof -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB)) THEN
      RAISE EXCEPTION 'Invalid refreshed messaging authorization';
    END IF;
    DECLARE
      o_audit JSONB;
      o_saved JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_ciphertext" = (i_ciphertext)::TEXT,
          "token_expires_at" = (i_expires)::TIMESTAMPTZ,
          "credential_lease" = (null)::UUID,
          "credential_lease_until" = (null)::TIMESTAMPTZ,
          "checks" = (o_proof)::JSONB,
          "updated_at" = (now())::TIMESTAMPTZ
        WHERE "id" = i_account
        RETURNING
          "id",
          "application_id",
          "provider",
          "account_id",
          "username",
          "credential_ciphertext",
          "token_expires_at",
          "credential_lease",
          "credential_lease_until",
          "mode",
          "enabled_commands",
          "pilot_sender_ids",
          "generation",
          "checks",
          "last_webhook_at",
          "last_command_at",
          "last_reply_at",
          "updated_at",
          "backoff_until",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_saved;
      o_audit := "finfolk_rpc".record_messaging_audit(
        i_application,
        i_account,
        'authorization_refreshed',
        uuid_generate_v4()
      );
      RETURN jsonb_build_object('generation',i_generation,'mode',o_saved ->> 'mode');
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-import-base/EnumDataAssetKind 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumDataAssetKind" AS ENUM ('geojson','raster','archive','document','other');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-import-base/DatabaseRelease 
CREATE TABLE IF NOT EXISTS "finfolk"."DatabaseRelease" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "manifest" JSONB NOT NULL,
  "counts" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-import-base/DataAsset 
CREATE TABLE IF NOT EXISTS "finfolk"."DataAsset" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "checksum" TEXT NOT NULL,
  "bytes" BIGINT NOT NULL,
  "kind" "finfolk"."EnumDataAssetKind" NOT NULL,
  "uri" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  CONSTRAINT check_0 CHECK ("bytes" >= 0)
);

-- finfolkdb.common.type-import-base/GeoArea 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoArea" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "metadata" JSONB NOT NULL
);

-- finfolkdb.common.type-import-base/GeoFeature 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoFeature" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "dataset_id" TEXT NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "geometry" JSONB NOT NULL,
  "properties" JSONB NOT NULL
);

-- finfolkdb.common.type-import-base/SiteLocation 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteLocation" (
  "beach_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "area_id" TEXT REFERENCES "finfolk"."GeoArea"("id"),
  "source_id" TEXT NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "geometry" JSONB NOT NULL
);

-- finfolkdb.common.type-import-base/DepthDatasetAsset 
CREATE TABLE IF NOT EXISTS "finfolk"."DepthDatasetAsset" (
  "dataset_id" TEXT NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "asset_id" TEXT NOT NULL REFERENCES "finfolk"."DataAsset"("id"),
  PRIMARY KEY (dataset_id,asset_id)
);

-- finfolkdb.common.type-import-base/GeoBoundary 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoBoundary" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "asset_id" TEXT NOT NULL REFERENCES "finfolk"."DataAsset"("id"),
  "area_id" TEXT REFERENCES "finfolk"."GeoArea"("id"),
  "geometry" JSONB NOT NULL,
  "properties" JSONB NOT NULL
);

-- finfolkdb.common.type-site-base/SiteCatalog 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteCatalog" (
  "id" INTEGER PRIMARY KEY NOT NULL,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT check_0 CHECK ("id" = 1),
  CONSTRAINT check_1 CHECK ("revision" >= 0)
);

-- finfolkdb.common.type-site-base/SiteProfile 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteProfile" (
  "beach_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "revision" BIGINT NOT NULL,
  "waterbody" "finfolk"."EnumSiteProfileWaterbody" NOT NULL,
  "access_mode" "finfolk"."EnumSiteProfileAccessMode" NOT NULL,
  "status" "finfolk"."EnumSiteProfileStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-site-base/SiteImport 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteImport" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "preview" JSONB NOT NULL DEFAULT '{}',
  "status" "finfolk"."EnumSiteImportStatus" NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-site-base/SiteRevision 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteRevision" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "site_id" TEXT NOT NULL REFERENCES "finfolk"."Beach"("id"),
  "owner_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "import_id" UUID REFERENCES "finfolk"."SiteImport"("id") ON DELETE CASCADE,
  "base_revision" BIGINT NOT NULL DEFAULT 0,
  "version" BIGINT NOT NULL DEFAULT 1,
  "status" "finfolk"."EnumSiteRevisionStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "reviewed_by_id" TEXT REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- finfolkdb.common.type-site-base/SiteAccessPoint 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteAccessPoint" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "mode" "finfolk"."EnumSiteAccessPointMode" NOT NULL,
  "payload" JSONB NOT NULL
);

-- finfolkdb.common.type-site-base/SiteDepthEvidence 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteDepthEvidence" (
  "id" UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "kind" "finfolk"."EnumSiteDepthEvidenceType" NOT NULL,
  "payload" JSONB NOT NULL
);

-- finfolkdb.common.type-site-base/SiteDepthDataset 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteDepthDataset" (
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "dataset_id" TEXT NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "relationship" "finfolk"."EnumSiteDepthDatasetRelationship" NOT NULL,
  "evidence" JSONB NOT NULL,
  PRIMARY KEY (revision_id,dataset_id)
);

-- finfolkdb.common.type-site-base/SiteTideStation 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteTideStation" (
  "revision_id" UUID PRIMARY KEY NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "station_id" TEXT NOT NULL REFERENCES "finfolk"."TideStation"("id"),
  "evidence" JSONB NOT NULL
);

-- finfolkdb.common.type-media-import/MediaImport 
CREATE TABLE IF NOT EXISTS "finfolk"."MediaImport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "owner_id" TEXT NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "platform" "finfolk"."EnumMediaImportPlatform" NOT NULL,
  "provider_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'post',
  "posted_at" TIMESTAMPTZ,
  "day" DATE,
  "beach_id" TEXT REFERENCES "finfolk"."Beach"("id"),
  "location_name" TEXT NOT NULL DEFAULT '',
  "candidates" JSONB NOT NULL DEFAULT '[]',
  "notes" TEXT NOT NULL DEFAULT '',
  "session_id" UUID REFERENCES "finfolk"."DiveSession"("id") ON DELETE SET NULL,
  "status" "finfolk"."EnumMediaImportStatus" NOT NULL DEFAULT 'active',
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "assignment_key" UUID,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("owner_id","platform","provider_id"),
  CONSTRAINT array_candidates CHECK (jsonb_typeof("candidates") = 'array'),
  CONSTRAINT fk_media_import_session_owner FOREIGN KEY (owner_id,session_id) REFERENCES "finfolk"."DiveSession"(owner_id,id)
);
CREATE INDEX ON "finfolk"."MediaImport" ("owner_id");

-- finfolkdb.fn.site.site-notes/is-site-note-member 
CREATE OR REPLACE FUNCTION "finfolk_rpc".is_site_note_member(
  i_user TEXT
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN "finfolk".is_user_active(i_user) AND exists(
    SELECT 1 FROM neon_auth."user" WHERE (("id")::TEXT = i_user) AND coalesce("emailVerified",false) AND NOT coalesce("banned",false)
  );
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/require-site-note-member 
CREATE OR REPLACE FUNCTION "finfolk_rpc".require_site_note_member() RETURNS TEXT AS $$

  DECLARE
    v_user TEXT;
  BEGIN
    v_user := "finfolk".auth_uid();
    IF NOT "finfolk_rpc".is_site_note_member(v_user) THEN
      RAISE EXCEPTION 'Verified member access required';
    END IF;
    RETURN v_user;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/is-site-note-site 
CREATE OR REPLACE FUNCTION "finfolk_rpc".is_site_note_site(
  i_site TEXT
) RETURNS BOOLEAN AS $$

  DECLARE
    v_private BOOLEAN;
    v_site BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."Beach"
    WHERE "id" = i_site) INTO v_site;
    SELECT exists(SELECT 1 FROM "finfolk"."SiteProfile"
    WHERE "beach_id" = i_site
    AND "status" != ('published')::"finfolk"."EnumSiteProfileStatus") INTO v_private;
    RETURN v_site AND NOT v_private;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/site-note-score 
CREATE OR REPLACE FUNCTION "finfolk_rpc".site_note_score(
  i_note UUID
) RETURNS BIGINT AS $$

  SELECT count(*) FROM "finfolk"."SiteNoteVote" AS "v" INNER JOIN "finfolk"."User" AS "u" ON "v"."voter_id" = "u"."id" INNER JOIN neon_auth."user" AS "a" ON ("a"."id")::TEXT = "u"."id" WHERE ("v"."note_id" = i_note) AND NOT "u"."deleted" AND coalesce("a"."emailVerified",false) AND NOT coalesce("a"."banned",false);

$$ LANGUAGE 'sql';

-- finfolkdb.fn.site.site-notes/ret-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_site_note(
  i_note UUID,
  i_viewer TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    o_user JSONB;
    v_author TEXT;
    v_upvoted BOOLEAN;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "beach_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "revision",
        "created_at",
        "updated_at"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "hidden" = false AND "withdrawn" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    v_author := (o_note ->> 'author_id');
    WITH j_ret AS (  
      SELECT "profile" FROM "finfolk"."User"
      WHERE "id" = v_author AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    SELECT exists(SELECT 1 FROM "finfolk"."SiteNoteVote"
    WHERE "note_id" = i_note AND "voter_id" = i_viewer) INTO v_upvoted;
    IF o_note IS NULL OR NOT "finfolk_rpc".is_site_note_site(o_note ->> 'beach_id') OR NOT "finfolk_rpc".is_site_note_member(v_author) OR "finfolk".is_user_blocked(i_viewer,v_author) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'id',
      i_note,
      'site',
      o_note ->> 'beach_id',
      'topic',
      o_note ->> 'topic',
      'text',
      o_note ->> 'body',
      'author',
      coalesce((o_user -> 'profile') ->> 'displayName','Diver'),
      'createdAt',
      "finfolk".as_iso_time((o_note ->> 'created_at')::TIMESTAMPTZ),
      'observedOn',
      o_note ->> 'observed_on',
      'revision',
      (o_note ->> 'revision')::INTEGER,
      'score',
      "finfolk_rpc".site_note_score(i_note),
      'own',
      v_author = i_viewer,
      'upvoted',
      v_upvoted
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/ret-site-notes 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_site_notes(
  i_site TEXT,
  i_sort TEXT,
  i_topic TEXT,
  i_offset INTEGER,
  i_member BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_rows JSONB;
    v_viewer TEXT;
  BEGIN
    v_viewer := CASE WHEN i_member THEN "finfolk_rpc".require_site_note_member()
    WHEN true THEN ''
    END;
    o_rows := null;
    IF i_offset IS NULL OR (i_offset < 0) OR (i_offset > 10000) OR i_sort IS NULL OR NOT ((i_sort = 'helpful') OR (i_sort = 'newest')) OR i_topic IS NULL OR NOT ((i_topic = 'all') OR (i_topic = 'access') OR (i_topic = 'facilities') OR (i_topic = 'wildlife') OR (i_topic = 'conditions')) THEN
      RAISE EXCEPTION 'Invalid notes filter';
    END IF;
    SELECT coalesce(jsonb_agg("value"),('[]')::JSONB) FROM (  
      SELECT "finfolk_rpc".ret_site_note("id",v_viewer) AS "value" FROM "finfolk"."SiteNote" WHERE ("beach_id" = i_site) AND NOT "withdrawn" AND NOT "hidden" AND ((i_topic = 'all') OR (("topic")::TEXT = i_topic)) AND "finfolk_rpc".ret_site_note("id",v_viewer) IS NOT NULL ORDER BY
        0 - CASE WHEN i_sort = 'helpful' THEN "finfolk_rpc".site_note_score("id")
      WHEN true THEN 0
      END,
        0 - "date_part"('epoch',"created_at"),
        "id"
      LIMIT 21 OFFSET i_offset) AS "selected_notes" INTO o_rows;
    RETURN jsonb_build_object('notes',CASE WHEN jsonb_array_length(o_rows) > 20 THEN o_rows - 20
    WHEN true THEN o_rows
    END,'next',CASE WHEN jsonb_array_length(o_rows) > 20 THEN i_offset + 20
    WHEN true THEN null
    END);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/save-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_site_note(
  i_site TEXT,
  i_id UUID,
  i_topic TEXT,
  i_body TEXT,
  i_observed DATE
) RETURNS JSONB AS $$

  DECLARE
    v_user TEXT;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_id)::TEXT,0));
    DECLARE
      o_existing JSONB;
      o_site JSONB;
      v_body TEXT;
    BEGIN
      WITH j_ret AS (  
        SELECT "id","name","timezone","area_name","state" FROM "finfolk"."Beach"
        WHERE "id" = i_site
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
      v_body := btrim(coalesce(i_body,''));
      WITH j_ret AS (  
        SELECT
          "id",
          "beach_id",
          "author_id",
          "topic",
          "body",
          "observed_on",
          "withdrawn",
          "hidden",
          "revision",
          "created_at",
          "updated_at"
        FROM "finfolk"."SiteNote"
        WHERE "id" = i_id
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF i_id IS NULL OR NOT "finfolk_rpc".is_site_note_site(i_site) OR (length(v_body) < 10) OR (length(v_body) > 1000) OR i_topic IS NULL OR NOT ((i_topic = 'access') OR (i_topic = 'facilities') OR (i_topic = 'wildlife') OR (i_topic = 'conditions')) OR ((i_topic = 'conditions') AND i_observed IS NULL) OR (i_observed IS NOT NULL AND (NOT "isfinite"(i_observed) OR (i_observed > ("timezone"(o_site ->> 'timezone',now()))::DATE))) THEN
        RAISE EXCEPTION 'Check the site, topic, note length and observation date';
      END IF;
      IF o_existing is not null  THEN
        IF ((o_existing ->> 'author_id') != v_user) OR ((o_existing ->> 'beach_id') != i_site) OR ((o_existing ->> 'topic') != i_topic) OR ((o_existing ->> 'body') != v_body) OR (coalesce(o_existing ->> 'observed_on','') != coalesce((i_observed)::TEXT,'')) THEN
          RAISE EXCEPTION 'This note identifier was already used';
        END IF;
        RETURN jsonb_build_object('id',i_id,'revision',(o_existing ->> 'revision')::INTEGER);
      END IF;
      DECLARE
        o_note JSONB;
      BEGIN
        WITH j_ret AS (  
          INSERT INTO "finfolk"."SiteNote" ("id","beach_id","author_id","topic","body","observed_on") VALUES (
            (i_id)::UUID,
            (i_site)::TEXT,
            (v_user)::TEXT,
            (i_topic)::"finfolk"."EnumSiteNoteTopic",
            (v_body)::TEXT,
            (i_observed)::DATE
          ) RETURNING
            "id",
            "beach_id",
            "author_id",
            "topic",
            "body",
            "observed_on",
            "withdrawn",
            "hidden",
            "revision",
            "created_at",
            "updated_at")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
        RETURN jsonb_build_object('id',i_id,'revision',1);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/set-site-note-vote 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_site_note_vote(
  i_site TEXT,
  i_note UUID,
  i_upvoted BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    v_user TEXT;
    v_voted BOOLEAN;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    WITH j_ret AS (  
      SELECT
        "id",
        "beach_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "revision",
        "created_at",
        "updated_at"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "beach_id" = i_site
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    SELECT exists(SELECT 1 FROM "finfolk"."SiteNoteVote"
    WHERE "note_id" = i_note AND "voter_id" = v_user) INTO v_voted;
    IF i_upvoted IS NULL OR o_note IS NULL OR "finfolk_rpc".ret_site_note(i_note,v_user) IS NULL THEN
      RAISE EXCEPTION 'That note is unavailable';
    END IF;
    IF i_upvoted THEN
      IF NOT v_voted THEN
        DECLARE
      o_write JSONB;
    BEGIN
      WITH j_ret AS (INSERT INTO "finfolk"."SiteNoteVote" ("note_id","voter_id") VALUES ((i_note)::UUID,(v_user)::TEXT) RETURNING "note_id","voter_id","created_at")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_write;
          null;
    END;
      END IF;
    ELSE
      DECLARE
      o_write JSONB;
    BEGIN
      WITH j_ret AS (  
          DELETE FROM "finfolk"."SiteNoteVote" WHERE "note_id" = i_note AND "voter_id" = v_user
          RETURNING "note_id","voter_id","created_at")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
        null;
    END;
    END IF;
    RETURN "finfolk_rpc".ret_site_note(i_note,v_user);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/set-site-note-withdrawn 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_site_note_withdrawn(
  i_site TEXT,
  i_note UUID,
  i_revision INTEGER,
  i_withdrawn BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    v_user TEXT;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    WITH j_ret AS (  
      SELECT
        "id",
        "beach_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "revision",
        "created_at",
        "updated_at"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "beach_id" = i_site AND "author_id" = v_user
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    IF o_note IS NULL OR i_withdrawn IS NULL THEN
      RAISE EXCEPTION 'That note is unavailable';
    END IF;
    IF (o_note ->> 'withdrawn')::BOOLEAN != i_withdrawn THEN
      IF i_revision IS NULL OR ((o_note ->> 'revision')::INTEGER != i_revision) THEN
        RAISE EXCEPTION 'This note changed; reload it before trying again';
      END IF;
      DECLARE
      o_saved JSONB;
    BEGIN
      WITH j_ret AS (  
          UPDATE "finfolk"."SiteNote" SET
            "withdrawn" = (i_withdrawn)::BOOLEAN,
            "revision" = (i_revision + 1)::INTEGER,
            "updated_at" = (now())::TIMESTAMPTZ
          WHERE "id" = i_note
          RETURNING
            "id",
            "beach_id",
            "author_id",
            "topic",
            "body",
            "observed_on",
            "withdrawn",
            "hidden",
            "revision",
            "created_at",
            "updated_at")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_saved;
        o_note := o_saved;
    END;
    END IF;
    RETURN jsonb_build_object(
      'id',
      i_note,
      'revision',
      (o_note ->> 'revision')::INTEGER,
      'withdrawn',
      i_withdrawn
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/report-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".report_site_note(
  i_site TEXT,
  i_note UUID,
  i_reason TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    v_reason TEXT;
    v_reported BOOLEAN;
    v_user TEXT;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    WITH j_ret AS (  
      SELECT
        "id",
        "beach_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "revision",
        "created_at",
        "updated_at"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "beach_id" = i_site
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    v_reason := btrim(coalesce(i_reason,''));
    SELECT exists(SELECT 1 FROM "finfolk"."SiteNoteReport"
    WHERE "note_id" = i_note AND "reporter_id" = v_user) INTO v_reported;
    IF o_note IS NULL OR "finfolk_rpc".ret_site_note(i_note,v_user) IS NULL OR (length(v_reason) < 1) OR (length(v_reason) > 1000) THEN
      RAISE EXCEPTION 'Choose a note and provide a report reason';
    END IF;
    IF NOT v_reported THEN
      DECLARE
      o_write JSONB;
    BEGIN
      WITH j_ret AS (INSERT INTO "finfolk"."SiteNoteReport" ("note_id","reporter_id","reason") VALUES ((i_note)::UUID,(v_user)::TEXT,(v_reason)::TEXT) RETURNING "note_id","reporter_id","reason","created_at","resolved_at")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_write;
        null;
    END;
    END IF;
    RETURN jsonb_build_object('reported',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/moderate-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".moderate_site_note(
  i_site TEXT,
  i_note UUID,
  i_hidden BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    v_user TEXT;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    IF coalesce(current_setting('finfolk.directory_admin',true),'false') != 'true' THEN
      RAISE EXCEPTION 'Administrator access required';
    END IF;
    DECLARE
      o_note JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "beach_id",
          "author_id",
          "topic",
          "body",
          "observed_on",
          "withdrawn",
          "hidden",
          "revision",
          "created_at",
          "updated_at"
        FROM "finfolk"."SiteNote"
        WHERE "id" = i_note AND "beach_id" = i_site
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
      IF o_note IS NULL OR i_hidden IS NULL THEN
        RAISE EXCEPTION 'That note is unavailable';
      END IF;
      IF (o_note ->> 'hidden')::BOOLEAN != i_hidden THEN
        DECLARE
        o_write JSONB;
      BEGIN
        WITH j_ret AS (  
            UPDATE "finfolk"."SiteNote" SET
              "hidden" = (i_hidden)::BOOLEAN,
              "revision" = ((o_note ->> 'revision')::INTEGER + 1)::INTEGER,
              "updated_at" = (now())::TIMESTAMPTZ
            WHERE "id" = i_note
            RETURNING
              "id",
              "beach_id",
              "author_id",
              "topic",
              "body",
              "observed_on",
              "withdrawn",
              "hidden",
              "revision",
              "created_at",
              "updated_at")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
          null;
      END;
      END IF;
      DECLARE
        o_write JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."SiteNoteReport" SET "resolved_at" = (now())::TIMESTAMPTZ WHERE "note_id" = i_note AND "resolved_at" IS NULL
          RETURNING "note_id","reporter_id","reason","created_at","resolved_at")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
        null;
      END;
      RETURN jsonb_build_object('id',i_note,'hidden',i_hidden);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-posts/insert-social-post 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_social_post(
  i_owner TEXT,
  i_beach TEXT,
  i_url TEXT,
  i_platform TEXT,
  i_handle TEXT,
  i_consent BOOLEAN,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_base JSONB;
    o_post JSONB;
    v_id UUID;
  BEGIN
    v_id := uuid_generate_v4();
    o_base := "finfolk".insert_base_addons(
      'SocialPost',
      (v_id)::TEXT,
      jsonb_build_object('url',i_url,'platform',i_platform),
      o_op
    );
    WITH j_ret AS (  
      INSERT INTO "finfolk"."SocialPost" (
        "id",
        "owner_id",
        "beach_id",
        "url",
        "platform",
        "creator_handle",
        "public_consent",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        (i_owner)::TEXT,
        (i_beach)::TEXT,
        (i_url)::TEXT,
        (i_platform)::"finfolk"."EnumSocialHandleType",
        (i_handle)::TEXT,
        (i_consent)::BOOLEAN,
        (o_base ->> 'audit')::UUID,
        (o_base ->> 'rev')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "owner_id",
        "beach_id",
        "url",
        "platform",
        "creator_handle",
        "status",
        "public_consent",
        "rejection_reason",
        "reviewed_by_id",
        "reviewed_at",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_post;
    RETURN o_post;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-posts/ret-social-post-public 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_social_post_public(
  i_post_id UUID,
  i_viewer TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_post JSONB;
    v_owner TEXT;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "beach_id",
        "url",
        "platform",
        "creator_handle",
        "time_created"
      FROM "finfolk"."SocialPost"
      WHERE "id" = i_post_id
      AND "status" = ('approved')::"finfolk"."EnumSocialPostStatus"
      AND "public_consent" = true
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_post;
    v_owner := (o_post ->> 'owner_id');
    IF o_post IS NULL OR NOT "finfolk".is_user_active(v_owner) OR "finfolk".is_user_blocked(i_viewer,v_owner) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object('id',o_post ->> 'id','beach_id',o_post ->> 'beach_id','url',o_post ->> 'url','platform',o_post ->> 'platform','creator_handle',o_post ->> 'creator_handle','created_at',"finfolk".as_iso_time(
      to_timestamp((o_post ->> 'time_created')::NUMERIC / 1000000)
    ));
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-logbook/insert-dive-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_dive_session(
  i_owner TEXT,
  i_beach TEXT,
  i_data JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_base JSONB;
    o_data JSONB;
    o_session JSONB;
    v_id UUID;
  BEGIN
    v_id := uuid_generate_v4();
    o_data := (("finfolk".as_jsonb(i_data) - 'beachId') || jsonb_build_object('visibility','private','photos',('[]')::JSONB));
    o_base := "finfolk".insert_base_addons('DiveSession',(v_id)::TEXT,o_data,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."DiveSession" (
        "id",
        "owner_id",
        "beach_id",
        "detail",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        (i_owner)::TEXT,
        (nullif(i_beach,''))::TEXT,
        "finfolk".as_jsonb((o_data)::JSONB),
        (o_base ->> 'audit')::UUID,
        (o_base ->> 'rev')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "owner_id",
        "beach_id",
        "detail",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_session;
    RETURN o_session;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-logbook/ret-dive-session-owned 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_dive_session_owned(
  i_session_id UUID,
  i_owner TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_session JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","owner_id","beach_id","detail" FROM "finfolk"."DiveSession"
      WHERE "id" = i_session_id AND "owner_id" = i_owner
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_session;
    IF o_session IS NULL OR NOT "finfolk".is_user_active(i_owner) THEN
      RETURN null;
    END IF;
    RETURN (o_session -> 'detail') || jsonb_build_object(
      'id',
      o_session ->> 'id',
      'ownerId',
      o_session ->> 'owner_id',
      'beachId',
      coalesce(o_session ->> 'beach_id','')
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-social-tiktok/TiktokConnection 
CREATE TABLE IF NOT EXISTS "finfolk"."TiktokConnection" (
  "user_id" TEXT PRIMARY KEY NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "app_id" TEXT NOT NULL,
  "open_id" TEXT,
  "display_name" TEXT NOT NULL DEFAULT '',
  "status" "finfolk"."EnumTiktokConnectionStatus" NOT NULL DEFAULT 'pending',
  "credential_ciphertext" TEXT,
  "access_expires_at" TIMESTAMPTZ,
  "refresh_expires_at" TIMESTAMPTZ,
  "oauth_hash" TEXT,
  "oauth_expires_at" TIMESTAMPTZ,
  "oauth_nonce_hash" TEXT,
  "last_success" TIMESTAMPTZ,
  "next_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "lease_until" TIMESTAMPTZ,
  "cursor" TEXT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("app_id","open_id")
);


-- Native directory HTTP contract; transaction identity is set by the trusted server.
CREATE OR REPLACE FUNCTION finfolk_rpc.directory_document(d jsonb) RETURNS jsonb AS $$
DECLARE s text;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR length(trim(coalesce(d->>'name','')))=0 OR length(d->>'name')>160
 OR NOT coalesce(d->>'category'=ANY(ARRAY['School','Instructor','Business','Club','Group','Freediver']),false)
 OR (d->>'category'<>'Freediver' AND NOT coalesce(d->>'state'=ANY(ARRAY['VIC','NSW','QLD','SA','WA','TAS','NT','ACT']),false)) THEN
 RAISE EXCEPTION 'Name, category and Australian state are required' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(d->'sources') IS DISTINCT FROM 'array' OR jsonb_typeof(d->'socials') IS DISTINCT FROM 'array'
 OR jsonb_array_length(d->'sources')>10 OR jsonb_array_length(d->'socials')>10 THEN
 RAISE EXCEPTION 'Provide up to ten source and social links' USING ERRCODE='22023'; END IF;
 -- New personal/group pages cannot assert verified external identities.
 IF d->'socials'<>'[]'::jsonb THEN RAISE EXCEPTION 'Social identities require review' USING ERRCODE='22023'; END IF;
 FOR s IN SELECT jsonb_array_elements_text(d->'sources') UNION ALL SELECT d->>'website' LOOP
 IF coalesce(s,'')<>'' AND (length(s)>2048 OR s !~ '^https://[^/@[:space:]]+([/:?#]|$)') THEN
 RAISE EXCEPTION 'Use HTTPS website and source links' USING ERRCODE='22023'; END IF; END LOOP;
 IF coalesce(d->>'image','')<>'' AND (length(d->>'image')>65558 OR d->>'image' !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/]+=*$') THEN
 RAISE EXCEPTION 'Invalid page image' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('name',trim(d->>'name'),'category',d->>'category','state',coalesce(d->>'state',''),
 'country',left(coalesce(nullif(trim(d->>'country'),''),'Australia'),100),'locality',left(coalesce(d->>'locality',''),160),
 'description',left(coalesce(d->>'description',''),2000),'website',coalesce(d->>'website',''),
 'image',coalesce(d->>'image',''),'socials','[]'::jsonb,'sources',d->'sources');
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finfolk_rpc.directory_owner_row(l finfolk."DirectoryListing") RETURNS jsonb AS $$
 SELECT jsonb_build_object('id',l.id,'document',l.detail,'status',l.status,'revision',r.index,
 'owner_id',(SELECT member_id FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND level='owner' AND is_active),
 'role',(SELECT level FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=finfolk.auth_uid() AND is_active))
 FROM finfolk."Rev" r WHERE r.class_table='DirectoryListing' AND r.class_context='Global' AND r.id=l.rev_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION finfolk_rpc.directory_operation(op text,v jsonb) RETURNS jsonb AS $$
DECLARE
 actor text:=finfolk.auth_uid(); adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'')='true';
 l finfolk."DirectoryListing"; req finfolk."AccessRequest"; ident uuid; doc jsonb; ctx jsonb; result jsonb; off integer; rev integer;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid request' USING ERRCODE='22023'; END IF;
 IF op='public-list' THEN
 off:=greatest(0,least(100000,coalesce((v->>'offset')::integer,0)));
 SELECT jsonb_build_object('listings',coalesce(jsonb_agg(p ORDER BY n) FILTER(WHERE n<=20),'[]'::jsonb),
 'next',CASE WHEN count(*)>20 THEN off+20 END) INTO result FROM (
 SELECT finfolk_rpc.ret_directory_public(id) p,row_number() OVER(ORDER BY lower(detail->>'name'),id) n
 FROM (SELECT * FROM finfolk."DirectoryListing" WHERE status='published'
 AND (coalesce(v->>'q','')='' OR strpos(lower(detail->>'name'),lower(v->>'q'))>0)
 AND (coalesce(v->>'category','')='' OR detail->>'category'=v->>'category')
 AND (coalesce(v->>'state','')='' OR detail->>'state'=v->>'state')
 AND (coalesce(v->>'locality','')='' OR strpos(lower(detail->>'locality'),lower(v->>'locality'))>0)
 ORDER BY lower(detail->>'name'),id LIMIT 21 OFFSET off) selected) numbered;
 RETURN result;
 ELSIF op='public-detail' THEN
 result:=finfolk_rpc.ret_directory_public((v->>'id')::uuid);
 IF result IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF; RETURN result;
 END IF;
 -- Serialize first-use provisioning and repeated requests for this authenticated actor.
 IF NOT EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text=actor AND "emailVerified" AND NOT coalesce(banned,false)) THEN
 RAISE EXCEPTION 'Verified member required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('directory-member:'||actor,0));
 IF EXISTS(SELECT 1 FROM finfolk."User" WHERE id=actor AND deleted) THEN RAISE EXCEPTION 'Member unavailable' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM finfolk."User" WHERE id=actor) THEN
 PERFORM finfolk_rpc.insert_user(actor,'{}',finfolk.op_fn('directory-member',actor,'{}')); END IF;
 IF op='mine' THEN
 SELECT jsonb_build_object('admin',adm,'listings',coalesce((SELECT jsonb_agg(finfolk_rpc.directory_owner_row(p) ORDER BY p.time_created DESC)
 FROM finfolk."DirectoryListing" p JOIN finfolk."AccessRole" a ON a.access_id=p.access_id AND a.class_table=p.class_table AND a.class_context=p.class_context
 WHERE a.member_id=actor AND a.is_active AND a.level IN ('owner','admin')),'[]'::jsonb),
 'claims',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'listing_id',p.id,'state',CASE r.status WHEN 'accepted' THEN 'approved' ELSE r.status::text END,
 'challenge',r.detail->>'challenge','expires_at',r.expires_at)) FROM finfolk."AccessRequest" r
 JOIN finfolk."DirectoryListing" p ON p.access_id=r.access_id AND p.class_table=r.class_table AND p.class_context=r.class_context WHERE r.from_id=actor),'[]'::jsonb)) INTO result; RETURN result;
 ELSIF op='page-access' THEN
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid;
 IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND is_active AND level IN ('owner','admin')) THEN
 RAISE EXCEPTION 'You do not manage this page' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('role',(SELECT level FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND is_active),
 'admins',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.member_id,'name',coalesce(u.profile->>'displayName','Diver')))
 FROM finfolk."AccessRole" a JOIN finfolk."User" u ON u.id=a.member_id WHERE a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=l.access_id AND a.is_active AND a.level='admin'),'[]'::jsonb),
 'invites','[]'::jsonb);
 ELSIF op='owner-create' THEN
 doc:=finfolk_rpc.directory_document(v->'document');
 -- Stable request identity is carried by the new page's own revision detail.
 ident:=(v->>'requestId')::uuid;
 IF ident IS NULL THEN RAISE EXCEPTION 'Page request identity required' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('directory-create:'||ident::text,0));
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE detail->>'creationRequest'=ident::text;
 IF FOUND THEN
 IF NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND level='owner' AND is_active)
 OR (l.detail-'creationRequest')<>doc THEN RAISE EXCEPTION 'Page request already used' USING ERRCODE='40001'; END IF;
 RETURN jsonb_build_object('id',l.id,'status',l.status); END IF;
 IF (SELECT count(*) FROM finfolk."AccessRole" a JOIN finfolk."DirectoryListing" p ON p.access_id=a.access_id AND p.class_table=a.class_table AND p.class_context=a.class_context
 WHERE a.member_id=actor AND a.level='owner' AND a.is_active AND p.status='candidate')>=10 THEN
 RAISE EXCEPTION 'Review your pending pages before creating another' USING ERRCODE='22023'; END IF;
 ctx:=finfolk.op_fn(op,actor,'{}');
 result:=finfolk_rpc.insert_directory_listing(doc||jsonb_build_object('creationRequest',ident),ctx);
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(result->>'id')::uuid;
 INSERT INTO finfolk."AccessRole"(class_table,class_context,access_id,member_id,level,op_created,time_created)
 VALUES('DirectoryListing','Global',l.access_id,actor,'owner',(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 RETURN jsonb_build_object('id',l.id,'status',l.status);
 ELSIF op='owner-save' THEN
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND is_active AND level IN ('owner','admin')) THEN
 RAISE EXCEPTION 'You do not manage this page' USING ERRCODE='42501'; END IF;
 SELECT index INTO rev FROM finfolk."Rev" WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 IF rev IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Page changed. Reload before saving' USING ERRCODE='40001'; END IF;
 -- Existing verified identities are retained; owners cannot replace them.
 IF coalesce(v->'document'->'socials','[]')<>'[]'::jsonb AND v->'document'->'socials' IS DISTINCT FROM finfolk.ret_social_urls(l.detail->'socials') THEN
 RAISE EXCEPTION 'Social identities require review' USING ERRCODE='42501'; END IF;
 doc:=finfolk_rpc.directory_document((v->'document')||'{"socials":[]}'::jsonb)||jsonb_build_object('socials',l.detail->'socials');
 IF l.detail ? 'creationRequest' THEN doc:=doc||jsonb_build_object('creationRequest',l.detail->'creationRequest'); END IF;
 ctx:=finfolk.op_fn(op,actor,'{}');
 UPDATE finfolk."DirectoryListing" SET detail=doc,op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=l.id;
 UPDATE finfolk."Rev" SET index=index+1,current=doc WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created)
 VALUES('DirectoryListing','Global',l.rev_id,rev+1,doc,(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,entry,op_created,time_created)
 VALUES('DirectoryListing','Global',l.audit_id,jsonb_build_object('event',op),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 RETURN jsonb_build_object('id',l.id);
 ELSIF op='claim' THEN
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF l.id IS NULL OR l.status<>'published' OR EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND level='owner' AND is_active) THEN
 RAISE EXCEPTION 'Page unavailable or already managed' USING ERRCODE='40001'; END IF;
 INSERT INTO finfolk."AccessRequest"(class_table,class_context,access_id,from_id,detail)
 VALUES('DirectoryListing','Global',l.access_id,actor,jsonb_build_object('challenge','FINFOLK-'||replace(gen_random_uuid()::text,'-','')))
 ON CONFLICT(class_table,class_context,access_id,from_id) WHERE status='pending'
 DO UPDATE SET detail=excluded.detail,expires_at=now()+interval '7 days' RETURNING * INTO req;
 RETURN jsonb_build_object('id',req.id,'challenge',req.detail->>'challenge','expires_at',req.expires_at);
 ELSIF op='report' THEN
 IF length(trim(coalesce(v->>'message','')))=0 OR length(v->>'message')>2000 THEN RAISE EXCEPTION 'Provide a correction reason' USING ERRCODE='22023'; END IF;
 IF finfolk_rpc.ret_directory_public((v->>'id')::uuid) IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO finfolk."DirectoryReport"(listing_id,author_id,message) VALUES((v->>'id')::uuid,actor,trim(v->>'message')); RETURN '{}'::jsonb;
 END IF;
 -- Review operations are deliberately explicit, never inferred from ownership.
 IF NOT adm THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF op='admin' THEN
 SELECT jsonb_build_object('listings',coalesce((SELECT jsonb_agg(finfolk_rpc.directory_owner_row(p)||jsonb_build_object('notes',p.notes,'outreach',p.outreach)) FROM finfolk."DirectoryListing" p),'[]'),
 'claims',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'listing_id',p.id,'user_id',r.from_id,'state',CASE r.status WHEN 'accepted' THEN 'approved' ELSE r.status::text END,'challenge',r.detail->>'challenge','expires_at',r.expires_at))
 FROM finfolk."AccessRequest" r JOIN finfolk."DirectoryListing" p ON p.access_id=r.access_id AND p.class_table=r.class_table AND p.class_context=r.class_context),'[]'),
 'reports',coalesce((SELECT jsonb_agg(r) FROM finfolk."DirectoryReport" r WHERE NOT r.resolved),'[]'),'runs','[]'::jsonb,'audit','[]'::jsonb) INTO result; RETURN result;
 ELSIF op='admin-save' THEN
 IF NOT coalesce(v->>'status'=ANY(ARRAY['candidate','published','rejected','archived','suppressed']),false) THEN RAISE EXCEPTION 'Choose a publication status' USING ERRCODE='22023'; END IF;
 IF coalesce((v->>'revokeOwner')::boolean,false) THEN RAISE EXCEPTION 'Ownership revocation is not available in this native pilot' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF;
 SELECT index INTO rev FROM finfolk."Rev" WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 IF rev IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Page changed. Reload before saving' USING ERRCODE='40001'; END IF;
 -- Publication uses the existing reviewed document. Editing uses the owner path.
 IF ((v->'document')-'socials'-'creationRequest') IS DISTINCT FROM (l.detail-'socials'-'creationRequest') THEN
 RAISE EXCEPTION 'Save page edits before publication review' USING ERRCODE='22023'; END IF;
 IF v->>'status'='published' AND jsonb_array_length(l.detail->'sources')=0 AND jsonb_array_length(l.detail->'socials')=0 THEN
 RAISE EXCEPTION 'Publication sources required' USING ERRCODE='22023'; END IF;
 ctx:=finfolk.op_fn(op,actor,'{}');
 UPDATE finfolk."DirectoryListing" SET status=(v->>'status')::finfolk."EnumDirectoryListingStatus",reviewed_at=now(),notes=left(coalesce(v->>'notes',''),2000),
 outreach=left(coalesce(v->>'outreach','Not contacted'),100),op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=l.id;
 UPDATE finfolk."Rev" SET index=index+1 WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created)
 VALUES('DirectoryListing','Global',l.rev_id,rev+1,jsonb_build_object('status',v->>'status'),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,entry,op_created,time_created)
 VALUES('DirectoryListing','Global',l.audit_id,jsonb_build_object('event',op,'status',v->>'status'),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 RETURN jsonb_build_object('id',l.id);
 ELSIF op='claim-review' THEN
 SELECT * INTO req FROM finfolk."AccessRequest" WHERE id=(v->>'id')::uuid AND class_table='DirectoryListing' AND class_context='Global' FOR UPDATE;
 IF req.id IS NULL OR req.status<>'pending' THEN RAISE EXCEPTION 'Claim no longer pending' USING ERRCODE='40001'; END IF;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE access_id=req.access_id FOR UPDATE;
 IF coalesce((v->>'approve')::boolean,false) THEN
 IF req.expires_at<=now() OR length(trim(coalesce(v->>'evidence','')))=0 THEN RAISE EXCEPTION 'Challenge expired or verification evidence missing' USING ERRCODE='22023'; END IF;
 IF l.status<>'published' OR EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND level='owner' AND is_active) THEN
 RAISE EXCEPTION 'Page already managed or unavailable' USING ERRCODE='40001'; END IF;
 INSERT INTO finfolk."AccessRole"(class_table,class_context,access_id,member_id,from_id,level)
 VALUES('DirectoryListing','Global',l.access_id,req.from_id,actor,'owner')
 ON CONFLICT(class_table,class_context,access_id,member_id) DO UPDATE SET level='owner',is_active=true,from_id=actor;
 END IF;
 UPDATE finfolk."AccessRequest" SET status=CASE WHEN coalesce((v->>'approve')::boolean,false) THEN 'accepted'::finfolk."EnumAccessRequestStatus" ELSE 'rejected'::finfolk."EnumAccessRequestStatus" END,
 reply_id=actor,detail=detail||jsonb_build_object('evidence',left(coalesce(v->>'evidence',''),2000)) WHERE class_table='DirectoryListing' AND class_context='Global' AND id=req.id AND access_id=req.access_id;
 RETURN '{}'::jsonb;
 ELSIF op='report-resolve' THEN
 UPDATE finfolk."DirectoryReport" SET resolved=true WHERE id=(v->>'id')::uuid; RETURN '{}'::jsonb;
 END IF;
 RAISE EXCEPTION 'This directory operation is not available on the native database' USING ERRCODE='22023';
END $$ LANGUAGE plpgsql;

REVOKE ALL ON ALL TABLES IN SCHEMA finfolk FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_api;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_directory') THEN CREATE ROLE finfolk_directory NOLOGIN NOINHERIT; END IF; END $$;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc,neon_auth TO finfolk_directory;
GRANT SELECT,INSERT,UPDATE ON finfolk."DirectoryListing",finfolk."DirectoryReport",finfolk."Access",finfolk."AccessRole",finfolk."AccessRequest",finfolk."Rev",finfolk."RevLog",finfolk."Audit",finfolk."AuditLog",finfolk."Social",finfolk."Op",finfolk."User",finfolk."Activity",finfolk."ActivityLog" TO finfolk_directory;
GRANT SELECT(id) ON finfolk."DatabaseRelease" TO finfolk_directory;
GRANT SELECT(id,"emailVerified",banned) ON neon_auth."user" TO finfolk_directory;
GRANT EXECUTE ON FUNCTION finfolk.auth_uid(),finfolk.as_jsonb(jsonb),finfolk.op_fn(text,text,jsonb),finfolk.insert_base_addons(text,text,jsonb,jsonb),finfolk.ret_social_url(text),finfolk.ret_social_urls(jsonb),finfolk_rpc.insert_user(text,jsonb,jsonb),finfolk_rpc.insert_directory_listing(jsonb,jsonb),finfolk_rpc.ret_directory_public(uuid),finfolk_rpc.directory_document(jsonb),finfolk_rpc.directory_owner_row(finfolk."DirectoryListing"),finfolk_rpc.directory_operation(text,jsonb) TO finfolk_directory;
COMMIT;
