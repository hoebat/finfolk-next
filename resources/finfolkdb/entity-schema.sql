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
    'SiteNote',
    'Social',
    'SocialAccount',
    'SocialAction',
    'SocialConnection',
    'SocialDiscovery',
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

-- finfolkdb.common.type-system-seed/as-bounded-text 
CREATE OR REPLACE FUNCTION "finfolk".as_bounded_text(
  input TEXT,
  minimum INTEGER,
  maximum INTEGER
) RETURNS TEXT AS $$
BEGIN
  IF (length(btrim(input)) < minimum) OR (length(input) > maximum) THEN
    RAISE EXCEPTION 'Text length is outside the permitted bounds';
  END IF;
  RETURN input;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-system-seed/as-finite-date 
CREATE OR REPLACE FUNCTION "finfolk".as_finite_date(
  input DATE
) RETURNS DATE AS $$
BEGIN
  IF input IS NOT NULL AND NOT "isfinite"(input) THEN
    RAISE EXCEPTION 'A finite date is required';
  END IF;
  RETURN input;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-system-seed/as-bounded-integer 
CREATE OR REPLACE FUNCTION "finfolk".as_bounded_integer(
  input INTEGER,
  minimum INTEGER,
  maximum INTEGER
) RETURNS INTEGER AS $$
BEGIN
  IF (input < minimum) OR (input > maximum) THEN
    RAISE EXCEPTION 'Integer is outside the permitted bounds';
  END IF;
  RETURN input;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.common.type-system-site/Site 
CREATE TABLE IF NOT EXISTS "finfolk"."Site" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "area_name" TEXT NOT NULL DEFAULT '',
  "state" TEXT NOT NULL DEFAULT '',
  UNIQUE ("key")
);

-- finfolkdb.common.type-system-base/Op 
CREATE TABLE IF NOT EXISTS "finfolk"."Op" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "time" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "tag" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "user_id" UUID
);

-- finfolkdb.common.type-system-base/Rev 
CREATE TABLE IF NOT EXISTS "finfolk"."Rev" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "class_ref" UUID NOT NULL,
  "index" INTEGER NOT NULL DEFAULT 0,
  "current" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context),
  UNIQUE ("class_table","class_context","class_ref")
);

-- finfolkdb.common.type-system-base/RevLog 
CREATE TABLE IF NOT EXISTS "finfolk"."RevLog" (
  "id" UUID DEFAULT uuid_generate_v1(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "rev_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "deltas" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context,rev_id),
  UNIQUE ("class_table","class_context","rev_id","version"),
  CONSTRAINT fk_rev_log_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id) ON DELETE CASCADE
);

-- finfolkdb.common.type-system-base/Audit 
CREATE TABLE IF NOT EXISTS "finfolk"."Audit" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "class_ref" UUID NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context),
  UNIQUE ("class_table","class_context","class_ref")
);

-- finfolkdb.common.type-system-base/AuditLog 
CREATE TABLE IF NOT EXISTS "finfolk"."AuditLog" (
  "id" UUID DEFAULT uuid_generate_v1(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "audit_id" UUID NOT NULL,
  "entry" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID NOT NULL,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table,class_context,audit_id),
  UNIQUE ("class_table","class_context","audit_id","op_created"),
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
  i_class_ref UUID
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
  "class_ref" UUID NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  UNIQUE ("class_table","class_ref")
);

-- finfolkdb.common.type-system-base/op-fn 
CREATE OR REPLACE FUNCTION "finfolk".op_fn(
  i_tag TEXT,
  i_user_id UUID,
  i_data JSONB
) RETURNS JSONB AS $$

  WITH j_ret AS (  
    INSERT INTO "finfolk"."Op" ("tag","data","user_id") VALUES (
      (i_tag)::TEXT,
      ("finfolk".as_jsonb(i_data))::JSONB,
      (i_user_id)::UUID
    ) RETURNING "id","time","tag","data","user_id")
  SELECT to_jsonb(j_ret) FROM j_ret;

$$ LANGUAGE 'sql';

-- finfolkdb.common.type-domain-enum/EnumSocialProvider 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialProvider" AS ENUM ('instagram','tiktok','mock');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialConnectionStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialConnectionStatus" AS ENUM ('pending','active','expired','revoked','failed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialProofKind 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialProofKind" AS ENUM ('oauth','message','comment','manual');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialProofStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialProofStatus" AS ENUM ('pending','verified','consumed','expired','revoked','rejected');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialSourceKind 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialSourceKind" AS ENUM ('account','tags','hashtag','recheck');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialSourceStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialSourceStatus" AS ENUM ('ready','paused','failed');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialActionKind 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialActionKind" AS ENUM ('reply','stats','dive','points','verify-account','prepare-link');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialDiscoveryStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialDiscoveryStatus" AS ENUM ('pending','published','hidden','rejected','unavailable');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialDiscoveryReportReason 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialDiscoveryReportReason" AS ENUM ('wrong_location','inappropriate','removed','other');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialCommandContext 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialCommandContext" AS ENUM ('mention','owned','message');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialCommandStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialCommandStatus" AS ENUM ('new',
    'confirmation',
    'done',
    'cancelled',
    'limited',
    'waiting',
    'expired',
    'rejected');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-domain-enum/EnumSocialCommandSendState 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSocialCommandSendState" AS ENUM ('pending','sending','sent','uncertain','skipped');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('User')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "profile" JSONB NOT NULL DEFAULT '{}',
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "invite_eligible" BOOLEAN NOT NULL DEFAULT false,
  "joined_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "owner_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  UNIQUE ("owner_id","target_id"),
  CONSTRAINT different_users CHECK ("owner_id" != "target_id")
);

-- finfolkdb.common.type-user/UserCheckin 
CREATE TABLE IF NOT EXISTS "finfolk"."UserCheckin" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "visit_day" DATE NOT NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "checked_in_at" BIGINT,
  "checked_out_at" BIGINT,
  UNIQUE ("user_id","site_id","visit_day"),
  CONSTRAINT valid_checkout CHECK ("checked_out_at" IS NULL OR ("checked_in_at" IS NOT NULL AND ("checked_out_at" >= "checked_in_at")))
);

-- finfolkdb.common.type-user/UserConnection 
CREATE TABLE IF NOT EXISTS "finfolk"."UserConnection" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "requested_by_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumUserConnectionStatus" NOT NULL,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("user_id","target_id"),
  CONSTRAINT ordered_users CHECK ("user_id" < "target_id"),
  CONSTRAINT valid_requester CHECK (("requested_by_id" = "user_id") OR ("requested_by_id" = "target_id"))
);

-- finfolkdb.common.type-social-account/SocialAccount 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialAccount" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialAccount')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "provider" "finfolk"."EnumSocialProvider" NOT NULL,
  "namespace" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "handle" TEXT NOT NULL DEFAULT '',
  "display_name" TEXT NOT NULL DEFAULT '',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "provider_data" JSONB NOT NULL DEFAULT '{}',
  "audit_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("provider","namespace","external_id"),
  UNIQUE ("audit_id"),
  CONSTRAINT nonempty_namespace CHECK (length(btrim("namespace")) > 0),
  CONSTRAINT nonempty_external_id CHECK (length(btrim("external_id")) > 0),
  CONSTRAINT positive_generation CHECK ("generation" > 0),
  CONSTRAINT object_provider_data CHECK (jsonb_typeof("provider_data") = 'object'),
  CONSTRAINT fk_social_account_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);

-- finfolkdb.common.type-social-account/SocialConnection 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialConnection" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialConnection')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "account_id" UUID NOT NULL REFERENCES "finfolk"."SocialAccount"("id"),
  "status" "finfolk"."EnumSocialConnectionStatus" NOT NULL DEFAULT 'pending',
  "identity_version" UUID NOT NULL DEFAULT gen_random_uuid(),
  "generation" INTEGER NOT NULL DEFAULT 1,
  "credential_ciphertext" TEXT,
  "access_expires_at" BIGINT,
  "refresh_expires_at" BIGINT,
  "credential_lease" UUID,
  "lease_until" BIGINT,
  "share_posts" BOOLEAN NOT NULL DEFAULT false,
  "public_points" BOOLEAN NOT NULL DEFAULT false,
  "capabilities" JSONB NOT NULL DEFAULT '[]',
  "granted_scopes" JSONB NOT NULL DEFAULT '[]',
  "cursor" TEXT,
  "last_success" BIGINT,
  "next_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "provider_data" JSONB NOT NULL DEFAULT '{}',
  "audit_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("id","user_id"),
  UNIQUE ("audit_id"),
  CONSTRAINT positive_generation CHECK ("generation" > 0),
  CONSTRAINT nonnegative_failures CHECK ("failures" >= 0),
  CONSTRAINT array_capabilities CHECK (jsonb_typeof("capabilities") = 'array'),
  CONSTRAINT array_scopes CHECK (jsonb_typeof("granted_scopes") = 'array'),
  CONSTRAINT object_provider_data CHECK (jsonb_typeof("provider_data") = 'object'),
  CONSTRAINT paired_lease CHECK (("credential_lease" IS NULL AND "lease_until" IS NULL) OR ("credential_lease" IS NOT NULL AND "lease_until" IS NOT NULL)),
  CONSTRAINT revoked_private CHECK (("status" != 'revoked') OR ("credential_ciphertext" IS NULL AND "credential_lease" IS NULL AND NOT "share_posts" AND NOT "public_points")),
  CONSTRAINT fk_social_connection_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."SocialConnection" ("user_id");
CREATE INDEX ON "finfolk"."SocialConnection" ("account_id");

-- finfolkdb.common.type-social-account/__social_connection_indexes__ 
CREATE UNIQUE INDEX IF NOT EXISTS "SocialConnectionCurrentAccount" ON "finfolk"."SocialConnection" ("account_id") WHERE "status" != 'revoked';

-- finfolkdb.common.type-site-note/EnumSiteNoteTopic 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumSiteNoteTopic" AS ENUM ('access','facilities','wildlife','conditions');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-site-note/SiteNote 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNote" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SiteNote')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id") ON DELETE CASCADE,
  "author_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "topic" "finfolk"."EnumSiteNoteTopic" NOT NULL,
  "body" TEXT NOT NULL CHECK ("body" = "finfolk".as_bounded_text("body",10,1000)),
  "observed_on" DATE CHECK ("observed_on" = "finfolk".as_finite_date("observed_on")),
  "withdrawn" BOOLEAN NOT NULL DEFAULT false,
  "hidden" BOOLEAN NOT NULL DEFAULT false,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("rev_id"),
  CONSTRAINT observation_required CHECK (("topic" != 'conditions') OR "observed_on" IS NOT NULL),
  CONSTRAINT fk_site_note_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."SiteNote" ("site_id");
CREATE INDEX ON "finfolk"."SiteNote" ("author_id");

-- finfolkdb.common.type-site-note/SiteNoteVote 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNoteVote" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "note_id" UUID NOT NULL REFERENCES "finfolk"."SiteNote"("id") ON DELETE CASCADE,
  "voter_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("note_id","voter_id")
);
CREATE INDEX ON "finfolk"."SiteNoteVote" ("voter_id");

-- finfolkdb.common.type-site-note/SiteNoteReport 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteNoteReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "note_id" UUID NOT NULL REFERENCES "finfolk"."SiteNote"("id") ON DELETE CASCADE,
  "reporter_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL CHECK ("reason" = "finfolk".as_bounded_text("reason",1,1000)),
  "resolved_at" BIGINT,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("note_id","reporter_id")
);
CREATE INDEX ON "finfolk"."SiteNoteReport" ("reporter_id");

-- finfolkdb.common.type-social-base/Social 
CREATE TABLE IF NOT EXISTS "finfolk"."Social" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_ref" UUID NOT NULL,
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  UNIQUE ("class_table","class_ref")
);

-- finfolkdb.common.type-social-base/SocialHandle 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialHandle" (
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "social_id" UUID NOT NULL,
  "account_id" UUID REFERENCES "finfolk"."SocialAccount"("id"),
  "type" "finfolk"."EnumSocialProvider" NOT NULL,
  "handle" TEXT NOT NULL,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "verified_at" BIGINT,
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

-- finfolkdb.common.type-social-post/SocialPost 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialPost" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialPost')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "url" TEXT NOT NULL,
  "platform" "finfolk"."EnumSocialProvider" NOT NULL,
  "creator_handle" TEXT NOT NULL DEFAULT '',
  "status" "finfolk"."EnumSocialPostStatus" NOT NULL DEFAULT 'pending',
  "public_consent" BOOLEAN NOT NULL DEFAULT false,
  "rejection_reason" TEXT NOT NULL DEFAULT '',
  "reviewed_by_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "reviewed_at" BIGINT,
  "audit_id" UUID NOT NULL,
  "rev_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("owner_id","site_id","url"),
  UNIQUE ("audit_id"),
  UNIQUE ("rev_id"),
  CONSTRAINT fk_social_post_rev FOREIGN KEY (class_table,class_context,rev_id) REFERENCES "finfolk"."Rev"(class_table,class_context,id),
  CONSTRAINT fk_social_post_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);
CREATE INDEX ON "finfolk"."SocialPost" ("owner_id");
CREATE INDEX ON "finfolk"."SocialPost" ("site_id");
CREATE INDEX ON "finfolk"."SocialPost" ("status");

-- finfolkdb.common.type-social-post/SocialPostReport 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialPostReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "post_id" UUID NOT NULL REFERENCES "finfolk"."SocialPost"("id") ON DELETE CASCADE,
  "reporter_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reason" TEXT NOT NULL,
  "status" "finfolk"."EnumSocialPostReportStatus" NOT NULL DEFAULT 'open',
  "resolved_by_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "resolved_at" BIGINT,
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "day" DATE NOT NULL DEFAULT ("timezone"(
    'Australia/Sydney',
    to_timestamp((1000000 * extract(epoch FROM now()))::BIGINT / 1000000.0)
  ))::DATE,
  "platform" "finfolk"."EnumSocialProvider" NOT NULL,
  "clicks" BIGINT NOT NULL DEFAULT 0,
  UNIQUE ("day","platform")
);

-- finfolkdb.common.type-logbook-base/DiveSession 
CREATE TABLE IF NOT EXISTS "finfolk"."DiveSession" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('DiveSession')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "site_id" UUID REFERENCES "finfolk"."Site"("id"),
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
CREATE INDEX ON "finfolk"."DiveSession" ("site_id");

-- finfolkdb.common.type-messaging-base/EnumMessagingProvider 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumMessagingProvider" AS ENUM ('instagram','tiktok','app','mock');
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "name" TEXT NOT NULL,
  UNIQUE ("key")
);

-- finfolkdb.common.type-messaging-base/MessagingAccount 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingAccount" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "social_account_id" UUID REFERENCES "finfolk"."SocialAccount"("id"),
  "key" TEXT,
  "application_id" UUID NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "provider" "finfolk"."EnumMessagingProvider" NOT NULL,
  "account_id" TEXT NOT NULL,
  "username" TEXT,
  "credential_ciphertext" TEXT,
  "token_expires_at" BIGINT,
  "credential_lease" UUID,
  "credential_lease_until" BIGINT,
  "mode" "finfolk"."EnumMessagingAccountMode" NOT NULL DEFAULT 'disabled',
  "enabled_commands" JSONB NOT NULL DEFAULT '["ping", "help"]',
  "pilot_sender_ids" JSONB NOT NULL DEFAULT '[]',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "checks" JSONB NOT NULL DEFAULT '{}',
  "last_webhook_at" BIGINT,
  "last_command_at" BIGINT,
  "last_reply_at" BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "backoff_until" BIGINT,
  "action_checkpoint" UUID,
  "delivery_checkpoint" UUID,
  "event_checkpoint" UUID,
  "proof_checkpoint" UUID,
  "provider_scope" TEXT,
  UNIQUE ("id","application_id"),
  UNIQUE ("key"),
  UNIQUE ("application_id","provider","account_id"),
  CONSTRAINT credential_lease_pair CHECK (("credential_lease" IS NULL AND "credential_lease_until" IS NULL) OR ("credential_lease" IS NOT NULL AND "credential_lease_until" IS NOT NULL)),
  CONSTRAINT positive_generation CHECK ("generation" > 0),
  CONSTRAINT commands_array CHECK (jsonb_typeof("enabled_commands") = 'array'),
  CONSTRAINT pilot_array CHECK (jsonb_typeof("pilot_sender_ids") = 'array')
);
CREATE INDEX ON "finfolk"."MessagingAccount" ("social_account_id");
CREATE INDEX ON "finfolk"."MessagingAccount" ("application_id");

-- finfolkdb.common.type-messaging-base/MessagingAudit 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingAudit" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "actor" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "correlation_id" UUID NOT NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT
);
CREATE INDEX ON "finfolk"."MessagingAudit" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingIdempotency 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingIdempotency" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "application_id" UUID NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "key_hash" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "response_ciphertext" TEXT,
  "response_status" INTEGER NOT NULL,
  "expires_at" BIGINT NOT NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("application_id","user_id","key_hash")
);

-- finfolkdb.common.type-messaging-base/MessagingOauthState 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingOauthState" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "application_id" UUID NOT NULL REFERENCES "finfolk"."MessagingApplication"("id"),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "state_hash" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "expires_at" BIGINT NOT NULL,
  "consumed_at" BIGINT,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "flow_key" TEXT NOT NULL,
  UNIQUE ("application_id","state_hash"),
  CONSTRAINT fk_messaging_oauth_state_account_scope FOREIGN KEY (application_id,account_id) REFERENCES "finfolk"."MessagingAccount"(application_id,id)
);
CREATE INDEX ON "finfolk"."MessagingOauthState" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingIdentity 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingIdentity" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "social_account_id" UUID REFERENCES "finfolk"."SocialAccount"("id"),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "external_id" TEXT NOT NULL,
  "user_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  UNIQUE ("id","account_id"),
  UNIQUE ("account_id","external_id")
);
CREATE INDEX ON "finfolk"."MessagingIdentity" ("account_id");

-- finfolkdb.common.type-messaging-base/MessagingConversation 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingConversation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
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
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "conversation_id" UUID NOT NULL REFERENCES "finfolk"."MessagingConversation"("id"),
  "direction" "finfolk"."EnumMessagingDirection" NOT NULL,
  "external_id" TEXT,
  "body" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "sent_at" BIGINT,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
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
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "external_event_id" TEXT NOT NULL,
  "message_id" UUID NOT NULL REFERENCES "finfolk"."MessagingMessage"("id"),
  "status" "finfolk"."EnumMessagingReceiptStatus" NOT NULL DEFAULT 'received',
  "generation" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease" UUID,
  "lease_until" BIGINT,
  "next_attempt_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "deadline" BIGINT NOT NULL,
  "result" JSONB NOT NULL DEFAULT '{}',
  "correlation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
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

-- finfolkdb.common.type-messaging-base/__work_indexes__ 
CREATE INDEX IF NOT EXISTS "MessagingReceipt_ready" ON "finfolk"."MessagingReceipt" ("account_id","status","next_attempt_at");
CREATE INDEX IF NOT EXISTS "MessagingMessage_history" ON "finfolk"."MessagingMessage" ("conversation_id","time_created","id");

-- finfolkdb.common.type-social-workflow/SocialEvent 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialEvent" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "provider" "finfolk"."EnumSocialProvider" NOT NULL,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "account_id" UUID REFERENCES "finfolk"."SocialAccount"("id"),
  "inbox_id" UUID REFERENCES "finfolk"."MessagingAccount"("id"),
  "message_id" UUID REFERENCES "finfolk"."MessagingMessage"("id"),
  "channel" "finfolk"."EnumSocialCommandContext" NOT NULL DEFAULT 'message',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "account_generation" INTEGER NOT NULL DEFAULT 1,
  "fingerprint" TEXT,
  "sent_at" BIGINT,
  "deadline" BIGINT,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("id","inbox_id"),
  UNIQUE ("id","account_id"),
  UNIQUE ("provider","namespace","key"),
  CONSTRAINT nonnegative_attempts CHECK ("attempts" >= 0)
);
CREATE INDEX ON "finfolk"."SocialEvent" ("inbox_id");

-- finfolkdb.common.type-social-workflow/SocialConnectionProof 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialConnectionProof" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."SocialAccount"("id"),
  "user_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "connection_id" UUID REFERENCES "finfolk"."SocialConnection"("id"),
  "event_id" UUID REFERENCES "finfolk"."SocialEvent"("id"),
  "inbox_id" UUID REFERENCES "finfolk"."MessagingAccount"("id"),
  "receipt_id" UUID REFERENCES "finfolk"."MessagingReceipt"("id"),
  "kind" "finfolk"."EnumSocialProofKind" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "nonce_hash" TEXT,
  "flow_key" TEXT,
  "generation" INTEGER NOT NULL,
  "status" "finfolk"."EnumSocialProofStatus" NOT NULL DEFAULT 'pending',
  "expires_at" BIGINT NOT NULL,
  "verified_at" BIGINT,
  "consumed_at" BIGINT,
  "consumed_version" UUID,
  "error" TEXT NOT NULL DEFAULT '',
  "provider_data" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("token_hash"),
  CONSTRAINT hashed_token CHECK ("regexp_like"("token_hash",'^[a-f0-9]{64}$')),
  CONSTRAINT positive_generation CHECK ("generation" > 0),
  CONSTRAINT oauth_binding CHECK (("kind" != 'oauth') OR ("nonce_hash" IS NOT NULL AND "flow_key" IS NOT NULL AND "regexp_like"("nonce_hash",'^[a-f0-9]{64}$') AND "regexp_like"("flow_key",'^[a-f0-9]{64}$'))),
  CONSTRAINT consumed_bound CHECK (("status" != 'consumed') OR ("user_id" IS NOT NULL AND "connection_id" IS NOT NULL AND "consumed_at" IS NOT NULL AND "consumed_version" IS NOT NULL)),
  CONSTRAINT verified_evidence CHECK ((("status" != 'verified') AND ("status" != 'consumed')) OR "verified_at" IS NOT NULL),
  CONSTRAINT object_provider_data CHECK (jsonb_typeof("provider_data") = 'object'),
  CONSTRAINT fk_social_connection_proof_event_account FOREIGN KEY (account_id,event_id) REFERENCES "finfolk"."SocialEvent"(account_id,id),
  CONSTRAINT fk_social_connection_proof_event_inbox FOREIGN KEY (event_id,inbox_id) REFERENCES "finfolk"."SocialEvent"(id,inbox_id)
);
CREATE INDEX ON "finfolk"."SocialConnectionProof" ("account_id");
CREATE INDEX ON "finfolk"."SocialConnectionProof" ("inbox_id");

-- finfolkdb.common.type-social-workflow/SocialSource 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialSource" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "provider" "finfolk"."EnumSocialProvider" NOT NULL,
  "namespace" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "account_id" UUID REFERENCES "finfolk"."SocialAccount"("id"),
  "kind" "finfolk"."EnumSocialSourceKind" NOT NULL,
  "configuration" JSONB NOT NULL DEFAULT '{}',
  "checkpoint" TEXT,
  "last_success" BIGINT,
  "next_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "lease" UUID,
  "lease_until" BIGINT,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "status" "finfolk"."EnumSocialSourceStatus" NOT NULL DEFAULT 'ready',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("provider","namespace","key"),
  CONSTRAINT object_configuration CHECK (jsonb_typeof("configuration") = 'object'),
  CONSTRAINT nonnegative_failures CHECK ("failures" >= 0),
  CONSTRAINT paired_lease CHECK (("lease" IS NULL AND "lease_until" IS NULL) OR ("lease" IS NOT NULL AND "lease_until" IS NOT NULL))
);

-- finfolkdb.common.type-social-workflow/SocialSuppressedSource 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialSuppressedSource" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "provider" "finfolk"."EnumSocialProvider" NOT NULL,
  "namespace" TEXT NOT NULL,
  "external_author_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("provider","namespace","external_author_id")
);

-- finfolkdb.common.type-social-workflow/SocialDiscovery 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialDiscovery" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialDiscovery')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "account_id" UUID NOT NULL REFERENCES "finfolk"."SocialAccount"("id"),
  "source_id" UUID REFERENCES "finfolk"."SocialSource"("id"),
  "external_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "owner_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "site_id" UUID REFERENCES "finfolk"."Site"("id"),
  "post_id" UUID REFERENCES "finfolk"."SocialPost"("id"),
  "candidates" JSONB NOT NULL DEFAULT '[]',
  "caption" TEXT NOT NULL DEFAULT '',
  "posted_at" BIGINT,
  "state" "finfolk"."EnumSocialDiscoveryStatus" NOT NULL DEFAULT 'pending',
  "automatic" BOOLEAN NOT NULL DEFAULT false,
  "sources" JSONB NOT NULL DEFAULT '[]',
  "checked_at" BIGINT,
  "provider_data" JSONB NOT NULL DEFAULT '{}',
  "audit_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("account_id","external_id"),
  UNIQUE ("audit_id"),
  CONSTRAINT array_candidates CHECK (jsonb_typeof("candidates") = 'array'),
  CONSTRAINT array_sources CHECK (jsonb_typeof("sources") = 'array'),
  CONSTRAINT object_provider_data CHECK (jsonb_typeof("provider_data") = 'object'),
  CONSTRAINT published_post CHECK (("state" != 'published') OR "post_id" IS NOT NULL),
  CONSTRAINT fk_social_discovery_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id)
);

-- finfolkdb.common.type-social-workflow/SocialDiscoveryReport 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialDiscoveryReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "discovery_id" UUID NOT NULL REFERENCES "finfolk"."SocialDiscovery"("id") ON DELETE CASCADE,
  "reason" "finfolk"."EnumSocialDiscoveryReportReason" NOT NULL,
  "day" DATE NOT NULL DEFAULT (now())::DATE,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("discovery_id","reason","day")
);

-- finfolkdb.common.type-social-workflow/SocialCommand 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialCommand" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "event_id" UUID REFERENCES "finfolk"."SocialEvent"("id"),
  "inbox_id" UUID REFERENCES "finfolk"."MessagingAccount"("id"),
  "generation" INTEGER NOT NULL DEFAULT 1,
  "account_id" UUID NOT NULL REFERENCES "finfolk"."SocialAccount"("id"),
  "key" TEXT NOT NULL,
  "context" "finfolk"."EnumSocialCommandContext" NOT NULL,
  "external_actor_id" TEXT NOT NULL,
  "external_media_id" TEXT,
  "owner_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "connection_id" UUID REFERENCES "finfolk"."SocialConnection"("id"),
  "identity_version" UUID,
  "command" TEXT NOT NULL,
  "args" JSONB NOT NULL DEFAULT '{}',
  "source_url" TEXT,
  "comment_at" BIGINT,
  "received_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "state" "finfolk"."EnumSocialCommandStatus" NOT NULL DEFAULT 'new',
  "result" JSONB NOT NULL DEFAULT '{}',
  "site_id" UUID REFERENCES "finfolk"."Site"("id"),
  "visit_day" DATE,
  "reply" TEXT,
  "send_state" "finfolk"."EnumSocialCommandSendState" NOT NULL DEFAULT 'pending',
  "external_reply_id" TEXT,
  "send_started_at" BIGINT,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("id","inbox_id"),
  UNIQUE ("id","event_id"),
  UNIQUE ("id","account_id"),
  UNIQUE ("event_id"),
  UNIQUE ("account_id","key"),
  CONSTRAINT object_args CHECK (jsonb_typeof("args") = 'object'),
  CONSTRAINT fk_social_command_source_inbox FOREIGN KEY (event_id,inbox_id) REFERENCES "finfolk"."SocialEvent"(id,inbox_id),
  CONSTRAINT fk_social_command_source_account FOREIGN KEY (event_id,account_id) REFERENCES "finfolk"."SocialEvent"(id,account_id)
);

-- finfolkdb.common.type-social-workflow/SocialAction 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialAction" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('SocialAction')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "event_id" UUID REFERENCES "finfolk"."SocialEvent"("id"),
  "command_id" UUID REFERENCES "finfolk"."SocialCommand"("id"),
  "inbox_id" UUID REFERENCES "finfolk"."MessagingAccount"("id"),
  "generation" INTEGER NOT NULL DEFAULT 1,
  "account_generation" INTEGER NOT NULL DEFAULT 1,
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" = "finfolk".as_bounded_integer("attempts",0,2147483647)),
  "lease" UUID,
  "lease_until" BIGINT,
  "deadline" BIGINT,
  "next_attempt_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "error_code" TEXT,
  "result" JSONB NOT NULL DEFAULT '{}' CHECK ("result" = "finfolk".as_jsonb("result")),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."SocialAccount"("id"),
  "source_id" TEXT NOT NULL,
  "kind" "finfolk"."EnumSocialActionKind" NOT NULL,
  "owner_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'review',
  "data" JSONB NOT NULL DEFAULT '{}' CHECK ("data" = "finfolk".as_jsonb("data")),
  "member_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "session_id" UUID REFERENCES "finfolk"."DiveSession"("id"),
  "audit_id" UUID NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("account_id","source_id","kind"),
  UNIQUE ("audit_id"),
  CONSTRAINT paired_lease CHECK (("lease" IS NULL AND "lease_until" IS NULL) OR ("lease" IS NOT NULL AND "lease_until" IS NOT NULL)),
  CONSTRAINT running_lease CHECK ((("state" = 'running') AND "lease" IS NOT NULL) OR (("state" != 'running') AND "lease" IS NULL)),
  CONSTRAINT fk_social_action_audit FOREIGN KEY (class_table,class_context,audit_id) REFERENCES "finfolk"."Audit"(class_table,class_context,id),
  CONSTRAINT fk_social_action_command_event FOREIGN KEY (event_id,command_id) REFERENCES "finfolk"."SocialCommand"(event_id,id),
  CONSTRAINT fk_social_action_command_inbox FOREIGN KEY (command_id,inbox_id) REFERENCES "finfolk"."SocialCommand"(id,inbox_id),
  CONSTRAINT fk_social_action_command_account FOREIGN KEY (command_id,account_id) REFERENCES "finfolk"."SocialCommand"(id,account_id)
);
CREATE INDEX ON "finfolk"."SocialAction" ("inbox_id");

-- finfolkdb.common.type-social-workflow/__action_indexes__ 
CREATE INDEX IF NOT EXISTS "SocialAction_ready" ON "finfolk"."SocialAction" ("inbox_id","state","next_attempt_at");

-- finfolkdb.common.type-social-workflow/SocialRateLimit 
CREATE TABLE IF NOT EXISTS "finfolk"."SocialRateLimit" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "provider" "finfolk"."EnumSocialProvider" NOT NULL,
  "namespace" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resets_at" BIGINT NOT NULL,
  "prompted_at" BIGINT,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("provider","namespace","purpose","bucket"),
  CONSTRAINT nonnegative_count CHECK ("count" >= 0)
);

-- finfolkdb.common.type-messaging-delivery/MessagingOutbox 
CREATE TABLE IF NOT EXISTS "finfolk"."MessagingOutbox" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."MessagingAccount"("id"),
  "event_id" UUID REFERENCES "finfolk"."SocialEvent"("id"),
  "command_id" UUID REFERENCES "finfolk"."SocialCommand"("id"),
  "channel" "finfolk"."EnumSocialCommandContext" NOT NULL DEFAULT 'message',
  "recipient" TEXT,
  "thread" TEXT,
  "comment" TEXT,
  "receipt_id" UUID REFERENCES "finfolk"."MessagingReceipt"("id"),
  "message_id" UUID REFERENCES "finfolk"."MessagingMessage"("id"),
  "body" TEXT NOT NULL CHECK ("body" = "finfolk".as_bounded_text("body",0,2000)),
  "correlation_id" UUID NOT NULL,
  "generation" INTEGER NOT NULL,
  "state" "finfolk"."EnumMessagingOutboxStatus" NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" = "finfolk".as_bounded_integer("attempts",0,2147483647)),
  "lease" UUID,
  "lease_until" BIGINT,
  "next_attempt_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "deadline" BIGINT NOT NULL,
  "provider_message_id" TEXT,
  "error_code" TEXT,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "body_ciphertext" TEXT,
  "cipher_context" JSONB NOT NULL DEFAULT '{}' CHECK ("cipher_context" = "finfolk".as_jsonb("cipher_context")),
  "reply_kind" "finfolk"."EnumMessagingOutboxReplyKind" NOT NULL DEFAULT 'text',
  UNIQUE ("command_id"),
  UNIQUE ("receipt_id"),
  UNIQUE ("message_id"),
  CONSTRAINT sending_lease CHECK ((("state" = 'sending') AND "lease" IS NOT NULL) OR (("state" != 'sending') AND "lease" IS NULL)),
  CONSTRAINT lease_pair CHECK (("lease" IS NULL AND "lease_until" IS NULL) OR ("lease" IS NOT NULL AND "lease_until" IS NOT NULL)),
  CONSTRAINT fk_messaging_outbox_event_inbox FOREIGN KEY (account_id,event_id) REFERENCES "finfolk"."SocialEvent"(inbox_id,id),
  CONSTRAINT fk_messaging_outbox_command_inbox FOREIGN KEY (account_id,command_id) REFERENCES "finfolk"."SocialCommand"(inbox_id,id),
  CONSTRAINT fk_messaging_outbox_receipt_scope FOREIGN KEY (account_id,receipt_id) REFERENCES "finfolk"."MessagingReceipt"(account_id,id),
  CONSTRAINT fk_messaging_outbox_message_scope FOREIGN KEY (account_id,message_id) REFERENCES "finfolk"."MessagingMessage"(account_id,id),
  CONSTRAINT fk_messaging_outbox_command_event FOREIGN KEY (event_id,command_id) REFERENCES "finfolk"."SocialCommand"(event_id,id)
);
CREATE INDEX ON "finfolk"."MessagingOutbox" ("account_id");

-- finfolkdb.common.type-messaging-delivery/__delivery_indexes__ 
CREATE INDEX IF NOT EXISTS "MessagingOutbox_ready" ON "finfolk"."MessagingOutbox" ("account_id","state","next_attempt_at");

-- finfolkdb.fn.messaging.messaging-manage/ret-messaging-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_messaging_account(
  i_application UUID,
  i_account UUID
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
  i_application UUID,
  i_account UUID,
  i_event TEXT,
  i_correlation UUID
) RETURNS JSONB AS $$

  DECLARE
    o_audit JSONB;
  BEGIN
    WITH j_ret AS (  
      INSERT INTO "finfolk"."MessagingAudit" ("account_id","actor","event","correlation_id") VALUES (
        (i_account)::UUID,
        (i_application)::TEXT,
        (i_event)::TEXT,
        (i_correlation)::UUID
      ) RETURNING
        "id",
        "account_id",
        "actor",
        "event",
        "correlation_id",
        "time_created")
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
      SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
      WHERE "id" = (o_conversation ->> 'participant_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
    RETURN ((o_account ->> 'mode') = 'live') OR (((o_account ->> 'mode') = 'pilot') AND jsonb_exists(o_account -> 'pilot_sender_ids',o_identity ->> 'external_id'));
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/receive-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_message(
  i_application UUID,
  i_account UUID,
  i_envelope JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_envelope JSONB;
    o_metadata JSONB;
    v_body TEXT;
    v_conversation TEXT;
    v_deadline BIGINT;
    v_event TEXT;
    v_message TEXT;
    v_sender TEXT;
    v_sent BIGINT;
  BEGIN
    o_envelope := "finfolk".as_jsonb(i_envelope);
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
    v_sent := (o_envelope ->> 'sentAt')::BIGINT;
    v_deadline := (o_envelope ->> 'deadline')::BIGINT;
    o_metadata := "finfolk".as_jsonb(o_envelope -> 'metadata');
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF (jsonb_typeof(o_envelope -> 'eventId') != 'string') OR (jsonb_typeof(o_envelope -> 'messageId') != 'string') OR (jsonb_typeof(o_envelope -> 'conversationId') != 'string') OR (jsonb_typeof(o_envelope -> 'senderId') != 'string') OR (jsonb_typeof(o_envelope -> 'body') != 'string') OR v_sent IS NULL OR v_deadline IS NULL OR (coalesce(v_event,'') = '') OR (length(v_event) > 500) OR (coalesce(v_message,'') = '') OR (length(v_message) > 500) OR (coalesce(v_conversation,'') = '') OR (length(v_conversation) > 500) OR (coalesce(v_sender,'') = '') OR (length(v_sender) > 500) OR v_body IS NULL OR (length(v_body) > 2000) OR v_sent IS NULL OR v_deadline IS NULL OR (v_deadline <= v_sent) OR (v_sent > ((1000000 * extract(epoch FROM now()))::BIGINT + 300000000)) THEN
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
          "time_created"
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
          "time_created"
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
              "time_created"
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
            SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
            WHERE "id" = (o_thread ->> 'participant_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_sender;
          IF ((o_original ->> 'external_id') != v_message) OR ((o_original ->> 'body') != v_body) OR ((o_original -> 'metadata') != o_metadata) OR ((o_original ->> 'sent_at')::BIGINT != v_sent) OR ((o_thread ->> 'external_id') != v_conversation) OR ((o_sender ->> 'external_id') != v_sender) THEN
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
                  "time_created"
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
          SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
          WHERE "account_id" = i_account AND "external_id" = v_sender
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
        IF o_identity is null  THEN
          DECLARE
          o_new JSONB;
        BEGIN
          WITH j_ret AS (INSERT INTO "finfolk"."MessagingIdentity" ("account_id","external_id") VALUES ((i_account)::UUID,(v_sender)::TEXT) RETURNING "id","social_account_id","account_id","external_id","user_id")
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
                  (i_account)::UUID,
                  (o_identity ->> 'id')::UUID,
                  (v_conversation)::TEXT
                ) RETURNING "id","account_id","participant_id","external_id")
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
              o_conversation := o_new;
          END;
          END IF;
          IF (o_conversation ->> 'participant_id')::UUID != (o_identity ->> 'id')::UUID THEN
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
                (i_account)::UUID,
                (o_conversation ->> 'id')::UUID,
                ('inbound')::"finfolk"."EnumMessagingDirection",
                (v_message)::TEXT,
                (v_body)::TEXT,
                (o_metadata)::JSONB,
                (v_sent)::BIGINT
              ) RETURNING
                "id",
                "account_id",
                "conversation_id",
                "direction",
                "external_id",
                "body",
                "metadata",
                "sent_at",
                "time_created")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."MessagingReceipt" (
                "account_id",
                "external_event_id",
                "message_id",
                "generation",
                "deadline"
              ) VALUES (
                (i_account)::UUID,
                (v_event)::TEXT,
                (o_message ->> 'id')::UUID,
                (o_account ->> 'generation')::INTEGER,
                (v_deadline)::BIGINT
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
                "time_created")
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
  i_application UUID,
  i_account UUID
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
        "lease_until" = (null)::BIGINT
      WHERE ("account_id" = i_account AND "status" != ('completed')::"finfolk"."EnumMessagingReceiptStatus" AND "status" != ('expired')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" <= (1000000 * extract(epoch FROM now()))::BIGINT)
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
        "time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingReceipt" SET
        "status" = ('failed')::"finfolk"."EnumMessagingReceiptStatus",
        "lease" = (null)::UUID,
        "lease_until" = (null)::BIGINT
      WHERE "account_id" = i_account
      AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
      AND "attempts" >= 5
      AND "lease_until" <= (1000000 * extract(epoch FROM now()))::BIGINT
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
        "time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_exhausted;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingOutbox" SET
        "state" = ('uncertain')::"finfolk"."EnumMessagingOutboxStatus",
        "lease" = (null)::UUID,
        "lease_until" = (null)::BIGINT,
        "error_code" = ('delivery_lease_expired')::TEXT
      WHERE "account_id" = i_account
      AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "lease_until" <= (1000000 * extract(epoch FROM now()))::BIGINT
      RETURNING
        "id",
        "account_id",
        "event_id",
        "command_id",
        "channel",
        "recipient",
        "thread",
        "comment",
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
        "time_created",
        "time_updated",
        "body_ciphertext",
        "cipher_context",
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
        "event_id",
        "command_id",
        "channel",
        "recipient",
        "thread",
        "comment",
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
        "time_created",
        "time_updated",
        "body_ciphertext",
        "cipher_context",
        "reply_kind")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_cancelled;
    WITH j_ret AS (  
      UPDATE "finfolk"."MessagingOutbox" SET
        "state" = ('expired')::"finfolk"."EnumMessagingOutboxStatus"
      WHERE "account_id" = i_account
      AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "deadline" <= (1000000 * extract(epoch FROM now()))::BIGINT
      RETURNING
        "id",
        "account_id",
        "event_id",
        "command_id",
        "channel",
        "recipient",
        "thread",
        "comment",
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
        "time_created",
        "time_updated",
        "body_ciphertext",
        "cipher_context",
        "reply_kind")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_deadline;
    RETURN jsonb_build_object('ok',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/claim-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_message(
  i_application UUID,
  i_account UUID
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_reconciled JSONB;
    v_generation INTEGER;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
    v_generation := (o_account ->> 'generation')::INTEGER;
    IF ((o_account ->> 'mode') = 'disabled') OR ((o_account ->> 'backoff_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
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
          "time_created"
        FROM "finfolk"."MessagingReceipt"
        WHERE ("account_id" = i_account AND "generation" = v_generation AND "status" = ('received')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT AND "next_attempt_at" <= (1000000 * extract(epoch FROM now()))::BIGINT AND "attempts" < 5)
        OR ("account_id" = i_account AND "generation" = v_generation AND "status" = ('failed')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT AND "next_attempt_at" <= (1000000 * extract(epoch FROM now()))::BIGINT AND "attempts" < 5)
        OR ("account_id" = i_account AND "generation" = v_generation AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus" AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT AND "lease_until" <= (1000000 * extract(epoch FROM now()))::BIGINT AND "attempts" < 5)
        ORDER BY "time_created","id" ASC
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
            "time_created"
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
          SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
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
                "lease_until" = (null)::BIGINT
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
                "time_created")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
            RETURN null;
        END;
        END IF;
        DECLARE
          o_claim JSONB;
          o_linked JSONB;
          v_user UUID;
        BEGIN
          WITH j_ret AS (  
            SELECT
              "id",
              "user_id",
              "account_id",
              "status",
              "identity_version",
              "generation",
              "credential_ciphertext",
              "access_expires_at",
              "refresh_expires_at",
              "credential_lease",
              "lease_until",
              "share_posts",
              "public_points",
              "capabilities",
              "granted_scopes",
              "cursor",
              "last_success",
              "next_at",
              "failures",
              "provider_data",
              "audit_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            FROM "finfolk"."SocialConnection"
            WHERE "account_id" = (o_participant ->> 'social_account_id')::UUID
            AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_linked;
          v_user := null;
          WITH j_ret AS (  
            UPDATE "finfolk"."MessagingReceipt" SET
              "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus",
              "attempts" = ((o_receipt ->> 'attempts')::INTEGER + 1)::INTEGER,
              "lease" = (uuid_generate_v4())::UUID,
              "lease_until" = ((1000000 * extract(epoch FROM now()))::BIGINT + 60000000)::BIGINT
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
              "time_created")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_claim;
          IF (o_account ->> 'provider') = 'app' THEN
            v_user := (o_participant ->> 'user_id')::UUID;
          ELSE
            v_user := (o_linked ->> 'user_id')::UUID;
          END IF;
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
            v_user
          );
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/complete-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_message(
  i_application UUID,
  i_account UUID,
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
        "time_created"
      FROM "finfolk"."MessagingReceipt"
      WHERE "id" = i_receipt
      AND "account_id" = i_account
      AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
      AND "lease" = i_lease
      AND "lease_until" > (1000000 * extract(epoch FROM now()))::BIGINT
      AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT
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
          "time_created"
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
              (i_account)::UUID,
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
              "time_created")
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
              (i_account)::UUID,
              (i_receipt)::UUID,
              (o_message ->> 'id')::UUID,
              "finfolk".as_bounded_text((i_reply)::TEXT,0,2000),
              (o_receipt ->> 'correlation_id')::UUID,
              (o_receipt ->> 'generation')::INTEGER,
              (o_receipt ->> 'deadline')::BIGINT
            ) RETURNING
              "id",
              "account_id",
              "event_id",
              "command_id",
              "channel",
              "recipient",
              "thread",
              "comment",
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
              "time_created",
              "time_updated",
              "body_ciphertext",
              "cipher_context",
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
            "lease_until" = (null)::BIGINT,
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
            "time_created")
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
  i_application UUID,
  i_account UUID,
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
          "lease_until" = (null)::BIGINT,
          "next_attempt_at" = ((1000000 * extract(epoch FROM now()))::BIGINT + (i_delay * 1000000))::BIGINT
        WHERE "id" = i_receipt
        AND "account_id" = i_account
        AND "status" = ('processing')::"finfolk"."EnumMessagingReceiptStatus"
        AND "lease" = i_lease
        AND "lease_until" > (1000000 * extract(epoch FROM now()))::BIGINT
        AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT
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
          "time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_retry;
      RETURN o_retry;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-manage/claim-delivery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_delivery(
  i_application UUID,
  i_account UUID
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_reconciled JSONB;
    v_generation INTEGER;
  BEGIN
    o_account := "finfolk_rpc".ret_messaging_account(i_application,i_account);
    v_generation := (o_account ->> 'generation')::INTEGER;
    o_reconciled := "finfolk_rpc".reconcile_messaging_work(i_application,i_account);
    IF ((o_account ->> 'mode') = 'disabled') OR ((o_account ->> 'backoff_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    DECLARE
      o_outbox JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "event_id",
          "command_id",
          "channel",
          "recipient",
          "thread",
          "comment",
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
          "time_created",
          "time_updated",
          "body_ciphertext",
          "cipher_context",
          "reply_kind"
        FROM "finfolk"."MessagingOutbox"
        WHERE "account_id" = i_account
        AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
        AND "generation" = v_generation
        AND "deadline" > (1000000 * extract(epoch FROM now()))::BIGINT
        AND "next_attempt_at" <= (1000000 * extract(epoch FROM now()))::BIGINT
        AND "attempts" < 5
        ORDER BY "time_created","id" ASC
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
            "time_created"
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
          SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
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
                "event_id",
                "command_id",
                "channel",
                "recipient",
                "thread",
                "comment",
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
                "time_created",
                "time_updated",
                "body_ciphertext",
                "cipher_context",
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
              "attempts" = "finfolk".as_bounded_integer(
              ((o_outbox ->> 'attempts')::INTEGER + 1)::INTEGER,
              0,
              2147483647
            ),
              "lease" = (uuid_generate_v4())::UUID,
              "lease_until" = ((1000000 * extract(epoch FROM now()))::BIGINT + 60000000)::BIGINT,
              "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
            WHERE "id" = (o_outbox ->> 'id')::UUID
            RETURNING
              "id",
              "account_id",
              "event_id",
              "command_id",
              "channel",
              "recipient",
              "thread",
              "comment",
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
              "time_created",
              "time_updated",
              "body_ciphertext",
              "cipher_context",
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
  i_application UUID,
  i_account UUID,
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
        "event_id",
        "command_id",
        "channel",
        "recipient",
        "thread",
        "comment",
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
        "time_created",
        "time_updated",
        "body_ciphertext",
        "cipher_context",
        "reply_kind"
      FROM "finfolk"."MessagingOutbox"
      WHERE "id" = i_delivery
      AND "account_id" = i_account
      AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
      AND "lease" = i_lease
      AND "lease_until" > (1000000 * extract(epoch FROM now()))::BIGINT
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
        IF (o_outbox ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
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
            "lease_until" = (null)::BIGINT,
            "next_attempt_at" = ((1000000 * extract(epoch FROM now()))::BIGINT + (coalesce(i_delay,1) * 1000000))::BIGINT,
            "provider_message_id" = (i_provider_message)::TEXT,
            "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
          WHERE "id" = i_delivery
          RETURNING
            "id",
            "account_id",
            "event_id",
            "command_id",
            "channel",
            "recipient",
            "thread",
            "comment",
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
            "time_created",
            "time_updated",
            "body_ciphertext",
            "cipher_context",
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
                "sent_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
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
                "time_created")
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
  i_application UUID,
  i_account UUID,
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
        "time_created"
      FROM "finfolk"."MessagingMessage"
      WHERE "account_id" = i_account AND "conversation_id" = i_conversation
      ORDER BY "time_created","id" DESC
      LIMIT 50)
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_history;
    RETURN coalesce(o_history,('[]')::JSONB);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-oauth/begin-messaging-oauth 
CREATE OR REPLACE FUNCTION "finfolk_rpc".begin_messaging_oauth(
  i_application UUID,
  i_account UUID,
  i_user UUID,
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
          (i_application)::UUID,
          (i_account)::UUID,
          (i_state)::TEXT,
          (i_nonce)::TEXT,
          (o_account ->> 'generation')::INTEGER,
          (i_user)::UUID,
          ((1000000 * extract(epoch FROM now()))::BIGINT + 600000000)::BIGINT,
          (i_flow)::TEXT
        ) RETURNING
          "id",
          "application_id",
          "account_id",
          "state_hash",
          "nonce_hash",
          "generation",
          "user_id",
          "expires_at",
          "consumed_at",
          "time_created",
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
  i_application UUID,
  i_account UUID,
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
      AND "expires_at" > (1000000 * extract(epoch FROM now()))::BIGINT
      AND "generation" = (o_account ->> 'generation')::INTEGER
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_intent;
    RETURN o_intent;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-oauth/consume-messaging-oauth 
CREATE OR REPLACE FUNCTION "finfolk_rpc".consume_messaging_oauth(
  i_application UUID,
  i_account UUID,
  i_user UUID,
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
        "id",
        "application_id",
        "account_id",
        "state_hash",
        "nonce_hash",
        "generation",
        "user_id",
        "expires_at",
        "consumed_at",
        "time_created",
        "flow_key"
      FROM "finfolk"."MessagingOauthState"
      WHERE "user_id" = i_user
      AND "flow_key" = i_flow
      AND "application_id" = i_application
      AND "nonce_hash" = i_nonce
      AND "expires_at" > (1000000 * extract(epoch FROM now()))::BIGINT
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
        UPDATE "finfolk"."MessagingOauthState" SET
          "consumed_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "application_id" = i_application AND "state_hash" = i_state
        RETURNING
          "id",
          "application_id",
          "account_id",
          "state_hash",
          "nonce_hash",
          "generation",
          "user_id",
          "expires_at",
          "consumed_at",
          "time_created",
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

-- finfolkdb.fn.helper.helper-access/is-user-blocked 
CREATE OR REPLACE FUNCTION "finfolk".is_user_blocked(
  i_viewer UUID,
  i_owner UUID
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
  i_user UUID
) RETURNS BOOLEAN AS $$

  DECLARE
    v_active BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."User"
    WHERE "id" = i_user AND "deleted" = false) INTO v_active;
    RETURN v_active;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.fn-system-util/auth-uid 
CREATE OR REPLACE FUNCTION "finfolk".auth_uid() RETURNS UUID AS $$

  SELECT (nullif(current_setting('finfolk.actor_id',true),''))::UUID;

$$ LANGUAGE 'sql';

-- finfolkdb.common.fn-system-util/as-iso-time 
CREATE OR REPLACE FUNCTION "finfolk".as_iso_time(
  i_time BIGINT
) RETURNS TEXT AS $$

  SELECT to_char(
    "timezone"('UTC',to_timestamp((i_time)::NUMERIC / 1000000)),
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );

$$ LANGUAGE 'sql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.fn.helper.helper-entity/insert-base-addons 
CREATE OR REPLACE FUNCTION "finfolk".insert_base_addons(
  i_class_table TEXT,
  i_class_ref UUID,
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
        (i_class_ref)::UUID,
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
        (i_class_ref)::UUID,
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
      ) RETURNING "id","rev_id","version","deltas","op_created","time_created")
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
      ) RETURNING "id","audit_id","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
    RETURN jsonb_build_object('rev',(o_rev ->> 'id')::UUID,'audit',(o_audit ->> 'id')::UUID);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-posts/insert-social-post 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_social_post(
  i_owner UUID,
  i_beach UUID,
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
      v_id,
      jsonb_build_object('url',i_url,'platform',i_platform),
      o_op
    );
    WITH j_ret AS (  
      INSERT INTO "finfolk"."SocialPost" (
        "id",
        "owner_id",
        "site_id",
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
        (i_owner)::UUID,
        (i_beach)::UUID,
        (i_url)::TEXT,
        (i_platform)::"finfolk"."EnumSocialProvider",
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
        "site_id",
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
  i_viewer UUID
) RETURNS JSONB AS $$

  DECLARE
    o_post JSONB;
    v_owner UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "site_id",
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
    v_owner := (o_post ->> 'owner_id')::UUID;
    IF o_post IS NULL OR NOT "finfolk".is_user_active(v_owner) OR "finfolk".is_user_blocked(i_viewer,v_owner) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'id',
      (o_post ->> 'id')::UUID,
      'site_id',
      (o_post ->> 'site_id')::UUID,
      'url',
      o_post ->> 'url',
      'platform',
      o_post ->> 'platform',
      'creator_handle',
      o_post ->> 'creator_handle',
      'created_at',
      "finfolk".as_iso_time((o_post ->> 'time_created')::BIGINT)
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/create-social-audit 
CREATE OR REPLACE FUNCTION "finfolk_rpc".create_social_audit(
  i_table TEXT,
  i_id UUID,
  o_op JSONB
) RETURNS UUID AS $$

  DECLARE
    o_audit JSONB;
  BEGIN
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Audit" (
        "class_table",
        "class_context",
        "class_ref",
        "op_created",
        "time_created"
      ) VALUES (
        (i_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_id)::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    RETURN (o_audit ->> 'id')::UUID;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/record-social-audit 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_social_audit(
  i_table TEXT,
  i_audit UUID,
  i_event TEXT,
  o_op JSONB
) RETURNS UUID AS $$

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
        (i_table)::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_audit)::UUID,
        "finfolk".as_jsonb((jsonb_build_object('event',i_event))::JSONB),
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","audit_id","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
    RETURN (o_log ->> 'id')::UUID;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/insert-social-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_social_account(
  i_provider TEXT,
  i_namespace TEXT,
  i_external_id TEXT,
  i_handle TEXT,
  i_display_name TEXT,
  i_provider_data JSONB,
  o_op JSONB
) RETURNS UUID AS $$

  DECLARE
    o_data JSONB;
  BEGIN
    o_data := "finfolk".as_jsonb(i_provider_data);
    IF NOT ((i_provider = 'instagram') OR (i_provider = 'tiktok') OR (i_provider = 'mock')) OR (coalesce(btrim(i_namespace),'') = '') OR (coalesce(btrim(i_external_id),'') = '') THEN
      RAISE EXCEPTION 'Provider, namespace and external account identity are required';
    END IF;
    PERFORM "pg_advisory_xact_lock"("hashtextextended"(
      (jsonb_build_array(i_provider,i_namespace,i_external_id))::TEXT,
      0
    ));
    DECLARE
      o_existing JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "provider",
          "namespace",
          "external_id",
          "handle",
          "display_name",
          "generation",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialAccount"
        WHERE "provider" = (i_provider)::"finfolk"."EnumSocialProvider"
        AND "namespace" = i_namespace
        AND "external_id" = i_external_id
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF o_existing is not null  THEN
        RETURN (o_existing ->> 'id')::UUID;
      END IF;
      DECLARE
        o_account JSONB;
        v_audit UUID;
        v_id UUID;
        v_log UUID;
      BEGIN
        v_id := uuid_generate_v4();
        v_audit := "finfolk_rpc".create_social_audit('SocialAccount',v_id,o_op);
        WITH j_ret AS (  
          INSERT INTO "finfolk"."SocialAccount" (
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          ) VALUES (
            (v_id)::UUID,
            (i_provider)::"finfolk"."EnumSocialProvider",
            (i_namespace)::TEXT,
            (i_external_id)::TEXT,
            (coalesce(i_handle,''))::TEXT,
            (coalesce(i_display_name,''))::TEXT,
            (o_data)::JSONB,
            (v_audit)::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT,
            (o_op ->> 'time')::BIGINT
          ) RETURNING
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
        v_log := "finfolk_rpc".record_social_audit('SocialAccount',v_audit,'created',o_op);
        RETURN v_id;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/begin-social-proof 
CREATE OR REPLACE FUNCTION "finfolk_rpc".begin_social_proof(
  i_account UUID,
  i_user UUID,
  i_kind TEXT,
  i_token_hash TEXT,
  i_nonce_hash TEXT,
  i_flow_key TEXT,
  i_ttl INTEGER,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = i_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account IS NULL OR (i_user IS NOT NULL AND NOT "finfolk".is_user_active(i_user)) OR i_token_hash IS NULL OR NOT "regexp_like"(i_token_hash,'^[a-f0-9]{64}$') OR ((i_kind = 'oauth') AND (NOT coalesce("regexp_like"(i_nonce_hash,'^[a-f0-9]{64}$'),false) OR NOT coalesce("regexp_like"(i_flow_key,'^[a-f0-9]{64}$'),false))) OR i_ttl IS NULL OR (i_ttl < 30) OR (i_ttl > 900) THEN
      RAISE EXCEPTION 'Invalid social proof intent';
    END IF;
    DECLARE
      o_proof JSONB;
    BEGIN
      WITH j_ret AS (  
        INSERT INTO "finfolk"."SocialConnectionProof" (
          "account_id",
          "user_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "expires_at",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        ) VALUES (
          (i_account)::UUID,
          (i_user)::UUID,
          (i_kind)::"finfolk"."EnumSocialProofKind",
          (i_token_hash)::TEXT,
          (i_nonce_hash)::TEXT,
          (i_flow_key)::TEXT,
          (o_account ->> 'generation')::INTEGER,
          ((1000000 * extract(epoch FROM now()))::BIGINT + ((i_ttl)::BIGINT * 1000000))::BIGINT,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT,
          (o_op ->> 'time')::BIGINT
        ) RETURNING
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
      RETURN jsonb_build_object(
        'id',
        (o_proof ->> 'id')::UUID,
        'expiresAt',
        o_proof -> 'expires_at'
      );
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/verify-social-proof 
CREATE OR REPLACE FUNCTION "finfolk_rpc".verify_social_proof(
  i_proof UUID,
  i_evidence JSONB,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_account JSONB;
    o_evidence JSONB;
    o_initial JSONB;
    o_proof JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnectionProof"
      WHERE "id" = i_proof
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_initial;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = (o_initial ->> 'account_id')::UUID
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnectionProof"
      WHERE "id" = i_proof
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
    o_evidence := "finfolk".as_jsonb(i_evidence);
    IF o_proof IS NULL OR o_account IS NULL OR ((o_proof ->> 'status') != 'pending') OR ((o_proof ->> 'expires_at')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR ((o_proof ->> 'generation')::INTEGER != (o_account ->> 'generation')::INTEGER) THEN
      RETURN false;
    END IF;
    IF (jsonb_typeof(o_evidence -> 'verified') != 'boolean') OR NOT coalesce((o_evidence ->> 'verified')::BOOLEAN,false) OR (coalesce(o_evidence ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_evidence ->> 'namespace','') != (o_account ->> 'namespace')) OR (coalesce(o_evidence ->> 'externalId','') != (o_account ->> 'external_id')) THEN
      RAISE EXCEPTION 'Verified social evidence does not match its provider account';
    END IF;
    DECLARE
      o_verified JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnectionProof" SET
          "status" = ('verified')::"finfolk"."EnumSocialProofStatus",
          "verified_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
          "provider_data" = (o_evidence)::JSONB,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = i_proof
        RETURNING
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_verified;
      RETURN true;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/connect-social-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".connect_social_account(
  i_user UUID,
  i_proof UUID,
  i_token_hash TEXT,
  i_nonce_hash TEXT,
  i_flow_key TEXT,
  i_ciphertext TEXT,
  i_access_expires BIGINT,
  i_refresh_expires BIGINT,
  i_capabilities JSONB,
  i_scopes JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_initial JSONB;
    o_proof JSONB;
    v_account UUID;
    v_version UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnectionProof"
      WHERE "id" = i_proof
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_initial;
    v_account := (o_initial ->> 'account_id')::UUID;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = v_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnectionProof"
      WHERE "id" = i_proof
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
    v_version := uuid_generate_v4();
    IF NOT "finfolk".is_user_active(i_user) OR o_account IS NULL OR o_proof IS NULL OR ((o_proof ->> 'status') != 'verified') OR i_token_hash IS NULL OR ((o_proof ->> 'token_hash') != i_token_hash) OR (coalesce(o_proof ->> 'nonce_hash','') != coalesce(i_nonce_hash,'')) OR (coalesce(o_proof ->> 'flow_key','') != coalesce(i_flow_key,'')) OR ((o_proof ->> 'expires_at')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR ((o_proof ->> 'generation')::INTEGER != (o_account ->> 'generation')::INTEGER) OR (o_proof ->> 'user_id' IS NOT NULL AND ((o_proof ->> 'user_id')::UUID != i_user)) THEN
      RETURN null;
    END IF;
    IF (jsonb_typeof(i_capabilities) != 'array') OR (jsonb_typeof(i_scopes) != 'array') OR (i_access_expires IS NOT NULL AND (i_access_expires <= (1000000 * extract(epoch FROM now()))::BIGINT)) OR (i_refresh_expires IS NOT NULL AND (i_refresh_expires <= (1000000 * extract(epoch FROM now()))::BIGINT)) THEN
      RAISE EXCEPTION 'Invalid social authorization scope or expiry';
    END IF;
    DECLARE
      o_current JSONB;
      v_audit UUID;
      v_id UUID;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "user_id",
          "account_id",
          "status",
          "identity_version",
          "generation",
          "credential_ciphertext",
          "access_expires_at",
          "refresh_expires_at",
          "credential_lease",
          "lease_until",
          "share_posts",
          "public_points",
          "capabilities",
          "granted_scopes",
          "cursor",
          "last_success",
          "next_at",
          "failures",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialConnection"
        WHERE "account_id" = v_account
        AND "status" != ('revoked')::"finfolk"."EnumSocialConnectionStatus"
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_current;
      v_id := coalesce((o_current ->> 'id')::UUID,uuid_generate_v4());
      v_audit := coalesce(
        (o_current ->> 'audit_id')::UUID,
        "finfolk_rpc".create_social_audit('SocialConnection',v_id,o_op)
      );
      IF o_current IS NOT NULL AND ((o_current ->> 'user_id')::UUID != i_user) THEN
        RAISE EXCEPTION 'Social account already has another member connection';
      END IF;
      IF o_current is null  THEN
        DECLARE
        o_new JSONB;
      BEGIN
        WITH j_ret AS (  
            INSERT INTO "finfolk"."SocialConnection" (
              "id",
              "user_id",
              "account_id",
              "audit_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            ) VALUES (
              (v_id)::UUID,
              (i_user)::UUID,
              (v_account)::UUID,
              (v_audit)::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'time')::BIGINT,
              (o_op ->> 'time')::BIGINT
            ) RETURNING
              "id",
              "user_id",
              "account_id",
              "status",
              "identity_version",
              "generation",
              "credential_ciphertext",
              "access_expires_at",
              "refresh_expires_at",
              "credential_lease",
              "lease_until",
              "share_posts",
              "public_points",
              "capabilities",
              "granted_scopes",
              "cursor",
              "last_success",
              "next_at",
              "failures",
              "provider_data",
              "audit_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
          null;
      END;
      END IF;
      DECLARE
        o_consumed JSONB;
        o_generation JSONB;
        o_saved JSONB;
        v_log UUID;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."SocialConnection" SET
            "status" = ('active')::"finfolk"."EnumSocialConnectionStatus",
            "identity_version" = (v_version)::UUID,
            "generation" = (coalesce((o_current ->> 'generation')::INTEGER,0) + 1)::INTEGER,
            "credential_ciphertext" = (i_ciphertext)::TEXT,
            "access_expires_at" = (i_access_expires)::BIGINT,
            "refresh_expires_at" = (i_refresh_expires)::BIGINT,
            "credential_lease" = (null)::UUID,
            "lease_until" = (null)::BIGINT,
            "share_posts" = (false)::BOOLEAN,
            "public_points" = (false)::BOOLEAN,
            "capabilities" = (i_capabilities)::JSONB,
            "granted_scopes" = (i_scopes)::JSONB,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = v_id
          RETURNING
            "id",
            "user_id",
            "account_id",
            "status",
            "identity_version",
            "generation",
            "credential_ciphertext",
            "access_expires_at",
            "refresh_expires_at",
            "credential_lease",
            "lease_until",
            "share_posts",
            "public_points",
            "capabilities",
            "granted_scopes",
            "cursor",
            "last_success",
            "next_at",
            "failures",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
        WITH j_ret AS (  
          UPDATE "finfolk"."SocialConnectionProof" SET
            "user_id" = (i_user)::UUID,
            "connection_id" = (v_id)::UUID,
            "status" = ('consumed')::"finfolk"."EnumSocialProofStatus",
            "consumed_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
            "consumed_version" = (v_version)::UUID,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_proof
          RETURNING
            "id",
            "account_id",
            "user_id",
            "connection_id",
            "event_id",
            "inbox_id",
            "receipt_id",
            "kind",
            "token_hash",
            "nonce_hash",
            "flow_key",
            "generation",
            "status",
            "expires_at",
            "verified_at",
            "consumed_at",
            "consumed_version",
            "error",
            "provider_data",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_consumed;
        WITH j_ret AS (  
          UPDATE "finfolk"."SocialAccount" SET
            "generation" = ((o_account ->> 'generation')::INTEGER + 1)::INTEGER,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = v_account
          RETURNING
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_generation;
        v_log := "finfolk_rpc".record_social_audit('SocialConnection',v_audit,'connected',o_op);
        RETURN jsonb_build_object(
          'id',
          v_id,
          'accountId',
          v_account,
          'identityVersion',
          v_version,
          'status',
          'active',
          'sharePosts',
          false,
          'publicPoints',
          false
        );
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/set-social-sharing 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_social_sharing(
  i_user UUID,
  i_connection UUID,
  i_version UUID,
  i_share BOOLEAN,
  i_points BOOLEAN,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_row JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "id" = i_connection
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_row;
    IF NOT "finfolk".is_user_active(i_user) OR o_row IS NULL OR ((o_row ->> 'user_id')::UUID != i_user) OR ((o_row ->> 'identity_version')::UUID != i_version) OR ((o_row ->> 'status') != 'active') OR i_share IS NULL OR i_points IS NULL THEN
      RETURN false;
    END IF;
    DECLARE
      o_saved JSONB;
      v_log UUID;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnection" SET
          "share_posts" = (i_share)::BOOLEAN,
          "public_points" = (i_points)::BOOLEAN,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = i_connection
        RETURNING
          "id",
          "user_id",
          "account_id",
          "status",
          "identity_version",
          "generation",
          "credential_ciphertext",
          "access_expires_at",
          "refresh_expires_at",
          "credential_lease",
          "lease_until",
          "share_posts",
          "public_points",
          "capabilities",
          "granted_scopes",
          "cursor",
          "last_success",
          "next_at",
          "failures",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
      v_log := "finfolk_rpc".record_social_audit(
        'SocialConnection',
        (o_row ->> 'audit_id')::UUID,
        'sharing-updated',
        o_op
      );
      RETURN true;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/disconnect-social-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".disconnect_social_account(
  i_user UUID,
  i_connection UUID,
  i_version UUID,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_account JSONB;
    o_initial JSONB;
    o_row JSONB;
    v_account UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "id" = i_connection
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_initial;
    v_account := (o_initial ->> 'account_id')::UUID;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = v_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "id" = i_connection
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_row;
    IF o_row IS NULL OR ((o_row ->> 'user_id')::UUID != i_user) OR ((o_row ->> 'identity_version')::UUID != i_version) OR ((o_row ->> 'status') = 'revoked') THEN
      RETURN false;
    END IF;
    DECLARE
      o_generation JSONB;
      o_proofs JSONB;
      o_revoked JSONB;
      v_log UUID;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnection" SET
          "status" = ('revoked')::"finfolk"."EnumSocialConnectionStatus",
          "identity_version" = (uuid_generate_v4())::UUID,
          "generation" = ((o_row ->> 'generation')::INTEGER + 1)::INTEGER,
          "credential_ciphertext" = (null)::TEXT,
          "access_expires_at" = (null)::BIGINT,
          "refresh_expires_at" = (null)::BIGINT,
          "credential_lease" = (null)::UUID,
          "lease_until" = (null)::BIGINT,
          "share_posts" = (false)::BOOLEAN,
          "public_points" = (false)::BOOLEAN,
          "capabilities" = ('[]')::JSONB,
          "granted_scopes" = ('[]')::JSONB,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = i_connection
        RETURNING
          "id",
          "user_id",
          "account_id",
          "status",
          "identity_version",
          "generation",
          "credential_ciphertext",
          "access_expires_at",
          "refresh_expires_at",
          "credential_lease",
          "lease_until",
          "share_posts",
          "public_points",
          "capabilities",
          "granted_scopes",
          "cursor",
          "last_success",
          "next_at",
          "failures",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_revoked;
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialAccount" SET
          "generation" = ((o_account ->> 'generation')::INTEGER + 1)::INTEGER,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = v_account
        RETURNING
          "id",
          "provider",
          "namespace",
          "external_id",
          "handle",
          "display_name",
          "generation",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_generation;
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnectionProof" SET
          "status" = ('revoked')::"finfolk"."EnumSocialProofStatus",
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "account_id" = v_account AND "status" IN ('pending','verified')
        RETURNING
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_proofs;
      v_log := "finfolk_rpc".record_social_audit(
        'SocialConnection',
        (o_row ->> 'audit_id')::UUID,
        'disconnected',
        o_op
      );
      RETURN true;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/insert-social-discovery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_social_discovery(
  i_account UUID,
  i_source UUID,
  i_external_id TEXT,
  i_url TEXT,
  i_owner UUID,
  i_beach UUID,
  i_caption TEXT,
  i_candidates JSONB,
  i_provider_data JSONB,
  o_op JSONB
) RETURNS UUID AS $$

  DECLARE
    o_account JSONB;
    o_data JSONB;
    o_source JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = i_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "key",
        "account_id",
        "kind",
        "configuration",
        "checkpoint",
        "last_success",
        "next_at",
        "lease",
        "lease_until",
        "failures",
        "status",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialSource"
      WHERE "id" = i_source
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_source;
    o_data := "finfolk".as_jsonb(i_provider_data);
    IF o_account IS NULL OR (coalesce(i_external_id,'') = '') OR NOT coalesce("starts_with"(i_url,'https://'),false) OR (jsonb_typeof(i_candidates) != 'array') OR (i_source IS NOT NULL AND (o_source IS NULL OR ((o_source ->> 'provider') != (o_account ->> 'provider')) OR ((o_source ->> 'namespace') != (o_account ->> 'namespace')) OR (o_source ->> 'account_id' IS NOT NULL AND ((o_source ->> 'account_id')::UUID != i_account)))) THEN
      RAISE EXCEPTION 'Discovery does not match its source and provider account';
    END IF;
    DECLARE
      o_existing JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "source_id",
          "external_id",
          "url",
          "owner_id",
          "site_id",
          "post_id",
          "candidates",
          "caption",
          "posted_at",
          "state",
          "automatic",
          "sources",
          "checked_at",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialDiscovery"
        WHERE "account_id" = i_account AND "external_id" = i_external_id
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF o_existing is not null  THEN
        RETURN (o_existing ->> 'id')::UUID;
      END IF;
      DECLARE
        o_discovery JSONB;
        v_audit UUID;
        v_id UUID;
        v_log UUID;
      BEGIN
        v_id := uuid_generate_v4();
        v_audit := "finfolk_rpc".create_social_audit('SocialDiscovery',v_id,o_op);
        WITH j_ret AS (  
          INSERT INTO "finfolk"."SocialDiscovery" (
            "id",
            "account_id",
            "source_id",
            "external_id",
            "url",
            "owner_id",
            "site_id",
            "candidates",
            "caption",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          ) VALUES (
            (v_id)::UUID,
            (i_account)::UUID,
            (i_source)::UUID,
            (i_external_id)::TEXT,
            (i_url)::TEXT,
            (i_owner)::UUID,
            (i_beach)::UUID,
            (i_candidates)::JSONB,
            (coalesce(i_caption,''))::TEXT,
            (o_data)::JSONB,
            (v_audit)::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT,
            (o_op ->> 'time')::BIGINT
          ) RETURNING
            "id",
            "account_id",
            "source_id",
            "external_id",
            "url",
            "owner_id",
            "site_id",
            "post_id",
            "candidates",
            "caption",
            "posted_at",
            "state",
            "automatic",
            "sources",
            "checked_at",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_discovery;
        v_log := "finfolk_rpc".record_social_audit('SocialDiscovery',v_audit,'discovered',o_op);
        RETURN v_id;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/publish-social-discovery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".publish_social_discovery(
  i_discovery UUID,
  i_post UUID,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_account JSONB;
    o_post JSONB;
    o_row JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "source_id",
        "external_id",
        "url",
        "owner_id",
        "site_id",
        "post_id",
        "candidates",
        "caption",
        "posted_at",
        "state",
        "automatic",
        "sources",
        "checked_at",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialDiscovery"
      WHERE "id" = i_discovery
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_row;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = (o_row ->> 'account_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "owner_id",
        "site_id",
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
        "time_updated"
      FROM "finfolk"."SocialPost"
      WHERE "id" = i_post
      LIMIT 1
      FOR SHARE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_post;
    IF o_row IS NULL OR o_post IS NULL OR o_row ->> 'owner_id' IS NULL OR o_row ->> 'site_id' IS NULL OR NOT "finfolk".is_user_active((o_post ->> 'owner_id')::UUID) OR ((o_row ->> 'owner_id')::UUID != (o_post ->> 'owner_id')::UUID) OR ((o_row ->> 'site_id')::UUID != (o_post ->> 'site_id')::UUID) OR ((o_account ->> 'provider') != (o_post ->> 'platform')) OR ((o_row ->> 'url') != (o_post ->> 'url')) OR ((o_post ->> 'status') != 'approved') OR NOT coalesce((o_post ->> 'public_consent')::BOOLEAN,false) THEN
      RETURN false;
    END IF;
    DECLARE
      o_saved JSONB;
      v_log UUID;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialDiscovery" SET
          "post_id" = (i_post)::UUID,
          "state" = ('published')::"finfolk"."EnumSocialDiscoveryStatus",
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = i_discovery
        RETURNING
          "id",
          "account_id",
          "source_id",
          "external_id",
          "url",
          "owner_id",
          "site_id",
          "post_id",
          "candidates",
          "caption",
          "posted_at",
          "state",
          "automatic",
          "sources",
          "checked_at",
          "provider_data",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
      v_log := "finfolk_rpc".record_social_audit(
        'SocialDiscovery',
        (o_row ->> 'audit_id')::UUID,
        'published',
        o_op
      );
      RETURN true;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-manage/ret-social-discovery-public 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_social_discovery_public(
  i_discovery UUID,
  i_viewer UUID
) RETURNS JSONB AS $$

  DECLARE
    o_row JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "source_id",
        "external_id",
        "url",
        "owner_id",
        "site_id",
        "post_id",
        "candidates",
        "caption",
        "posted_at",
        "state",
        "automatic",
        "sources",
        "checked_at",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialDiscovery"
      WHERE "id" = i_discovery
      AND "state" = ('published')::"finfolk"."EnumSocialDiscoveryStatus"
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_row;
    IF o_row is null  THEN
      RETURN null;
    END IF;
    RETURN "finfolk_rpc".ret_social_post_public((o_row ->> 'post_id')::UUID,i_viewer);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/enqueue-social-action 
CREATE OR REPLACE FUNCTION "finfolk_rpc".enqueue_social_action(
  i_command UUID,
  i_kind TEXT,
  o_op JSONB
) RETURNS UUID AS $$

  DECLARE
    o_account JSONB;
    o_command JSONB;
    o_event JSONB;
    v_id UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "event_id",
        "inbox_id",
        "generation",
        "account_id",
        "key",
        "context",
        "external_actor_id",
        "external_media_id",
        "owner_id",
        "connection_id",
        "identity_version",
        "command",
        "args",
        "source_url",
        "comment_at",
        "received_at",
        "state",
        "result",
        "site_id",
        "visit_day",
        "reply",
        "send_state",
        "external_reply_id",
        "send_started_at",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialCommand"
      WHERE "id" = i_command
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "key",
        "account_id",
        "inbox_id",
        "message_id",
        "channel",
        "generation",
        "account_generation",
        "fingerprint",
        "sent_at",
        "deadline",
        "payload",
        "status",
        "attempts",
        "error",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialEvent"
      WHERE "id" = (o_command ->> 'event_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = (o_command ->> 'account_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    v_id := uuid_generate_v4();
    IF o_command IS NULL OR o_event IS NULL OR o_account IS NULL OR ((o_command ->> 'state') != 'waiting') OR NOT ((i_kind = 'verify-account') OR (i_kind = 'prepare-link')) THEN
      RAISE EXCEPTION 'Invalid external social action';
    END IF;
    DECLARE
      o_action JSONB;
      v_audit UUID;
      v_log UUID;
    BEGIN
      v_audit := "finfolk_rpc".create_social_audit('SocialAction',v_id,o_op);
      WITH j_ret AS (  
        INSERT INTO "finfolk"."SocialAction" (
          "id",
          "event_id",
          "command_id",
          "inbox_id",
          "generation",
          "account_generation",
          "deadline",
          "account_id",
          "source_id",
          "kind",
          "state",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        ) VALUES (
          (v_id)::UUID,
          ((o_event ->> 'id')::UUID)::UUID,
          (i_command)::UUID,
          (o_command ->> 'inbox_id')::UUID,
          (o_event ->> 'generation')::INTEGER,
          (o_account ->> 'generation')::INTEGER,
          (least(
          (o_event ->> 'deadline')::BIGINT,
          (1000000 * extract(epoch FROM now()))::BIGINT + 600000000
        ))::BIGINT,
          ((o_account ->> 'id')::UUID)::UUID,
          (i_command)::TEXT,
          (i_kind)::"finfolk"."EnumSocialActionKind",
          ('pending')::TEXT,
          (v_audit)::UUID,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT,
          (o_op ->> 'time')::BIGINT
        ) RETURNING
          "id",
          "event_id",
          "command_id",
          "inbox_id",
          "generation",
          "account_generation",
          "attempts",
          "lease",
          "lease_until",
          "deadline",
          "next_attempt_at",
          "error_code",
          "result",
          "account_id",
          "source_id",
          "kind",
          "owner_id",
          "state",
          "data",
          "member_confirmed",
          "session_id",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_action;
      v_log := "finfolk_rpc".record_social_audit('SocialAction',v_audit,'queued',o_op);
      RETURN v_id;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/finish-social-command-reply 
CREATE OR REPLACE FUNCTION "finfolk_rpc".finish_social_command_reply(
  i_command UUID,
  i_body TEXT,
  i_ciphertext TEXT,
  i_context JSONB,
  i_result JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_command JSONB;
    o_event JSONB;
    o_payload JSONB;
    v_body TEXT;
    v_inbox UUID;
    v_message UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "event_id",
        "inbox_id",
        "generation",
        "account_id",
        "key",
        "context",
        "external_actor_id",
        "external_media_id",
        "owner_id",
        "connection_id",
        "identity_version",
        "command",
        "args",
        "source_url",
        "comment_at",
        "received_at",
        "state",
        "result",
        "site_id",
        "visit_day",
        "reply",
        "send_state",
        "external_reply_id",
        "send_started_at",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialCommand"
      WHERE "id" = i_command
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "key",
        "account_id",
        "inbox_id",
        "message_id",
        "channel",
        "generation",
        "account_generation",
        "fingerprint",
        "sent_at",
        "deadline",
        "payload",
        "status",
        "attempts",
        "error",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialEvent"
      WHERE "id" = (o_command ->> 'event_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
    o_payload := (o_event -> 'payload');
    v_inbox := (o_command ->> 'inbox_id')::UUID;
    v_body := CASE WHEN i_ciphertext IS NOT NULL THEN '[Private connection code]'
    WHEN true THEN i_body
    END;
    v_message := null;
    IF (o_event ->> 'channel') = 'message' THEN
      DECLARE
      o_incoming JSONB;
        o_outgoing JSONB;
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
            "time_created"
          FROM "finfolk"."MessagingMessage"
          WHERE "id" = (o_event ->> 'message_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_incoming;
        WITH j_ret AS (  
          INSERT INTO "finfolk"."MessagingMessage" ("account_id","conversation_id","direction","body","metadata") VALUES (
            (v_inbox)::UUID,
            (o_incoming ->> 'conversation_id')::UUID,
            ('outbound')::"finfolk"."EnumMessagingDirection",
            (v_body)::TEXT,
            ('{}')::JSONB
          ) RETURNING
            "id",
            "account_id",
            "conversation_id",
            "direction",
            "external_id",
            "body",
            "metadata",
            "sent_at",
            "time_created")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_outgoing;
        v_message := (o_outgoing ->> 'id')::UUID;
    END;
    END IF;
    DECLARE
      o_delivery JSONB;
      o_finished JSONB;
      o_finished_event JSONB;
    BEGIN
      WITH j_ret AS (  
        INSERT INTO "finfolk"."MessagingOutbox" (
          "account_id",
          "event_id",
          "command_id",
          "channel",
          "recipient",
          "thread",
          "comment",
          "message_id",
          "body",
          "correlation_id",
          "generation",
          "deadline",
          "body_ciphertext",
          "cipher_context",
          "reply_kind"
        ) VALUES (
          (v_inbox)::UUID,
          ((o_event ->> 'id')::UUID)::UUID,
          (i_command)::UUID,
          (o_event ->> 'channel')::"finfolk"."EnumSocialCommandContext",
          (o_payload ->> 'senderId')::TEXT,
          (CASE WHEN (o_event ->> 'channel') = 'message' THEN o_payload ->> 'conversationId'
        WHEN true THEN null
        END)::TEXT,
          (CASE WHEN (o_event ->> 'channel') = 'message' THEN null
        WHEN true THEN o_payload ->> 'messageId'
        END)::TEXT,
          (v_message)::UUID,
          "finfolk".as_bounded_text((v_body)::TEXT,0,2000),
          (uuid_generate_v4())::UUID,
          (o_event ->> 'generation')::INTEGER,
          (least((o_event ->> 'deadline')::BIGINT,coalesce(
          (i_result ->> 'expiresAt')::BIGINT,
          (o_event ->> 'deadline')::BIGINT
        )))::BIGINT,
          (i_ciphertext)::TEXT,
          "finfolk".as_jsonb((coalesce(i_context,('{}')::JSONB))::JSONB),
          (CASE WHEN i_ciphertext IS NULL THEN 'text'
        WHEN true THEN 'connect_code'
        END)::"finfolk"."EnumMessagingOutboxReplyKind"
        ) RETURNING
          "id",
          "account_id",
          "event_id",
          "command_id",
          "channel",
          "recipient",
          "thread",
          "comment",
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
          "time_created",
          "time_updated",
          "body_ciphertext",
          "cipher_context",
          "reply_kind")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_delivery;
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialCommand" SET
          "state" = ('done')::"finfolk"."EnumSocialCommandStatus",
          "result" = (i_result)::JSONB,
          "reply" = (v_body)::TEXT,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = i_command
        RETURNING
          "id",
          "event_id",
          "inbox_id",
          "generation",
          "account_id",
          "key",
          "context",
          "external_actor_id",
          "external_media_id",
          "owner_id",
          "connection_id",
          "identity_version",
          "command",
          "args",
          "source_url",
          "comment_at",
          "received_at",
          "state",
          "result",
          "site_id",
          "visit_day",
          "reply",
          "send_state",
          "external_reply_id",
          "send_started_at",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_finished;
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialEvent" SET
          "status" = ('completed')::TEXT,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = (o_event ->> 'id')::UUID
        RETURNING
          "id",
          "provider",
          "namespace",
          "key",
          "account_id",
          "inbox_id",
          "message_id",
          "channel",
          "generation",
          "account_generation",
          "fingerprint",
          "sent_at",
          "deadline",
          "payload",
          "status",
          "attempts",
          "error",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_finished_event;
      RETURN jsonb_build_object(
        'commandId',
        i_command,
        'status',
        'completed',
        'deliveryId',
        (o_delivery ->> 'id')::UUID
      );
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/retire-social-code-deliveries 
CREATE OR REPLACE FUNCTION "finfolk_rpc".retire_social_code_deliveries(
  i_account UUID
) RETURNS JSONB AS $$

  DECLARE
    o_proof JSONB;
    o_proofs JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnectionProof"
      WHERE "account_id" = i_account AND "status" IN ('pending','verified'))
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_proofs;
    o_proof := null;
    FOR o_proof IN SELECT jsonb_array_elements(coalesce(o_proofs,('[]')::JSONB)) LOOP
      DECLARE
        o_cancelled JSONB;
        o_uncertain JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingOutbox" SET
            "state" = ('cancelled')::"finfolk"."EnumMessagingOutboxStatus",
            "error_code" = ('proof_replaced')::TEXT,
            "body_ciphertext" = (null)::TEXT,
            "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
          WHERE "event_id" = (o_proof ->> 'event_id')::UUID
          AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
          AND "reply_kind" = ('connect_code')::"finfolk"."EnumMessagingOutboxReplyKind"
          RETURNING
            "id",
            "account_id",
            "event_id",
            "command_id",
            "channel",
            "recipient",
            "thread",
            "comment",
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
            "time_created",
            "time_updated",
            "body_ciphertext",
            "cipher_context",
            "reply_kind")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_cancelled;
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingOutbox" SET
            "state" = ('uncertain')::"finfolk"."EnumMessagingOutboxStatus",
            "lease" = (null)::UUID,
            "lease_until" = (null)::BIGINT,
            "error_code" = ('proof_replaced')::TEXT,
            "body_ciphertext" = (null)::TEXT,
            "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
          WHERE "event_id" = (o_proof ->> 'event_id')::UUID
          AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
          AND "reply_kind" = ('connect_code')::"finfolk"."EnumMessagingOutboxReplyKind"
          RETURNING
            "id",
            "account_id",
            "event_id",
            "command_id",
            "channel",
            "recipient",
            "thread",
            "comment",
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
            "time_created",
            "time_updated",
            "body_ciphertext",
            "cipher_context",
            "reply_kind")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_uncertain;
        null;
      END;
    END LOOP;
    RETURN ('{}')::JSONB;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/expire-social-action 
CREATE OR REPLACE FUNCTION "finfolk_rpc".expire_social_action(
  o_action JSONB,
  i_error TEXT,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_command JSONB;
    o_event JSONB;
    o_expired JSONB;
    v_log UUID;
  BEGIN
    WITH j_ret AS (  
      UPDATE "finfolk"."SocialAction" SET
        "lease" = (null)::UUID,
        "lease_until" = (null)::BIGINT,
        "error_code" = (i_error)::TEXT,
        "state" = ('expired')::TEXT,
        "op_updated" = (o_op ->> 'id')::UUID,
        "time_updated" = (o_op ->> 'time')::BIGINT
      WHERE "id" = (o_action ->> 'id')::UUID
      RETURNING
        "id",
        "event_id",
        "command_id",
        "inbox_id",
        "generation",
        "account_generation",
        "attempts",
        "lease",
        "lease_until",
        "deadline",
        "next_attempt_at",
        "error_code",
        "result",
        "account_id",
        "source_id",
        "kind",
        "owner_id",
        "state",
        "data",
        "member_confirmed",
        "session_id",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
    WITH j_ret AS (  
      UPDATE "finfolk"."SocialCommand" SET
        "state" = ('expired')::"finfolk"."EnumSocialCommandStatus",
        "result" = (jsonb_build_object('error',i_error))::JSONB,
        "op_updated" = (o_op ->> 'id')::UUID,
        "time_updated" = (o_op ->> 'time')::BIGINT
      WHERE "id" = (o_action ->> 'command_id')::UUID
      RETURNING
        "id",
        "event_id",
        "inbox_id",
        "generation",
        "account_id",
        "key",
        "context",
        "external_actor_id",
        "external_media_id",
        "owner_id",
        "connection_id",
        "identity_version",
        "command",
        "args",
        "source_url",
        "comment_at",
        "received_at",
        "state",
        "result",
        "site_id",
        "visit_day",
        "reply",
        "send_state",
        "external_reply_id",
        "send_started_at",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_command;
    WITH j_ret AS (  
      UPDATE "finfolk"."SocialEvent" SET
        "status" = ('expired')::TEXT,
        "error" = (i_error)::TEXT,
        "op_updated" = (o_op ->> 'id')::UUID,
        "time_updated" = (o_op ->> 'time')::BIGINT
      WHERE "id" = (o_action ->> 'event_id')::UUID
      RETURNING
        "id",
        "provider",
        "namespace",
        "key",
        "account_id",
        "inbox_id",
        "message_id",
        "channel",
        "generation",
        "account_generation",
        "fingerprint",
        "sent_at",
        "deadline",
        "payload",
        "status",
        "attempts",
        "error",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_event;
    v_log := "finfolk_rpc".record_social_audit('SocialAction',(o_action ->> 'audit_id')::UUID,'expired',o_op);
    RETURN ('{}')::JSONB;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/claim-social-action 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_social_action(
  i_application UUID,
  i_inbox UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF ((o_inbox ->> 'mode') = 'disabled') OR ((o_inbox ->> 'backoff_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    DECLARE
      o_action JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "event_id",
          "command_id",
          "inbox_id",
          "generation",
          "account_generation",
          "attempts",
          "lease",
          "lease_until",
          "deadline",
          "next_attempt_at",
          "error_code",
          "result",
          "account_id",
          "source_id",
          "kind",
          "owner_id",
          "state",
          "data",
          "member_confirmed",
          "session_id",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialAction"
        WHERE "inbox_id" = i_inbox
        AND "state" = 'pending'
        AND "next_attempt_at" <= (1000000 * extract(epoch FROM now()))::BIGINT
        ORDER BY "time_created","id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_action;
      IF o_action is null  THEN
        RETURN null;
      END IF;
      DECLARE
        o_account JSONB;
        o_event JSONB;
        v_lease UUID;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialAccount"
          WHERE "id" = (o_action ->> 'account_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
        WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "key",
            "account_id",
            "inbox_id",
            "message_id",
            "channel",
            "generation",
            "account_generation",
            "fingerprint",
            "sent_at",
            "deadline",
            "payload",
            "status",
            "attempts",
            "error",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialEvent"
          WHERE "id" = (o_action ->> 'event_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
        v_lease := uuid_generate_v4();
        IF NOT jsonb_exists(o_inbox -> 'enabled_commands','connect') OR ((o_action ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR ((o_action ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_action ->> 'account_generation')::INTEGER != (o_account ->> 'generation')::INTEGER) OR (((o_inbox ->> 'mode') = 'pilot') AND NOT jsonb_exists(
          o_inbox -> 'pilot_sender_ids',
          (o_event -> 'payload') ->> 'senderId'
        )) THEN
          PERFORM "finfolk_rpc".expire_social_action(o_action,'action_expired',o_op);
          RETURN null;
        END IF;
        DECLARE
          o_claimed JSONB;
          v_log UUID;
        BEGIN
          WITH j_ret AS (  
            UPDATE "finfolk"."SocialAction" SET
              "attempts" = "finfolk".as_bounded_integer(
              ((o_action ->> 'attempts')::INTEGER + 1)::INTEGER,
              0,
              2147483647
            ),
              "lease" = (v_lease)::UUID,
              "lease_until" = ((1000000 * extract(epoch FROM now()))::BIGINT + 30000000)::BIGINT,
              "state" = ('running')::TEXT,
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "id" = (o_action ->> 'id')::UUID
            RETURNING
              "id",
              "event_id",
              "command_id",
              "inbox_id",
              "generation",
              "account_generation",
              "attempts",
              "lease",
              "lease_until",
              "deadline",
              "next_attempt_at",
              "error_code",
              "result",
              "account_id",
              "source_id",
              "kind",
              "owner_id",
              "state",
              "data",
              "member_confirmed",
              "session_id",
              "audit_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_claimed;
          v_log := "finfolk_rpc".record_social_audit('SocialAction',(o_action ->> 'audit_id')::UUID,'claimed',o_op);
          RETURN jsonb_build_object('id',(o_action ->> 'id')::UUID,'lease',v_lease,'kind',o_action ->> 'kind','deadline',o_action -> 'deadline','binding',jsonb_build_object(
            'actionId',
            (o_action ->> 'id')::UUID,
            'lease',
            v_lease,
            'inboxId',
            i_inbox,
            'eventId',
            o_action -> 'event_id',
            'generation',
            o_action -> 'generation',
            'accountGeneration',
            o_action -> 'account_generation'
          ),'request',jsonb_build_object(
            'provider',
            o_account ->> 'provider',
            'namespace',
            o_account ->> 'namespace',
            'externalId',
            o_account ->> 'external_id',
            'codeLength',
            8,
            'alphabet',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
            'prefix',
            'Your FinFolk connection code: ',
            'suffix',
            '. Enter it in your FinFolk account within 10 minutes.'
          ));
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-actions/complete-social-action 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_social_action(
  i_application UUID,
  i_inbox UUID,
  i_action UUID,
  i_lease UUID,
  i_outcome TEXT,
  i_result JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_action JSONB;
    o_inbox JSONB;
    o_initial JSONB;
    o_result JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    WITH j_ret AS (  
      SELECT
        "id",
        "event_id",
        "command_id",
        "inbox_id",
        "generation",
        "account_generation",
        "attempts",
        "lease",
        "lease_until",
        "deadline",
        "next_attempt_at",
        "error_code",
        "result",
        "account_id",
        "source_id",
        "kind",
        "owner_id",
        "state",
        "data",
        "member_confirmed",
        "session_id",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAction"
      WHERE "id" = i_action AND "inbox_id" = i_inbox
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_initial;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = (o_initial ->> 'account_id')::UUID
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT
        "id",
        "event_id",
        "command_id",
        "inbox_id",
        "generation",
        "account_generation",
        "attempts",
        "lease",
        "lease_until",
        "deadline",
        "next_attempt_at",
        "error_code",
        "result",
        "account_id",
        "source_id",
        "kind",
        "owner_id",
        "state",
        "data",
        "member_confirmed",
        "session_id",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAction"
      WHERE "id" = i_action AND "inbox_id" = i_inbox
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_action;
    o_result := "finfolk".as_jsonb(i_result);
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF o_action IS NULL OR i_lease IS NULL OR ((o_action ->> 'state') != 'running') OR ((o_action ->> 'lease')::UUID != i_lease) OR ((o_action ->> 'lease_until')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR ((o_action ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR ((o_inbox ->> 'mode') = 'disabled') OR NOT jsonb_exists(o_inbox -> 'enabled_commands','connect') OR ((o_action ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_action ->> 'account_generation')::INTEGER != (o_account ->> 'generation')::INTEGER) THEN
      RETURN null;
    END IF;
    DECLARE
      o_binding JSONB;
      o_event JSONB;
      v_command UUID;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "provider",
          "namespace",
          "key",
          "account_id",
          "inbox_id",
          "message_id",
          "channel",
          "generation",
          "account_generation",
          "fingerprint",
          "sent_at",
          "deadline",
          "payload",
          "status",
          "attempts",
          "error",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialEvent"
        WHERE "id" = (o_action ->> 'event_id')::UUID
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
      v_command := (o_action ->> 'command_id')::UUID;
      o_binding := jsonb_build_object(
        'actionId',
        i_action,
        'lease',
        i_lease,
        'inboxId',
        i_inbox,
        'eventId',
        o_action -> 'event_id',
        'generation',
        o_action -> 'generation',
        'accountGeneration',
        o_action -> 'account_generation'
      );
      IF ((o_inbox ->> 'mode') = 'pilot') AND NOT jsonb_exists(
        o_inbox -> 'pilot_sender_ids',
        (o_event -> 'payload') ->> 'senderId'
      ) THEN
        RETURN null;
      END IF;
      IF i_outcome IS NULL OR NOT ((i_outcome = 'success') OR (i_outcome = 'retry') OR (i_outcome = 'failed')) OR (coalesce(o_result -> 'binding',('{}')::JSONB) != o_binding) THEN
        RAISE EXCEPTION 'External action result does not match its claim';
      END IF;
      IF i_outcome != 'success' THEN
        DECLARE
        o_failed JSONB;
          v_log UUID;
          v_retry BOOLEAN;
      BEGIN
        v_retry := ((i_outcome = 'retry') AND ((o_action ->> 'attempts')::INTEGER < 3));
          WITH j_ret AS (  
            UPDATE "finfolk"."SocialAction" SET
              "lease" = (null)::UUID,
              "lease_until" = (null)::BIGINT,
              "next_attempt_at" = ((1000000 * extract(epoch FROM now()))::BIGINT + ((o_action ->> 'attempts')::INTEGER * 30000000))::BIGINT,
              "error_code" = ('external_effect_failed')::TEXT,
              "state" = (CASE WHEN v_retry THEN 'pending'
            WHEN true THEN 'failed'
            END)::TEXT,
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "id" = i_action
            RETURNING
              "id",
              "event_id",
              "command_id",
              "inbox_id",
              "generation",
              "account_generation",
              "attempts",
              "lease",
              "lease_until",
              "deadline",
              "next_attempt_at",
              "error_code",
              "result",
              "account_id",
              "source_id",
              "kind",
              "owner_id",
              "state",
              "data",
              "member_confirmed",
              "session_id",
              "audit_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_failed;
          v_log := "finfolk_rpc".record_social_audit('SocialAction',(o_action ->> 'audit_id')::UUID,CASE WHEN v_retry THEN 'retry'
          WHEN true THEN 'failed'
          END,o_op);
          IF NOT v_retry THEN
            PERFORM "finfolk_rpc".finish_social_command_reply(
              v_command,
              'Unable to verify your social account. Try /connect again later.',
              null,
              null,
              ('{"error":"external_effect_failed"}')::JSONB,
              o_op
            );
          END IF;
          RETURN jsonb_build_object('id',i_action,'status',CASE WHEN v_retry THEN 'pending'
          WHEN true THEN 'failed'
          END);
      END;
      END IF;
      IF (o_action ->> 'kind') = 'verify-account' THEN
        IF ((((((o_result - 'binding') - 'provider') - 'namespace') - 'externalId') - 'eligible') != ('{}')::JSONB) OR (coalesce(o_result ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_result ->> 'namespace','') != (o_account ->> 'namespace')) OR (coalesce(o_result ->> 'externalId','') != (o_account ->> 'external_id')) OR (coalesce(jsonb_typeof(o_result -> 'eligible'),'null') != 'boolean') THEN
          RAISE EXCEPTION 'Provider evidence does not match the requested identity';
        END IF;
        IF (o_result ->> 'eligible')::BOOLEAN THEN
          DECLARE
        v_next UUID;
      BEGIN
        v_next := "finfolk_rpc".enqueue_social_action(v_command,'prepare-link',o_op);
            null;
      END;
        ELSE
          PERFORM "finfolk_rpc".finish_social_command_reply(
            v_command,
            'This social account is not eligible to connect.',
            null,
            null,
            ('{"error":"account_ineligible"}')::JSONB,
            o_op
          );
        END IF;
      ELSIF (o_action ->> 'kind') = 'prepare-link' THEN
        DECLARE
        v_ciphertext TEXT;
          v_code TEXT;
          v_hash TEXT;
      BEGIN
        v_code := (o_result ->> 'code');
          v_hash := (o_result ->> 'tokenHash');
          v_ciphertext := (o_result ->> 'ciphertext');
          IF (((((o_result - 'binding') - 'code') - 'tokenHash') - 'ciphertext') != ('{}')::JSONB) OR v_code IS NULL OR (jsonb_typeof(o_result -> 'code') != 'string') OR NOT "regexp_like"(v_code,'^[A-Z0-9]{8}$') OR v_hash IS NULL OR (jsonb_typeof(o_result -> 'tokenHash') != 'string') OR (v_hash != "encode"("digest"(v_code,'sha256'),'hex')) OR v_ciphertext IS NULL OR (jsonb_typeof(o_result -> 'ciphertext') != 'string') OR (length(v_ciphertext) < 40) OR (length(v_ciphertext) > 8192) THEN
            RAISE EXCEPTION 'Invalid connection code preparation';
          END IF;
          PERFORM "finfolk_rpc".retire_social_code_deliveries((o_account ->> 'id')::UUID);
          DECLARE
            o_old JSONB;
            o_proof JSONB;
          BEGIN
            WITH j_ret AS (  
              UPDATE "finfolk"."SocialConnectionProof" SET
                "status" = ('revoked')::"finfolk"."EnumSocialProofStatus",
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "account_id" = (o_account ->> 'id')::UUID
              AND "status" IN ('pending','verified')
              RETURNING
                "id",
                "account_id",
                "user_id",
                "connection_id",
                "event_id",
                "inbox_id",
                "receipt_id",
                "kind",
                "token_hash",
                "nonce_hash",
                "flow_key",
                "generation",
                "status",
                "expires_at",
                "verified_at",
                "consumed_at",
                "consumed_version",
                "error",
                "provider_data",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_old;
            WITH j_ret AS (  
              INSERT INTO "finfolk"."SocialConnectionProof" (
                "account_id",
                "event_id",
                "inbox_id",
                "kind",
                "token_hash",
                "generation",
                "status",
                "expires_at",
                "verified_at",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              ) VALUES (
                ((o_account ->> 'id')::UUID)::UUID,
                ((o_event ->> 'id')::UUID)::UUID,
                (i_inbox)::UUID,
                ('message')::"finfolk"."EnumSocialProofKind",
                (v_hash)::TEXT,
                (o_account ->> 'generation')::INTEGER,
                ('verified')::"finfolk"."EnumSocialProofStatus",
                ((1000000 * extract(epoch FROM now()))::BIGINT + 600000000)::BIGINT,
                (1000000 * extract(epoch FROM now()))::BIGINT,
                (o_op ->> 'id')::UUID,
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT,
                (o_op ->> 'time')::BIGINT
              ) RETURNING
                "id",
                "account_id",
                "user_id",
                "connection_id",
                "event_id",
                "inbox_id",
                "receipt_id",
                "kind",
                "token_hash",
                "nonce_hash",
                "flow_key",
                "generation",
                "status",
                "expires_at",
                "verified_at",
                "consumed_at",
                "consumed_version",
                "error",
                "provider_data",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
            PERFORM "finfolk_rpc".finish_social_command_reply(v_command,null,v_ciphertext,o_binding,jsonb_build_object(
              'proofId',
              (o_proof ->> 'id')::UUID,
              'expiresAt',
              o_proof -> 'expires_at'
            ),o_op);
          END;
      END;
      ELSE
        RAISE EXCEPTION 'Unsupported external action kind';
      END IF;
      DECLARE
        o_finished JSONB;
        v_log UUID;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."SocialAction" SET
            "lease" = (null)::UUID,
            "lease_until" = (null)::BIGINT,
            "error_code" = (null)::TEXT,
            "result" = "finfolk".as_jsonb(('{"ok":true}')::JSONB),
            "state" = ('completed')::TEXT,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_action
          RETURNING
            "id",
            "event_id",
            "command_id",
            "inbox_id",
            "generation",
            "account_generation",
            "attempts",
            "lease",
            "lease_until",
            "deadline",
            "next_attempt_at",
            "error_code",
            "result",
            "account_id",
            "source_id",
            "kind",
            "owner_id",
            "state",
            "data",
            "member_confirmed",
            "session_id",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_finished;
        v_log := "finfolk_rpc".record_social_audit(
          'SocialAction',
          (o_action ->> 'audit_id')::UUID,
          'completed',
          o_op
        );
        RETURN jsonb_build_object('id',i_action,'status','completed');
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

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
  "class_ref" UUID NOT NULL,
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
  "id" UUID DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType",
  "class_context" "finfolk"."EnumClassType",
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "access_id" UUID NOT NULL,
  "member_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "from_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "level" "finfolk"."EnumAccessRoleLevel" NOT NULL DEFAULT 'member',
  "scope" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  PRIMARY KEY (id,class_table,class_context,access_id),
  UNIQUE ("class_table","class_context","access_id","member_id"),
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
  "from_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reply_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "status" "finfolk"."EnumAccessRequestStatus" NOT NULL DEFAULT 'pending',
  "expires_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT + 604800000000,
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
  "from_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "reply_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "status" "finfolk"."EnumAccessInviteExternalStatus" NOT NULL DEFAULT 'pending',
  "expires_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT + 604800000000,
  "accepted_at" BIGINT,
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
  "from_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "reply_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumAccessInviteEmailStatus" NOT NULL DEFAULT 'pending',
  "expires_at" BIGINT NOT NULL,
  "accepted_at" BIGINT,
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

-- finfolkdb.common.type-directory-base/DirectoryListing 
CREATE TABLE IF NOT EXISTS "finfolk"."DirectoryListing" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('DirectoryListing')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "status" "finfolk"."EnumDirectoryListingStatus" NOT NULL DEFAULT 'candidate',
  "reviewed_at" BIGINT,
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
  "author_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
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
    o_base := "finfolk".insert_base_addons('DirectoryListing',v_id,o_document,o_op);
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
        (v_id)::UUID,
        ('closed')::"finfolk"."EnumAccessSetting",
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","setting","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_access;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Social" ("class_table","class_ref","op_created","time_created") VALUES (
        ('DirectoryListing')::"finfolk"."EnumClassType",
        (v_id)::UUID,
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
      (o_listing ->> 'id')::UUID,
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

-- finfolkdb.common.type-trip-base/Trip 
CREATE TABLE IF NOT EXISTS "finfolk"."Trip" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Trip')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "owner_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
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
CREATE INDEX ON "finfolk"."Trip" ("site_id");

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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "import_id" UUID NOT NULL REFERENCES "finfolk"."TripImport"("id") ON DELETE CASCADE,
  "ordinal" INTEGER NOT NULL,
  "day" DATE NOT NULL,
  "detail" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("import_id","ordinal"),
  CONSTRAINT positive_ordinal CHECK ("ordinal" > 0)
);

-- finfolkdb.common.type-trip-base/TripImportBatch 
CREATE TABLE IF NOT EXISTS "finfolk"."TripImportBatch" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "import_id" UUID NOT NULL REFERENCES "finfolk"."TripImport"("id") ON DELETE CASCADE,
  "index" INTEGER NOT NULL,
  "rows" JSONB NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("import_id","index"),
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
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "status" "finfolk"."EnumTripPublicationStatus" NOT NULL DEFAULT 'pending',
  "public_consent" BOOLEAN NOT NULL DEFAULT false,
  "published_at" BIGINT,
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

-- finfolkdb.fn.user.user-manage-trips/insert-trip 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_trip(
  i_owner UUID,
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
    o_base := "finfolk".insert_base_addons('Trip',v_id,o_draft,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Trip" (
        "id",
        "owner_id",
        "site_id",
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
        (i_owner)::UUID,
        (o_draft ->> 'beachId')::UUID,
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
        "site_id",
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
  i_owner UUID
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
        "site_id",
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
    RETURN jsonb_build_object('id',(o_trip ->> 'id')::UUID,'draft',(o_trip -> 'detail') || jsonb_build_object(
      'beachId',
      (o_trip ->> 'site_id')::UUID,
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
  i_owner UUID,
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
        "site_id",
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
  i_owner UUID,
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
        "site_id",
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
          "id",
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
            "id",
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
  i_owner UUID,
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
                    "id",
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
              ) RETURNING "id","rev_id","version","deltas","op_created","time_created")
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
              ) RETURNING "id","audit_id","op_created","time_created")
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
      SELECT "site_id","detail" FROM "finfolk"."TripPublication"
      WHERE "trip_id" = i_trip_id
      AND "status" = (i_status)::"finfolk"."EnumTripPublicationStatus"
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_publication;
    IF o_publication is null  THEN
      RETURN null;
    END IF;
    RETURN (o_publication -> 'detail') || jsonb_build_object('beachId',(o_publication ->> 'site_id')::UUID);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/set-trip-publication 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_trip_publication(
  i_trip_id UUID,
  i_owner UUID,
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
        "site_id",
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
      IF (i_revision != (o_rev ->> 'index')::INTEGER) OR (o_snapshot ->> 'beachId')::UUID IS NULL OR ((o_snapshot ->> 'beachId')::UUID != (o_trip ->> 'site_id')::UUID) THEN
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
            "site_id",
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
                "site_id",
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
          v_time BIGINT;
        BEGIN
          v_status := 'pending';
          v_time := null;
          IF coalesce(i_approved,false) THEN
            v_status := 'published';
            v_time := (1000000 * extract(epoch FROM now()))::BIGINT;
          END IF;
          DECLARE
            o_log JSONB;
            o_publication JSONB;
          BEGIN
            WITH j_ret AS (  
              INSERT INTO "finfolk"."TripPublication" (
                "trip_id",
                "site_id",
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
                (o_snapshot ->> 'beachId')::UUID,
                (v_status)::"finfolk"."EnumTripPublicationStatus",
                (true)::BOOLEAN,
                (v_time)::BIGINT,
                "finfolk".as_jsonb((o_snapshot - 'beachId')::JSONB),
                (o_op ->> 'id')::UUID,
                (o_op ->> 'id')::UUID,
                (o_op ->> 'time')::BIGINT,
                (o_op ->> 'time')::BIGINT
              ) RETURNING
                "id",
                "trip_id",
                "site_id",
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
              ) RETURNING "id","audit_id","op_created","time_created")
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
      SELECT "site_id","published_at","detail" FROM "finfolk"."TripPublication"
      WHERE "trip_id" = i_trip_id
      AND "status" = ('published')::"finfolk"."EnumTripPublicationStatus"
      AND "public_consent" = true
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_publication;
    o_data := (o_publication -> 'detail');
    IF o_trip IS NULL OR o_publication IS NULL OR NOT "finfolk".is_user_active((o_trip ->> 'owner_id')::UUID) THEN
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
      (o_publication ->> 'site_id')::UUID,
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
      "finfolk".as_iso_time((o_publication ->> 'published_at')::BIGINT)
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
    IF o_trip IS NULL OR i_review_token IS NULL OR v_decision IS NULL OR NOT "finfolk".is_user_active((o_trip ->> 'owner_id')::UUID) THEN
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
            "site_id",
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
            "published_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "trip_id" = i_trip_id
          AND "status" = ('pending')::"finfolk"."EnumTripPublicationStatus"
          AND "public_consent" = true
          RETURNING
            "id",
            "trip_id",
            "site_id",
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
            "site_id",
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
            "site_id",
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
        ) RETURNING "id","audit_id","op_created","time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
      RETURN jsonb_build_object('ok',true);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/withdraw-trip-publication 
CREATE OR REPLACE FUNCTION "finfolk_rpc".withdraw_trip_publication(
  i_trip_id UUID,
  i_owner UUID,
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
          "site_id",
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
        ) RETURNING "id","audit_id","op_created","time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
      RETURN jsonb_build_object('ok',true);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-trips/update-trip-draft 
CREATE OR REPLACE FUNCTION "finfolk_rpc".update_trip_draft(
  i_trip_id UUID,
  i_owner UUID,
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
            "site_id" = (o_draft ->> 'beachId')::UUID,
            "start_date" = (v_start)::DATE,
            "end_date" = (v_end)::DATE,
            "detail" = "finfolk".as_jsonb((((o_draft - 'beachId') - 'start') - 'end')::JSONB),
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_trip_id AND "owner_id" = i_owner
          RETURNING
            "id",
            "owner_id",
            "site_id",
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
          ) RETURNING "id","rev_id","version","deltas","op_created","time_created")
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
          ) RETURNING "id","audit_id","op_created","time_created")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
        RETURN jsonb_build_object('id',i_trip_id,'revision',i_revision + 1);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-reward/UserInvitation 
CREATE TABLE IF NOT EXISTS "finfolk"."UserInvitation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "code" TEXT NOT NULL,
  "inviter_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("code"),
  UNIQUE ("inviter_id")
);

-- finfolkdb.common.type-user-reward/UserInvitationJoin 
CREATE TABLE IF NOT EXISTS "finfolk"."UserInvitationJoin" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "invitee_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "inviter_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "verified_sender_id" TEXT,
  "rewarded_at" BIGINT,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("invitee_id"),
  UNIQUE ("verified_sender_id"),
  CONSTRAINT check_0 CHECK ("invitee_id" != "inviter_id")
);

-- finfolkdb.common.type-user-reward/UserPointsEntry 
CREATE TABLE IF NOT EXISTS "finfolk"."UserPointsEntry" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "action_id" UUID NOT NULL REFERENCES "finfolk"."SocialAction"("id"),
  "day" DATE NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 1,
  "reversed" BOOLEAN NOT NULL DEFAULT false,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("user_id","day"),
  UNIQUE ("action_id"),
  CONSTRAINT check_0 CHECK ("points" = 1)
);

-- finfolkdb.common.type-user-reward/UserRequestLimit 
CREATE TABLE IF NOT EXISTS "finfolk"."UserRequestLimit" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "minute" BIGINT NOT NULL,
  "count" INTEGER NOT NULL,
  UNIQUE ("user_id")
);

-- finfolkdb.common.type-event/Event 
CREATE TABLE IF NOT EXISTS "finfolk"."Event" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "class_table" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Event')::"finfolk"."EnumClassType") STORED,
  "class_context" "finfolk"."EnumClassType" GENERATED ALWAYS AS (('Global')::"finfolk"."EnumClassType") STORED,
  "listing_id" UUID NOT NULL REFERENCES "finfolk"."DirectoryListing"("id"),
  "status" "finfolk"."EnumEventStatus" NOT NULL DEFAULT 'draft',
  "visibility" "finfolk"."EnumEventVisibility" NOT NULL DEFAULT 'public',
  "starts_at" BIGINT NOT NULL,
  "ends_at" BIGINT NOT NULL,
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "event_id" UUID NOT NULL REFERENCES "finfolk"."Event"("id"),
  "member_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "status" "finfolk"."EnumEventRsvpStatus" NOT NULL,
  "op_created" UUID,
  "op_updated" UUID,
  "time_created" BIGINT,
  "time_updated" BIGINT,
  UNIQUE ("event_id","member_id")
);
CREATE INDEX ON "finfolk"."EventRsvp" ("member_id");

-- finfolkdb.fn.event.event-manage/insert-event 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_event(
  i_listing_id UUID,
  i_document JSONB,
  i_visibility TEXT,
  i_starts_at BIGINT,
  i_ends_at BIGINT,
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
    o_base := "finfolk".insert_base_addons('Event',v_id,o_document,o_op);
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
        (v_id)::UUID,
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
        (i_starts_at)::BIGINT,
        (i_ends_at)::BIGINT,
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

-- finfolkdb.common.type-shop-base/EnumFinnieRedemptionStatus 
DO $$
BEGIN
  CREATE TYPE "finfolk"."EnumFinnieRedemptionStatus" AS ENUM ('claimed','fulfilled','refunded');
EXCEPTION WHEN OTHERS THEN
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-shop-base/FinnieAccount 
CREATE TABLE IF NOT EXISTS "finfolk"."FinnieAccount" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "imported_points" BIGINT NOT NULL DEFAULT 0,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("user_id")
);

-- finfolkdb.common.type-shop-base/FinnieItem 
CREATE TABLE IF NOT EXISTS "finfolk"."FinnieItem" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" TEXT NOT NULL,
  "outlet" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "instructions" TEXT NOT NULL DEFAULT '',
  "cost" INTEGER NOT NULL,
  "stock" INTEGER,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "expires_at" BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  CONSTRAINT positive_cost CHECK ("cost" > 0),
  CONSTRAINT positive_revision CHECK ("revision" > 0),
  CONSTRAINT valid_stock CHECK ("stock" IS NULL OR ("stock" >= 0)),
  CONSTRAINT valid_title CHECK ((length("title") >= 1) AND (length("title") <= 160)),
  CONSTRAINT valid_outlet CHECK ((length("outlet") >= 1) AND (length("outlet") <= 160))
);

-- finfolkdb.common.type-shop-base/FinnieRedemption 
CREATE TABLE IF NOT EXISTS "finfolk"."FinnieRedemption" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."FinnieAccount"("id"),
  "item_id" UUID NOT NULL REFERENCES "finfolk"."FinnieItem"("id"),
  "request_key" UUID NOT NULL,
  "code" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cost" INTEGER NOT NULL,
  "item_snapshot" JSONB NOT NULL,
  "status" "finfolk"."EnumFinnieRedemptionStatus" NOT NULL DEFAULT 'claimed',
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "completed_at" BIGINT,
  UNIQUE ("account_id","request_key"),
  UNIQUE ("code"),
  CONSTRAINT positive_cost CHECK ("cost" > 0)
);

-- finfolkdb.common.type-shop-base/FinnieEntry 
CREATE TABLE IF NOT EXISTS "finfolk"."FinnieEntry" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "account_id" UUID NOT NULL REFERENCES "finfolk"."FinnieAccount"("id"),
  "amount" BIGINT NOT NULL,
  "reference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("account_id","reference"),
  CONSTRAINT nonzero_amount CHECK ("amount" != 0)
);

-- finfolkdb.fn.social.social-commands/social-command-registry 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_command_registry() RETURNS JSONB AS $$
BEGIN
  RETURN ('{"help":{"public":true},"ping":{"public":true},"site":{"public":true},"privacy":{"public":true},"status":{"public":true},"connect":{"public":true,"privateChannel":true},"disconnect":{"member":true,"privateChannel":true},"whoami":{"member":true,"privateChannel":true,"mockOnly":true}}')::JSONB;
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.fn.social.social-commands/parse-social-command 
CREATE OR REPLACE FUNCTION "finfolk_rpc".parse_social_command(
  i_channel TEXT,
  i_text TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_policy JSONB;
    o_registry JSONB;
    v_args TEXT;
    v_name TEXT;
    v_text TEXT;
    v_topic TEXT;
  BEGIN
    v_text := btrim(coalesce(i_text,''));
    v_name := '';
    v_args := '';
    v_topic := '';
    o_registry := "finfolk_rpc".social_command_registry();
    o_policy := null;
    IF NOT ((i_channel = 'message') OR (i_channel = 'mention') OR (i_channel = 'owned')) THEN
      RAISE EXCEPTION 'Unknown social command channel';
    END IF;
    IF (length(v_text) > 2000) OR ("strpos"(v_text,"chr"(10)) > 0) OR ("strpos"(v_text,"chr"(13)) > 0) THEN
      RETURN jsonb_build_object('command','help','error','one_command','args',('{}')::JSONB);
    END IF;
    IF (i_channel = 'mention') AND NOT coalesce("regexp_like"(
      v_text,
      '(^|[[:space:]])@finfolk[.]com[.]au([!?,]?)([[:space:]]|$)',
      'i'
    ),false) THEN
      RETURN jsonb_build_object('command','none','args',('{}')::JSONB);
    END IF;
    IF i_channel != 'message' THEN
      v_text := btrim(regexp_replace(
        v_text,
        '(^|[[:space:]])@finfolk[.]com[.]au([!?,]?)([[:space:]]|$)',
        ' ',
        'gi'
      ));
    END IF;
    IF lower(v_text) = 'help' THEN
      v_text := '/help';
    END IF;
    IF NOT "starts_with"(v_text,'/') THEN
      RETURN jsonb_build_object('command','none','args',('{}')::JSONB);
    END IF;
    v_name := lower(regexp_replace(v_text,'^/([A-Za-z]+).*$','\1'));
    v_args := btrim(regexp_replace(v_text,'^/[A-Za-z]+',''));
    IF v_name = 'menu' THEN
      v_name := 'help';
    END IF;
    IF v_name = 'claim' THEN
      RETURN jsonb_build_object('command','help','guidance','claim_retired','args',('{}')::JSONB);
    END IF;
    IF NOT jsonb_exists(o_registry,v_name) THEN
      RETURN jsonb_build_object('command','help','error','unknown_command','args',('{}')::JSONB);
    END IF;
    o_policy := (o_registry -> v_name);
    IF (i_channel != 'message') AND coalesce((o_policy ->> 'privateChannel')::BOOLEAN,false) THEN
      RETURN jsonb_build_object(
        'command',
        'help',
        'guidance',
        'use_dm',
        'args',
        jsonb_build_object('command',v_name)
      );
    END IF;
    IF v_name = 'help' THEN
      v_topic := lower(v_args);
      IF NOT ((v_topic = '') OR (v_topic = 'account') OR (v_topic = 'diagnostics')) THEN
        RETURN jsonb_build_object('command','help','error','unknown_topic','args',('{}')::JSONB);
      END IF;
      RETURN jsonb_build_object(
        'command',
        'help',
        'args',
        jsonb_build_object('topic',v_topic),
        'policy',
        o_policy
      );
    END IF;
    IF v_args != '' THEN
      RETURN jsonb_build_object(
        'command',
        'help',
        'error',
        'unexpected_arguments',
        'args',
        jsonb_build_object('command',v_name)
      );
    END IF;
    RETURN jsonb_build_object('command',v_name,'args',('{}')::JSONB,'policy',o_policy);
  END;

$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.fn.social.social-commands/social-command-help 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_command_help(
  i_channel TEXT,
  i_provider TEXT,
  i_enabled JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_policy JSONB;
    o_registry JSONB;
    v_help TEXT;
    v_name TEXT;
  BEGIN
    o_registry := "finfolk_rpc".social_command_registry();
    v_help := 'Available commands:';
    v_name := null;
    o_policy := null;
    IF jsonb_typeof(i_enabled) != 'array' THEN
      RAISE EXCEPTION 'Enabled commands must be an array';
    END IF;
    FOR v_name IN SELECT jsonb_array_elements_text(i_enabled) LOOP
      o_policy := (o_registry -> v_name);
      IF o_policy IS NOT NULL AND ((i_channel = 'message') OR NOT coalesce((o_policy ->> 'privateChannel')::BOOLEAN,false)) AND ((i_provider = 'mock') OR NOT coalesce((o_policy ->> 'mockOnly')::BOOLEAN,false)) THEN
        v_help := "concat"(v_help,"chr"(10),'/',v_name);
      END IF;
    END LOOP;
    RETURN jsonb_build_object('reply',v_help);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-commands/social-public-reply 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_public_reply(
  i_parsed JSONB,
  i_channel TEXT,
  i_provider TEXT,
  i_enabled JSONB
) RETURNS JSONB AS $$

  DECLARE
    v_command TEXT;
    v_guidance TEXT;
    v_topic TEXT;
  BEGIN
    v_command := (i_parsed ->> 'command');
    v_guidance := (i_parsed ->> 'guidance');
    v_topic := ((i_parsed -> 'args') ->> 'topic');
    IF (v_guidance IS NOT NULL OR i_parsed ->> 'error' IS NOT NULL) AND NOT jsonb_exists(i_enabled,'help') THEN
      RETURN null;
    END IF;
    IF v_guidance = 'use_dm' THEN
      RETURN jsonb_build_object(
        'reply',
        'For account commands, send a DM to @finfolk.com.au. Connection codes and personal details are never posted in comments.'
      );
    END IF;
    IF v_guidance = 'claim_retired' THEN
      RETURN jsonb_build_object(
        'reply',
        '/claim is retired. Send /connect in a DM to link your FinFolk account.'
      );
    END IF;
    IF i_parsed ->> 'error' is not null  THEN
      RETURN jsonb_build_object(
        'reply',
        'Please send one supported command at a time. Send /help for available commands.'
      );
    END IF;
    IF NOT jsonb_exists(i_enabled,v_command) THEN
      RETURN null;
    END IF;
    IF v_command = 'ping' THEN
      RETURN jsonb_build_object('reply','Pong.');
    END IF;
    IF v_command = 'site' THEN
      RETURN jsonb_build_object('reply','Explore FinFolk: https://finfolk.com.au');
    END IF;
    IF v_command = 'privacy' THEN
      RETURN jsonb_build_object(
        'reply',
        'Privacy and deletion information: https://api.finfolk.com.au/privacy'
      );
    END IF;
    IF v_command = 'help' THEN
      IF (v_topic = 'diagnostics') AND NOT jsonb_exists(i_enabled,'ping') THEN
        RETURN jsonb_build_object('reply','Diagnostics are not enabled.');
      END IF;
      IF (v_topic = 'account') AND NOT jsonb_exists(i_enabled,'connect') THEN
        RETURN jsonb_build_object(
          'reply',
          'Account linking is not enabled. Manage existing connections privately on FinFolk.'
        );
      END IF;
      IF v_topic = 'account' THEN
        RETURN jsonb_build_object(
          'reply',
          'Send /connect in a DM, then enter the private code in your signed-in FinFolk account. Connecting never enables public sharing automatically.'
        );
      END IF;
      IF v_topic = 'diagnostics' THEN
        RETURN jsonb_build_object('reply','Send /ping to check that FinFolk is responding.');
      END IF;
      RETURN "finfolk_rpc".social_command_help(i_channel,i_provider,i_enabled);
    END IF;
    RETURN null;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-user-report/UserReport 
CREATE TABLE IF NOT EXISTS "finfolk"."UserReport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "author_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "target_id" UUID REFERENCES "finfolk"."User"("id"),
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
  "actor_id" UUID REFERENCES "finfolk"."User"("id"),
  "detail" JSONB NOT NULL DEFAULT '{}',
  "op_created" UUID,
  "time_created" BIGINT,
  PRIMARY KEY (id,class_table),
  CONSTRAINT fk_activity_log_activity FOREIGN KEY (class_table,activity_id) REFERENCES "finfolk"."Activity"(class_table,id) ON DELETE CASCADE
);

-- finfolkdb.fn.user.user-manage/insert-user 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_user(
  i_user_id UUID,
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
        (i_user_id)::UUID,
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
        (i_user_id)::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."Activity" ("class_table","class_ref","op_created","time_created") VALUES (
        ('User')::"finfolk"."EnumClassType",
        (i_user_id)::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_activity;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."User" ("id","profile","activity_id","audit_id","rev_id") VALUES (
        (i_user_id)::UUID,
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
        "time_updated",
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
      ) RETURNING "id","audit_id","op_created","time_created")
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
        (i_user_id)::UUID,
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "metadata" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("key")
);

-- finfolkdb.common.type-environment-base/DepthDataset 
CREATE TABLE IF NOT EXISTS "finfolk"."DepthDataset" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "upstream_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "status" "finfolk"."EnumDepthDatasetStatus" NOT NULL DEFAULT 'staged',
  "metadata" JSONB NOT NULL,
  UNIQUE ("key"),
  UNIQUE ("source_id","upstream_id","version")
);

-- finfolkdb.common.type-environment-base/TideStation 
CREATE TABLE IF NOT EXISTS "finfolk"."TideStation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "upstream_id" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE ("key"),
  UNIQUE ("source_id","upstream_id")
);

-- finfolkdb.common.type-environment-base/EnvironmentTarget 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentTarget" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "product" "finfolk"."EnumEnvironmentTargetProduct" NOT NULL,
  "configuration" JSONB NOT NULL,
  "last_requested_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("key")
);

-- finfolkdb.common.type-environment-base/EnvironmentSnapshot 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentSnapshot" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "target_id" UUID NOT NULL REFERENCES "finfolk"."EnvironmentTarget"("id") ON DELETE CASCADE,
  "issued_at" BIGINT,
  "retrieved_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "valid_from" BIGINT NOT NULL,
  "valid_to" BIGINT NOT NULL,
  "fresh_until" BIGINT NOT NULL,
  "delete_after" BIGINT NOT NULL,
  "checksum" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  CONSTRAINT check_0 CHECK ("valid_to" > "valid_from"),
  CONSTRAINT check_1 CHECK ("delete_after" >= "retrieved_at"),
  CONSTRAINT check_2 CHECK ("schema_version" > 0)
);

-- finfolkdb.common.type-environment-base/EnvironmentJob 
CREATE TABLE IF NOT EXISTS "finfolk"."EnvironmentJob" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "target_id" UUID NOT NULL REFERENCES "finfolk"."EnvironmentTarget"("id") ON DELETE CASCADE,
  "next_attempt_at" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "lease_token" UUID,
  "lease_until" BIGINT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_success" BIGINT,
  "error_code" TEXT,
  UNIQUE ("target_id"),
  CONSTRAINT check_0 CHECK ("attempts" >= 0),
  CONSTRAINT check_1 CHECK (("lease_token" IS NULL AND "lease_until" IS NULL) OR ("lease_token" IS NOT NULL AND "lease_until" IS NOT NULL))
);

-- finfolkdb.fn.social.social-policy/social-member-allowed 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_member_allowed(
  o_inbox JSONB,
  i_user UUID
) RETURNS BOOLEAN AS $$
BEGIN
  IF NOT "finfolk".is_user_active(i_user) THEN
    RETURN false;
  END IF;
  DECLARE
    o_operated JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "account_id" = (o_inbox ->> 'social_account_id')::UUID
      AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_operated;
    RETURN NOT "finfolk".is_user_blocked(i_user,(o_operated ->> 'user_id')::UUID);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-policy/social-work-policy-error 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_work_policy_error(
  o_inbox JSONB,
  o_event JSONB,
  o_command JSONB
) RETURNS TEXT AS $$

  DECLARE
    v_name TEXT;
  BEGIN
    v_name := coalesce(
      o_command ->> 'command',
      ((o_event -> 'payload') -> 'parsed') ->> 'command'
    );
    IF o_event IS NULL OR ((o_event ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) THEN
      RETURN 'generation_changed';
    END IF;
    IF (o_event ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
      RETURN 'deadline_expired';
    END IF;
    IF ((o_inbox ->> 'mode') = 'pilot') AND NOT jsonb_exists(
      o_inbox -> 'pilot_sender_ids',
      (o_event -> 'payload') ->> 'senderId'
    ) THEN
      RETURN 'audience_changed';
    END IF;
    IF (v_name != 'none') AND NOT jsonb_exists(o_inbox -> 'enabled_commands',v_name) THEN
      RETURN 'command_disabled';
    END IF;
    IF (v_name = 'whoami') AND ((o_inbox ->> 'provider') != 'mock') THEN
      RETURN 'mock_only';
    END IF;
    IF ((o_event ->> 'channel') = 'message') AND ((v_name = 'connect') OR (v_name = 'status') OR (v_name = 'whoami')) THEN
      DECLARE
      o_account JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialAccount"
          WHERE "id" = (o_event ->> 'account_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
        IF (o_event ->> 'account_generation')::INTEGER != (o_account ->> 'generation')::INTEGER THEN
          RETURN 'identity_changed';
        END IF;
    END;
    END IF;
    IF o_command ->> 'owner_id' IS NOT NULL AND ((v_name = 'status') OR (v_name = 'whoami')) THEN
      DECLARE
      o_connection JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
            "id",
            "user_id",
            "account_id",
            "status",
            "identity_version",
            "generation",
            "credential_ciphertext",
            "access_expires_at",
            "refresh_expires_at",
            "credential_lease",
            "lease_until",
            "share_posts",
            "public_points",
            "capabilities",
            "granted_scopes",
            "cursor",
            "last_success",
            "next_at",
            "failures",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialConnection"
          WHERE "id" = (o_command ->> 'connection_id')::UUID
          AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
          LIMIT 1
          FOR SHARE)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_connection;
        IF o_connection IS NULL OR o_command ->> 'identity_version' IS NULL OR ((o_connection ->> 'account_id')::UUID != (o_event ->> 'account_id')::UUID) OR ((o_connection ->> 'user_id')::UUID != (o_command ->> 'owner_id')::UUID) OR ((o_connection ->> 'identity_version')::UUID != (o_command ->> 'identity_version')::UUID) OR NOT "finfolk_rpc".social_member_allowed(o_inbox,(o_command ->> 'owner_id')::UUID) THEN
          RETURN 'member_restricted';
        END IF;
    END;
    END IF;
    IF (o_command -> 'result') ->> 'postId' is not null  THEN
      DECLARE
      o_post JSONB;
        o_viewer JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
            "id",
            "owner_id",
            "site_id",
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
            "time_updated"
          FROM "finfolk"."SocialPost"
          WHERE "id" = ((o_command -> 'result') ->> 'postId')::UUID
          LIMIT 1
          FOR SHARE)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_post;
        WITH j_ret AS (  
          SELECT
            "id",
            "user_id",
            "account_id",
            "status",
            "identity_version",
            "generation",
            "credential_ciphertext",
            "access_expires_at",
            "refresh_expires_at",
            "credential_lease",
            "lease_until",
            "share_posts",
            "public_points",
            "capabilities",
            "granted_scopes",
            "cursor",
            "last_success",
            "next_at",
            "failures",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialConnection"
          WHERE "account_id" = (o_event ->> 'account_id')::UUID
          AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_viewer;
        IF o_post IS NULL OR ((o_post ->> 'status') != 'approved') OR NOT (o_post ->> 'public_consent')::BOOLEAN OR ((o_post ->> 'url') != (o_command ->> 'source_url')) OR NOT "finfolk".is_user_active((o_post ->> 'owner_id')::UUID) OR "finfolk".is_user_blocked((o_viewer ->> 'user_id')::UUID,(o_post ->> 'owner_id')::UUID) THEN
          RETURN 'publication_withdrawn';
        END IF;
    END;
    END IF;
    RETURN null;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-chat/receive-chat-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_chat_message(
  i_application UUID,
  i_account UUID,
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
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
      v_deadline BIGINT;
      v_key TEXT;
      v_sent BIGINT;
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
          "time_created"
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
          "time_created"
        FROM "finfolk"."MessagingMessage"
        WHERE "id" = (o_receipt ->> 'message_id')::UUID
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
      v_sent := coalesce(
        (o_message ->> 'sent_at')::BIGINT,
        (1000000 * extract(epoch FROM now()))::BIGINT
      );
      v_deadline := coalesce(
        (o_receipt ->> 'deadline')::BIGINT,
        v_sent + (i_window * 1000000)
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
  i_application UUID,
  i_account UUID,
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
        SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
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

-- finfolkdb.fn.social.social-connections/invalidate-social-personal-work 
CREATE OR REPLACE FUNCTION "finfolk_rpc".invalidate_social_personal_work(
  i_account UUID,
  i_exclude_command UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_actions JSONB;
    o_command JSONB;
    o_commands JSONB;
    o_proofs JSONB;
  BEGIN
    WITH j_ret AS (  
      UPDATE "finfolk"."SocialConnectionProof" SET
        "status" = ('revoked')::"finfolk"."EnumSocialProofStatus",
        "op_updated" = (o_op ->> 'id')::UUID,
        "time_updated" = (o_op ->> 'time')::BIGINT
      WHERE "account_id" = i_account AND "status" IN ('pending','verified')
      RETURNING
        "id",
        "account_id",
        "user_id",
        "connection_id",
        "event_id",
        "inbox_id",
        "receipt_id",
        "kind",
        "token_hash",
        "nonce_hash",
        "flow_key",
        "generation",
        "status",
        "expires_at",
        "verified_at",
        "consumed_at",
        "consumed_version",
        "error",
        "provider_data",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_proofs;
    WITH j_ret AS (  
      UPDATE "finfolk"."SocialAction" SET
        "lease" = (null)::UUID,
        "lease_until" = (null)::BIGINT,
        "error_code" = ('identity_changed')::TEXT,
        "state" = ('expired')::TEXT,
        "op_updated" = (o_op ->> 'id')::UUID,
        "time_updated" = (o_op ->> 'time')::BIGINT
      WHERE "account_id" = i_account AND "state" IN ('pending','running')
      RETURNING
        "id",
        "event_id",
        "command_id",
        "inbox_id",
        "generation",
        "account_generation",
        "attempts",
        "lease",
        "lease_until",
        "deadline",
        "next_attempt_at",
        "error_code",
        "result",
        "account_id",
        "source_id",
        "kind",
        "owner_id",
        "state",
        "data",
        "member_confirmed",
        "session_id",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_actions;
    WITH j_ret AS (  
      SELECT
        "id",
        "event_id",
        "inbox_id",
        "generation",
        "account_id",
        "key",
        "context",
        "external_actor_id",
        "external_media_id",
        "owner_id",
        "connection_id",
        "identity_version",
        "command",
        "args",
        "source_url",
        "comment_at",
        "received_at",
        "state",
        "result",
        "site_id",
        "visit_day",
        "reply",
        "send_state",
        "external_reply_id",
        "send_started_at",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialCommand"
      WHERE "account_id" = i_account
      AND "command" IN ('connect','disconnect','status','whoami'))
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_commands;
    o_command := null;
    FOR o_command IN SELECT jsonb_array_elements(coalesce(o_commands,('[]')::JSONB)) LOOP
      IF i_exclude_command IS NULL OR ((o_command ->> 'id')::UUID != i_exclude_command) THEN
        DECLARE
        o_cancelled JSONB;
          o_uncertain JSONB;
      BEGIN
        WITH j_ret AS (  
            UPDATE "finfolk"."MessagingOutbox" SET
              "state" = ('cancelled')::"finfolk"."EnumMessagingOutboxStatus",
              "error_code" = ('identity_changed')::TEXT,
              "body_ciphertext" = (null)::TEXT,
              "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
            WHERE "command_id" = (o_command ->> 'id')::UUID
            AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
            RETURNING
              "id",
              "account_id",
              "event_id",
              "command_id",
              "channel",
              "recipient",
              "thread",
              "comment",
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
              "time_created",
              "time_updated",
              "body_ciphertext",
              "cipher_context",
              "reply_kind")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_cancelled;
          WITH j_ret AS (  
            UPDATE "finfolk"."MessagingOutbox" SET
              "state" = ('uncertain')::"finfolk"."EnumMessagingOutboxStatus",
              "lease" = (null)::UUID,
              "lease_until" = (null)::BIGINT,
              "error_code" = ('identity_changed')::TEXT,
              "body_ciphertext" = (null)::TEXT,
              "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
            WHERE "command_id" = (o_command ->> 'id')::UUID
            AND "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus"
            RETURNING
              "id",
              "account_id",
              "event_id",
              "command_id",
              "channel",
              "recipient",
              "thread",
              "comment",
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
              "time_created",
              "time_updated",
              "body_ciphertext",
              "cipher_context",
              "reply_kind")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_uncertain;
          null;
      END;
        IF ((o_command ->> 'state') = 'new') OR ((o_command ->> 'state') = 'waiting') THEN
          DECLARE
        o_event JSONB;
            o_expired JSONB;
      BEGIN
        WITH j_ret AS (  
              UPDATE "finfolk"."SocialCommand" SET
                "state" = ('expired')::"finfolk"."EnumSocialCommandStatus",
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "id" = (o_command ->> 'id')::UUID
              RETURNING
                "id",
                "event_id",
                "inbox_id",
                "generation",
                "account_id",
                "key",
                "context",
                "external_actor_id",
                "external_media_id",
                "owner_id",
                "connection_id",
                "identity_version",
                "command",
                "args",
                "source_url",
                "comment_at",
                "received_at",
                "state",
                "result",
                "site_id",
                "visit_day",
                "reply",
                "send_state",
                "external_reply_id",
                "send_started_at",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
            WITH j_ret AS (  
              UPDATE "finfolk"."SocialEvent" SET
                "status" = ('expired')::TEXT,
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "id" = (o_command ->> 'event_id')::UUID
              RETURNING
                "id",
                "provider",
                "namespace",
                "key",
                "account_id",
                "inbox_id",
                "message_id",
                "channel",
                "generation",
                "account_generation",
                "fingerprint",
                "sent_at",
                "deadline",
                "payload",
                "status",
                "attempts",
                "error",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_event;
            null;
      END;
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('invalidated',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-connections/redeem-social-connection 
CREATE OR REPLACE FUNCTION "finfolk_rpc".redeem_social_connection(
  i_application UUID,
  i_inbox UUID,
  i_user UUID,
  i_code TEXT,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
    v_code TEXT;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    v_code := upper(regexp_replace(coalesce(i_code,''),'[[:space:]-]','','g'));
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF ((o_inbox ->> 'mode') = 'disabled') OR NOT "finfolk_rpc".social_member_allowed(o_inbox,i_user) OR (length(coalesce(i_code,'')) > 100) OR NOT "regexp_like"(v_code,'^[A-Z0-9]{8}$') THEN
      RETURN null;
    END IF;
    DECLARE
      o_event JSONB;
      o_proof JSONB;
      v_hash TEXT;
    BEGIN
      v_hash := "encode"("digest"(v_code,'sha256'),'hex');
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialConnectionProof"
        WHERE "token_hash" = v_hash
        AND "kind" = ('message')::"finfolk"."EnumSocialProofKind"
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
      WITH j_ret AS (  
        SELECT
          "id",
          "provider",
          "namespace",
          "key",
          "account_id",
          "inbox_id",
          "message_id",
          "channel",
          "generation",
          "account_generation",
          "fingerprint",
          "sent_at",
          "deadline",
          "payload",
          "status",
          "attempts",
          "error",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialEvent"
        WHERE "id" = (o_proof ->> 'event_id')::UUID
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
      IF o_proof IS NULL OR o_event IS NULL OR ((o_event ->> 'inbox_id')::UUID != i_inbox) OR ((o_event ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_proof ->> 'status') != 'verified') OR (((o_inbox ->> 'mode') = 'pilot') AND NOT jsonb_exists(
        o_inbox -> 'pilot_sender_ids',
        (o_event -> 'payload') ->> 'senderId'
      )) THEN
        RETURN null;
      END IF;
      DECLARE
        o_connected JSONB;
      BEGIN
        o_connected := "finfolk_rpc".connect_social_account(
          i_user,
          (o_proof ->> 'id')::UUID,
          v_hash,
          null,
          null,
          null,
          null,
          null,
          ('[]')::JSONB,
          ('[]')::JSONB,
          o_op
        );
        IF o_connected is not null  THEN
          PERFORM "finfolk_rpc".invalidate_social_personal_work((o_proof ->> 'account_id')::UUID,null,o_op);
        END IF;
        RETURN o_connected;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-connections/disconnect-social-connection 
CREATE OR REPLACE FUNCTION "finfolk_rpc".disconnect_social_connection(
  i_application UUID,
  i_inbox UUID,
  i_user UUID,
  i_connection UUID,
  i_version UUID,
  i_command UUID,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_account JSONB;
    o_connection JSONB;
    o_identity JSONB;
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "id" = i_connection
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_connection;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = (o_connection ->> 'account_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    WITH j_ret AS (  
      SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
      WHERE "account_id" = i_inbox
      AND "social_account_id" = (o_account ->> 'id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF o_identity IS NULL OR o_connection IS NULL OR NOT "finfolk".is_user_active(i_user) THEN
      RETURN false;
    END IF;
    IF NOT "finfolk_rpc".disconnect_social_account(i_user,i_connection,i_version,o_op) THEN
      RETURN false;
    END IF;
    PERFORM "finfolk_rpc".invalidate_social_personal_work((o_account ->> 'id')::UUID,i_command,o_op);
    RETURN true;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-events/receive-social-event 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_social_event(
  i_application UUID,
  i_inbox UUID,
  i_envelope JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
    o_input JSONB;
    v_body TEXT;
    v_channel TEXT;
    v_deadline BIGINT;
    v_fingerprint TEXT;
    v_key TEXT;
    v_message TEXT;
    v_namespace TEXT;
    v_provider TEXT;
    v_sender TEXT;
    v_sent BIGINT;
    v_thread TEXT;
  BEGIN
    o_input := "finfolk".as_jsonb(i_envelope);
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    v_provider := (o_inbox ->> 'provider');
    v_channel := (o_input ->> 'channel');
    v_sender := (o_input ->> 'senderId');
    v_message := (o_input ->> 'messageId');
    v_thread := (o_input ->> 'conversationId');
    v_body := (o_input ->> 'body');
    v_sent := (o_input ->> 'sentAt')::BIGINT;
    v_deadline := (o_input ->> 'deadline')::BIGINT;
    v_namespace := null;
    v_key := null;
    v_fingerprint := null;
    IF o_inbox IS NULL OR (v_provider = 'app') THEN
      RAISE EXCEPTION 'External social inbox is outside application scope';
    END IF;
    IF jsonb_exists(o_input,'application') OR jsonb_exists(o_input,'inbox') OR jsonb_exists(o_input,'namespace') OR jsonb_exists(o_input,'userId') OR jsonb_exists(o_input,'ownerId') OR jsonb_exists(o_input,'handler') OR v_channel IS NULL OR NOT ((v_channel = 'message') OR (v_channel = 'mention') OR (v_channel = 'owned')) OR (jsonb_typeof(o_input -> 'senderId') != 'string') OR (coalesce(v_sender,'') = '') OR (length(v_sender) > 500) OR (jsonb_typeof(o_input -> 'messageId') != 'string') OR (coalesce(v_message,'') = '') OR (length(v_message) > 500) OR (jsonb_typeof(o_input -> 'body') != 'string') OR (length(v_body) > 2000) OR ((v_channel = 'message') AND ((jsonb_typeof(o_input -> 'conversationId') != 'string') OR (coalesce(v_thread,'') = '') OR (length(v_thread) > 500))) OR v_sent IS NULL OR v_deadline IS NULL OR (v_sent <= 0) OR (v_sent > ((1000000 * extract(epoch FROM now()))::BIGINT + 300000000)) OR (v_deadline <= v_sent) OR (v_deadline > (v_sent + 604800000000)) THEN
      RAISE EXCEPTION 'Invalid normalized social event';
    END IF;
    v_namespace := (jsonb_build_array(v_provider,i_application,i_inbox,CASE WHEN v_channel = 'message' THEN 'message'
    WHEN true THEN 'comment'
    END))::TEXT;
    v_key := "concat"(CASE WHEN v_channel = 'message' THEN 'message:'
    WHEN true THEN 'comment:'
    END,v_message);
    v_fingerprint := "encode"("digest"((o_input - 'eventId')::TEXT,'sha256'),'hex');
    DECLARE
      o_existing JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "provider",
          "namespace",
          "key",
          "account_id",
          "inbox_id",
          "message_id",
          "channel",
          "generation",
          "account_generation",
          "fingerprint",
          "sent_at",
          "deadline",
          "payload",
          "status",
          "attempts",
          "error",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialEvent"
        WHERE "provider" = (v_provider)::"finfolk"."EnumSocialProvider"
        AND "namespace" = v_namespace
        AND "key" = v_key
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF o_existing is not null  THEN
        IF (o_existing ->> 'fingerprint') != v_fingerprint THEN
          RAISE EXCEPTION 'Conflicting duplicate social event';
        END IF;
        RETURN jsonb_build_object('id',(o_existing ->> 'id')::UUID,'duplicate',true);
      END IF;
      DECLARE
        o_account JSONB;
        o_parsed JSONB;
        o_payload JSONB;
        v_account UUID;
        v_message_id UUID;
      BEGIN
        v_account := "finfolk_rpc".insert_social_account(
          v_provider,
          (jsonb_build_array(v_provider,i_application,i_inbox))::TEXT,
          v_sender,
          '',
          '',
          ('{}')::JSONB,
          o_op
        );
        WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialAccount"
          WHERE "id" = v_account
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
        o_parsed := "finfolk_rpc".parse_social_command(v_channel,v_body);
        o_payload := (((o_input - 'body') - 'eventId') || jsonb_build_object('parsed',o_parsed));
        v_message_id := null;
        IF (o_parsed ->> 'command') = 'none' THEN
          o_payload := (o_payload || jsonb_build_object('body',v_body));
        END IF;
        IF v_channel = 'message' THEN
          DECLARE
          o_identity JSONB;
        BEGIN
          WITH j_ret AS (  
              SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
              WHERE "account_id" = i_inbox AND "external_id" = v_sender
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
            IF o_identity is null  THEN
              DECLARE
              o_new JSONB;
            BEGIN
              WITH j_ret AS (INSERT INTO "finfolk"."MessagingIdentity" ("social_account_id","account_id","external_id") VALUES ((v_account)::UUID,(i_inbox)::UUID,(v_sender)::TEXT) RETURNING "id","social_account_id","account_id","external_id","user_id")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
                o_identity := o_new;
            END;
            END IF;
            IF o_identity ->> 'social_account_id' IS NULL OR ((o_identity ->> 'social_account_id')::UUID != v_account) THEN
              RAISE EXCEPTION 'Conflicting social participant binding';
            END IF;
            DECLARE
              o_thread JSONB;
            BEGIN
              WITH j_ret AS (  
                SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
                WHERE "account_id" = i_inbox AND "external_id" = v_thread
                LIMIT 1)
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_thread;
              IF o_thread is null  THEN
                DECLARE
                o_new JSONB;
              BEGIN
                WITH j_ret AS (  
                    INSERT INTO "finfolk"."MessagingConversation" ("account_id","participant_id","external_id") VALUES (
                      (i_inbox)::UUID,
                      ((o_identity ->> 'id')::UUID)::UUID,
                      (v_thread)::TEXT
                    ) RETURNING "id","account_id","participant_id","external_id")
                  SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
                  o_thread := o_new;
              END;
              END IF;
              IF (o_thread ->> 'participant_id')::UUID != (o_identity ->> 'id')::UUID THEN
                RAISE EXCEPTION 'Conversation participant mismatch';
              END IF;
              DECLARE
                o_message JSONB;
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
                    (i_inbox)::UUID,
                    ((o_thread ->> 'id')::UUID)::UUID,
                    ('inbound')::"finfolk"."EnumMessagingDirection",
                    (v_message)::TEXT,
                    (v_body)::TEXT,
                    ('{}')::JSONB,
                    (v_sent)::BIGINT
                  ) RETURNING
                    "id",
                    "account_id",
                    "conversation_id",
                    "direction",
                    "external_id",
                    "body",
                    "metadata",
                    "sent_at",
                    "time_created")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
                v_message_id := (o_message ->> 'id')::UUID;
              END;
            END;
        END;
        END IF;
        DECLARE
          o_event JSONB;
        BEGIN
          WITH j_ret AS (  
            INSERT INTO "finfolk"."SocialEvent" (
              "provider",
              "namespace",
              "key",
              "account_id",
              "inbox_id",
              "message_id",
              "channel",
              "generation",
              "account_generation",
              "fingerprint",
              "sent_at",
              "deadline",
              "payload",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            ) VALUES (
              (v_provider)::"finfolk"."EnumSocialProvider",
              (v_namespace)::TEXT,
              (v_key)::TEXT,
              (v_account)::UUID,
              (i_inbox)::UUID,
              (v_message_id)::UUID,
              (v_channel)::"finfolk"."EnumSocialCommandContext",
              (o_inbox ->> 'generation')::INTEGER,
              (o_account ->> 'generation')::INTEGER,
              (v_fingerprint)::TEXT,
              (v_sent)::BIGINT,
              (v_deadline)::BIGINT,
              (o_payload)::JSONB,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'time')::BIGINT,
              (o_op ->> 'time')::BIGINT
            ) RETURNING
              "id",
              "provider",
              "namespace",
              "key",
              "account_id",
              "inbox_id",
              "message_id",
              "channel",
              "generation",
              "account_generation",
              "fingerprint",
              "sent_at",
              "deadline",
              "payload",
              "status",
              "attempts",
              "error",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
          RETURN jsonb_build_object('id',(o_event ->> 'id')::UUID,'duplicate',false);
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-events/reserve-social-rate 
CREATE OR REPLACE FUNCTION "finfolk_rpc".reserve_social_rate(
  i_provider TEXT,
  i_namespace TEXT,
  i_sender TEXT,
  i_purpose TEXT,
  i_window INTEGER,
  i_limit INTEGER,
  o_op JSONB
) RETURNS BOOLEAN AS $$

  DECLARE
    o_rate JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "purpose",
        "bucket",
        "count",
        "resets_at",
        "prompted_at",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialRateLimit"
      WHERE "provider" = (i_provider)::"finfolk"."EnumSocialProvider"
      AND "namespace" = i_namespace
      AND "purpose" = i_purpose
      AND "bucket" = i_sender
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rate;
    IF o_rate is null  THEN
      DECLARE
      o_new JSONB;
    BEGIN
      WITH j_ret AS (  
          INSERT INTO "finfolk"."SocialRateLimit" (
            "provider",
            "namespace",
            "purpose",
            "bucket",
            "count",
            "resets_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          ) VALUES (
            (i_provider)::"finfolk"."EnumSocialProvider",
            (i_namespace)::TEXT,
            (i_purpose)::TEXT,
            (i_sender)::TEXT,
            (1)::INTEGER,
            ((1000000 * extract(epoch FROM now()))::BIGINT + ((i_window)::BIGINT * 1000000))::BIGINT,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT,
            (o_op ->> 'time')::BIGINT
          ) RETURNING
            "id",
            "provider",
            "namespace",
            "purpose",
            "bucket",
            "count",
            "resets_at",
            "prompted_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_new;
        RETURN true;
    END;
    END IF;
    DECLARE
      v_count INTEGER;
      v_reset BIGINT;
    BEGIN
      v_count := ((o_rate ->> 'count')::INTEGER + 1);
      v_reset := (o_rate ->> 'resets_at')::BIGINT;
      IF v_reset <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
        v_count := 1;
        v_reset := ((1000000 * extract(epoch FROM now()))::BIGINT + ((i_window)::BIGINT * 1000000));
      END IF;
      DECLARE
        o_saved JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."SocialRateLimit" SET
            "count" = (v_count)::INTEGER,
            "resets_at" = (v_reset)::BIGINT,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = (o_rate ->> 'id')::UUID
          RETURNING
            "id",
            "provider",
            "namespace",
            "purpose",
            "bucket",
            "count",
            "resets_at",
            "prompted_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
        RETURN v_count <= i_limit;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-events/reserve-social-command-rate 
CREATE OR REPLACE FUNCTION "finfolk_rpc".reserve_social_command_rate(
  i_provider TEXT,
  i_namespace TEXT,
  i_sender TEXT,
  o_op JSONB
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN "finfolk_rpc".reserve_social_rate(i_provider,i_namespace,i_sender,'command',60,30,o_op);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-events/process-social-event 
CREATE OR REPLACE FUNCTION "finfolk_rpc".process_social_event(
  i_application UUID,
  i_inbox UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF ((o_inbox ->> 'mode') = 'disabled') OR ((o_inbox ->> 'backoff_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    DECLARE
      o_event JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "provider",
          "namespace",
          "key",
          "account_id",
          "inbox_id",
          "message_id",
          "channel",
          "generation",
          "account_generation",
          "fingerprint",
          "sent_at",
          "deadline",
          "payload",
          "status",
          "attempts",
          "error",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialEvent"
        WHERE "inbox_id" = i_inbox AND "status" = 'queued'
        ORDER BY "time_created","id" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
      IF o_event is null  THEN
        RETURN null;
      END IF;
      DECLARE
        o_command JSONB;
        o_connection JSONB;
        o_parsed JSONB;
        o_payload JSONB;
        o_result JSONB;
        v_channel TEXT;
        v_event UUID;
        v_identity_namespace TEXT;
        v_name TEXT;
        v_owner UUID;
        v_reply TEXT;
        v_state TEXT;
        v_status TEXT;
      BEGIN
        v_event := (o_event ->> 'id')::UUID;
        v_identity_namespace := (jsonb_build_array(o_inbox ->> 'provider',i_application,i_inbox))::TEXT;
        o_payload := (o_event -> 'payload');
        o_parsed := ((o_event -> 'payload') -> 'parsed');
        v_channel := (o_event ->> 'channel');
        v_name := ((o_payload -> 'parsed') ->> 'command');
        v_status := 'completed';
        v_state := 'done';
        v_reply := null;
        o_result := ('{}')::JSONB;
        o_connection := null;
        v_owner := null;
        o_command := null;
        IF ((o_event ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_event ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR (((o_inbox ->> 'mode') = 'pilot') AND NOT jsonb_exists(o_inbox -> 'pilot_sender_ids',o_payload ->> 'senderId')) THEN
          DECLARE
          o_expired JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."SocialEvent" SET
                "status" = ('expired')::TEXT,
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "id" = v_event
              RETURNING
                "id",
                "provider",
                "namespace",
                "key",
                "account_id",
                "inbox_id",
                "message_id",
                "channel",
                "generation",
                "account_generation",
                "fingerprint",
                "sent_at",
                "deadline",
                "payload",
                "status",
                "attempts",
                "error",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
            RETURN jsonb_build_object('id',v_event,'status','expired');
        END;
        END IF;
        IF v_name = 'none' THEN
          DECLARE
          o_ignored JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."SocialEvent" SET
                "status" = ('completed')::TEXT,
                "op_updated" = (o_op ->> 'id')::UUID,
                "time_updated" = (o_op ->> 'time')::BIGINT
              WHERE "id" = v_event
              RETURNING
                "id",
                "provider",
                "namespace",
                "key",
                "account_id",
                "inbox_id",
                "message_id",
                "channel",
                "generation",
                "account_generation",
                "fingerprint",
                "sent_at",
                "deadline",
                "payload",
                "status",
                "attempts",
                "error",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_ignored;
            RETURN jsonb_build_object('id',v_event,'status','ignored');
        END;
        END IF;
        IF (v_name = 'connect') OR ((v_name = 'status') AND (v_channel = 'message')) OR (v_name = 'whoami') OR (v_name = 'disconnect') THEN
          DECLARE
          o_account JSONB;
            o_current JSONB;
        BEGIN
          WITH j_ret AS (  
              SELECT
                "id",
                "provider",
                "namespace",
                "external_id",
                "handle",
                "display_name",
                "generation",
                "provider_data",
                "audit_id",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialAccount"
              WHERE "id" = (o_event ->> 'account_id')::UUID
              LIMIT 1
              FOR UPDATE)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
            WITH j_ret AS (  
              SELECT
                "id",
                "user_id",
                "account_id",
                "status",
                "identity_version",
                "generation",
                "credential_ciphertext",
                "access_expires_at",
                "refresh_expires_at",
                "credential_lease",
                "lease_until",
                "share_posts",
                "public_points",
                "capabilities",
                "granted_scopes",
                "cursor",
                "last_success",
                "next_at",
                "failures",
                "provider_data",
                "audit_id",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialConnection"
              WHERE "account_id" = (o_event ->> 'account_id')::UUID
              AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
              LIMIT 1
              FOR SHARE)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_current;
            IF (o_event ->> 'account_generation')::INTEGER != (o_account ->> 'generation')::INTEGER THEN
              DECLARE
              o_expired JSONB;
            BEGIN
              WITH j_ret AS (  
                  UPDATE "finfolk"."SocialEvent" SET
                    "status" = ('expired')::TEXT,
                    "op_updated" = (o_op ->> 'id')::UUID,
                    "time_updated" = (o_op ->> 'time')::BIGINT
                  WHERE "id" = v_event
                  RETURNING
                    "id",
                    "provider",
                    "namespace",
                    "key",
                    "account_id",
                    "inbox_id",
                    "message_id",
                    "channel",
                    "generation",
                    "account_generation",
                    "fingerprint",
                    "sent_at",
                    "deadline",
                    "payload",
                    "status",
                    "attempts",
                    "error",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated")
                SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
                RETURN jsonb_build_object('id',v_event,'status','expired');
            END;
            END IF;
            o_connection := o_current;
            v_owner := (o_current ->> 'user_id')::UUID;
            IF ((v_name = 'disconnect') AND NOT "finfolk".is_user_active(v_owner)) OR ((v_name != 'disconnect') AND NOT "finfolk_rpc".social_member_allowed(o_inbox,v_owner)) THEN
              v_owner := null;
            END IF;
        END;
        END IF;
        IF NOT "finfolk_rpc".reserve_social_command_rate(
          o_inbox ->> 'provider',
          v_identity_namespace,
          o_payload ->> 'senderId',
          o_op
        ) THEN
          v_status := 'rejected';
          v_state := 'limited';
          o_result := jsonb_build_object('error','rate_limited');
        ELSE
          DECLARE
          o_public JSONB;
        BEGIN
          o_public := "finfolk_rpc".social_public_reply(
              o_parsed,
              v_channel,
              o_inbox ->> 'provider',
              o_inbox -> 'enabled_commands'
            );
            v_reply := (o_public ->> 'reply');
            IF v_reply is null  THEN
              IF NOT jsonb_exists(o_inbox -> 'enabled_commands',v_name) THEN
                v_status := 'rejected';
                v_state := 'rejected';
                o_result := jsonb_build_object('error','command_disabled');
              ELSIF (v_name = 'whoami') AND ((o_inbox ->> 'provider') != 'mock') THEN
                v_status := 'rejected';
                v_state := 'rejected';
                o_result := jsonb_build_object('error','mock_only');
              ELSIF (v_name = 'connect') AND o_connection IS NOT NULL THEN
                v_reply := 'This social account is already connected to FinFolk.';
              ELSIF (v_name = 'connect') AND NOT "finfolk_rpc".reserve_social_rate(
                o_inbox ->> 'provider',
                v_identity_namespace,
                o_payload ->> 'senderId',
                'connect',
                3600,
                3,
                o_op
              ) THEN
                v_state := 'limited';
                v_status := 'rejected';
                o_result := jsonb_build_object('error','connect_rate_limited');
              ELSIF v_name = 'disconnect' THEN
                IF v_owner IS NOT NULL AND "finfolk_rpc".disconnect_social_connection(
                  i_application,
                  i_inbox,
                  v_owner,
                  (o_connection ->> 'id')::UUID,
                  (o_connection ->> 'identity_version')::UUID,
                  null,
                  o_op
                ) THEN
                  v_reply := 'Your social account is disconnected from FinFolk.';
                  o_result := jsonb_build_object('disconnected',true);
                ELSE
                  v_reply := 'Connect your account first.';
                END IF;
              ELSIF (v_name = 'status') AND (v_channel != 'message') THEN
                DECLARE
              o_post JSONB;
            BEGIN
              WITH j_ret AS (  
                    SELECT
                      "id",
                      "owner_id",
                      "site_id",
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
                      "time_updated"
                    FROM "finfolk"."SocialPost"
                    WHERE "url" = o_payload ->> 'url'
                    AND "status" = ('approved')::"finfolk"."EnumSocialPostStatus"
                    AND "public_consent" = true
                    LIMIT 1)
                  SELECT to_jsonb(j_ret) FROM j_ret INTO o_post;
                  v_reply := 'This post has not been published on FinFolk.';
                  IF o_post IS NOT NULL AND "finfolk".is_user_active((o_post ->> 'owner_id')::UUID) THEN
                    o_result := jsonb_build_object('postId',(o_post ->> 'id')::UUID);
                    v_reply := "concat"(
                      'Published on FinFolk: https://finfolk.com.au/?view=maps&site=',
                      o_post ->> 'site_id'
                    );
                  END IF;
            END;
              ELSIF (v_name = 'whoami') OR (v_name = 'status') THEN
                o_result := jsonb_build_object('member',v_owner);
                v_reply := CASE WHEN v_owner IS NULL THEN 'Connect your account first.'
            WHEN true THEN 'Your account is connected to FinFolk.'
            END;
              ELSE
                v_status := 'waiting';
                v_state := 'waiting';
                o_result := jsonb_build_object('effect',v_name);
              END IF;
            END IF;
        END;
        END IF;
        DECLARE
          o_new_command JSONB;
        BEGIN
          WITH j_ret AS (  
            INSERT INTO "finfolk"."SocialCommand" (
              "event_id",
              "inbox_id",
              "generation",
              "account_id",
              "key",
              "context",
              "external_actor_id",
              "external_media_id",
              "owner_id",
              "connection_id",
              "identity_version",
              "command",
              "args",
              "source_url",
              "state",
              "result",
              "reply",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            ) VALUES (
              (v_event)::UUID,
              (i_inbox)::UUID,
              (o_inbox ->> 'generation')::INTEGER,
              (o_event ->> 'account_id')::UUID,
              (o_event ->> 'key')::TEXT,
              (v_channel)::"finfolk"."EnumSocialCommandContext",
              (o_payload ->> 'senderId')::TEXT,
              (o_payload ->> 'mediaId')::TEXT,
              (v_owner)::UUID,
              (CASE WHEN v_owner IS NULL THEN null
            WHEN true THEN (o_connection ->> 'id')::UUID
            END)::UUID,
              (CASE WHEN v_owner IS NULL THEN null
            WHEN true THEN (o_connection ->> 'identity_version')::UUID
            END)::UUID,
              (v_name)::TEXT,
              (o_parsed -> 'args')::JSONB,
              (o_payload ->> 'url')::TEXT,
              (v_state)::"finfolk"."EnumSocialCommandStatus",
              (o_result)::JSONB,
              (v_reply)::TEXT,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'time')::BIGINT,
              (o_op ->> 'time')::BIGINT
            ) RETURNING
              "id",
              "event_id",
              "inbox_id",
              "generation",
              "account_id",
              "key",
              "context",
              "external_actor_id",
              "external_media_id",
              "owner_id",
              "connection_id",
              "identity_version",
              "command",
              "args",
              "source_url",
              "comment_at",
              "received_at",
              "state",
              "result",
              "site_id",
              "visit_day",
              "reply",
              "send_state",
              "external_reply_id",
              "send_started_at",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_new_command;
          o_command := o_new_command;
        END;
        IF (v_state = 'waiting') AND (v_name = 'connect') THEN
          DECLARE
          v_action UUID;
        BEGIN
          v_action := "finfolk_rpc".enqueue_social_action((o_command ->> 'id')::UUID,'verify-account',o_op);
            null;
        END;
        END IF;
        IF v_reply is not null  THEN
          DECLARE
          v_outgoing UUID;
        BEGIN
          v_outgoing := null;
            IF v_channel = 'message' THEN
              DECLARE
              o_incoming JSONB;
                o_outgoing JSONB;
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
                    "time_created"
                  FROM "finfolk"."MessagingMessage"
                  WHERE "id" = (o_event ->> 'message_id')::UUID
                  LIMIT 1)
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_incoming;
                WITH j_ret AS (  
                  INSERT INTO "finfolk"."MessagingMessage" ("account_id","conversation_id","direction","body","metadata") VALUES (
                    (i_inbox)::UUID,
                    (o_incoming ->> 'conversation_id')::UUID,
                    ('outbound')::"finfolk"."EnumMessagingDirection",
                    (v_reply)::TEXT,
                    ('{}')::JSONB
                  ) RETURNING
                    "id",
                    "account_id",
                    "conversation_id",
                    "direction",
                    "external_id",
                    "body",
                    "metadata",
                    "sent_at",
                    "time_created")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_outgoing;
                v_outgoing := (o_outgoing ->> 'id')::UUID;
            END;
            END IF;
            DECLARE
              o_delivery JSONB;
            BEGIN
              WITH j_ret AS (  
                INSERT INTO "finfolk"."MessagingOutbox" (
                  "account_id",
                  "event_id",
                  "command_id",
                  "channel",
                  "recipient",
                  "thread",
                  "comment",
                  "message_id",
                  "body",
                  "correlation_id",
                  "generation",
                  "deadline"
                ) VALUES (
                  (i_inbox)::UUID,
                  (v_event)::UUID,
                  ((o_command ->> 'id')::UUID)::UUID,
                  (v_channel)::"finfolk"."EnumSocialCommandContext",
                  (o_payload ->> 'senderId')::TEXT,
                  (CASE WHEN v_channel = 'message' THEN o_payload ->> 'conversationId'
                WHEN true THEN null
                END)::TEXT,
                  (CASE WHEN v_channel = 'message' THEN null
                WHEN true THEN o_payload ->> 'messageId'
                END)::TEXT,
                  (v_outgoing)::UUID,
                  "finfolk".as_bounded_text((v_reply)::TEXT,0,2000),
                  (uuid_generate_v4())::UUID,
                  (o_event ->> 'generation')::INTEGER,
                  (o_event ->> 'deadline')::BIGINT
                ) RETURNING
                  "id",
                  "account_id",
                  "event_id",
                  "command_id",
                  "channel",
                  "recipient",
                  "thread",
                  "comment",
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
                  "time_created",
                  "time_updated",
                  "body_ciphertext",
                  "cipher_context",
                  "reply_kind")
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_delivery;
              null;
            END;
        END;
        END IF;
        DECLARE
          o_finished JSONB;
        BEGIN
          WITH j_ret AS (  
            UPDATE "finfolk"."SocialEvent" SET
              "status" = (v_status)::TEXT,
              "attempts" = ((o_event ->> 'attempts')::INTEGER + 1)::INTEGER,
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "id" = v_event
            RETURNING
              "id",
              "provider",
              "namespace",
              "key",
              "account_id",
              "inbox_id",
              "message_id",
              "channel",
              "generation",
              "account_generation",
              "fingerprint",
              "sent_at",
              "deadline",
              "payload",
              "status",
              "attempts",
              "error",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_finished;
          RETURN jsonb_build_object(
            'id',
            v_event,
            'commandId',
            (o_command ->> 'id')::UUID,
            'status',
            v_status
          );
        END;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/set-messaging-authorization 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_messaging_authorization(
  i_application UUID,
  i_account UUID,
  i_generation INTEGER,
  i_ciphertext TEXT,
  i_expires BIGINT,
  i_proof JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_proof JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
    IF i_generation IS NULL OR (coalesce(i_ciphertext,'') = '') OR (coalesce(o_proof ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_proof ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce(o_proof -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (i_expires IS NOT NULL AND (i_expires IS NULL OR (i_expires <= (1000000 * extract(epoch FROM now()))::BIGINT))) OR (i_expires IS NULL AND (coalesce(o_proof -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB)) THEN
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
          "token_expires_at" = (i_expires)::BIGINT,
          "credential_lease" = (null)::UUID,
          "credential_lease_until" = (null)::BIGINT,
          "mode" = ('disabled')::"finfolk"."EnumMessagingAccountMode",
          "generation" = (i_generation + 1)::INTEGER,
          "checks" = (o_proof)::JSONB,
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_account
        RETURNING
          "id",
          "social_account_id",
          "key",
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
          "time_updated",
          "backoff_until",
          "action_checkpoint",
          "delivery_checkpoint",
          "event_checkpoint",
          "proof_checkpoint",
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
  i_application UUID,
  i_account UUID,
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
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
    IF ((o_account ->> 'provider') != 'app') AND (o_account ->> 'credential_ciphertext' IS NULL OR (coalesce((o_account -> 'checks') ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce((o_account -> 'checks') ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce((o_account -> 'checks') -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (coalesce((o_account -> 'checks') -> 'subscribed',('false')::JSONB) != ('true')::JSONB) OR ((o_account ->> 'token_expires_at')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR (o_account ->> 'token_expires_at' IS NULL AND (coalesce((o_account -> 'checks') -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB))) THEN
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
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_account
        RETURNING
          "id",
          "social_account_id",
          "key",
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
          "time_updated",
          "backoff_until",
          "action_checkpoint",
          "delivery_checkpoint",
          "event_checkpoint",
          "proof_checkpoint",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_active;
      o_audit := "finfolk_rpc".record_messaging_audit(i_application,i_account,'account_activated',uuid_generate_v4());
      RETURN jsonb_build_object('generation',i_generation,'mode',o_active ->> 'mode');
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/disable-messaging-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".disable_messaging_account(
  i_application UUID,
  i_account UUID,
  i_generation INTEGER,
  i_disconnect BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
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
          "credential_lease_until" = (null)::BIGINT,
          "mode" = ('disabled')::"finfolk"."EnumMessagingAccountMode",
          "generation" = (i_generation + 1)::INTEGER,
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_account
        RETURNING
          "id",
          "social_account_id",
          "key",
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
          "time_updated",
          "backoff_until",
          "action_checkpoint",
          "delivery_checkpoint",
          "event_checkpoint",
          "proof_checkpoint",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_disabled;
      IF i_disconnect THEN
        DECLARE
        o_cleared JSONB;
      BEGIN
        WITH j_ret AS (  
            UPDATE "finfolk"."MessagingAccount" SET
              "credential_ciphertext" = (null)::TEXT,
              "token_expires_at" = (null)::BIGINT,
              "checks" = ('{}')::JSONB
            WHERE "id" = i_account
            RETURNING
              "id",
              "social_account_id",
              "key",
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
              "time_updated",
              "backoff_until",
              "action_checkpoint",
              "delivery_checkpoint",
              "event_checkpoint",
              "proof_checkpoint",
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
  i_application UUID,
  i_account UUID,
  i_generation INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account is null  THEN
      RAISE EXCEPTION 'Messaging account is outside application scope';
    END IF;
    IF i_generation IS NULL OR ((o_account ->> 'generation')::INTEGER != i_generation) OR o_account ->> 'credential_ciphertext' IS NULL OR ((o_account ->> 'credential_lease_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    DECLARE
      o_claim JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_lease" = (uuid_generate_v4())::UUID,
          "credential_lease_until" = ((1000000 * extract(epoch FROM now()))::BIGINT + 120000000)::BIGINT
        WHERE "id" = i_account
        RETURNING
          "id",
          "social_account_id",
          "key",
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
          "time_updated",
          "backoff_until",
          "action_checkpoint",
          "delivery_checkpoint",
          "event_checkpoint",
          "proof_checkpoint",
          "provider_scope")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_claim;
      RETURN o_claim;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/release-messaging-refresh 
CREATE OR REPLACE FUNCTION "finfolk_rpc".release_messaging_refresh(
  i_application UUID,
  i_account UUID,
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
        "credential_lease_until" = (null)::BIGINT
      WHERE "id" = i_account
      AND "application_id" = i_application
      AND "generation" = i_generation
      AND "credential_lease" = i_lease
      RETURNING
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_release;
    RETURN jsonb_build_object('released',o_release IS NOT NULL);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.messaging.messaging-authorization/save-messaging-refresh 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_messaging_refresh(
  i_application UUID,
  i_account UUID,
  i_generation INTEGER,
  i_lease UUID,
  i_ciphertext TEXT,
  i_expires BIGINT,
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
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_account
      AND "application_id" = i_application
      AND "generation" = i_generation
      AND "credential_lease" = i_lease
      AND "credential_lease_until" > (1000000 * extract(epoch FROM now()))::BIGINT
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
    IF o_account IS NULL OR i_lease IS NULL THEN
      RETURN null;
    END IF;
    IF (coalesce(i_ciphertext,'') = '') OR (coalesce(o_proof ->> 'provider','') != (o_account ->> 'provider')) OR (coalesce(o_proof ->> 'accountId','') != (o_account ->> 'account_id')) OR (coalesce(o_proof -> 'authorized',('false')::JSONB) != ('true')::JSONB) OR (coalesce(o_proof -> 'subscribed',('false')::JSONB) != ('true')::JSONB) OR (i_expires IS NOT NULL AND (i_expires IS NULL OR (i_expires <= (1000000 * extract(epoch FROM now()))::BIGINT))) OR (i_expires IS NULL AND (coalesce(o_proof -> 'nonExpiring',('false')::JSONB) != ('true')::JSONB)) THEN
      RAISE EXCEPTION 'Invalid refreshed messaging authorization';
    END IF;
    DECLARE
      o_audit JSONB;
      o_saved JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."MessagingAccount" SET
          "credential_ciphertext" = (i_ciphertext)::TEXT,
          "token_expires_at" = (i_expires)::BIGINT,
          "credential_lease" = (null)::UUID,
          "credential_lease_until" = (null)::BIGINT,
          "checks" = (o_proof)::JSONB,
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_account
        RETURNING
          "id",
          "social_account_id",
          "key",
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
          "time_updated",
          "backoff_until",
          "action_checkpoint",
          "delivery_checkpoint",
          "event_checkpoint",
          "proof_checkpoint",
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
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "manifest" JSONB NOT NULL,
  "counts" JSONB NOT NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("key")
);

-- finfolkdb.common.type-import-base/DataAsset 
CREATE TABLE IF NOT EXISTS "finfolk"."DataAsset" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "checksum" TEXT NOT NULL,
  "bytes" BIGINT NOT NULL,
  "kind" "finfolk"."EnumDataAssetKind" NOT NULL,
  "uri" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  UNIQUE ("key"),
  CONSTRAINT check_0 CHECK ("bytes" >= 0)
);

-- finfolkdb.common.type-import-base/GeoArea 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoArea" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "metadata" JSONB NOT NULL,
  UNIQUE ("key")
);

-- finfolkdb.common.type-import-base/GeoFeature 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoFeature" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "dataset_id" UUID NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "geometry" JSONB NOT NULL,
  "properties" JSONB NOT NULL,
  UNIQUE ("key")
);

-- finfolkdb.common.type-import-base/SiteLocation 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteLocation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "area_id" UUID REFERENCES "finfolk"."GeoArea"("id"),
  "source_id" UUID NOT NULL REFERENCES "finfolk"."DataSource"("id"),
  "geometry" JSONB NOT NULL,
  UNIQUE ("site_id")
);

-- finfolkdb.common.type-import-base/DepthDatasetAsset 
CREATE TABLE IF NOT EXISTS "finfolk"."DepthDatasetAsset" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "dataset_id" UUID NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "asset_id" UUID NOT NULL REFERENCES "finfolk"."DataAsset"("id"),
  UNIQUE ("dataset_id","asset_id")
);

-- finfolkdb.common.type-import-base/GeoBoundary 
CREATE TABLE IF NOT EXISTS "finfolk"."GeoBoundary" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT,
  "asset_id" UUID NOT NULL REFERENCES "finfolk"."DataAsset"("id"),
  "area_id" UUID REFERENCES "finfolk"."GeoArea"("id"),
  "geometry" JSONB NOT NULL,
  "properties" JSONB NOT NULL,
  UNIQUE ("key")
);

-- finfolkdb.fn.social.social-interop/new-social-operation 
CREATE OR REPLACE FUNCTION "finfolk_rpc".new_social_operation(
  i_actor UUID
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk".op_fn('social-adapter',i_actor,('{}')::JSONB);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-interop/ret-social-adapter-scope 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_social_adapter_scope(
  i_application UUID,
  i_inbox UUID
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    RETURN jsonb_build_object(
      'applicationId',
      i_application,
      'inboxId',
      i_inbox,
      'provider',
      o_inbox ->> 'provider',
      'accountId',
      o_inbox ->> 'account_id',
      'namespace',
      (jsonb_build_array(o_inbox ->> 'provider',i_application,i_inbox))::TEXT
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.common.type-site-base/SiteCatalog 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteCatalog" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "singleton" BOOLEAN NOT NULL DEFAULT true,
  "revision" BIGINT NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  UNIQUE ("singleton"),
  CONSTRAINT singleton CHECK ("singleton"),
  CONSTRAINT check_1 CHECK ("revision" >= 0)
);

-- finfolkdb.common.type-site-base/SiteProfile 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteProfile" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "revision" BIGINT NOT NULL,
  "waterbody" "finfolk"."EnumSiteProfileWaterbody" NOT NULL,
  "access_mode" "finfolk"."EnumSiteProfileAccessMode" NOT NULL,
  "status" "finfolk"."EnumSiteProfileStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("site_id")
);

-- finfolkdb.common.type-site-base/SiteImport 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteImport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "owner_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "preview" JSONB NOT NULL DEFAULT '{}',
  "status" "finfolk"."EnumSiteImportStatus" NOT NULL DEFAULT 'draft',
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT
);

-- finfolkdb.common.type-site-base/SiteRevision 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteRevision" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "site_id" UUID NOT NULL REFERENCES "finfolk"."Site"("id"),
  "owner_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "import_id" UUID REFERENCES "finfolk"."SiteImport"("id") ON DELETE CASCADE,
  "base_revision" BIGINT NOT NULL DEFAULT 0,
  "version" BIGINT NOT NULL DEFAULT 1,
  "status" "finfolk"."EnumSiteRevisionStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "reviewed_by_id" UUID REFERENCES "finfolk"."User"("id") ON DELETE SET NULL,
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT
);

-- finfolkdb.common.type-site-base/SiteAccessPoint 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteAccessPoint" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "mode" "finfolk"."EnumSiteAccessPointMode" NOT NULL,
  "payload" JSONB NOT NULL
);

-- finfolkdb.common.type-site-base/SiteDepthEvidence 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteDepthEvidence" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "kind" "finfolk"."EnumSiteDepthEvidenceType" NOT NULL,
  "payload" JSONB NOT NULL
);

-- finfolkdb.common.type-site-base/SiteDepthDataset 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteDepthDataset" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "dataset_id" UUID NOT NULL REFERENCES "finfolk"."DepthDataset"("id"),
  "relationship" "finfolk"."EnumSiteDepthDatasetRelationship" NOT NULL,
  "evidence" JSONB NOT NULL,
  UNIQUE ("revision_id","dataset_id")
);

-- finfolkdb.common.type-site-base/SiteTideStation 
CREATE TABLE IF NOT EXISTS "finfolk"."SiteTideStation" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "revision_id" UUID NOT NULL REFERENCES "finfolk"."SiteRevision"("id") ON DELETE CASCADE,
  "station_id" UUID NOT NULL REFERENCES "finfolk"."TideStation"("id"),
  "evidence" JSONB NOT NULL,
  UNIQUE ("revision_id")
);

-- finfolkdb.common.type-media-import/MediaImport 
CREATE TABLE IF NOT EXISTS "finfolk"."MediaImport" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "owner_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "connection_id" UUID REFERENCES "finfolk"."SocialConnection"("id"),
  "provider_namespace" TEXT NOT NULL DEFAULT '',
  "platform" "finfolk"."EnumSocialProvider" NOT NULL,
  "provider_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'post',
  "posted_at" BIGINT,
  "day" DATE,
  "site_id" UUID REFERENCES "finfolk"."Site"("id"),
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
  UNIQUE ("owner_id","provider_namespace","platform","provider_id"),
  CONSTRAINT array_candidates CHECK (jsonb_typeof("candidates") = 'array'),
  CONSTRAINT fk_media_import_session_owner FOREIGN KEY (owner_id,session_id) REFERENCES "finfolk"."DiveSession"(owner_id,id),
  CONSTRAINT fk_media_import_connection_owner FOREIGN KEY (owner_id,connection_id) REFERENCES "finfolk"."SocialConnection"(user_id,id)
);
CREATE INDEX ON "finfolk"."MediaImport" ("owner_id");

-- finfolkdb.fn.site.site-note-revision/site-note-version 
CREATE OR REPLACE FUNCTION "finfolk_rpc".site_note_version(
  i_rev UUID
) RETURNS JSONB AS $$

  DECLARE
    o_rev JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
      WHERE "class_table" = ('SiteNote')::"finfolk"."EnumClassType"
      AND "class_context" = ('Global')::"finfolk"."EnumClassType"
      AND "id" = i_rev
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
    IF o_rev is null  THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object('revision',o_rev -> 'index');
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-revision/insert-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_site_note(
  i_id UUID,
  i_site UUID,
  i_author UUID,
  i_topic TEXT,
  i_body TEXT,
  i_observed DATE,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_current JSONB;
    o_log JSONB;
    o_note JSONB;
    o_rev JSONB;
  BEGIN
    o_current := jsonb_build_object(
      'site_id',
      i_site,
      'author_id',
      i_author,
      'topic',
      i_topic,
      'body',
      i_body,
      'observed_on',
      i_observed,
      'withdrawn',
      false,
      'hidden',
      false
    );
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
        ('SiteNote')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (i_id)::UUID,
        (1)::INTEGER,
        (o_current)::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","class_ref","index","current","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
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
        ('SiteNote')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        ((o_rev ->> 'id')::UUID)::UUID,
        (1)::INTEGER,
        (o_current)::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","rev_id","version","deltas","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
    WITH j_ret AS (  
      INSERT INTO "finfolk"."SiteNote" (
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (i_id)::UUID,
        (i_site)::UUID,
        (i_author)::UUID,
        (i_topic)::"finfolk"."EnumSiteNoteTopic",
        "finfolk".as_bounded_text((i_body)::TEXT,10,1000),
        "finfolk".as_finite_date((i_observed)::DATE),
        ((o_rev ->> 'id')::UUID)::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT,
        (o_op ->> 'time')::BIGINT
      ) RETURNING
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    RETURN o_note || "finfolk_rpc".site_note_version((o_rev ->> 'id')::UUID);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-revision/record-site-note-revision 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_site_note_revision(
  i_note UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_current JSONB;
    o_log JSONB;
    o_note JSONB;
    o_rev JSONB;
    o_saved JSONB;
    v_rev UUID;
    v_version INTEGER;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
    v_rev := (o_note ->> 'rev_id')::UUID;
    WITH j_ret AS (  
      SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
      WHERE "class_table" = ('SiteNote')::"finfolk"."EnumClassType"
      AND "class_context" = ('Global')::"finfolk"."EnumClassType"
      AND "id" = v_rev
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
    WITH j_ret AS (  
      SELECT
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_current;
    v_version := ((o_rev ->> 'index')::INTEGER + 1);
    WITH j_ret AS (  
      UPDATE "finfolk"."Rev" SET
        "index" = (v_version)::INTEGER,
        "current" = (o_current)::JSONB
      WHERE "class_table" = ('SiteNote')::"finfolk"."EnumClassType"
      AND "class_context" = ('Global')::"finfolk"."EnumClassType"
      AND "id" = v_rev
      RETURNING "id","class_ref","index","current","op_created","time_created")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
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
        ('SiteNote')::"finfolk"."EnumClassType",
        ('Global')::"finfolk"."EnumClassType",
        (v_rev)::UUID,
        (v_version)::INTEGER,
        (o_current)::JSONB,
        (o_op ->> 'id')::UUID,
        (o_op ->> 'time')::BIGINT
      ) RETURNING "id","rev_id","version","deltas","op_created","time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
    RETURN jsonb_build_object('revision',v_version);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/is-site-note-member 
CREATE OR REPLACE FUNCTION "finfolk_rpc".is_site_note_member(
  i_user UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN "finfolk".is_user_active(i_user) AND exists(
    SELECT 1 FROM neon_auth."user" WHERE (("id")::TEXT = (i_user)::TEXT) AND coalesce("emailVerified",false) AND NOT coalesce("banned",false)
  );
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/require-site-note-member 
CREATE OR REPLACE FUNCTION "finfolk_rpc".require_site_note_member() RETURNS UUID AS $$

  DECLARE
    v_user UUID;
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
  i_site UUID
) RETURNS BOOLEAN AS $$

  DECLARE
    v_private BOOLEAN;
    v_site BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."Site"
    WHERE "id" = i_site) INTO v_site;
    SELECT exists(SELECT 1 FROM "finfolk"."SiteProfile"
    WHERE "site_id" = i_site
    AND "status" != ('published')::"finfolk"."EnumSiteProfileStatus") INTO v_private;
    RETURN v_site AND NOT v_private;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/site-note-score 
CREATE OR REPLACE FUNCTION "finfolk_rpc".site_note_score(
  i_note UUID
) RETURNS BIGINT AS $$

  SELECT count(*) FROM "finfolk"."SiteNoteVote" AS "v" INNER JOIN "finfolk"."User" AS "u" ON "v"."voter_id" = "u"."id" INNER JOIN neon_auth."user" AS "a" ON ("a"."id")::TEXT = ("u"."id")::TEXT WHERE ("v"."note_id" = i_note) AND NOT "u"."deleted" AND coalesce("a"."emailVerified",false) AND NOT coalesce("a"."banned",false);

$$ LANGUAGE 'sql';

-- finfolkdb.fn.site.site-notes/ret-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_site_note(
  i_note UUID,
  i_viewer UUID
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    o_raw JSONB;
    o_user JSONB;
    v_author UUID;
    v_upvoted BOOLEAN;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "hidden" = false AND "withdrawn" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_raw;
    o_note := (o_raw || "finfolk_rpc".site_note_version((o_raw ->> 'rev_id')::UUID));
    v_author := (o_note ->> 'author_id')::UUID;
    WITH j_ret AS (  
      SELECT "profile" FROM "finfolk"."User"
      WHERE "id" = v_author AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    SELECT exists(SELECT 1 FROM "finfolk"."SiteNoteVote"
    WHERE "note_id" = i_note AND "voter_id" = i_viewer) INTO v_upvoted;
    IF o_note IS NULL OR NOT "finfolk_rpc".is_site_note_site((o_note ->> 'site_id')::UUID) OR NOT "finfolk_rpc".is_site_note_member(v_author) OR "finfolk".is_user_blocked(i_viewer,v_author) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'id',
      i_note,
      'site',
      (o_note ->> 'site_id')::UUID,
      'topic',
      o_note ->> 'topic',
      'text',
      o_note ->> 'body',
      'author',
      coalesce((o_user -> 'profile') ->> 'displayName','Diver'),
      'createdAt',
      "finfolk".as_iso_time((o_note ->> 'time_created')::BIGINT),
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
  i_site UUID,
  i_sort TEXT,
  i_topic TEXT,
  i_offset INTEGER,
  i_member BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_rows JSONB;
    v_viewer UUID;
  BEGIN
    v_viewer := CASE WHEN i_member THEN "finfolk_rpc".require_site_note_member()
    WHEN true THEN null
    END;
    o_rows := null;
    IF i_offset IS NULL OR (i_offset < 0) OR (i_offset > 10000) OR i_sort IS NULL OR NOT ((i_sort = 'helpful') OR (i_sort = 'newest')) OR i_topic IS NULL OR NOT ((i_topic = 'all') OR (i_topic = 'access') OR (i_topic = 'facilities') OR (i_topic = 'wildlife') OR (i_topic = 'conditions')) THEN
      RAISE EXCEPTION 'Invalid notes filter';
    END IF;
    SELECT coalesce(jsonb_agg("value"),('[]')::JSONB) FROM (  
      SELECT "finfolk_rpc".ret_site_note("id",v_viewer) AS "value" FROM "finfolk"."SiteNote" WHERE ("site_id" = i_site) AND NOT "withdrawn" AND NOT "hidden" AND ((i_topic = 'all') OR (("topic")::TEXT = i_topic)) AND "finfolk_rpc".ret_site_note("id",v_viewer) IS NOT NULL ORDER BY
        0 - CASE WHEN i_sort = 'helpful' THEN "finfolk_rpc".site_note_score("id")
      WHEN true THEN 0
      END,
        0 - "time_created",
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
  i_site UUID,
  i_id UUID,
  i_topic TEXT,
  i_body TEXT,
  i_observed DATE
) RETURNS JSONB AS $$

  DECLARE
    o_op JSONB;
    v_user UUID;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    o_op := "finfolk".op_fn('save-site-note',v_user,('{}')::JSONB);
    PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_id)::TEXT,0));
    DECLARE
      o_existing JSONB;
      o_site JSONB;
      v_body TEXT;
    BEGIN
      WITH j_ret AS (  
        SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
        WHERE "id" = i_site
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
      v_body := btrim(coalesce(i_body,''));
      WITH j_ret AS (  
        SELECT
          "id",
          "site_id",
          "author_id",
          "topic",
          "body",
          "observed_on",
          "withdrawn",
          "hidden",
          "rev_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SiteNote"
        WHERE "id" = i_id
        LIMIT 1)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
      IF i_id IS NULL OR NOT "finfolk_rpc".is_site_note_site(i_site) OR (length(v_body) < 10) OR (length(v_body) > 1000) OR i_topic IS NULL OR NOT ((i_topic = 'access') OR (i_topic = 'facilities') OR (i_topic = 'wildlife') OR (i_topic = 'conditions')) OR ((i_topic = 'conditions') AND i_observed IS NULL) OR (i_observed IS NOT NULL AND (NOT "isfinite"(i_observed) OR (i_observed > ("timezone"(
        o_site ->> 'timezone',
        to_timestamp((1000000 * extract(epoch FROM now()))::BIGINT / 1000000.0)
      ))::DATE))) THEN
        RAISE EXCEPTION 'Check the site, topic, note length and observation date';
      END IF;
      IF o_existing is not null  THEN
        IF ((o_existing ->> 'author_id')::UUID != v_user) OR ((o_existing ->> 'site_id')::UUID != i_site) OR ((o_existing ->> 'topic') != i_topic) OR ((o_existing ->> 'body') != v_body) OR (coalesce(o_existing ->> 'observed_on','') != coalesce((i_observed)::TEXT,'')) THEN
          RAISE EXCEPTION 'This note identifier was already used';
        END IF;
        RETURN jsonb_build_object(
          'id',
          i_id,
          'revision',
          ("finfolk_rpc".site_note_version((o_existing ->> 'rev_id')::UUID) ->> 'revision')::INTEGER
        );
      END IF;
      DECLARE
        o_note JSONB;
      BEGIN
        o_note := "finfolk_rpc".insert_site_note(i_id,i_site,v_user,i_topic,v_body,i_observed,o_op);
        RETURN jsonb_build_object('id',i_id,'revision',1);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/set-site-note-vote 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_site_note_vote(
  i_site UUID,
  i_note UUID,
  i_upvoted BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    o_op JSONB;
    v_user UUID;
    v_voted BOOLEAN;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    o_op := "finfolk".op_fn('set-site-note-vote',v_user,('{}')::JSONB);
    WITH j_ret AS (  
      SELECT
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "site_id" = i_site
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
      WITH j_ret AS (  
            INSERT INTO "finfolk"."SiteNoteVote" (
              "note_id",
              "voter_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            ) VALUES (
              (i_note)::UUID,
              (v_user)::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'id')::UUID,
              (o_op ->> 'time')::BIGINT,
              (o_op ->> 'time')::BIGINT
            ) RETURNING
              "id",
              "note_id",
              "voter_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
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
          RETURNING
            "id",
            "note_id",
            "voter_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
        null;
    END;
    END IF;
    RETURN "finfolk_rpc".ret_site_note(i_note,v_user);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/set-site-note-withdrawn 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_site_note_withdrawn(
  i_site UUID,
  i_note UUID,
  i_revision INTEGER,
  i_withdrawn BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    o_op JSONB;
    o_raw JSONB;
    v_user UUID;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    o_op := "finfolk".op_fn('set-site-note-withdrawn',v_user,('{}')::JSONB);
    WITH j_ret AS (  
      SELECT
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "site_id" = i_site AND "author_id" = v_user
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_raw;
    o_note := (o_raw || "finfolk_rpc".site_note_version((o_raw ->> 'rev_id')::UUID));
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
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_note
          RETURNING
            "id",
            "site_id",
            "author_id",
            "topic",
            "body",
            "observed_on",
            "withdrawn",
            "hidden",
            "rev_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_saved;
        o_note := (o_saved || "finfolk_rpc".record_site_note_revision(i_note,o_op));
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
  i_site UUID,
  i_note UUID,
  i_reason TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_note JSONB;
    o_op JSONB;
    v_reason TEXT;
    v_reported BOOLEAN;
    v_user UUID;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    o_op := "finfolk".op_fn('report-site-note',v_user,('{}')::JSONB);
    WITH j_ret AS (  
      SELECT
        "id",
        "site_id",
        "author_id",
        "topic",
        "body",
        "observed_on",
        "withdrawn",
        "hidden",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SiteNote"
      WHERE "id" = i_note AND "site_id" = i_site
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
      WITH j_ret AS (  
          INSERT INTO "finfolk"."SiteNoteReport" (
            "note_id",
            "reporter_id",
            "reason",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          ) VALUES (
            (i_note)::UUID,
            (v_user)::UUID,
            "finfolk".as_bounded_text((v_reason)::TEXT,1,1000),
            (o_op ->> 'id')::UUID,
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT,
            (o_op ->> 'time')::BIGINT
          ) RETURNING
            "id",
            "note_id",
            "reporter_id",
            "reason",
            "resolved_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_write;
        null;
    END;
    END IF;
    RETURN jsonb_build_object('reported',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-notes/moderate-site-note 
CREATE OR REPLACE FUNCTION "finfolk_rpc".moderate_site_note(
  i_site UUID,
  i_note UUID,
  i_hidden BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_op JSONB;
    v_user UUID;
  BEGIN
    v_user := "finfolk_rpc".require_site_note_member();
    o_op := "finfolk".op_fn('moderate-site-note',v_user,('{}')::JSONB);
    IF coalesce(current_setting('finfolk.directory_admin',true),'false') != 'true' THEN
      RAISE EXCEPTION 'Administrator access required';
    END IF;
    DECLARE
      o_note JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "site_id",
          "author_id",
          "topic",
          "body",
          "observed_on",
          "withdrawn",
          "hidden",
          "rev_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SiteNote"
        WHERE "id" = i_note AND "site_id" = i_site
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_note;
      IF o_note IS NULL OR i_hidden IS NULL THEN
        RAISE EXCEPTION 'That note is unavailable';
      END IF;
      IF (o_note ->> 'hidden')::BOOLEAN != i_hidden THEN
        DECLARE
        o_version JSONB;
          o_write JSONB;
      BEGIN
        WITH j_ret AS (  
            UPDATE "finfolk"."SiteNote" SET
              "hidden" = (i_hidden)::BOOLEAN,
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "id" = i_note
            RETURNING
              "id",
              "site_id",
              "author_id",
              "topic",
              "body",
              "observed_on",
              "withdrawn",
              "hidden",
              "rev_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
          o_version := "finfolk_rpc".record_site_note_revision(i_note,o_op);
          null;
      END;
      END IF;
      DECLARE
        o_write JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."SiteNoteReport" SET
            "resolved_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "note_id" = i_note AND "resolved_at" IS NULL
          RETURNING
            "id",
            "note_id",
            "reporter_id",
            "reason",
            "resolved_at",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_write;
        null;
      END;
      RETURN jsonb_build_object('id',i_note,'hidden',i_hidden);
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-manage-logbook/insert-dive-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".insert_dive_session(
  i_owner UUID,
  i_beach UUID,
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
    o_base := "finfolk".insert_base_addons('DiveSession',v_id,o_data,o_op);
    WITH j_ret AS (  
      INSERT INTO "finfolk"."DiveSession" (
        "id",
        "owner_id",
        "site_id",
        "detail",
        "audit_id",
        "rev_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      ) VALUES (
        (v_id)::UUID,
        (i_owner)::UUID,
        (i_beach)::UUID,
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
        "site_id",
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
  i_owner UUID
) RETURNS JSONB AS $$

  DECLARE
    o_session JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","owner_id","site_id","detail" FROM "finfolk"."DiveSession"
      WHERE "id" = i_session_id AND "owner_id" = i_owner
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_session;
    IF o_session IS NULL OR NOT "finfolk".is_user_active(i_owner) THEN
      RETURN null;
    END IF;
    RETURN (o_session -> 'detail') || jsonb_build_object(
      'id',
      (o_session ->> 'id')::UUID,
      'ownerId',
      (o_session ->> 'owner_id')::UUID,
      'beachId',
      coalesce(o_session ->> 'site_id','')
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-messaging/receive-social-message 
CREATE OR REPLACE FUNCTION "finfolk_rpc".receive_social_message(
  i_application UUID,
  i_inbox UUID,
  i_namespace TEXT,
  i_envelope JSONB,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Messaging account outside application scope';
    END IF;
    IF (o_inbox ->> 'provider') = 'app' THEN
      RAISE EXCEPTION 'External provider required';
    END IF;
    DECLARE
      o_identity JSONB;
      o_received JSONB;
      v_account UUID;
    BEGIN
      v_account := "finfolk_rpc".insert_social_account(
        o_inbox ->> 'provider',
        i_namespace,
        i_envelope ->> 'senderId',
        '',
        '',
        ('{}')::JSONB,
        o_op
      );
      o_received := "finfolk_rpc".receive_message(i_application,i_inbox,i_envelope);
      WITH j_ret AS (  
        SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
        WHERE "account_id" = i_inbox
        AND "external_id" = i_envelope ->> 'senderId'
        LIMIT 1
        FOR UPDATE)
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
      IF o_identity ->> 'social_account_id' IS NOT NULL AND ((o_identity ->> 'social_account_id')::UUID != v_account) THEN
        RAISE EXCEPTION 'Conflicting social identity binding';
      END IF;
      DECLARE
        o_bound JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingIdentity" SET
            "social_account_id" = (v_account)::UUID,
            "user_id" = (null)::UUID
          WHERE "id" = (o_identity ->> 'id')::UUID
          RETURNING "id","social_account_id","account_id","external_id","user_id")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_bound;
        RETURN o_received;
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-messaging/resolve-social-member 
CREATE OR REPLACE FUNCTION "finfolk_rpc".resolve_social_member(
  i_inbox UUID,
  i_sender TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_connection JSONB;
    o_identity JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
      WHERE "account_id" = i_inbox AND "external_id" = i_sender
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "account_id",
        "status",
        "identity_version",
        "generation",
        "credential_ciphertext",
        "access_expires_at",
        "refresh_expires_at",
        "credential_lease",
        "lease_until",
        "share_posts",
        "public_points",
        "capabilities",
        "granted_scopes",
        "cursor",
        "last_success",
        "next_at",
        "failures",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialConnection"
      WHERE "account_id" = (o_identity ->> 'social_account_id')::UUID
      AND "status" = ('active')::"finfolk"."EnumSocialConnectionStatus"
      LIMIT 1
      FOR SHARE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_connection;
    IF o_connection IS NULL OR NOT "finfolk".is_user_active((o_connection ->> 'user_id')::UUID) THEN
      RETURN null;
    END IF;
    RETURN jsonb_build_object(
      'userId',
      o_connection -> 'user_id',
      'identityVersion',
      o_connection -> 'identity_version',
      'connectionId',
      o_connection -> 'id'
    );
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-messaging/begin-social-message-proof 
CREATE OR REPLACE FUNCTION "finfolk_rpc".begin_social_message_proof(
  i_inbox UUID,
  i_sender TEXT,
  i_receipt UUID,
  i_hash TEXT,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_account JSONB;
    o_identity JSONB;
    o_message JSONB;
    o_receipt JSONB;
    o_thread JSONB;
    v_account UUID;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","social_account_id","account_id","external_id","user_id" FROM "finfolk"."MessagingIdentity"
      WHERE "account_id" = i_inbox AND "external_id" = i_sender
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_identity;
    v_account := (o_identity ->> 'social_account_id')::UUID;
    WITH j_ret AS (  
      SELECT
        "id",
        "provider",
        "namespace",
        "external_id",
        "handle",
        "display_name",
        "generation",
        "provider_data",
        "audit_id",
        "op_created",
        "op_updated",
        "time_created",
        "time_updated"
      FROM "finfolk"."SocialAccount"
      WHERE "id" = v_account
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
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
        "time_created"
      FROM "finfolk"."MessagingReceipt"
      WHERE "id" = i_receipt AND "account_id" = i_inbox
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
        "time_created"
      FROM "finfolk"."MessagingMessage"
      WHERE "id" = (o_receipt ->> 'message_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_message;
    WITH j_ret AS (  
      SELECT "id","account_id","participant_id","external_id" FROM "finfolk"."MessagingConversation"
      WHERE "id" = (o_message ->> 'conversation_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_thread;
    IF o_account IS NULL OR o_receipt IS NULL OR ((o_thread ->> 'participant_id')::UUID != (o_identity ->> 'id')::UUID) THEN
      RAISE EXCEPTION 'Proof receipt does not match sender';
    END IF;
    DECLARE
      o_bound JSONB;
      o_old JSONB;
      o_proof JSONB;
      v_ok BOOLEAN;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnectionProof" SET
          "status" = ('revoked')::"finfolk"."EnumSocialProofStatus",
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "account_id" = v_account AND "status" IN ('pending','verified')
        RETURNING
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_old;
      o_proof := "finfolk_rpc".begin_social_proof(v_account,null,'message',i_hash,null,null,600,o_op);
      WITH j_ret AS (  
        UPDATE "finfolk"."SocialConnectionProof" SET
          "receipt_id" = (i_receipt)::UUID,
          "op_updated" = (o_op ->> 'id')::UUID,
          "time_updated" = (o_op ->> 'time')::BIGINT
        WHERE "id" = (o_proof ->> 'id')::UUID
        RETURNING
          "id",
          "account_id",
          "user_id",
          "connection_id",
          "event_id",
          "inbox_id",
          "receipt_id",
          "kind",
          "token_hash",
          "nonce_hash",
          "flow_key",
          "generation",
          "status",
          "expires_at",
          "verified_at",
          "consumed_at",
          "consumed_version",
          "error",
          "provider_data",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_bound;
      v_ok := "finfolk_rpc".verify_social_proof((o_proof ->> 'id')::UUID,jsonb_build_object(
        'verified',
        true,
        'provider',
        o_account -> 'provider',
        'namespace',
        o_account -> 'namespace',
        'externalId',
        o_account -> 'external_id'
      ),o_op);
      RETURN o_proof;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-delivery/social-delivery-result 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_delivery_result(
  o_delivery JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object(
    'id',
    (o_delivery ->> 'id')::UUID,
    'state',
    o_delivery ->> 'state',
    'attempts',
    o_delivery -> 'attempts',
    'nextAttemptAt',
    o_delivery -> 'next_attempt_at',
    'providerMessageId',
    o_delivery ->> 'provider_message_id'
  );
END;
$$ LANGUAGE 'plpgsql' IMMUTABLE PARALLEL SAFE;

-- finfolkdb.fn.social.social-delivery/record-social-delivery-audit 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_social_delivery_audit(
  i_application UUID,
  o_delivery JSONB,
  i_event TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_audit JSONB;
  BEGIN
    WITH j_ret AS (  
      INSERT INTO "finfolk"."MessagingAudit" ("account_id","actor","event","correlation_id") VALUES (
        (o_delivery ->> 'account_id')::UUID,
        (i_application)::TEXT,
        (i_event)::TEXT,
        (o_delivery ->> 'correlation_id')::UUID
      ) RETURNING
        "id",
        "account_id",
        "actor",
        "event",
        "correlation_id",
        "time_created")
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    RETURN ('{}')::JSONB;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-delivery/social-delivery-policy-error 
CREATE OR REPLACE FUNCTION "finfolk_rpc".social_delivery_policy_error(
  o_inbox JSONB,
  o_event JSONB,
  o_command JSONB,
  o_delivery JSONB
) RETURNS TEXT AS $$

  DECLARE
    o_payload JSONB;
    v_error TEXT;
  BEGIN
    v_error := "finfolk_rpc".social_work_policy_error(o_inbox,o_event,o_command);
    o_payload := (o_event -> 'payload');
    IF v_error is not null  THEN
      RETURN v_error;
    END IF;
    IF (o_delivery ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
      RETURN 'deadline_expired';
    END IF;
    IF ((o_delivery ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_delivery ->> 'channel') != (o_event ->> 'channel')) OR (coalesce(o_delivery ->> 'recipient','') != (o_payload ->> 'senderId')) OR (((o_delivery ->> 'channel') = 'message') AND (coalesce(o_delivery ->> 'thread','') != (o_payload ->> 'conversationId'))) OR (((o_delivery ->> 'channel') != 'message') AND (coalesce(o_delivery ->> 'comment','') != (o_payload ->> 'messageId'))) THEN
      RETURN 'destination_changed';
    END IF;
    IF (o_delivery ->> 'reply_kind') = 'connect_code' THEN
      DECLARE
      o_account JSONB;
        o_proof JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
            "id",
            "account_id",
            "user_id",
            "connection_id",
            "event_id",
            "inbox_id",
            "receipt_id",
            "kind",
            "token_hash",
            "nonce_hash",
            "flow_key",
            "generation",
            "status",
            "expires_at",
            "verified_at",
            "consumed_at",
            "consumed_version",
            "error",
            "provider_data",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialConnectionProof"
          WHERE "id" = ((o_command -> 'result') ->> 'proofId')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_proof;
        WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "external_id",
            "handle",
            "display_name",
            "generation",
            "provider_data",
            "audit_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialAccount"
          WHERE "id" = (o_event ->> 'account_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
        IF o_proof IS NULL OR ((o_proof ->> 'status') != 'verified') OR ((o_proof ->> 'event_id')::UUID != (o_event ->> 'id')::UUID) OR ((o_proof ->> 'account_id')::UUID != (o_account ->> 'id')::UUID) OR ((o_proof ->> 'generation')::INTEGER != (o_account ->> 'generation')::INTEGER) OR ((o_proof ->> 'expires_at')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) OR o_delivery ->> 'body_ciphertext' IS NULL THEN
          RETURN 'proof_invalid';
        END IF;
    END;
    END IF;
    IF ((o_delivery ->> 'state') = 'pending') AND ((o_delivery ->> 'attempts')::INTEGER >= 5) THEN
      RETURN 'attempts_exhausted';
    END IF;
    RETURN null;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-delivery/claim-social-delivery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".claim_social_delivery(
  i_application UUID,
  i_inbox UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF ((o_inbox ->> 'mode') = 'disabled') OR ((o_inbox ->> 'backoff_until')::BIGINT > (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    DECLARE
      o_delivery JSONB;
      o_ready JSONB;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "account_id",
          "event_id",
          "command_id",
          "channel",
          "recipient",
          "thread",
          "comment",
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
          "time_created",
          "time_updated",
          "body_ciphertext",
          "cipher_context",
          "reply_kind"
        FROM "finfolk"."MessagingOutbox"
        WHERE "account_id" = i_inbox
        AND "state" = ('pending')::"finfolk"."EnumMessagingOutboxStatus"
        AND "next_attempt_at" <= (1000000 * extract(epoch FROM now()))::BIGINT
        ORDER BY "time_created","id" ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED)
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_ready;
      o_delivery := null;
      FOR o_delivery IN SELECT jsonb_array_elements(coalesce(o_ready,('[]')::JSONB)) LOOP
        IF o_delivery ->> 'command_id' is not null  THEN
          DECLARE
          o_command JSONB;
            o_event JSONB;
            v_error TEXT;
        BEGIN
          WITH j_ret AS (  
              SELECT
                "id",
                "event_id",
                "inbox_id",
                "generation",
                "account_id",
                "key",
                "context",
                "external_actor_id",
                "external_media_id",
                "owner_id",
                "connection_id",
                "identity_version",
                "command",
                "args",
                "source_url",
                "comment_at",
                "received_at",
                "state",
                "result",
                "site_id",
                "visit_day",
                "reply",
                "send_state",
                "external_reply_id",
                "send_started_at",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialCommand"
              WHERE "id" = (o_delivery ->> 'command_id')::UUID
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
            WITH j_ret AS (  
              SELECT
                "id",
                "provider",
                "namespace",
                "key",
                "account_id",
                "inbox_id",
                "message_id",
                "channel",
                "generation",
                "account_generation",
                "fingerprint",
                "sent_at",
                "deadline",
                "payload",
                "status",
                "attempts",
                "error",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialEvent"
              WHERE "id" = (o_delivery ->> 'event_id')::UUID
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
            v_error := "finfolk_rpc".social_delivery_policy_error(o_inbox,o_event,o_command,o_delivery);
            IF v_error is not null  THEN
              DECLARE
              o_expired JSONB;
            BEGIN
              WITH j_ret AS (  
                  UPDATE "finfolk"."MessagingOutbox" SET
                    "state" = (CASE WHEN v_error = 'deadline_expired' THEN 'expired'
                  WHEN v_error = 'attempts_exhausted' THEN 'failed'
                  WHEN true THEN 'cancelled'
                  END)::"finfolk"."EnumMessagingOutboxStatus",
                    "error_code" = (v_error)::TEXT,
                    "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
                    "body_ciphertext" = (null)::TEXT,
                    "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
                  WHERE "id" = (o_delivery ->> 'id')::UUID
                  RETURNING
                    "id",
                    "account_id",
                    "event_id",
                    "command_id",
                    "channel",
                    "recipient",
                    "thread",
                    "comment",
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
                    "time_created",
                    "time_updated",
                    "body_ciphertext",
                    "cipher_context",
                    "reply_kind")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
                null;
            END;
            ELSE
              DECLARE
              o_claimed JSONB;
                v_lease UUID;
            BEGIN
              v_lease := uuid_generate_v4();
                WITH j_ret AS (  
                  UPDATE "finfolk"."MessagingOutbox" SET
                    "state" = ('sending')::"finfolk"."EnumMessagingOutboxStatus",
                    "attempts" = "finfolk".as_bounded_integer(
                    ((o_delivery ->> 'attempts')::INTEGER + 1)::INTEGER,
                    0,
                    2147483647
                  ),
                    "lease" = (v_lease)::UUID,
                    "lease_until" = ((1000000 * extract(epoch FROM now()))::BIGINT + 60000000)::BIGINT,
                    "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
                  WHERE "id" = (o_delivery ->> 'id')::UUID
                  RETURNING
                    "id",
                    "account_id",
                    "event_id",
                    "command_id",
                    "channel",
                    "recipient",
                    "thread",
                    "comment",
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
                    "time_created",
                    "time_updated",
                    "body_ciphertext",
                    "cipher_context",
                    "reply_kind")
                SELECT to_jsonb(j_ret) FROM j_ret INTO o_claimed;
                PERFORM "finfolk_rpc".record_social_delivery_audit(i_application,o_claimed,'delivery_claimed');
                RETURN jsonb_build_object('id',(o_claimed ->> 'id')::UUID,'lease',v_lease,'deadline',o_claimed -> 'deadline','provider',o_inbox ->> 'provider','accountId',o_inbox ->> 'account_id','destination',jsonb_build_object('channel',o_claimed ->> 'channel','recipientId',o_claimed ->> 'recipient','conversationId',CASE WHEN (o_claimed ->> 'channel') = 'message' THEN o_claimed ->> 'thread'
                WHEN true THEN null
                END,'commentId',o_claimed ->> 'comment'),'payload',jsonb_build_object(
                  'body',
                  o_claimed ->> 'body',
                  'ciphertext',
                  o_claimed ->> 'body_ciphertext',
                  'cipherContext',
                  o_claimed -> 'cipher_context',
                  'replyKind',
                  o_claimed ->> 'reply_kind'
                ));
            END;
            END IF;
        END;
        END IF;
      END LOOP;
      RETURN null;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-delivery/complete-social-delivery 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_social_delivery(
  i_application UUID,
  i_inbox UUID,
  i_delivery UUID,
  i_lease UUID,
  i_outcome TEXT,
  i_provider_id TEXT,
  i_retry_after INTEGER,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_delivery JSONB;
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    WITH j_ret AS (  
      SELECT
        "id",
        "account_id",
        "event_id",
        "command_id",
        "channel",
        "recipient",
        "thread",
        "comment",
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
        "time_created",
        "time_updated",
        "body_ciphertext",
        "cipher_context",
        "reply_kind"
      FROM "finfolk"."MessagingOutbox"
      WHERE "id" = i_delivery AND "account_id" = i_inbox
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_delivery;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    IF o_delivery IS NULL OR o_delivery ->> 'command_id' IS NULL OR i_lease IS NULL OR ((o_delivery ->> 'state') != 'sending') OR ((o_delivery ->> 'lease')::UUID != i_lease) OR ((o_delivery ->> 'lease_until')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) THEN
      RETURN null;
    END IF;
    IF i_outcome IS NULL OR NOT ((i_outcome = 'accepted') OR (i_outcome = 'retry') OR (i_outcome = 'failed') OR (i_outcome = 'uncertain')) OR ((i_outcome = 'accepted') AND ((coalesce(i_provider_id,'') = '') OR (length(i_provider_id) > 500))) OR ((i_outcome = 'retry') AND i_retry_after IS NOT NULL AND ((i_retry_after < 1) OR (i_retry_after > 3600))) THEN
      RAISE EXCEPTION 'Invalid social delivery outcome';
    END IF;
    DECLARE
      v_error TEXT;
      v_next BIGINT;
      v_state TEXT;
    BEGIN
      v_state := CASE WHEN i_outcome = 'accepted' THEN 'provider_accepted'
      WHEN true THEN i_outcome
      END;
      v_error := null;
      v_next := (o_delivery ->> 'next_attempt_at')::BIGINT;
      IF i_outcome = 'retry' THEN
        DECLARE
        o_command JSONB;
          o_event JSONB;
      BEGIN
        WITH j_ret AS (  
            SELECT
              "id",
              "event_id",
              "inbox_id",
              "generation",
              "account_id",
              "key",
              "context",
              "external_actor_id",
              "external_media_id",
              "owner_id",
              "connection_id",
              "identity_version",
              "command",
              "args",
              "source_url",
              "comment_at",
              "received_at",
              "state",
              "result",
              "site_id",
              "visit_day",
              "reply",
              "send_state",
              "external_reply_id",
              "send_started_at",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            FROM "finfolk"."SocialCommand"
            WHERE "id" = (o_delivery ->> 'command_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
          WITH j_ret AS (  
            SELECT
              "id",
              "provider",
              "namespace",
              "key",
              "account_id",
              "inbox_id",
              "message_id",
              "channel",
              "generation",
              "account_generation",
              "fingerprint",
              "sent_at",
              "deadline",
              "payload",
              "status",
              "attempts",
              "error",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            FROM "finfolk"."SocialEvent"
            WHERE "id" = (o_delivery ->> 'event_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
          v_error := "finfolk_rpc".social_delivery_policy_error(o_inbox,o_event,o_command,o_delivery);
          IF v_error IS NULL AND ((o_delivery ->> 'attempts')::INTEGER >= 5) THEN
            v_error := 'attempts_exhausted';
          END IF;
          v_state := CASE WHEN v_error = 'deadline_expired' THEN 'expired'
          WHEN v_error = 'attempts_exhausted' THEN 'failed'
          WHEN v_error IS NOT NULL THEN 'cancelled'
          WHEN true THEN 'pending'
          END;
          v_next := ((1000000 * extract(epoch FROM now()))::BIGINT + (1000000 * greatest(
            coalesce(i_retry_after,1),
            30 * ("power"(2,(o_delivery ->> 'attempts')::INTEGER - 1))::INTEGER
          )));
      END;
      END IF;
      DECLARE
        o_finished JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingOutbox" SET
            "state" = (v_state)::"finfolk"."EnumMessagingOutboxStatus",
            "lease" = (null)::UUID,
            "lease_until" = (null)::BIGINT,
            "next_attempt_at" = (v_next)::BIGINT,
            "provider_message_id" = (CASE WHEN i_outcome = 'accepted' THEN i_provider_id
          WHEN true THEN null
          END)::TEXT,
            "error_code" = (v_error)::TEXT,
            "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
            "body_ciphertext" = (CASE WHEN v_state = 'pending' THEN o_delivery ->> 'body_ciphertext'
          WHEN true THEN null
          END)::TEXT,
            "cipher_context" = "finfolk".as_jsonb((CASE WHEN v_state = 'pending' THEN o_delivery -> 'cipher_context'
          WHEN true THEN ('{}')::JSONB
          END)::JSONB)
          WHERE "id" = i_delivery
          RETURNING
            "id",
            "account_id",
            "event_id",
            "command_id",
            "channel",
            "recipient",
            "thread",
            "comment",
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
            "time_created",
            "time_updated",
            "body_ciphertext",
            "cipher_context",
            "reply_kind")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_finished;
        IF (i_outcome = 'accepted') AND o_delivery ->> 'message_id' IS NOT NULL THEN
          DECLARE
          o_message JSONB;
        BEGIN
          WITH j_ret AS (  
              UPDATE "finfolk"."MessagingMessage" SET
                "external_id" = (i_provider_id)::TEXT,
                "sent_at" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
              WHERE "id" = (o_delivery ->> 'message_id')::UUID
              AND "account_id" = i_inbox
              RETURNING
                "id",
                "account_id",
                "conversation_id",
                "direction",
                "external_id",
                "body",
                "metadata",
                "sent_at",
                "time_created")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_message;
            null;
        END;
        END IF;
        PERFORM "finfolk_rpc".record_social_delivery_audit(i_application,o_finished,"concat"('delivery_',v_state));
        RETURN "finfolk_rpc".social_delivery_result(o_finished);
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.social.social-delivery/reconcile-social-work 
CREATE OR REPLACE FUNCTION "finfolk_rpc".reconcile_social_work(
  i_application UUID,
  i_inbox UUID,
  o_op JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_inbox JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "social_account_id",
        "key",
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
        "time_updated",
        "backoff_until",
        "action_checkpoint",
        "delivery_checkpoint",
        "event_checkpoint",
        "proof_checkpoint",
        "provider_scope"
      FROM "finfolk"."MessagingAccount"
      WHERE "id" = i_inbox AND "application_id" = i_application
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_inbox;
    IF o_inbox is null  THEN
      RAISE EXCEPTION 'Social inbox outside application scope';
    END IF;
    DECLARE
      o_action JSONB;
      o_actions JSONB;
      v_action_cursor UUID;
      v_action_read INTEGER;
      v_actions INTEGER;
      v_deliveries INTEGER;
      v_delivery_cursor UUID;
      v_delivery_read INTEGER;
      v_event_cursor UUID;
      v_event_read INTEGER;
      v_events INTEGER;
      v_proof_cursor UUID;
      v_proof_read INTEGER;
      v_proofs INTEGER;
    BEGIN
      WITH j_ret AS (  
        SELECT
          "id",
          "event_id",
          "command_id",
          "inbox_id",
          "generation",
          "account_generation",
          "attempts",
          "lease",
          "lease_until",
          "deadline",
          "next_attempt_at",
          "error_code",
          "result",
          "account_id",
          "source_id",
          "kind",
          "owner_id",
          "state",
          "data",
          "member_confirmed",
          "session_id",
          "audit_id",
          "op_created",
          "op_updated",
          "time_created",
          "time_updated"
        FROM "finfolk"."SocialAction"
        WHERE "inbox_id" = i_inbox
        AND "state" IN ('pending','running')
        AND "id" > coalesce(
          (o_inbox ->> 'action_checkpoint')::UUID,
          ('00000000-0000-0000-0000-000000000000')::UUID
        )
        ORDER BY "id" ASC
        LIMIT 100
        FOR UPDATE SKIP LOCKED)
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_actions;
      o_action := null;
      v_action_cursor := null;
      v_delivery_cursor := null;
      v_event_cursor := null;
      v_proof_cursor := null;
      v_action_read := jsonb_array_length(coalesce(o_actions,('[]')::JSONB));
      v_delivery_read := 0;
      v_event_read := 0;
      v_proof_read := 0;
      v_actions := 0;
      v_proofs := 0;
      v_deliveries := 0;
      v_events := 0;
      FOR o_action IN SELECT jsonb_array_elements(coalesce(o_actions,('[]')::JSONB)) LOOP
        IF v_action_read = 100 THEN
          v_action_cursor := (o_action ->> 'id')::UUID;
        END IF;
        DECLARE
          o_command JSONB;
          o_event JSONB;
          v_error TEXT;
        BEGIN
          WITH j_ret AS (  
            SELECT
              "id",
              "event_id",
              "inbox_id",
              "generation",
              "account_id",
              "key",
              "context",
              "external_actor_id",
              "external_media_id",
              "owner_id",
              "connection_id",
              "identity_version",
              "command",
              "args",
              "source_url",
              "comment_at",
              "received_at",
              "state",
              "result",
              "site_id",
              "visit_day",
              "reply",
              "send_state",
              "external_reply_id",
              "send_started_at",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            FROM "finfolk"."SocialCommand"
            WHERE "id" = (o_action ->> 'command_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
          WITH j_ret AS (  
            SELECT
              "id",
              "provider",
              "namespace",
              "key",
              "account_id",
              "inbox_id",
              "message_id",
              "channel",
              "generation",
              "account_generation",
              "fingerprint",
              "sent_at",
              "deadline",
              "payload",
              "status",
              "attempts",
              "error",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated"
            FROM "finfolk"."SocialEvent"
            WHERE "id" = (o_action ->> 'event_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
          v_error := "finfolk_rpc".social_work_policy_error(o_inbox,o_event,o_command);
          IF (o_action ->> 'deadline')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
            v_error := 'deadline_expired';
          END IF;
          IF ((o_action ->> 'generation')::INTEGER != (o_event ->> 'generation')::INTEGER) OR ((o_action ->> 'account_generation')::INTEGER != (o_event ->> 'account_generation')::INTEGER) THEN
            v_error := 'identity_changed';
          END IF;
          IF v_error is not null  THEN
            PERFORM "finfolk_rpc".expire_social_action(o_action,v_error,o_op);
            v_actions := (v_actions + 1);
          ELSIF ((o_action ->> 'state') = 'running') AND ((o_action ->> 'lease_until')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) THEN
            DECLARE
            o_recovered JSONB;
              v_log UUID;
              v_retry BOOLEAN;
          BEGIN
            v_retry := ((o_action ->> 'attempts')::INTEGER < 3);
              WITH j_ret AS (  
                UPDATE "finfolk"."SocialAction" SET
                  "lease" = (null)::UUID,
                  "lease_until" = (null)::BIGINT,
                  "next_attempt_at" = ((1000000 * extract(epoch FROM now()))::BIGINT + (30000000 * (o_action ->> 'attempts')::INTEGER))::BIGINT,
                  "error_code" = ('lease_expired')::TEXT,
                  "state" = (CASE WHEN v_retry THEN 'pending'
                WHEN true THEN 'failed'
                END)::TEXT,
                  "op_updated" = (o_op ->> 'id')::UUID,
                  "time_updated" = (o_op ->> 'time')::BIGINT
                WHERE "id" = (o_action ->> 'id')::UUID
                RETURNING
                  "id",
                  "event_id",
                  "command_id",
                  "inbox_id",
                  "generation",
                  "account_generation",
                  "attempts",
                  "lease",
                  "lease_until",
                  "deadline",
                  "next_attempt_at",
                  "error_code",
                  "result",
                  "account_id",
                  "source_id",
                  "kind",
                  "owner_id",
                  "state",
                  "data",
                  "member_confirmed",
                  "session_id",
                  "audit_id",
                  "op_created",
                  "op_updated",
                  "time_created",
                  "time_updated")
              SELECT jsonb_agg(j_ret) FROM j_ret INTO o_recovered;
              v_log := "finfolk_rpc".record_social_audit(
                'SocialAction',
                (o_action ->> 'audit_id')::UUID,
                'lease_expired',
                o_op
              );
              IF NOT v_retry THEN
                PERFORM "finfolk_rpc".finish_social_command_reply(
                  (o_command ->> 'id')::UUID,
                  'Unable to verify your social account. Try /connect again later.',
                  null,
                  null,
                  ('{"error":"external_effect_failed"}')::JSONB,
                  o_op
                );
              END IF;
              v_actions := (v_actions + 1);
          END;
          END IF;
        END;
      END LOOP;
      DECLARE
        o_delivery JSONB;
        o_pending JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "account_id",
            "event_id",
            "command_id",
            "channel",
            "recipient",
            "thread",
            "comment",
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
            "time_created",
            "time_updated",
            "body_ciphertext",
            "cipher_context",
            "reply_kind"
          FROM "finfolk"."MessagingOutbox"
          WHERE "account_id" = i_inbox
          AND "state" IN ('pending','sending')
          AND "id" > coalesce(
            (o_inbox ->> 'delivery_checkpoint')::UUID,
            ('00000000-0000-0000-0000-000000000000')::UUID
          )
          ORDER BY "id" ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED)
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_pending;
        o_delivery := null;
        v_delivery_read := jsonb_array_length(coalesce(o_pending,('[]')::JSONB));
        FOR o_delivery IN SELECT jsonb_array_elements(coalesce(o_pending,('[]')::JSONB)) LOOP
          IF v_delivery_read = 100 THEN
            v_delivery_cursor := (o_delivery ->> 'id')::UUID;
          END IF;
          IF o_delivery ->> 'command_id' is not null  THEN
            DECLARE
            o_command JSONB;
              o_event JSONB;
              v_error TEXT;
          BEGIN
            WITH j_ret AS (  
                SELECT
                  "id",
                  "event_id",
                  "inbox_id",
                  "generation",
                  "account_id",
                  "key",
                  "context",
                  "external_actor_id",
                  "external_media_id",
                  "owner_id",
                  "connection_id",
                  "identity_version",
                  "command",
                  "args",
                  "source_url",
                  "comment_at",
                  "received_at",
                  "state",
                  "result",
                  "site_id",
                  "visit_day",
                  "reply",
                  "send_state",
                  "external_reply_id",
                  "send_started_at",
                  "op_created",
                  "op_updated",
                  "time_created",
                  "time_updated"
                FROM "finfolk"."SocialCommand"
                WHERE "id" = (o_delivery ->> 'command_id')::UUID
                LIMIT 1)
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
              WITH j_ret AS (  
                SELECT
                  "id",
                  "provider",
                  "namespace",
                  "key",
                  "account_id",
                  "inbox_id",
                  "message_id",
                  "channel",
                  "generation",
                  "account_generation",
                  "fingerprint",
                  "sent_at",
                  "deadline",
                  "payload",
                  "status",
                  "attempts",
                  "error",
                  "op_created",
                  "op_updated",
                  "time_created",
                  "time_updated"
                FROM "finfolk"."SocialEvent"
                WHERE "id" = (o_delivery ->> 'event_id')::UUID
                LIMIT 1)
              SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
              v_error := "finfolk_rpc".social_delivery_policy_error(o_inbox,o_event,o_command,o_delivery);
              IF ((o_delivery ->> 'state') = 'sending') AND ((o_delivery ->> 'lease_until')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT) THEN
                v_error := 'lease_expired';
              END IF;
              IF v_error is not null  THEN
                DECLARE
                o_expired JSONB;
                  v_state TEXT;
              BEGIN
                v_state := CASE WHEN (o_delivery ->> 'state') = 'sending' THEN 'uncertain'
                  WHEN v_error = 'deadline_expired' THEN 'expired'
                  WHEN v_error = 'attempts_exhausted' THEN 'failed'
                  WHEN true THEN 'cancelled'
                  END;
                  WITH j_ret AS (  
                    UPDATE "finfolk"."MessagingOutbox" SET
                      "state" = (v_state)::"finfolk"."EnumMessagingOutboxStatus",
                      "lease" = (null)::UUID,
                      "lease_until" = (null)::BIGINT,
                      "error_code" = (v_error)::TEXT,
                      "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT,
                      "body_ciphertext" = (null)::TEXT,
                      "cipher_context" = "finfolk".as_jsonb(('{}')::JSONB)
                    WHERE "id" = (o_delivery ->> 'id')::UUID
                    RETURNING
                      "id",
                      "account_id",
                      "event_id",
                      "command_id",
                      "channel",
                      "recipient",
                      "thread",
                      "comment",
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
                      "time_created",
                      "time_updated",
                      "body_ciphertext",
                      "cipher_context",
                      "reply_kind")
                  SELECT to_jsonb(j_ret) FROM j_ret INTO o_expired;
                  PERFORM "finfolk_rpc".record_social_delivery_audit(i_application,o_expired,"concat"('delivery_',v_state));
                  v_deliveries := (v_deliveries + 1);
              END;
              END IF;
          END;
          END IF;
        END LOOP;
      END;
      DECLARE
        o_event JSONB;
        o_pending JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "provider",
            "namespace",
            "key",
            "account_id",
            "inbox_id",
            "message_id",
            "channel",
            "generation",
            "account_generation",
            "fingerprint",
            "sent_at",
            "deadline",
            "payload",
            "status",
            "attempts",
            "error",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialEvent"
          WHERE "inbox_id" = i_inbox
          AND "status" IN ('queued','waiting')
          AND "id" > coalesce(
            (o_inbox ->> 'event_checkpoint')::UUID,
            ('00000000-0000-0000-0000-000000000000')::UUID
          )
          ORDER BY "id" ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED)
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_pending;
        o_event := null;
        v_event_read := jsonb_array_length(coalesce(o_pending,('[]')::JSONB));
        FOR o_event IN SELECT jsonb_array_elements(coalesce(o_pending,('[]')::JSONB)) LOOP
          IF v_event_read = 100 THEN
            v_event_cursor := (o_event ->> 'id')::UUID;
          END IF;
          DECLARE
            o_command JSONB;
            v_error TEXT;
          BEGIN
            WITH j_ret AS (  
              SELECT
                "id",
                "event_id",
                "inbox_id",
                "generation",
                "account_id",
                "key",
                "context",
                "external_actor_id",
                "external_media_id",
                "owner_id",
                "connection_id",
                "identity_version",
                "command",
                "args",
                "source_url",
                "comment_at",
                "received_at",
                "state",
                "result",
                "site_id",
                "visit_day",
                "reply",
                "send_state",
                "external_reply_id",
                "send_started_at",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialCommand"
              WHERE "event_id" = (o_event ->> 'id')::UUID
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_command;
            v_error := "finfolk_rpc".social_work_policy_error(o_inbox,o_event,o_command);
            IF v_error is not null  THEN
              DECLARE
              o_expired JSONB;
                o_expired_command JSONB;
            BEGIN
              WITH j_ret AS (  
                  UPDATE "finfolk"."SocialEvent" SET
                    "status" = ('expired')::TEXT,
                    "error" = (v_error)::TEXT,
                    "op_updated" = (o_op ->> 'id')::UUID,
                    "time_updated" = (o_op ->> 'time')::BIGINT
                  WHERE "id" = (o_event ->> 'id')::UUID
                  RETURNING
                    "id",
                    "provider",
                    "namespace",
                    "key",
                    "account_id",
                    "inbox_id",
                    "message_id",
                    "channel",
                    "generation",
                    "account_generation",
                    "fingerprint",
                    "sent_at",
                    "deadline",
                    "payload",
                    "status",
                    "attempts",
                    "error",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated")
                SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
                WITH j_ret AS (  
                  UPDATE "finfolk"."SocialCommand" SET
                    "state" = ('expired')::"finfolk"."EnumSocialCommandStatus",
                    "result" = (jsonb_build_object('error',v_error))::JSONB,
                    "op_updated" = (o_op ->> 'id')::UUID,
                    "time_updated" = (o_op ->> 'time')::BIGINT
                  WHERE "event_id" = (o_event ->> 'id')::UUID
                  RETURNING
                    "id",
                    "event_id",
                    "inbox_id",
                    "generation",
                    "account_id",
                    "key",
                    "context",
                    "external_actor_id",
                    "external_media_id",
                    "owner_id",
                    "connection_id",
                    "identity_version",
                    "command",
                    "args",
                    "source_url",
                    "comment_at",
                    "received_at",
                    "state",
                    "result",
                    "site_id",
                    "visit_day",
                    "reply",
                    "send_state",
                    "external_reply_id",
                    "send_started_at",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated")
                SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired_command;
                v_events := (v_events + 1);
            END;
            END IF;
          END;
        END LOOP;
      END;
      DECLARE
        o_proof JSONB;
        o_proofs JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT
            "id",
            "account_id",
            "user_id",
            "connection_id",
            "event_id",
            "inbox_id",
            "receipt_id",
            "kind",
            "token_hash",
            "nonce_hash",
            "flow_key",
            "generation",
            "status",
            "expires_at",
            "verified_at",
            "consumed_at",
            "consumed_version",
            "error",
            "provider_data",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated"
          FROM "finfolk"."SocialConnectionProof"
          WHERE "inbox_id" = i_inbox
          AND "status" IN ('pending','verified')
          AND "id" > coalesce(
            (o_inbox ->> 'proof_checkpoint')::UUID,
            ('00000000-0000-0000-0000-000000000000')::UUID
          )
          ORDER BY "id" ASC
          LIMIT 100
          FOR UPDATE SKIP LOCKED)
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_proofs;
        o_proof := null;
        v_proof_read := jsonb_array_length(coalesce(o_proofs,('[]')::JSONB));
        FOR o_proof IN SELECT jsonb_array_elements(coalesce(o_proofs,('[]')::JSONB)) LOOP
          IF v_proof_read = 100 THEN
            v_proof_cursor := (o_proof ->> 'id')::UUID;
          END IF;
          DECLARE
            o_account JSONB;
            o_event JSONB;
            v_status TEXT;
          BEGIN
            WITH j_ret AS (  
              SELECT
                "id",
                "provider",
                "namespace",
                "key",
                "account_id",
                "inbox_id",
                "message_id",
                "channel",
                "generation",
                "account_generation",
                "fingerprint",
                "sent_at",
                "deadline",
                "payload",
                "status",
                "attempts",
                "error",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialEvent"
              WHERE "id" = (o_proof ->> 'event_id')::UUID
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_event;
            WITH j_ret AS (  
              SELECT
                "id",
                "provider",
                "namespace",
                "external_id",
                "handle",
                "display_name",
                "generation",
                "provider_data",
                "audit_id",
                "op_created",
                "op_updated",
                "time_created",
                "time_updated"
              FROM "finfolk"."SocialAccount"
              WHERE "id" = (o_proof ->> 'account_id')::UUID
              LIMIT 1)
            SELECT to_jsonb(j_ret) FROM j_ret INTO o_account;
            v_status := null;
            IF (o_proof ->> 'expires_at')::BIGINT <= (1000000 * extract(epoch FROM now()))::BIGINT THEN
              v_status := 'expired';
            END IF;
            IF ((o_event ->> 'generation')::INTEGER != (o_inbox ->> 'generation')::INTEGER) OR ((o_proof ->> 'generation')::INTEGER != (o_account ->> 'generation')::INTEGER) THEN
              v_status := 'revoked';
            END IF;
            IF v_status is not null  THEN
              DECLARE
              o_expired JSONB;
            BEGIN
              WITH j_ret AS (  
                  UPDATE "finfolk"."SocialConnectionProof" SET
                    "status" = (v_status)::"finfolk"."EnumSocialProofStatus",
                    "op_updated" = (o_op ->> 'id')::UUID,
                    "time_updated" = (o_op ->> 'time')::BIGINT
                  WHERE "id" = (o_proof ->> 'id')::UUID
                  RETURNING
                    "id",
                    "account_id",
                    "user_id",
                    "connection_id",
                    "event_id",
                    "inbox_id",
                    "receipt_id",
                    "kind",
                    "token_hash",
                    "nonce_hash",
                    "flow_key",
                    "generation",
                    "status",
                    "expires_at",
                    "verified_at",
                    "consumed_at",
                    "consumed_version",
                    "error",
                    "provider_data",
                    "op_created",
                    "op_updated",
                    "time_created",
                    "time_updated")
                SELECT jsonb_agg(j_ret) FROM j_ret INTO o_expired;
                v_proofs := (v_proofs + 1);
            END;
            END IF;
          END;
        END LOOP;
      END;
      DECLARE
        o_checkpoint JSONB;
      BEGIN
        WITH j_ret AS (  
          UPDATE "finfolk"."MessagingAccount" SET
            "action_checkpoint" = (v_action_cursor)::UUID,
            "delivery_checkpoint" = (v_delivery_cursor)::UUID,
            "event_checkpoint" = (v_event_cursor)::UUID,
            "proof_checkpoint" = (v_proof_cursor)::UUID
          WHERE "id" = i_inbox
          RETURNING
            "id",
            "social_account_id",
            "key",
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
            "time_updated",
            "backoff_until",
            "action_checkpoint",
            "delivery_checkpoint",
            "event_checkpoint",
            "proof_checkpoint",
            "provider_scope")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_checkpoint;
        RETURN jsonb_build_object(
          'actions',
          v_actions,
          'deliveries',
          v_deliveries,
          'events',
          v_events,
          'proofs',
          v_proofs,
          'scanned',
          v_action_read + v_delivery_read + v_event_read + v_proof_read,
          'more',
          (v_action_read = 100) OR (v_delivery_read = 100) OR (v_event_read = 100) OR (v_proof_read = 100)
        );
      END;
    END;
  END;

$$ LANGUAGE 'plpgsql';


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
 actor uuid:=finfolk.auth_uid(); adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'')='true';
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
 IF NOT EXISTS(SELECT 1 FROM neon_auth."user" WHERE id::text=actor::text AND "emailVerified" AND NOT coalesce(banned,false)) THEN
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
GRANT EXECUTE ON FUNCTION finfolk.auth_uid(),finfolk.as_jsonb(jsonb),finfolk.op_fn(text,uuid,jsonb),finfolk.insert_base_addons(text,uuid,jsonb,jsonb),finfolk.ret_social_url(text),finfolk.ret_social_urls(jsonb),finfolk_rpc.insert_user(uuid,jsonb,jsonb),finfolk_rpc.insert_directory_listing(jsonb,jsonb),finfolk_rpc.ret_directory_public(uuid),finfolk_rpc.directory_document(jsonb),finfolk_rpc.directory_owner_row(finfolk."DirectoryListing"),finfolk_rpc.directory_operation(text,jsonb) TO finfolk_directory;
COMMIT;
