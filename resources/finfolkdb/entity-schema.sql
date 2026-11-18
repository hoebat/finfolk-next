-- Generated standalone FinFolk entity schema.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') THEN CREATE ROLE finfolk_api NOLOGIN; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) THEN RAISE EXCEPTION 'Fresh entity schema requires empty application schemas'; END IF; END $$;
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
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "deletion_state" TEXT NOT NULL DEFAULT 'active',
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

-- finfolkdb.common.type-user/UserRole 
CREATE TABLE IF NOT EXISTS "finfolk"."UserRole" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "role" TEXT NOT NULL,
  UNIQUE ("user_id","role"),
  CONSTRAINT known_role CHECK (("role" = 'admin') OR ("role" = 'moderator'))
);

-- finfolkdb.common.type-user/ApplicationFeature 
CREATE TABLE IF NOT EXISTS "finfolk"."ApplicationFeature" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE ("key")
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
        "email_verified",
        "deletion_state",
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
  "site_id" UUID REFERENCES "finfolk"."Site"("id"),
  "site_key" TEXT NOT NULL DEFAULT '',
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

-- finfolkdb.common.type-event/EventInviteDelivery 
CREATE TABLE IF NOT EXISTS "finfolk"."EventInviteDelivery" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "event_id" UUID NOT NULL REFERENCES "finfolk"."Event"("id") ON DELETE CASCADE,
  "invite_id" UUID NOT NULL,
  "requester_id" UUID NOT NULL REFERENCES "finfolk"."User"("id") ON DELETE CASCADE,
  "state" TEXT NOT NULL DEFAULT 'queued',
  "sealed_token" TEXT NOT NULL DEFAULT '',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease" UUID,
  "lease_until" BIGINT NOT NULL DEFAULT 0,
  "receipt" TEXT NOT NULL DEFAULT '',
  "error" TEXT NOT NULL DEFAULT '',
  "time_created" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  "time_updated" BIGINT NOT NULL DEFAULT (1000000 * extract(epoch FROM now()))::BIGINT,
  UNIQUE ("invite_id"),
  CONSTRAINT state_valid CHECK (("state" = 'queued') OR ("state" = 'sending') OR ("state" = 'sent') OR ("state" = 'failed') OR ("state" = 'cancelled')),
  CONSTRAINT attempts_valid CHECK (("attempts" >= 0) AND ("attempts" <= 5))
);

-- finfolkdb.fn.user.user-account/ret-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_account(
  i_user UUID
) RETURNS JSONB AS $$

  DECLARE
    o_user JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","profile" FROM "finfolk"."User"
      WHERE "id" = i_user AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    IF o_user is null  THEN
      RAISE EXCEPTION 'Account unavailable';
    END IF;
    RETURN jsonb_build_object('id',i_user,'profile',o_user -> 'profile');
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/ensure-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ensure_account(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  IF i_user is null  THEN
    RAISE EXCEPTION 'Authenticated identity required';
  END IF;
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  DECLARE
    v_exists BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."User"
    WHERE "id" = i_user) INTO v_exists;
    IF NOT v_exists THEN
      PERFORM "finfolk_rpc".insert_user(
        i_user,
        jsonb_build_object('displayName','Diver'),
        "finfolk".op_fn('account-create',i_user,('{}')::JSONB)
      );
    END IF;
  END;
  RETURN "finfolk_rpc".ret_account(i_user);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/sync-account-identity 
CREATE OR REPLACE FUNCTION "finfolk_rpc".sync_account_identity(
  i_user UUID,
  i_verified BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ensure_account(i_user);
  DECLARE
    o_updated JSONB;
  BEGIN
    WITH j_ret AS (  
      UPDATE "finfolk"."User" SET "email_verified" = (coalesce(i_verified,false))::BOOLEAN WHERE "id" = i_user AND "deleted" = false
      RETURNING
        "id",
        "profile",
        "deleted",
        "email_verified",
        "deletion_state",
        "invite_eligible",
        "joined_at",
        "time_updated",
        "activity_id",
        "audit_id",
        "rev_id")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
  END;
  RETURN jsonb_build_object('ok',true);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/account-list 
CREATE OR REPLACE FUNCTION "finfolk_rpc".account_list(
  i_value JSONB,
  i_allowed JSONB,
  i_limit INTEGER
) RETURNS JSONB AS $$

  DECLARE
    o_item JSONB;
    o_result JSONB;
    o_value JSONB;
    v_text TEXT;
  BEGIN
    o_value := coalesce(i_value,('[]')::JSONB);
    o_result := ('[]')::JSONB;
    o_item := null;
    v_text := null;
    IF (jsonb_typeof(o_value) != 'array') OR (jsonb_array_length(o_value) > i_limit) THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Invalid profile list';
    END IF;
    FOR o_item IN SELECT jsonb_array_elements(o_value) LOOP
      IF jsonb_typeof(o_item) != 'string' THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Invalid profile list value';
      END IF;
      v_text := (jsonb_build_array(o_item) ->> 0);
      IF i_allowed IS NOT NULL AND NOT jsonb_exists(i_allowed,v_text) THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Choose a listed profile value';
      END IF;
      IF NOT jsonb_exists(o_result,v_text) THEN
        o_result := (o_result || jsonb_build_array(v_text));
      END IF;
    END LOOP;
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/account-link 
CREATE OR REPLACE FUNCTION "finfolk_rpc".account_link(
  i_value TEXT,
  i_platform TEXT
) RETURNS TEXT AS $$

  DECLARE
    v_value TEXT;
  BEGIN
    v_value := coalesce(i_value,'');
    IF v_value = '' THEN
      RETURN '';
    END IF;
    IF (length(v_value) > 200) OR ((i_platform = 'instagram') AND NOT "regexp_like"(
      v_value,
      '^https://(www[.])?instagram[.]com/[A-Za-z0-9._]{1,30}/?$'
    )) OR ((i_platform = 'tiktok') AND NOT "regexp_like"(
      v_value,
      '^https://(www[.])?tiktok[.]com/@[A-Za-z0-9._]{1,30}/?$'
    )) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Enter a full provider profile URL'
      ;
    END IF;
    RETURN "regexp_replace"(
      "regexp_replace"(v_value,'^https://(www[.])?','https://www.'),
      '/$',
      ''
    ) || '/';
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/account-portrait 
CREATE OR REPLACE FUNCTION "finfolk_rpc".account_portrait(
  i_value TEXT
) RETURNS TEXT AS $$
BEGIN
  IF i_value = '' THEN
    RETURN '';
  END IF;
  IF i_value IS NULL OR (length(i_value) > 65558) OR NOT "regexp_like"(
    i_value,
    '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$'
  ) THEN
    RAISE EXCEPTION USING
      errcode = '22023',
      message = 'Choose a valid JPEG or WebP portrait'
    ;
  END IF;
  DECLARE
    v_bytes BYTEA;
    v_size INT;
    v_valid BOOLEAN;
  BEGIN
    v_bytes := "decode"("split_part"(i_value,',',2),'base64');
    v_size := "octet_length"(v_bytes);
    v_valid := false;
    IF (v_size >= 20) AND (v_size <= 49152) THEN
      IF "regexp_like"(i_value,'^data:image/webp;') THEN
        v_valid := (("encode"("substr"(v_bytes,1,4),'hex') = '52494646') AND ("encode"("substr"(v_bytes,9,4),'hex') = '57454250') AND jsonb_exists(
          ('["56503820","5650384c","56503858"]')::JSONB,
          "encode"("substr"(v_bytes,13,4),'hex')
        ) AND (("get_byte"(v_bytes,4) + (256 * "get_byte"(v_bytes,5)) + (65536 * "get_byte"(v_bytes,6)) + (16777216 * "get_byte"(v_bytes,7))) = (v_size - 8)));
      ELSE
        v_valid := (("get_byte"(v_bytes,0) = 255) AND ("get_byte"(v_bytes,1) = 216) AND ("get_byte"(v_bytes,2) = 255) AND ("get_byte"(v_bytes,v_size - 2) = 255) AND ("get_byte"(v_bytes,v_size - 1) = 217));
      END IF;
    END IF;
    IF NOT v_valid THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Choose a valid JPEG or WebP portrait'
      ;
    END IF;
    RETURN i_value;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/account-featured 
CREATE OR REPLACE FUNCTION "finfolk_rpc".account_featured(
  i_user UUID,
  i_kind TEXT,
  i_values JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_item JSONB;
    o_values JSONB;
    v_id UUID;
    v_owned BOOLEAN;
  BEGIN
    o_values := "finfolk_rpc".account_list(i_values,null,12);
    o_item := null;
    v_id := null;
    v_owned := false;
    FOR o_item IN SELECT jsonb_array_elements(o_values) LOOP
      v_id := (jsonb_build_array(o_item) ->> 0)::UUID;
      IF i_kind = 'featuredLogs' THEN
        DECLARE
        o_session JSONB;
      BEGIN
        WITH j_ret AS (  
            SELECT "detail" FROM "finfolk"."DiveSession"
            WHERE "id" = v_id AND "owner_id" = i_user
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_session;
          v_owned := coalesce(((o_session -> 'detail') ->> 'visibility') = 'public',false);
      END;
      ELSE
        DECLARE
        v_post BOOLEAN;
      BEGIN
        SELECT exists(SELECT 1 FROM "finfolk"."SocialPost"
          WHERE "id" = v_id
          AND "owner_id" = i_user
          AND "status" = ('approved')::"finfolk"."EnumSocialPostStatus"
          AND "public_consent" = true) INTO v_post;
          v_owned := v_post;
      END;
      END IF;
      IF NOT v_owned THEN
        RAISE EXCEPTION USING
          errcode = '22023',
          message = 'Feature only your currently published items'
        ;
      END IF;
    END LOOP;
    RETURN o_values;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/save-account-preferences 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_account_preferences(
  i_user UUID,
  i_profile JSONB,
  i_verified BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  DECLARE
    o_account JSONB;
    o_beaches JSONB;
    o_depth JSONB;
    o_input JSONB;
    o_old JSONB;
    o_result JSONB;
    o_sharing JSONB;
    o_user JSONB;
    v_bio TEXT;
    v_key TEXT;
    v_name TEXT;
  BEGIN
    o_account := "finfolk_rpc".ret_account(i_user);
    o_old := (o_account -> 'profile');
    o_input := null;
    o_sharing := null;
    o_result := null;
    v_key := null;
    v_name := null;
    v_bio := null;
    o_depth := null;
    o_beaches := null;
    WITH j_ret AS (  
      SELECT
        "id",
        "profile",
        "deleted",
        "email_verified",
        "deletion_state",
        "invite_eligible",
        "joined_at",
        "time_updated",
        "activity_id",
        "audit_id",
        "rev_id"
      FROM "finfolk"."User"
      WHERE "id" = i_user
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    IF i_profile IS NULL OR (jsonb_typeof(i_profile) != 'object') THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Invalid profile';
    END IF;
    FOR v_key IN SELECT jsonb_object_keys(i_profile) LOOP
      IF NOT jsonb_exists(
        ('["displayName","bio","instagram","tiktok","open","sharing","beaches","activities","availability","experience","depthGoal","portrait","featuredLogs","featuredPosts"]')::JSONB,
        v_key
      ) THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Unknown profile field';
      END IF;
    END LOOP;
    o_input := (o_old || i_profile);
    v_name := btrim(coalesce(o_input ->> 'displayName','Diver'));
    IF v_name = '' THEN
      v_name := 'Diver';
    END IF;
    v_bio := btrim(coalesce(o_input ->> 'bio',''));
    IF (length(v_name) > 80) OR (length(v_bio) > 500) OR (jsonb_exists(o_input,'open') AND (jsonb_typeof(o_input -> 'open') != 'boolean')) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Invalid profile text or visibility'
      ;
    END IF;
    IF ((o_input -> 'open') = ('true')::JSONB) AND NOT coalesce(i_verified,false) THEN
      RAISE EXCEPTION USING
        errcode = '42501',
        message = 'Verify your email before appearing in discovery'
      ;
    END IF;
    o_sharing := coalesce(o_input -> 'sharing',('{}')::JSONB);
    IF jsonb_typeof(o_sharing) != 'object' THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Invalid sharing preferences';
    END IF;
    o_depth := coalesce(o_input -> 'depthGoal',('null')::JSONB);
    IF (o_depth != ('null')::JSONB) AND ((jsonb_typeof(o_depth) != 'number') OR (((o_depth)::TEXT)::NUMERIC <= 0) OR (((o_depth)::TEXT)::NUMERIC > 100)) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Choose a depth between 0 and 100 metres'
      ;
    END IF;
    o_beaches := "finfolk_rpc".account_list(o_input -> 'beaches',null,20);
    DECLARE
      o_site JSONB;
      v_site UUID;
    BEGIN
      o_site := null;
      v_site := null;
      FOR o_site IN SELECT jsonb_array_elements(o_beaches) LOOP
        v_site := (jsonb_build_array(o_site) ->> 0)::UUID;
        DECLARE
          v_exists BOOLEAN;
        BEGIN
          SELECT exists(SELECT 1 FROM "finfolk"."Site"
          WHERE "id" = v_site) INTO v_exists;
          IF NOT v_exists THEN
            RAISE EXCEPTION USING errcode = '22023',message = 'Choose an existing dive site';
          END IF;
        END;
      END LOOP;
    END;
    IF jsonb_exists(o_input,'experience') AND NOT jsonb_exists(
      ('["","new","comfortable","experienced"]')::JSONB,
      o_input ->> 'experience'
    ) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Choose a listed experience level'
      ;
    END IF;
    o_result := jsonb_build_object('displayName',v_name,'bio',v_bio,'instagram',"finfolk_rpc".account_link(o_input ->> 'instagram','instagram'),'tiktok',"finfolk_rpc".account_link(o_input ->> 'tiktok','tiktok'),'open',coalesce((o_input -> 'open') = ('true')::JSONB,false),'sharing',jsonb_build_object(
      'visits',
      coalesce((o_sharing -> 'visits') = ('true')::JSONB,false),
      'months',
      coalesce((o_sharing -> 'months') = ('true')::JSONB,false),
      'dives',
      coalesce((o_sharing -> 'dives') = ('true')::JSONB,false),
      'time',
      coalesce((o_sharing -> 'time') = ('true')::JSONB,false),
      'depth',
      coalesce((o_sharing -> 'depth') = ('true')::JSONB,false)
    ),'beaches',o_beaches,'activities',"finfolk_rpc".account_list(
      o_input -> 'activities',
      ('["freediving","ocean-swimming","spearfishing"]')::JSONB,
      3
    ),'availability',"finfolk_rpc".account_list(
      o_input -> 'availability',
      ('["weekday mornings","weekday afternoons","weekend mornings","weekend afternoons"]')::JSONB,
      4
    ),'experience',coalesce(o_input ->> 'experience',''),'depthGoal',o_depth);
    o_result := ((o_old - 'displayName' - 'bio' - 'instagram' - 'tiktok' - 'open' - 'sharing' - 'beaches' - 'activities' - 'availability' - 'experience' - 'depthGoal') || o_result);
    IF jsonb_exists(i_profile,'portrait') THEN
      o_result := (o_result || jsonb_build_object(
        'portrait',
        "finfolk_rpc".account_portrait(i_profile ->> 'portrait')
      ));
    END IF;
    IF jsonb_exists(i_profile,'featuredLogs') THEN
      o_result := (o_result || jsonb_build_object(
        'featuredLogs',
        "finfolk_rpc".account_featured(i_user,'featuredLogs',i_profile -> 'featuredLogs')
      ));
    END IF;
    IF jsonb_exists(i_profile,'featuredPosts') THEN
      o_result := (o_result || jsonb_build_object(
        'featuredPosts',
        "finfolk_rpc".account_featured(i_user,'featuredPosts',i_profile -> 'featuredPosts')
      ));
    END IF;
    DECLARE
      o_history JSONB;
      o_log JSONB;
      o_op JSONB;
      o_rev JSONB;
      o_updated JSONB;
    BEGIN
      o_op := "finfolk".op_fn('account-preferences',i_user,('{}')::JSONB);
      WITH j_ret AS (  
        UPDATE "finfolk"."User" SET
          "profile" = (o_result)::JSONB,
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_user AND "deleted" = false
        RETURNING
          "id",
          "profile",
          "deleted",
          "email_verified",
          "deletion_state",
          "invite_eligible",
          "joined_at",
          "time_updated",
          "activity_id",
          "audit_id",
          "rev_id")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
      WITH j_ret AS (  
        UPDATE "finfolk"."Rev" SET
          "index" = (1 + "index")::INTEGER,
          "current" = (o_result)::JSONB
        WHERE "id" = (o_user ->> 'rev_id')::UUID
        RETURNING "id","class_ref","index","current","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_rev;
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
          ('User')::"finfolk"."EnumClassType",
          ('Global')::"finfolk"."EnumClassType",
          (o_user ->> 'rev_id')::UUID,
          (((o_rev -> 0) ->> 'index')::INT)::INTEGER,
          (o_result)::JSONB,
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
          ('User')::"finfolk"."EnumClassType",
          ('Global')::"finfolk"."EnumClassType",
          (o_user ->> 'audit_id')::UUID,
          "finfolk".as_jsonb((jsonb_build_object('event','preferences'))::JSONB),
          (o_op ->> 'id')::UUID,
          (o_op ->> 'time')::BIGINT
        ) RETURNING "id","audit_id","op_created","time_created")
      SELECT to_jsonb(j_ret) FROM j_ret INTO o_log;
      RETURN o_result;
    END;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/lock-account-pair 
CREATE OR REPLACE FUNCTION "finfolk_rpc".lock_account_pair(
  i_user UUID,
  i_target UUID
) RETURNS BOOLEAN AS $$
BEGIN
  IF i_target IS NULL OR (i_user = i_target) THEN
    RAISE EXCEPTION USING errcode = '22023',message = 'Choose another diver';
  END IF;
  PERFORM "pg_advisory_xact_lock"("hashtextextended"(
    'account-pair:' || (least(i_user,i_target))::TEXT || ':' || (greatest(i_user,i_target))::TEXT,
    0
  ));
  EXECUTE 'SELECT id FROM finfolk."User" WHERE id=$1 FOR SHARE' USING least(i_user,i_target);
  EXECUTE 'SELECT id FROM finfolk."User" WHERE id=$1 FOR SHARE' USING greatest(i_user,i_target);
  PERFORM "finfolk_rpc".ret_account(i_user);
  IF NOT "finfolk".is_user_active(i_target) THEN
    RAISE EXCEPTION USING errcode = 'P0002',message = 'Profile unavailable';
  END IF;
  RETURN true;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/set-account-connection 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_account_connection(
  i_user UUID,
  i_target UUID,
  i_mode TEXT,
  i_verified BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".lock_account_pair(i_user,i_target);
  IF NOT coalesce(i_verified,false) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Verify your email before connecting'
    ;
  END IF;
  IF "finfolk".is_user_blocked(i_user,i_target) THEN
    RAISE EXCEPTION USING errcode = 'P0002',message = 'Profile unavailable';
  END IF;
  DECLARE
    o_existing JSONB;
    v_first UUID;
    v_second UUID;
  BEGIN
    v_first := least(i_user,i_target);
    v_second := greatest(i_user,i_target);
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "target_id",
        "requested_by_id",
        "status",
        "time_updated"
      FROM "finfolk"."UserConnection"
      WHERE "user_id" = v_first AND "target_id" = v_second
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_existing;
    IF i_mode = 'request' THEN
      IF (o_existing ->> 'status') = 'declined' THEN
        RAISE EXCEPTION USING errcode = '42501',message = 'This connection is unavailable';
      END IF;
      IF o_existing is null  THEN
        DECLARE
      o_created JSONB;
    BEGIN
      WITH j_ret AS (  
            INSERT INTO "finfolk"."UserConnection" ("user_id","target_id","requested_by_id","status") VALUES (
              (v_first)::UUID,
              (v_second)::UUID,
              (i_user)::UUID,
              ('pending')::"finfolk"."EnumUserConnectionStatus"
            ) RETURNING
              "id",
              "user_id",
              "target_id",
              "requested_by_id",
              "status",
              "time_updated")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_created;
    END;
      ELSE
        IF (o_existing ->> 'status') = 'removed' THEN
          DECLARE
      o_updated JSONB;
    BEGIN
      WITH j_ret AS (  
              UPDATE "finfolk"."UserConnection" SET
                "requested_by_id" = (i_user)::UUID,
                "status" = ('pending')::"finfolk"."EnumUserConnectionStatus",
                "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
              WHERE "id" = (o_existing ->> 'id')::UUID
              RETURNING
                "id",
                "user_id",
                "target_id",
                "requested_by_id",
                "status",
                "time_updated")
            SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
    END;
        END IF;
      END IF;
    ELSIF (i_mode = 'accept') OR (i_mode = 'decline') THEN
      IF o_existing IS NULL OR ((o_existing ->> 'status') != 'pending') OR ((o_existing ->> 'requested_by_id')::UUID = i_user) THEN
        RAISE EXCEPTION USING errcode = '42501',message = 'Only the recipient can respond';
      END IF;
      DECLARE
      o_updated JSONB;
    BEGIN
      WITH j_ret AS (  
          UPDATE "finfolk"."UserConnection" SET
            "status" = (CASE WHEN i_mode = 'accept' THEN 'accepted'
          WHEN true THEN 'declined'
          END)::"finfolk"."EnumUserConnectionStatus",
            "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
          WHERE "id" = (o_existing ->> 'id')::UUID
          RETURNING
            "id",
            "user_id",
            "target_id",
            "requested_by_id",
            "status",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_updated;
    END;
    ELSIF i_mode = 'remove' THEN
      DECLARE
      o_removed JSONB;
    BEGIN
      WITH j_ret AS (  
          UPDATE "finfolk"."UserConnection" SET
            "status" = ('removed')::"finfolk"."EnumUserConnectionStatus",
            "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
          WHERE "user_id" = v_first AND "target_id" = v_second
          RETURNING
            "id",
            "user_id",
            "target_id",
            "requested_by_id",
            "status",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
    END;
    ELSE
      RAISE EXCEPTION USING errcode = '22023',message = 'Unknown connection action';
    END IF;
    RETURN jsonb_build_object('ok',true);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/set-account-block 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_account_block(
  i_user UUID,
  i_target UUID,
  i_block BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".lock_account_pair(i_user,i_target);
  DECLARE
    v_existing BOOLEAN;
    v_first UUID;
    v_second UUID;
  BEGIN
    v_first := least(i_user,i_target);
    v_second := greatest(i_user,i_target);
    SELECT exists(SELECT 1 FROM "finfolk"."UserBlock"
    WHERE "owner_id" = i_user AND "target_id" = i_target) INTO v_existing;
    IF i_block THEN
      IF NOT v_existing THEN
        DECLARE
      o_created JSONB;
    BEGIN
      WITH j_ret AS (INSERT INTO "finfolk"."UserBlock" ("owner_id","target_id") VALUES ((i_user)::UUID,(i_target)::UUID) RETURNING "id","owner_id","target_id")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_created;
    END;
      END IF;
      DECLARE
      o_removed JSONB;
    BEGIN
      WITH j_ret AS (  
          UPDATE "finfolk"."UserConnection" SET
            "status" = ('removed')::"finfolk"."EnumUserConnectionStatus",
            "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
          WHERE "user_id" = v_first AND "target_id" = v_second
          RETURNING
            "id",
            "user_id",
            "target_id",
            "requested_by_id",
            "status",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
    END;
    ELSE
      DECLARE
      o_removed JSONB;
    BEGIN
      WITH j_ret AS (  
          DELETE FROM "finfolk"."UserBlock" WHERE "owner_id" = i_user AND "target_id" = i_target
          RETURNING "id","owner_id","target_id")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
    END;
    END IF;
    RETURN jsonb_build_object('ok',true);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/ret-account-connections 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_account_connections(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_rel JSONB;
    o_relations JSONB;
    o_result JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "target_id",
        "requested_by_id",
        "status",
        "time_updated"
      FROM "finfolk"."UserConnection"
      WHERE ("user_id" = i_user AND "status" IN ('pending','accepted'))
      OR ("target_id" = i_user AND "status" IN ('pending','accepted'))
      ORDER BY "time_updated","id" DESC
      LIMIT 50)
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_relations;
    o_result := ('[]')::JSONB;
    o_rel := null;
    FOR o_rel IN SELECT jsonb_array_elements(coalesce(o_relations,('[]')::JSONB)) LOOP
      DECLARE
        o_target JSONB;
        v_target UUID;
      BEGIN
        v_target := CASE WHEN (o_rel ->> 'user_id')::UUID = i_user THEN (o_rel ->> 'target_id')::UUID
        WHEN true THEN (o_rel ->> 'user_id')::UUID
        END;
        WITH j_ret AS (  
          SELECT
            "id",
            "profile",
            "deleted",
            "email_verified",
            "deletion_state",
            "invite_eligible",
            "joined_at",
            "time_updated",
            "activity_id",
            "audit_id",
            "rev_id"
          FROM "finfolk"."User"
          WHERE "id" = v_target AND "deleted" = false
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_target;
        IF o_target IS NOT NULL AND NOT "finfolk".is_user_blocked(i_user,v_target) THEN
          o_result := (o_result || jsonb_build_array(jsonb_build_object('id',v_target,'name',coalesce((o_target -> 'profile') ->> 'displayName','Diver'),'status',o_rel ->> 'status','requested_by',o_rel ->> 'requested_by_id','instagram',CASE WHEN (o_rel ->> 'status') = 'accepted' THEN (o_target -> 'profile') ->> 'instagram'
        WHEN true THEN ''
        END,'tiktok',CASE WHEN (o_rel ->> 'status') = 'accepted' THEN (o_target -> 'profile') ->> 'tiktok'
        WHEN true THEN ''
        END)));
        END IF;
      END;
    END LOOP;
    RETURN o_result;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/ret-account-blocks 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_account_blocks(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_block JSONB;
    o_blocks JSONB;
    o_result JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","owner_id","target_id" FROM "finfolk"."UserBlock"
      WHERE "owner_id" = i_user
      ORDER BY "id")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_blocks;
    o_result := ('[]')::JSONB;
    o_block := null;
    FOR o_block IN SELECT jsonb_array_elements(coalesce(o_blocks,('[]')::JSONB)) LOOP
      DECLARE
        o_target JSONB;
        v_target UUID;
      BEGIN
        v_target := (o_block ->> 'target_id')::UUID;
        WITH j_ret AS (  
          SELECT
            "id",
            "profile",
            "deleted",
            "email_verified",
            "deletion_state",
            "invite_eligible",
            "joined_at",
            "time_updated",
            "activity_id",
            "audit_id",
            "rev_id"
          FROM "finfolk"."User"
          WHERE "id" = v_target AND "deleted" = false
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_target;
        IF o_target is not null  THEN
          o_result := (o_result || jsonb_build_array(jsonb_build_object(
            'id',
            v_target,
            'name',
            coalesce((o_target -> 'profile') ->> 'displayName','Diver')
          )));
        END IF;
      END;
    END LOOP;
    RETURN o_result;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/ret-account-status 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_account_status(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_posts JSONB;
    v_admin BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserRole"
    WHERE "user_id" = i_user AND "role" = 'admin') INTO v_admin;
    WITH j_ret AS (  
      SELECT "id","key","enabled" FROM "finfolk"."ApplicationFeature"
      WHERE "key" = 'community-posts'
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_posts;
    RETURN jsonb_build_object(
      'admin',
      v_admin,
      'enabled',
      coalesce((o_posts ->> 'enabled')::BOOLEAN,false),
      'tag',
      'finfolk.com.au',
      'pilotBeaches',
      ('[]')::JSONB
    );
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/ret-account-sites 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_account_sites() RETURNS JSONB AS $$

  DECLARE
    o_sites JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","name","timezone","area_name","state" FROM "finfolk"."Site"
      ORDER BY "name","id")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_sites;
    RETURN jsonb_build_object('beaches',coalesce(o_sites,('[]')::JSONB));
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/erase-account 
CREATE OR REPLACE FUNCTION "finfolk_rpc".erase_account(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  DECLARE
    o_found JSONB;
    o_op JSONB;
    o_ref JSONB;
    o_refs JSONB;
    o_stream JSONB;
    o_streams JSONB;
    o_user JSONB;
    v_present BOOLEAN;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "profile",
        "deleted",
        "email_verified",
        "deletion_state",
        "invite_eligible",
        "joined_at",
        "time_updated",
        "activity_id",
        "audit_id",
        "rev_id"
      FROM "finfolk"."User"
      WHERE "id" = i_user
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    o_op := null;
    o_refs := null;
    o_ref := null;
    o_streams := ('[]')::JSONB;
    o_found := null;
    o_stream := null;
    v_present := false;
    IF o_user is null  THEN
      PERFORM "finfolk_rpc".ensure_account(i_user);
      DECLARE
      o_provisioned JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
            "id",
            "profile",
            "deleted",
            "email_verified",
            "deletion_state",
            "invite_eligible",
            "joined_at",
            "time_updated",
            "activity_id",
            "audit_id",
            "rev_id"
          FROM "finfolk"."User"
          WHERE "id" = i_user
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_provisioned;
        o_user := o_provisioned;
    END;
    END IF;
    IF jsonb_exists(
      ('["pending_auth","complete"]')::JSONB,
      o_user ->> 'deletion_state'
    ) THEN
      RETURN jsonb_build_object('ok',true);
    END IF;
    EXECUTE 'SELECT id FROM finfolk."User" WHERE id=$1 FOR UPDATE' USING i_user;
    o_op := "finfolk".op_fn('account-delete',i_user,('{}')::JSONB);
    EXECUTE 'SELECT coalesce(jsonb_agg(jsonb_build_object(''table'',c.relname,''column'',a.attname,''cascade'',k.confdeltype=''c'',''nullable'',NOT a.attnotnull) ORDER BY c.relname,a.attname),''[]''::jsonb) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1] WHERE k.contype=''f'' AND k.confrelid=''finfolk."User"''::regclass AND n.nspname=''finfolk'' AND cardinality(k.conkey)=1' INTO o_refs;
    FOR o_ref IN SELECT jsonb_array_elements(o_refs) LOOP
      IF (o_ref -> 'cascade') = ('true')::JSONB THEN
        EXECUTE "format"(
          'SELECT coalesce(jsonb_agg(jsonb_build_object(''rev'',to_jsonb(t)->>''rev_id'',''audit'',to_jsonb(t)->>''audit_id'',''activity'',to_jsonb(t)->>''activity_id'')),''[]''::jsonb) FROM finfolk.%I t WHERE %I=$1',
          o_ref ->> 'table',
          o_ref ->> 'column'
        ) INTO o_found USING i_user;
        o_streams := (o_streams || o_found);
      END IF;
    END LOOP;
    DECLARE
      o_marked JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."User" SET
          "profile" = ('{}')::JSONB,
          "deleted" = (true)::BOOLEAN,
          "email_verified" = (false)::BOOLEAN,
          "deletion_state" = ('pending_auth')::TEXT,
          "invite_eligible" = (false)::BOOLEAN,
          "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
        WHERE "id" = i_user
        RETURNING
          "id",
          "profile",
          "deleted",
          "email_verified",
          "deletion_state",
          "invite_eligible",
          "joined_at",
          "time_updated",
          "activity_id",
          "audit_id",
          "rev_id")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_marked;
    END;
    EXECUTE 'SELECT e.id FROM finfolk."Event" e WHERE e.id IN(SELECT d.event_id FROM finfolk."EventInviteDelivery" d WHERE d.requester_id=$1) OR e.listing_id IN(SELECT p.id FROM finfolk."DirectoryListing" p JOIN finfolk."AccessRole" a ON a.class_table=''DirectoryListing'' AND a.class_context=''Global'' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level=''owner'' AND a.is_active) ORDER BY e.id FOR UPDATE' USING i_user;
    EXECUTE 'SELECT i.id FROM finfolk."AccessInviteEmail" i WHERE i.class_table=''Event'' AND i.class_context=''Global'' AND i.access_id IN(SELECT e.access_id FROM finfolk."Event" e WHERE e.id IN(SELECT d.event_id FROM finfolk."EventInviteDelivery" d WHERE d.requester_id=$1) OR e.listing_id IN(SELECT p.id FROM finfolk."DirectoryListing" p JOIN finfolk."AccessRole" a ON a.class_table=''DirectoryListing'' AND a.class_context=''Global'' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level=''owner'' AND a.is_active)) ORDER BY i.access_id,i.id FOR UPDATE' USING i_user;
    EXECUTE 'UPDATE finfolk."EventInviteDelivery" SET state=''cancelled'',sealed_token='''',lease=NULL,lease_until=0,error='''' WHERE state<>''sent'' AND event_id IN(SELECT e.id FROM finfolk."Event" e JOIN finfolk."DirectoryListing" p ON p.id=e.listing_id JOIN finfolk."AccessRole" a ON a.class_table=''DirectoryListing'' AND a.class_context=''Global'' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level=''owner'' AND a.is_active)' USING i_user;
    EXECUTE 'DELETE FROM finfolk."SiteRevision" WHERE owner_id=$1 AND status<>''published''' USING i_user;
    EXECUTE 'DELETE FROM finfolk."SiteImport" WHERE owner_id=$1 AND status<>''published''' USING i_user;
    FOR o_ref IN SELECT jsonb_array_elements(o_refs) LOOP
      IF (o_ref -> 'cascade') = ('true')::JSONB THEN
        EXECUTE "format"(
          'DELETE FROM finfolk.%I WHERE %I=$1',
          o_ref ->> 'table',
          o_ref ->> 'column'
        ) USING i_user;
      ELSIF (o_ref -> 'nullable') = ('true')::JSONB THEN
        EXECUTE "format"(
          'UPDATE finfolk.%I SET %I=NULL WHERE %I=$1',
          o_ref ->> 'table',
          o_ref ->> 'column',
          o_ref ->> 'column'
        ) USING i_user;
      ELSE
        EXECUTE "format"(
          'SELECT EXISTS(SELECT 1 FROM finfolk.%I WHERE %I=$1)',
          o_ref ->> 'table',
          o_ref ->> 'column'
        ) INTO v_present USING i_user;
        IF v_present THEN
          RAISE EXCEPTION 'Account deletion has an unsupported required reference';
        END IF;
      END IF;
    END LOOP;
    FOR o_stream IN SELECT jsonb_array_elements(o_streams) LOOP
      IF o_stream ->> 'rev' is not null  THEN
        DECLARE
        o_deleted JSONB;
      BEGIN
        WITH j_ret AS (  
            DELETE FROM "finfolk"."Rev" WHERE "id" = (o_stream ->> 'rev')::UUID
            RETURNING "id","class_ref","index","current","op_created","time_created")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_deleted;
      END;
      END IF;
      IF o_stream ->> 'audit' is not null  THEN
        DECLARE
        o_deleted JSONB;
      BEGIN
        WITH j_ret AS (  
            DELETE FROM "finfolk"."Audit" WHERE "id" = (o_stream ->> 'audit')::UUID
            RETURNING "id","class_ref","op_created","time_created")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_deleted;
      END;
      END IF;
      IF o_stream ->> 'activity' is not null  THEN
        DECLARE
        o_deleted JSONB;
      BEGIN
        WITH j_ret AS (  
            DELETE FROM "finfolk"."Activity" WHERE "id" = (o_stream ->> 'activity')::UUID
            RETURNING "id","class_ref","op_created","time_created")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_deleted;
      END;
      END IF;
    END LOOP;
    DECLARE
      o_activity JSONB;
      o_audit JSONB;
      o_ops JSONB;
      o_rev JSONB;
      o_revisions JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."Rev" SET "current" = ('{}')::JSONB WHERE "id" = (o_user ->> 'rev_id')::UUID
        RETURNING "id","class_ref","index","current","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_rev;
      WITH j_ret AS (  
        UPDATE "finfolk"."RevLog" SET "deltas" = ('{}')::JSONB WHERE "rev_id" = (o_user ->> 'rev_id')::UUID
        RETURNING "id","rev_id","version","deltas","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_revisions;
      WITH j_ret AS (  
        UPDATE "finfolk"."AuditLog" SET
          "entry" = "finfolk".as_jsonb((jsonb_build_object('event','account-deleted'))::JSONB)
        WHERE "audit_id" = (o_user ->> 'audit_id')::UUID
        RETURNING "id","audit_id","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_audit;
      WITH j_ret AS (  
        UPDATE "finfolk"."ActivityLog" SET "detail" = "finfolk".as_jsonb(('{}')::JSONB) WHERE "activity_id" = (o_user ->> 'activity_id')::UUID
        RETURNING
          "id",
          "activity_id",
          "action",
          "actor_id",
          "op_created",
          "time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_activity;
      WITH j_ret AS (  
        UPDATE "finfolk"."Op" SET "data" = ('{}')::JSONB,"user_id" = (null)::UUID WHERE "user_id" = i_user
        RETURNING "id","time","tag","data","user_id")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_ops;
    END;
    RETURN jsonb_build_object('ok',true);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/complete-account-deletion 
CREATE OR REPLACE FUNCTION "finfolk_rpc".complete_account_deletion(
  i_user UUID
) RETURNS JSONB AS $$

  DECLARE
    o_user JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "profile",
        "deleted",
        "email_verified",
        "deletion_state",
        "invite_eligible",
        "joined_at",
        "time_updated",
        "activity_id",
        "audit_id",
        "rev_id"
      FROM "finfolk"."User"
      WHERE "id" = i_user AND "deleted" = true
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    IF o_user is null  THEN
      RAISE EXCEPTION 'Account deletion was not requested';
    END IF;
    DECLARE
      o_complete JSONB;
    BEGIN
      WITH j_ret AS (  
        UPDATE "finfolk"."User" SET "deletion_state" = ('complete')::TEXT WHERE "id" = i_user AND "deleted" = true
        RETURNING
          "id",
          "profile",
          "deleted",
          "email_verified",
          "deletion_state",
          "invite_eligible",
          "joined_at",
          "time_updated",
          "activity_id",
          "audit_id",
          "rev_id")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_complete;
    END;
    RETURN jsonb_build_object('ok',true);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/pending-account-deletions 
CREATE OR REPLACE FUNCTION "finfolk_rpc".pending_account_deletions() RETURNS JSONB AS $$

  DECLARE
    o_users JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id" FROM "finfolk"."User"
      WHERE "deleted" = true AND "deletion_state" = 'pending_auth'
      ORDER BY "time_updated","id" ASC
      LIMIT 100)
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_users;
    RETURN coalesce(o_users,('[]')::JSONB);
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-account/record-account-deletion-failure 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_account_deletion_failure(
  i_user UUID
) RETURNS JSONB AS $$

  DECLARE
    o_retry JSONB;
  BEGIN
    WITH j_ret AS (  
      UPDATE "finfolk"."User" SET
        "time_updated" = ((1000000 * extract(epoch FROM now()))::BIGINT)::BIGINT
      WHERE "id" = i_user
      AND "deleted" = true
      AND "deletion_state" = 'pending_auth'
      RETURNING
        "id",
        "profile",
        "deleted",
        "email_verified",
        "deletion_state",
        "invite_eligible",
        "joined_at",
        "time_updated",
        "activity_id",
        "audit_id",
        "rev_id")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_retry;
    RETURN jsonb_build_object('ok',true);
  END;

$$ LANGUAGE 'plpgsql';

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

  DECLARE
    v_verified BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."User"
    WHERE "id" = i_user AND "email_verified" = true AND "deleted" = false) INTO v_verified;
    RETURN "finfolk".is_user_active(i_user) AND v_verified;
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

  SELECT count(*) FROM "finfolk"."SiteNoteVote" AS "v" INNER JOIN "finfolk"."User" AS "u" ON "v"."voter_id" = "u"."id" WHERE ("v"."note_id" = i_note) AND NOT "u"."deleted" AND "u"."email_verified";

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
      coalesce(v_author = i_viewer,false),
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

-- finfolkdb.fn.site.site-note-app/native-notes-public-list 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_public_list(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'public-list',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-moderate 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_moderate(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'moderate',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-report 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_report(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'report',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_save(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'save',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-vote 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_vote(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'vote',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-withdraw 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_withdraw(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'withdraw',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/native-notes-list 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_notes_list(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_notes(i_user,i_verified,'list',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-note-app/call-native-notes 
CREATE OR REPLACE FUNCTION "finfolk_rpc".call_native_notes(
  i_user UUID,
  i_verified BOOLEAN,
  i_operation TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  IF i_operation != 'public-list' THEN
    IF NOT coalesce(i_verified,false) THEN
      RAISE EXCEPTION 'Verified member required';
    END IF;
    PERFORM "finfolk_rpc".ret_account(i_user);
  END IF;
  DECLARE
    v_admin BOOLEAN;
    v_id UUID;
    v_site UUID;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserRole"
    WHERE "user_id" = i_user AND "role" = 'admin') INTO v_admin;
    v_site := (i_values ->> 'site')::UUID;
    v_id := (i_values ->> 'id')::UUID;
    PERFORM "set_config"('finfolk.actor_id',coalesce((i_user)::TEXT,''),true);
    PERFORM "set_config"('finfolk.directory_admin',(v_admin)::TEXT,true);
    IF (i_operation = 'public-list') OR (i_operation = 'list') THEN
      RETURN "finfolk_rpc".ret_site_notes(
        v_site,
        coalesce(i_values ->> 'sort','helpful'),
        coalesce(i_values ->> 'topic','all'),
        coalesce((i_values ->> 'offset')::INTEGER,0),
        i_operation = 'list'
      ) || jsonb_build_object('enabled',true);
    ELSIF i_operation = 'save' THEN
      RETURN "finfolk_rpc".save_site_note(
        v_site,
        v_id,
        i_values ->> 'topic',
        i_values ->> 'text',
        (nullif(i_values ->> 'observedOn',''))::DATE
      );
    ELSIF i_operation = 'vote' THEN
      RETURN "finfolk_rpc".set_site_note_vote(v_site,v_id,(i_values ->> 'upvoted')::BOOLEAN);
    ELSIF i_operation = 'withdraw' THEN
      RETURN "finfolk_rpc".set_site_note_withdrawn(
        v_site,
        v_id,
        (i_values ->> 'revision')::INTEGER,
        (i_values ->> 'withdrawn')::BOOLEAN
      );
    ELSIF i_operation = 'report' THEN
      RETURN "finfolk_rpc".report_site_note(v_site,v_id,i_values ->> 'reason');
    ELSIF i_operation = 'moderate' THEN
      RETURN "finfolk_rpc".moderate_site_note(v_site,v_id,(i_values ->> 'hidden')::BOOLEAN);
    ELSE
      RAISE EXCEPTION 'Unknown note operation';
    END IF;
  END;
END;
$$ LANGUAGE 'plpgsql';

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

-- finfolkdb.fn.site.site-review/native-site-review-mine 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_mine(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'mine',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-admin 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_admin(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'admin',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-publish 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_publish(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'publish',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-reject 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_reject(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'reject',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_save(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'save',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-submit 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_submit(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'submit',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/native-site-review-withdraw 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_site_review_withdraw(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_site_review(i_user,i_verified,'withdraw',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-review/call-native-site-review 
CREATE OR REPLACE FUNCTION "finfolk_rpc".call_native_site_review(
  i_user UUID,
  i_verified BOOLEAN,
  i_operation TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_result JSONB;
    v_admin BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserRole"
    WHERE "user_id" = i_user AND "role" = 'admin') INTO v_admin;
    o_result := null;
    PERFORM "set_config"('finfolk.actor_id',(i_user)::TEXT,true);
    PERFORM "set_config"(
      'finfolk.site_verified',
      (coalesce(i_verified,false))::TEXT,
      true
    );
    PERFORM "set_config"('finfolk.site_admin',(v_admin)::TEXT,true);
    EXECUTE 'SELECT finfolk_rpc.native_site_review_operation($1->>''operation'',$1->''values'')' INTO o_result USING jsonb_build_object('operation',i_operation,'values',i_values);
    RETURN o_result;
  END;
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
      (o_listing ->> 'reviewed_at')::NUMERIC / 1000
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

-- finfolkdb.fn.event.event-app/native-events-accept 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_accept(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'accept',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-cancel 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_cancel(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'cancel',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-detail 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_detail(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'detail',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-invite 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_invite(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'invite',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-invite-retry 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_invite_retry(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'invite-retry',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-mine 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_mine(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'mine',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-moderate 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_moderate(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'moderate',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-revoke 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_revoke(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'revoke',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-roster 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_roster(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'roster',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-rsvp 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_rsvp(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'rsvp',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_save(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'save',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-public-detail 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_public_detail(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'public-detail',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/native-events-list 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_events_list(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_events(i_user,i_verified,i_email,'list',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-app/call-native-events 
CREATE OR REPLACE FUNCTION "finfolk_rpc".call_native_events(
  i_user UUID,
  i_verified BOOLEAN,
  i_email TEXT,
  i_operation TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  IF i_user is not null  THEN
    PERFORM "finfolk_rpc".ret_account(i_user);
  END IF;
  DECLARE
    o_result JSONB;
    v_admin BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserRole"
    WHERE "user_id" = i_user AND "role" = 'admin') INTO v_admin;
    o_result := null;
    PERFORM "set_config"('finfolk.actor_id',coalesce((i_user)::TEXT,''),true);
    PERFORM "set_config"(
      'finfolk.event_verified',
      (coalesce(i_verified,false))::TEXT,
      true
    );
    PERFORM "set_config"('finfolk.event_email',coalesce(i_email,''),true);
    PERFORM "set_config"('finfolk.directory_admin',(v_admin)::TEXT,true);
    EXECUTE 'SELECT finfolk_rpc.native_event_operation($1->>''operation'',$1->''values'')' INTO o_result USING jsonb_build_object('operation',i_operation,'values',i_values);
    RETURN o_result;
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

-- finfolkdb.fn.user.user-logbook/private-session-values 
CREATE OR REPLACE FUNCTION "finfolk_rpc".private_session_values(
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  IF coalesce(jsonb_typeof(i_values),'null') != 'object' THEN
    RAISE EXCEPTION USING errcode = '22023',message = 'Invalid session';
  END IF;
  DECLARE
    v_key TEXT;
  BEGIN
    v_key := null;
    FOR v_key IN SELECT jsonb_object_keys(i_values) LOOP
      IF NOT jsonb_exists(
        ('["date","locationName","beachId","point","durationMinutes","maxDepthMetres","notes"]')::JSONB,
        v_key
      ) THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Unknown session field';
      END IF;
    END LOOP;
  END;
  DECLARE
    o_depth JSONB;
    o_duration JSONB;
    o_point JSONB;
    v_date TEXT;
    v_notes TEXT;
    v_place TEXT;
  BEGIN
    v_date := coalesce(i_values ->> 'date','');
    v_place := "btrim"(coalesce(i_values ->> 'locationName',''));
    v_notes := coalesce(i_values ->> 'notes','');
    o_duration := coalesce(i_values -> 'durationMinutes',('null')::JSONB);
    o_depth := coalesce(i_values -> 'maxDepthMetres',('null')::JSONB);
    o_point := coalesce(i_values -> 'point',('null')::JSONB);
    IF (coalesce(jsonb_typeof(i_values -> 'date'),'null') != 'string') OR NOT "regexp_like"(v_date,'^[0-9]{4}-[0-9]{2}-[0-9]{2}$') OR (coalesce(jsonb_typeof(i_values -> 'locationName'),'null') != 'string') OR (v_place = '') OR ("char_length"(v_place) > 160) OR ("char_length"(v_notes) > 10000) OR (jsonb_exists(i_values,'notes') AND (jsonb_typeof(i_values -> 'notes') != 'string')) OR (jsonb_exists(i_values,'beachId') AND (jsonb_typeof(i_values -> 'beachId') != 'string')) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Choose a valid session date, location and notes'
      ;
    END IF;
    DECLARE
      v_valid_date DATE;
    BEGIN
      v_valid_date := (v_date)::DATE;
    END;
    IF NOT jsonb_exists(('["number","null"]')::JSONB,jsonb_typeof(o_duration)) OR NOT jsonb_exists(('["number","null"]')::JSONB,jsonb_typeof(o_depth)) THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Enter numeric dive statistics';
    END IF;
    IF ((o_duration != ('null')::JSONB) AND ((((o_duration)::TEXT)::NUMERIC < 0) OR (((o_duration)::TEXT)::NUMERIC > 1440))) OR ((o_depth != ('null')::JSONB) AND ((((o_depth)::TEXT)::NUMERIC < 0) OR (((o_depth)::TEXT)::NUMERIC > 300))) THEN
      RAISE EXCEPTION USING
        errcode = '22023',
        message = 'Dive statistics are outside the allowed range'
      ;
    END IF;
    IF o_point != ('null')::JSONB THEN
      IF (jsonb_typeof(o_point) != 'array') OR (jsonb_array_length(o_point) != 2) OR (jsonb_typeof(o_point -> 0) != 'number') OR (jsonb_typeof(o_point -> 1) != 'number') OR ("abs"((o_point ->> 0)::NUMERIC) > 180) OR ("abs"((o_point ->> 1)::NUMERIC) > 85) THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Choose a valid map location';
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'date',
      v_date,
      'locationName',
      v_place,
      'notes',
      v_notes,
      'beachId',
      coalesce(i_values ->> 'beachId',''),
      'point',
      o_point,
      'durationMinutes',
      o_duration,
      'maxDepthMetres',
      o_depth,
      'visibility',
      'private',
      'photos',
      ('[]')::JSONB,
      'linkedMedia',
      ('[]')::JSONB
    );
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/private-session-row 
CREATE OR REPLACE FUNCTION "finfolk_rpc".private_session_row(
  i_row JSONB
) RETURNS JSONB AS $$

  DECLARE
    o_data JSONB;
    o_site JSONB;
  BEGIN
    o_data := (i_row -> 'detail');
    WITH j_ret AS (  
      SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
      WHERE "id" = (i_row ->> 'site_id')::UUID
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
    RETURN jsonb_build_object('id',i_row -> 'id','ownerId',i_row -> 'owner_id','beachId',coalesce(i_row ->> 'site_id',''),'date',coalesce(o_data ->> 'date',"to_char"(
      "to_timestamp"((i_row ->> 'time_created')::NUMERIC / 1000000),
      'YYYY-MM-DD'
    )),'locationName',coalesce(
      o_data ->> 'locationName',
      o_site ->> 'name',
      'Somewhere in the water'
    ),'point',coalesce(o_data -> 'point',('null')::JSONB),'durationMinutes',coalesce(o_data -> 'durationMinutes',('null')::JSONB),'maxDepthMetres',coalesce(o_data -> 'maxDepthMetres',('null')::JSONB),'notes',coalesce(o_data ->> 'notes',''),'visibility',coalesce(o_data ->> 'visibility','private'),'photos',coalesce(o_data -> 'photos',('[]')::JSONB),'linkedMedia',coalesce(o_data -> 'linkedMedia',('[]')::JSONB));
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-private-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_private_session(
  i_user UUID,
  i_session UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_session JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
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
      FROM "finfolk"."DiveSession"
      WHERE "id" = i_session AND "owner_id" = i_user
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_session;
    IF o_session is null  THEN
      RETURN null;
    END IF;
    RETURN "finfolk_rpc".private_session_row(o_session);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/save-private-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".save_private_session(
  i_user UUID,
  i_session UUID,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_data JSONB;
    o_op JSONB;
    v_id UUID;
    v_site UUID;
  BEGIN
    o_data := "finfolk_rpc".private_session_values(i_values);
    v_site := null;
    v_id := i_session;
    o_op := "finfolk".op_fn('private-session-save',i_user,('{}')::JSONB);
    IF (o_data ->> 'beachId') != '' THEN
      v_site := (o_data ->> 'beachId')::UUID;
    END IF;
    IF v_site is not null  THEN
      DECLARE
      v_exists BOOLEAN;
    BEGIN
      SELECT exists(SELECT 1 FROM "finfolk"."Site"
        WHERE "id" = v_site) INTO v_exists;
        IF NOT v_exists THEN
          RAISE EXCEPTION USING errcode = 'P0002',message = 'Choose an existing dive site';
        END IF;
    END;
    END IF;
    IF i_session is null  THEN
      DECLARE
      o_created JSONB;
    BEGIN
      o_created := "finfolk_rpc".insert_dive_session(i_user,v_site,o_data,o_op);
        v_id := (o_created ->> 'id')::UUID;
    END;
    ELSE
      DECLARE
      o_old JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT
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
          FROM "finfolk"."DiveSession"
          WHERE "id" = i_session AND "owner_id" = i_user
          LIMIT 1
          FOR UPDATE)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_old;
        IF o_old is null  THEN
          RAISE EXCEPTION USING errcode = 'P0002',message = 'Session unavailable';
        END IF;
        IF coalesce((o_old -> 'detail') ->> 'visibility','private') != 'private' THEN
          RAISE EXCEPTION USING
            errcode = '42501',
            message = 'Make the session private before editing'
          ;
        END IF;
        DECLARE
          o_audit JSONB;
          o_history JSONB;
          o_next JSONB;
          o_rev JSONB;
          o_revised JSONB;
          o_saved JSONB;
          v_version INT;
        BEGIN
          o_next := ((o_old -> 'detail') || (o_data - 'beachId' - 'photos' - 'linkedMedia'));
          WITH j_ret AS (  
            UPDATE "finfolk"."DiveSession" SET
              "site_id" = (v_site)::UUID,
              "detail" = "finfolk".as_jsonb((o_next)::JSONB),
              "op_updated" = (o_op ->> 'id')::UUID,
              "time_updated" = (o_op ->> 'time')::BIGINT
            WHERE "id" = i_session AND "owner_id" = i_user
            RETURNING
              "id",
              "owner_id",
              "site_id",
              "audit_id",
              "rev_id",
              "op_created",
              "op_updated",
              "time_created",
              "time_updated")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
          WITH j_ret AS (  
            SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
            WHERE "id" = (o_old ->> 'rev_id')::UUID
            LIMIT 1)
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
          v_version := ((o_rev ->> 'index')::INT + 1);
          WITH j_ret AS (  
            UPDATE "finfolk"."Rev" SET "index" = (v_version)::INTEGER,"current" = (o_next)::JSONB WHERE "id" = (o_old ->> 'rev_id')::UUID
            RETURNING "id","class_ref","index","current","op_created","time_created")
          SELECT jsonb_agg(j_ret) FROM j_ret INTO o_revised;
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
              ('DiveSession')::"finfolk"."EnumClassType",
              ('Global')::"finfolk"."EnumClassType",
              (o_old ->> 'rev_id')::UUID,
              (v_version)::INTEGER,
              (o_next)::JSONB,
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
              ('DiveSession')::"finfolk"."EnumClassType",
              ('Global')::"finfolk"."EnumClassType",
              (o_old ->> 'audit_id')::UUID,
              "finfolk".as_jsonb((jsonb_build_object('event','save'))::JSONB),
              (o_op ->> 'id')::UUID,
              (o_op ->> 'time')::BIGINT
            ) RETURNING "id","audit_id","op_created","time_created")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
        END;
    END;
    END IF;
    RETURN jsonb_build_object('id',v_id);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/delete-private-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".delete_private_session(
  i_user UUID,
  i_session UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_old JSONB;
    o_op JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
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
      FROM "finfolk"."DiveSession"
      WHERE "id" = i_session AND "owner_id" = i_user
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_old;
    o_op := "finfolk".op_fn('private-session-delete',i_user,('{}')::JSONB);
    IF o_old is null  THEN
      RAISE EXCEPTION USING errcode = 'P0002',message = 'Session unavailable';
    END IF;
    IF (jsonb_array_length(coalesce((o_old -> 'detail') -> 'photos',('[]')::JSONB)) > 0) OR (jsonb_array_length(
      coalesce((o_old -> 'detail') -> 'linkedMedia',('[]')::JSONB)
    ) > 0) THEN
      RAISE EXCEPTION USING
        errcode = '42501',
        message = 'Media cleanup is required before deleting this session'
      ;
    END IF;
    DECLARE
      o_audit JSONB;
      o_deleted JSONB;
      o_rev JSONB;
    BEGIN
      WITH j_ret AS (  
        DELETE FROM "finfolk"."DiveSession" WHERE "id" = i_session AND "owner_id" = i_user
        RETURNING
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
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_deleted;
      WITH j_ret AS (  
        DELETE FROM "finfolk"."Rev" WHERE "id" = (o_old ->> 'rev_id')::UUID
        RETURNING "id","class_ref","index","current","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_rev;
      WITH j_ret AS (  
        DELETE FROM "finfolk"."Audit" WHERE "id" = (o_old ->> 'audit_id')::UUID
        RETURNING "id","class_ref","op_created","time_created")
      SELECT jsonb_agg(j_ret) FROM j_ret INTO o_audit;
      RETURN jsonb_build_object('deleted',true);
    END;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-private-sessions 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_private_sessions(
  i_user UUID,
  i_query JSONB
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  IF i_query ->> 'owner' IS NOT NULL AND ((i_query ->> 'owner')::UUID != i_user) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Public session browsing has a separate access path'
    ;
  END IF;
  DECLARE
    o_result JSONB;
    o_row JSONB;
    o_rows JSONB;
    v_after TEXT;
    v_cursor TEXT;
    v_index INT;
    v_next TEXT;
    v_time BIGINT;
  BEGIN
    v_cursor := coalesce(i_query ->> 'cursor','');
    v_time := 9223372036854775807;
    v_after := 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    v_next := null;
    v_index := 0;
    o_rows := null;
    o_row := null;
    o_result := ('[]')::JSONB;
    IF v_cursor != '' THEN
      IF NOT "regexp_like"(v_cursor,'^[0-9]{1,19}:[0-9a-fA-F-]{36}$') THEN
        RAISE EXCEPTION USING errcode = '22023',message = 'Choose a valid session cursor';
      END IF;
      v_time := ("split_part"(v_cursor,':',1))::BIGINT;
      v_after := "split_part"(v_cursor,':',2);
    END IF;
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY time_created DESC,id DESC),''[]''::jsonb) FROM (SELECT * FROM finfolk."DiveSession" WHERE owner_id=($1->>''actor'')::uuid AND (time_created,id)<(($1->>''time'')::bigint,($1->>''after'')::uuid) AND (NOT ($1->>''public'')::boolean OR detail->>''visibility''=''public'') ORDER BY time_created DESC,id DESC LIMIT 51) r' INTO o_rows USING jsonb_build_object(
      'actor',
      i_user,
      'time',
      v_time,
      'after',
      v_after,
      'public',
      coalesce((i_query ->> 'publicOnly')::BOOLEAN,false)
    );
    FOR o_row IN SELECT jsonb_array_elements(o_rows) LOOP
      IF v_index < 50 THEN
        o_result := (o_result || jsonb_build_array("finfolk_rpc".private_session_row(o_row)));
        IF v_index = 49 THEN
          v_next := ((o_row ->> 'time_created') || ':' || (o_row ->> 'id'));
        END IF;
      END IF;
      v_index := (v_index + 1);
    END LOOP;
    IF jsonb_array_length(o_rows) <= 50 THEN
      v_next := null;
    END IF;
    RETURN jsonb_build_object(
      'sessions',
      o_result,
      'cursor',
      v_next,
      'more',
      jsonb_array_length(o_rows) > 50
    );
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-private-profile 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_private_profile(
  i_user UUID,
  i_target UUID
) RETURNS JSONB AS $$
BEGIN
  IF i_target IS NOT NULL AND (i_user != i_target) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Other member profiles require the public profile access path'
    ;
  END IF;
  DECLARE
    o_user JSONB;
  BEGIN
    o_user := "finfolk_rpc".ret_account(i_user);
    RETURN (o_user -> 'profile') || jsonb_build_object('id',i_user,'uid',i_user);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/set-session-visibility 
CREATE OR REPLACE FUNCTION "finfolk_rpc".set_session_visibility(
  i_user UUID,
  i_session UUID,
  i_visibility TEXT,
  i_verified BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  PERFORM "finfolk_rpc".ret_account(i_user);
  IF NOT jsonb_exists(('["private","public"]')::JSONB,i_visibility) THEN
    RAISE EXCEPTION USING
      errcode = '22023',
      message = 'Choose private or public visibility'
    ;
  END IF;
  DECLARE
    o_old JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
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
      FROM "finfolk"."DiveSession"
      WHERE "id" = i_session AND "owner_id" = i_user
      LIMIT 1
      FOR UPDATE)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_old;
    IF o_old is null  THEN
      RAISE EXCEPTION USING errcode = 'P0002',message = 'Session unavailable';
    END IF;
    IF i_visibility = 'public' THEN
      IF NOT coalesce(i_verified,false) THEN
        RAISE EXCEPTION USING
          errcode = '42501',
          message = 'Verify your email before publishing'
        ;
      END IF;
      IF (jsonb_array_length(coalesce((o_old -> 'detail') -> 'photos',('[]')::JSONB)) > 0) OR (jsonb_array_length(
        coalesce((o_old -> 'detail') -> 'linkedMedia',('[]')::JSONB)
      ) > 0) THEN
        RAISE EXCEPTION USING
          errcode = '42501',
          message = 'Media publishing requires ownership verification'
        ;
      END IF;
    END IF;
    IF coalesce((o_old -> 'detail') ->> 'visibility','private') != i_visibility THEN
      DECLARE
      o_audit JSONB;
        o_history JSONB;
        o_next JSONB;
        o_op JSONB;
        o_rev JSONB;
        o_revised JSONB;
        o_saved JSONB;
        v_version INT;
    BEGIN
      o_op := "finfolk".op_fn(
          'session-visibility',
          i_user,
          jsonb_build_object('visibility',i_visibility)
        );
        o_next := ((o_old -> 'detail') || jsonb_build_object('visibility',i_visibility));
        WITH j_ret AS (  
          UPDATE "finfolk"."DiveSession" SET
            "detail" = "finfolk".as_jsonb((o_next)::JSONB),
            "op_updated" = (o_op ->> 'id')::UUID,
            "time_updated" = (o_op ->> 'time')::BIGINT
          WHERE "id" = i_session AND "owner_id" = i_user
          RETURNING
            "id",
            "owner_id",
            "site_id",
            "audit_id",
            "rev_id",
            "op_created",
            "op_updated",
            "time_created",
            "time_updated")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_saved;
        WITH j_ret AS (  
          SELECT "id","class_ref","index","current","op_created","time_created" FROM "finfolk"."Rev"
          WHERE "id" = (o_old ->> 'rev_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_rev;
        v_version := ((o_rev ->> 'index')::INT + 1);
        WITH j_ret AS (  
          UPDATE "finfolk"."Rev" SET "index" = (v_version)::INTEGER,"current" = (o_next)::JSONB WHERE "id" = (o_old ->> 'rev_id')::UUID
          RETURNING "id","class_ref","index","current","op_created","time_created")
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_revised;
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
            ('DiveSession')::"finfolk"."EnumClassType",
            ('Global')::"finfolk"."EnumClassType",
            (o_old ->> 'rev_id')::UUID,
            (v_version)::INTEGER,
            (o_next)::JSONB,
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
            ('DiveSession')::"finfolk"."EnumClassType",
            ('Global')::"finfolk"."EnumClassType",
            (o_old ->> 'audit_id')::UUID,
            "finfolk".as_jsonb(
            (jsonb_build_object('event','visibility','visibility',i_visibility))::JSONB
          ),
            (o_op ->> 'id')::UUID,
            (o_op ->> 'time')::BIGINT
          ) RETURNING "id","audit_id","op_created","time_created")
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_audit;
    END;
    END IF;
    RETURN jsonb_build_object('visibility',i_visibility);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/public-session-row 
CREATE OR REPLACE FUNCTION "finfolk_rpc".public_session_row(
  i_row JSONB
) RETURNS JSONB AS $$
BEGIN
  IF i_row IS NULL OR (coalesce((i_row -> 'detail') ->> 'visibility','private') != 'public') OR NOT "finfolk".is_user_active((i_row ->> 'owner_id')::UUID) THEN
    RETURN null;
  END IF;
  IF (jsonb_array_length(coalesce((i_row -> 'detail') -> 'photos',('[]')::JSONB)) > 0) OR (jsonb_array_length(
    coalesce((i_row -> 'detail') -> 'linkedMedia',('[]')::JSONB)
  ) > 0) THEN
    RETURN null;
  END IF;
  RETURN "finfolk_rpc".private_session_row(i_row);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-visible-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_visible_session(
  i_viewer UUID,
  i_session UUID
) RETURNS JSONB AS $$
BEGIN
  IF i_viewer is not null  THEN
    PERFORM "finfolk_rpc".ret_account(i_viewer);
  END IF;
  DECLARE
    o_row JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
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
      FROM "finfolk"."DiveSession"
      WHERE "id" = i_session
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_row;
    IF o_row is null  THEN
      RETURN null;
    END IF;
    IF (o_row ->> 'owner_id')::UUID = i_viewer THEN
      RETURN "finfolk_rpc".private_session_row(o_row);
    END IF;
    IF i_viewer IS NOT NULL AND "finfolk".is_user_blocked(i_viewer,(o_row ->> 'owner_id')::UUID) THEN
      RETURN null;
    END IF;
    RETURN "finfolk_rpc".public_session_row(o_row);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-visible-sessions 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_visible_sessions(
  i_viewer UUID,
  i_query JSONB
) RETURNS JSONB AS $$
BEGIN
  IF i_viewer is not null  THEN
    PERFORM "finfolk_rpc".ret_account(i_viewer);
  END IF;
  DECLARE
    o_result JSONB;
    o_row JSONB;
    v_owner UUID;
  BEGIN
    v_owner := coalesce((i_query ->> 'owner')::UUID,i_viewer);
    o_result := ('[]')::JSONB;
    o_row := null;
    IF v_owner is null  THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Choose a session owner';
    END IF;
    IF NOT "finfolk".is_user_active(v_owner) OR (i_viewer IS NOT NULL AND "finfolk".is_user_blocked(i_viewer,v_owner)) THEN
      RETURN jsonb_build_object('sessions',o_result,'cursor',null,'more',false);
    END IF;
    IF v_owner = i_viewer THEN
      RETURN "finfolk_rpc".ret_private_sessions(i_viewer,i_query);
    END IF;
    DECLARE
      o_page JSONB;
    BEGIN
      o_page := "finfolk_rpc".ret_private_sessions(
        v_owner,
        i_query || jsonb_build_object('owner',v_owner,'publicOnly',true)
      );
      FOR o_row IN SELECT jsonb_array_elements(o_page -> 'sessions') LOOP
        IF (jsonb_array_length(o_row -> 'photos') = 0) AND (jsonb_array_length(o_row -> 'linkedMedia') = 0) THEN
          o_result := (o_result || jsonb_build_array(o_row));
        END IF;
      END LOOP;
      RETURN o_page || jsonb_build_object('sessions',o_result);
    END;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/profile-post-links 
CREATE OR REPLACE FUNCTION "finfolk_rpc".profile_post_links(
  i_owner UUID,
  i_private BOOLEAN
) RETURNS JSONB AS $$

  DECLARE
    o_posts JSONB;
  BEGIN
    o_posts := null;
    EXECUTE 'SELECT coalesce(jsonb_agg(row ORDER BY created DESC,id),''[]''::jsonb) FROM (SELECT p.id,p.time_created created,jsonb_build_object(''id'',p.id,''beach_id'',p.site_id,''beach_name'',s.name,''url'',p.url,''platform'',p.platform,''status'',p.status,''public_consent'',p.public_consent) row FROM finfolk."SocialPost" p JOIN finfolk."Site" s ON s.id=p.site_id JOIN finfolk."User" u ON u.id=p.owner_id WHERE p.owner_id=($1->>''owner'')::uuid AND NOT u.deleted AND (($1->>''private'')::boolean OR (p.status=''approved'' AND p.public_consent AND coalesce(u.profile->''featuredPosts'',''[]''::jsonb)?p.id::text)) ORDER BY p.time_created DESC,p.id LIMIT 100) p' INTO o_posts USING jsonb_build_object('owner',i_owner,'private',i_private);
    RETURN o_posts;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-my-profile-posts 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_my_profile_posts(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  RETURN "finfolk_rpc".profile_post_links(i_user,true);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-visible-profile 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_visible_profile(
  i_viewer UUID,
  i_target UUID
) RETURNS JSONB AS $$
BEGIN
  IF i_viewer is not null  THEN
    PERFORM "finfolk_rpc".ret_account(i_viewer);
  END IF;
  DECLARE
    o_user JSONB;
    v_target UUID;
  BEGIN
    v_target := coalesce(i_target,i_viewer);
    WITH j_ret AS (  
      SELECT "id","profile" FROM "finfolk"."User"
      WHERE "id" = v_target AND "deleted" = false
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_user;
    IF v_target is null  THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Choose a profile';
    END IF;
    IF o_user IS NULL OR (i_viewer IS NOT NULL AND "finfolk".is_user_blocked(i_viewer,v_target)) THEN
      RAISE EXCEPTION USING errcode = 'P0002',message = 'Profile unavailable';
    END IF;
    IF v_target = i_viewer THEN
      RETURN (o_user -> 'profile') || jsonb_build_object('id',v_target,'uid',v_target);
    END IF;
    DECLARE
      o_profile JSONB;
      v_details BOOLEAN;
      v_open BOOLEAN;
    BEGIN
      o_profile := (o_user -> 'profile');
      v_open := coalesce((o_profile -> 'open') = ('true')::JSONB,false);
      v_details := v_open;
      IF i_viewer is not null  THEN
        DECLARE
        v_connected BOOLEAN;
      BEGIN
        SELECT exists(SELECT 1 FROM "finfolk"."UserConnection"
          WHERE "user_id" = least(i_viewer,v_target)
          AND "target_id" = greatest(i_viewer,v_target)
          AND "status" = ('accepted')::"finfolk"."EnumUserConnectionStatus") INTO v_connected;
          IF v_connected THEN
            v_details := true;
          END IF;
      END;
      END IF;
      DECLARE
        o_basic JSONB;
      BEGIN
        o_basic := jsonb_build_object(
          'id',
          v_target,
          'uid',
          v_target,
          'displayName',
          coalesce(o_profile ->> 'displayName','Diver'),
          'open',
          v_open,
          'restricted',
          NOT v_details
        );
        IF NOT v_details THEN
          RETURN o_basic;
        END IF;
        IF jsonb_exists(o_profile,'featuredLogs') THEN
          o_basic := (o_basic || jsonb_build_object('featuredLogs',o_profile -> 'featuredLogs'));
        END IF;
        IF jsonb_exists(o_profile,'featuredPosts') THEN
          o_basic := (o_basic || jsonb_build_object('featuredPosts',o_profile -> 'featuredPosts'));
        END IF;
        RETURN o_basic || jsonb_build_object(
          'bio',
          coalesce(o_profile ->> 'bio',''),
          'instagram',
          coalesce(o_profile ->> 'instagram',''),
          'tiktok',
          coalesce(o_profile ->> 'tiktok',''),
          'portrait',
          coalesce(o_profile ->> 'portrait',''),
          'availability',
          coalesce(o_profile -> 'availability',('[]')::JSONB),
          'experience',
          coalesce(o_profile ->> 'experience',''),
          'beaches',
          coalesce(o_profile -> 'beaches',('[]')::JSONB),
          'posts',
          "finfolk_rpc".profile_post_links(v_target,false)
        );
      END;
    END;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-public-session 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_public_session(
  i_session UUID
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".ret_visible_session(null,i_session);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-public-sessions 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_public_sessions(
  i_query JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".ret_visible_sessions(null,i_query);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-logbook/ret-public-profile 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_public_profile(
  i_target UUID
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".ret_visible_profile(null,i_target);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-profile/ret-profile-statistics 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_profile_statistics(
  i_user UUID,
  i_target UUID,
  i_site UUID
) RETURNS JSONB AS $$

  DECLARE
    o_counts JSONB;
    o_own JSONB;
    o_owner JSONB;
    o_public JSONB;
    o_site JSONB;
    o_stats JSONB;
    o_target JSONB;
    o_viewer JSONB;
    v_buddy BOOLEAN;
    v_connected BOOLEAN;
    v_level INT;
    v_open BOOLEAN;
  BEGIN
    o_viewer := "finfolk_rpc".ret_account(i_user);
    o_public := "finfolk_rpc".ret_visible_profile(i_user,i_target);
    o_target := "finfolk_rpc".ret_account(i_target);
    o_owner := (o_target -> 'profile');
    o_own := (o_viewer -> 'profile');
    WITH j_ret AS (  
      SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
      WHERE "id" = i_site
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
    SELECT exists(SELECT 1 FROM "finfolk"."UserConnection"
    WHERE "user_id" = least(i_user,i_target)
    AND "target_id" = greatest(i_user,i_target)
    AND "status" = ('accepted')::"finfolk"."EnumUserConnectionStatus") INTO v_buddy;
    v_connected := ((i_user = i_target) OR v_buddy);
    v_open := (((o_own -> 'open') = ('true')::JSONB) AND ((o_owner -> 'open') = ('true')::JSONB));
    o_counts := null;
    o_stats := ('{}')::JSONB;
    v_level := 0;
    IF o_site is null  THEN
      RAISE EXCEPTION USING errcode = 'P0002',message = 'Choose an existing dive site';
    END IF;
    DECLARE
      v_day DATE;
    BEGIN
      v_day := ("timezone"(o_site ->> 'timezone',now()))::DATE;
      EXECUTE 'WITH p AS (SELECT ($1->>''actor'')::uuid actor,($1->>''target'')::uuid target,($1->>''site'')::uuid site,($1->>''day'')::date AS local_day), visits AS (  SELECT count(*) FILTER(WHERE user_id=p.actor AND visit_day BETWEEN p.local_day-29 AND p.local_day)::int viewer_count,  count(*) FILTER(WHERE user_id=p.target AND visit_day BETWEEN p.local_day-29 AND p.local_day)::int owner_count,  count(DISTINCT to_char(visit_day,''YYYY-MM'')) FILTER(WHERE user_id=p.target AND visit_day<=p.local_day)::int months  FROM finfolk."UserCheckin" CROSS JOIN p WHERE site_id=p.site AND user_id IN(p.actor,p.target)  ), sessions AS (SELECT count(*)::int dives,  sum(CASE WHEN jsonb_typeof(detail->''durationMinutes'')=''number'' THEN (detail->>''durationMinutes'')::numeric END) minutes,  array_agg((detail->>''maxDepthMetres'')::numeric ORDER BY (detail->>''maxDepthMetres'')::numeric) FILTER(WHERE jsonb_typeof(detail->''maxDepthMetres'')=''number'') depths  FROM finfolk."DiveSession" CROSS JOIN p WHERE owner_id=p.target AND site_id=p.site)  SELECT jsonb_build_object(''viewerCount'',viewer_count,''visits'',owner_count,''months'',months,''dives'',dives,''minutes'',minutes,''typicalDepth'',depths[cardinality(depths)/2+1]) FROM visits CROSS JOIN sessions' INTO o_counts USING jsonb_build_object('actor',i_user,'target',i_target,'site',i_site,'day',v_day);
    END;
    IF v_connected OR (v_open AND ((o_counts ->> 'viewerCount')::INT >= 8) AND ((o_counts ->> 'visits')::INT >= 8)) THEN
      v_level := 2;
    END IF;
    IF v_level >= 1 THEN
      IF ((o_owner -> 'sharing') -> 'visits') = ('true')::JSONB THEN
        o_stats := (o_stats || jsonb_build_object('visits',o_counts -> 'visits'));
      END IF;
      IF ((o_owner -> 'sharing') -> 'months') = ('true')::JSONB THEN
        o_stats := (o_stats || jsonb_build_object('months',o_counts -> 'months'));
      END IF;
    END IF;
    IF v_level >= 2 THEN
      IF ((o_owner -> 'sharing') -> 'dives') = ('true')::JSONB THEN
        o_stats := (o_stats || jsonb_build_object('dives',o_counts -> 'dives'));
      END IF;
      IF ((o_owner -> 'sharing') -> 'time') = ('true')::JSONB THEN
        o_stats := (o_stats || jsonb_build_object('minutes',o_counts -> 'minutes'));
      END IF;
      IF ((o_owner -> 'sharing') -> 'depth') = ('true')::JSONB THEN
        o_stats := (o_stats || jsonb_build_object('typicalDepth',o_counts -> 'typicalDepth'));
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'profile',
      o_public,
      'level',
      v_level,
      'stats',
      o_stats,
      'progress',
      least(8,(o_counts ->> 'viewerCount')::INT),
      'sharingClosed',
      NOT coalesce(v_open,false),
      'expiresWithActivity',
      NOT v_connected
    );
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

-- finfolkdb.fn.site.site-catalog/native-public-site-catalog 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_public_site_catalog() RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_site_catalog()' INTO o_result;
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-catalog/native-public-site-detail 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_public_site_detail(
  i_site UUID
) RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_site_detail($1)' INTO o_result USING i_site;
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.site.site-catalog/native-public-popular 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_public_popular() RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_discover_popular()' INTO o_result;
    RETURN o_result;
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

-- finfolkdb.fn.event.event-delivery/event-delivery-enqueue 
CREATE OR REPLACE FUNCTION "finfolk_rpc".event_delivery_enqueue(
  i_actor UUID,
  i_event UUID,
  i_invite UUID,
  i_token TEXT,
  i_key TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_event_delivery_operation(''enqueue'',($1->>''actor'')::uuid,($1->>''event'')::uuid,($1->>''invite'')::uuid,$1->>''token'',$1->>''key'',NULL,NULL,NULL)' INTO o_result USING jsonb_build_object(
      'actor',
      i_actor,
      'event',
      i_event,
      'invite',
      i_invite,
      'token',
      i_token,
      'key',
      i_key
    );
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-delivery/event-delivery-claim 
CREATE OR REPLACE FUNCTION "finfolk_rpc".event_delivery_claim(
  i_actor UUID,
  i_event UUID,
  i_invite UUID,
  i_key TEXT,
  i_lease UUID
) RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_event_delivery_operation(''claim'',($1->>''actor'')::uuid,($1->>''event'')::uuid,($1->>''invite'')::uuid,NULL,$1->>''key'',($1->>''lease'')::uuid,NULL,NULL)' INTO o_result USING jsonb_build_object(
      'actor',
      i_actor,
      'event',
      i_event,
      'invite',
      i_invite,
      'key',
      i_key,
      'lease',
      i_lease
    );
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.event.event-delivery/event-delivery-complete 
CREATE OR REPLACE FUNCTION "finfolk_rpc".event_delivery_complete(
  i_actor UUID,
  i_event UUID,
  i_invite UUID,
  i_lease UUID,
  i_state TEXT,
  i_receipt TEXT
) RETURNS JSONB AS $$

  DECLARE
    o_result JSONB;
  BEGIN
    o_result := null;
    EXECUTE 'SELECT finfolk_rpc.native_event_delivery_operation(''complete'',($1->>''actor'')::uuid,($1->>''event'')::uuid,($1->>''invite'')::uuid,NULL,NULL,($1->>''lease'')::uuid,$1->>''state'',$1->>''receipt'')' INTO o_result USING jsonb_build_object(
      'actor',
      i_actor,
      'event',
      i_event,
      'invite',
      i_invite,
      'lease',
      i_lease,
      'state',
      i_state,
      'receipt',
      i_receipt
    );
    RETURN o_result;
  END;

$$ LANGUAGE 'plpgsql';

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

-- finfolkdb.fn.user.user-community/record-community-checkin 
CREATE OR REPLACE FUNCTION "finfolk_rpc".record_community_checkin(
  i_user UUID,
  i_site UUID,
  i_verified BOOLEAN
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  PERFORM "finfolk_rpc".ret_account(i_user);
  IF NOT coalesce(i_verified,false) THEN
    RAISE EXCEPTION USING
      errcode = '42501',
      message = 'Verify your email before checking in'
    ;
  END IF;
  DECLARE
    o_site JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
      WHERE "id" = i_site
      LIMIT 1)
    SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
    IF o_site is null  THEN
      RAISE EXCEPTION USING errcode = 'P0002',message = 'Choose an existing dive site';
    END IF;
    DECLARE
      o_row JSONB;
      v_count INT;
      v_day DATE;
      v_exists BOOLEAN;
    BEGIN
      v_day := ("timezone"(o_site ->> 'timezone',now()))::DATE;
      SELECT exists(SELECT 1 FROM "finfolk"."UserCheckin"
      WHERE "user_id" = i_user AND "site_id" = i_site AND "visit_day" = v_day) INTO v_exists;
      v_count := 0;
      o_row := null;
      IF NOT v_exists THEN
        DECLARE
        o_created JSONB;
      BEGIN
        WITH j_ret AS (  
            INSERT INTO "finfolk"."UserCheckin" ("user_id","site_id","visit_day") VALUES ((i_user)::UUID,(i_site)::UUID,(v_day)::DATE) RETURNING
              "id",
              "user_id",
              "site_id",
              "visit_day",
              "time_created",
              "checked_in_at",
              "checked_out_at")
          SELECT to_jsonb(j_ret) FROM j_ret INTO o_created;
      END;
      END IF;
      DECLARE
        o_visits JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT "visit_day" FROM "finfolk"."UserCheckin"
          WHERE "user_id" = i_user
          AND "site_id" = i_site
          AND "visit_day" >= v_day - 29
          ORDER BY "visit_day" ASC
          LIMIT 31)
        SELECT jsonb_agg(j_ret) FROM j_ret INTO o_visits;
        FOR o_row IN SELECT jsonb_array_elements(coalesce(o_visits,('[]')::JSONB)) LOOP
          IF (o_row ->> 'visit_day')::DATE <= v_day THEN
            v_count := (v_count + 1);
          END IF;
        END LOOP;
      END;
      RETURN jsonb_build_object('day',(v_day)::TEXT,'count',v_count,'selfReported',true);
    END;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-community/remove-community-checkin 
CREATE OR REPLACE FUNCTION "finfolk_rpc".remove_community_checkin(
  i_user UUID,
  i_site UUID,
  i_day DATE
) RETURNS JSONB AS $$
BEGIN
  PERFORM "pg_advisory_xact_lock"("hashtextextended"((i_user)::TEXT,0));
  PERFORM "finfolk_rpc".ret_account(i_user);
  IF i_day is null  THEN
    RAISE EXCEPTION USING errcode = '22023',message = 'Choose a visit day';
  END IF;
  DECLARE
    o_removed JSONB;
  BEGIN
    WITH j_ret AS (  
      DELETE FROM "finfolk"."UserCheckin" WHERE "user_id" = i_user AND "site_id" = i_site AND "visit_day" = i_day
      RETURNING
        "id",
        "user_id",
        "site_id",
        "visit_day",
        "time_created",
        "checked_in_at",
        "checked_out_at")
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_removed;
    RETURN jsonb_build_object('removed',true);
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-community/ret-community-checkins 
CREATE OR REPLACE FUNCTION "finfolk_rpc".ret_community_checkins(
  i_user UUID
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_result JSONB;
    o_row JSONB;
    o_visits JSONB;
  BEGIN
    WITH j_ret AS (  
      SELECT
        "id",
        "user_id",
        "site_id",
        "visit_day",
        "time_created",
        "checked_in_at",
        "checked_out_at"
      FROM "finfolk"."UserCheckin"
      WHERE "user_id" = i_user
      ORDER BY "visit_day","site_id" DESC
      LIMIT 100)
    SELECT jsonb_agg(j_ret) FROM j_ret INTO o_visits;
    o_row := null;
    o_result := ('[]')::JSONB;
    FOR o_row IN SELECT jsonb_array_elements(coalesce(o_visits,('[]')::JSONB)) LOOP
      DECLARE
        o_site JSONB;
      BEGIN
        WITH j_ret AS (  
          SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
          WHERE "id" = (o_row ->> 'site_id')::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
        o_result := (o_result || jsonb_build_array(jsonb_build_object(
          'beach_id',
          o_row -> 'site_id',
          'day',
          o_row -> 'visit_day',
          'name',
          o_site -> 'name'
        )));
      END;
    END LOOP;
    RETURN o_result;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.user.user-community/discover-community-people 
CREATE OR REPLACE FUNCTION "finfolk_rpc".discover_community_people(
  i_user UUID,
  i_query JSONB
) RETURNS JSONB AS $$
BEGIN
  PERFORM "finfolk_rpc".ret_account(i_user);
  DECLARE
    o_result JSONB;
    o_row JSONB;
    o_rows JSONB;
    v_after TEXT;
    v_availability TEXT;
    v_cursor TEXT;
    v_experience TEXT;
    v_index INT;
    v_next TEXT;
    v_rank TEXT;
    v_seed TEXT;
    v_site TEXT;
    v_zone TEXT;
  BEGIN
    v_seed := (i_query ->> 'seed');
    v_availability := coalesce(i_query ->> 'availability','');
    v_experience := coalesce(i_query ->> 'experience','');
    v_site := coalesce(i_query ->> 'beachId','');
    v_cursor := coalesce(i_query ->> 'cursor','');
    v_rank := '';
    v_after := '00000000-0000-0000-0000-000000000000';
    v_zone := 'UTC';
    o_rows := null;
    o_row := null;
    o_result := ('[]')::JSONB;
    v_next := null;
    v_index := 0;
    IF v_seed IS NULL OR NOT "regexp_like"(v_seed,'^[A-Za-z0-9_-]{8,64}$') THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Choose a new people mix';
    END IF;
    IF NOT jsonb_exists(
      ('["","weekday mornings","weekday afternoons","weekend mornings","weekend afternoons"]')::JSONB,
      v_availability
    ) OR NOT jsonb_exists(
      ('["","new","comfortable","experienced"]')::JSONB,
      v_experience
    ) THEN
      RAISE EXCEPTION USING errcode = '22023',message = 'Choose listed people filters';
    END IF;
    IF v_site != '' THEN
      DECLARE
      o_site JSONB;
    BEGIN
      WITH j_ret AS (  
          SELECT "id","key","name","timezone","area_name","state" FROM "finfolk"."Site"
          WHERE "id" = (v_site)::UUID
          LIMIT 1)
        SELECT to_jsonb(j_ret) FROM j_ret INTO o_site;
        IF o_site is null  THEN
          RAISE EXCEPTION USING errcode = 'P0002',message = 'Choose an existing dive site';
        END IF;
        v_zone := (o_site ->> 'timezone');
    END;
    END IF;
    DECLARE
      v_context TEXT;
      v_day DATE;
    BEGIN
      v_context := "md5"(
        (i_user)::TEXT || ':' || v_seed || ':' || (jsonb_build_array(v_site,v_availability,v_experience))::TEXT
      );
      v_day := ("timezone"(v_zone,now()))::DATE;
      IF v_cursor != '' THEN
        IF NOT "regexp_like"(v_cursor,'^[0-9a-f]{32}[.][0-9a-f]{32}[.][0-9a-f-]{36}$') OR ("split_part"(v_cursor,'.',1) != v_context) THEN
          RAISE EXCEPTION USING
            errcode = '22023',
            message = 'This people mix changed; start a new mix'
          ;
        END IF;
        v_rank := "split_part"(v_cursor,'.',2);
        v_after := "split_part"(v_cursor,'.',3);
      END IF;
      EXECUTE 'WITH p AS (SELECT ($1->>''actor'')::uuid AS actor,$1->>''seed'' AS seed,nullif($1->>''site'','''')::uuid AS site,($1->>''day'')::date AS day,$1->>''availability'' AS availability,$1->>''experience'' AS experience,$1->>''rank'' AS rank,($1->>''after'')::uuid AS after), eligible AS (  SELECT m.id,m.profile,md5(p.actor::text||'':''||p.seed||'':''||m.id::text) AS mix_rank,  (SELECT CASE WHEN c.status IN (''pending'',''accepted'') THEN c.status::text ELSE NULL END FROM finfolk."UserConnection" c WHERE c.user_id=least(p.actor,m.id) AND c.target_id=greatest(p.actor,m.id)) AS connection,  CASE WHEN p.site IS NULL THEN 0 ELSE (SELECT count(*) FROM finfolk."UserCheckin" v WHERE v.user_id=m.id AND v.site_id=p.site AND v.visit_day BETWEEN p.day-29 AND p.day) END AS visits  FROM finfolk."User" m CROSS JOIN p WHERE m.id<>p.actor AND NOT m.deleted AND m.profile->''open''=''true''::jsonb  AND (p.availability='''' OR coalesce(m.profile->''availability'',''[]''::jsonb)?p.availability)  AND (p.experience='''' OR m.profile->>''experience''=p.experience)  AND NOT EXISTS(SELECT 1 FROM finfolk."UserBlock" b WHERE (b.owner_id=p.actor AND b.target_id=m.id) OR (b.owner_id=m.id AND b.target_id=p.actor))  AND NOT EXISTS(SELECT 1 FROM finfolk."UserConnection" c WHERE c.user_id=least(p.actor,m.id) AND c.target_id=greatest(p.actor,m.id) AND c.status=''declined'')  ), page AS (SELECT e.* FROM eligible e CROSS JOIN p WHERE (p.site IS NULL OR e.visits>0 OR coalesce(e.profile->''beaches'',''[]''::jsonb)?p.site::text) AND (e.mix_rank,e.id)>(p.rank,p.after) ORDER BY e.mix_rank,e.id LIMIT 7)  SELECT coalesce(jsonb_agg(jsonb_build_object(''id'',id,''displayName'',coalesce(profile->>''displayName'',''Diver''),''open'',true,''bio'',coalesce(profile->>''bio'',''''),''instagram'',coalesce(profile->>''instagram'',''''),''tiktok'',coalesce(profile->>''tiktok'',''''),''portrait'',coalesce(profile->>''portrait'',''''),''availability'',coalesce(profile->''availability'',''[]''::jsonb),''experience'',coalesce(profile->>''experience'',''''),''beaches'',coalesce(profile->''beaches'',''[]''::jsonb),''regular'',visits>=8,''recent'',visits>0,''connection'',connection,''mix_rank'',mix_rank) ORDER BY mix_rank,id),''[]''::jsonb) FROM page' INTO o_rows USING jsonb_build_object(
        'actor',
        i_user,
        'seed',
        v_seed,
        'site',
        v_site,
        'day',
        v_day,
        'availability',
        v_availability,
        'experience',
        v_experience,
        'rank',
        v_rank,
        'after',
        v_after
      );
      FOR o_row IN SELECT jsonb_array_elements(o_rows) LOOP
        IF v_index < 6 THEN
          o_result := (o_result || jsonb_build_array(o_row - 'mix_rank'));
          IF v_index = 5 THEN
            v_next := (v_context || '.' || (o_row ->> 'mix_rank') || '.' || (o_row ->> 'id'));
          END IF;
        END IF;
        v_index := (v_index + 1);
      END LOOP;
      IF jsonb_array_length(o_rows) <= 6 THEN
        v_next := null;
      END IF;
      RETURN jsonb_build_object('people',o_result,'cursor',v_next);
    END;
  END;
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

-- finfolkdb.fn.directory.directory-app/native-directory-admin 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_admin(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'admin',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-admin-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_admin_save(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'admin-save',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-claim 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_claim(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'claim',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-claim-review 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_claim_review(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'claim-review',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-owner-create 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_owner_create(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'owner-create',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-discovery-start 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_discovery_start(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'discovery-start',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-merge 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_merge(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'merge',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-mine 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_mine(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'mine',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-owner-save 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_owner_save(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'owner-save',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-report 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_report(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'report',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-report-resolve 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_report_resolve(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'report-resolve',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-page-access 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_page_access(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'page-access',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-admin-remove 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_admin_remove(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'admin-remove',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-invite-create 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_invite_create(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'invite-create',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-invite-redeem 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_invite_redeem(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'invite-redeem',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-invite-revoke 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_invite_revoke(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'invite-revoke',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-public-list 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_public_list(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'public-list',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-public-detail 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_public_detail(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'public-detail',i_values);
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/call-native-directory 
CREATE OR REPLACE FUNCTION "finfolk_rpc".call_native_directory(
  i_user UUID,
  i_verified BOOLEAN,
  i_operation TEXT,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  IF i_user is not null  THEN
    PERFORM "finfolk_rpc".ret_account(i_user);
  END IF;
  DECLARE
    o_result JSONB;
    v_admin BOOLEAN;
  BEGIN
    SELECT exists(SELECT 1 FROM "finfolk"."UserRole"
    WHERE "user_id" = i_user AND "role" = 'admin') INTO v_admin;
    o_result := null;
    PERFORM "set_config"('finfolk.actor_id',coalesce((i_user)::TEXT,''),true);
    PERFORM "set_config"(
      'finfolk.directory_verified',
      (coalesce(i_verified,false))::TEXT,
      true
    );
    PERFORM "set_config"('finfolk.directory_admin',(v_admin)::TEXT,true);
    EXECUTE 'SELECT finfolk_rpc.directory_operation($1->>''operation'',$1->''values'')' INTO o_result USING jsonb_build_object('operation',i_operation,'values',i_values);
    RETURN o_result;
  END;
END;
$$ LANGUAGE 'plpgsql';

-- finfolkdb.fn.directory.directory-app/native-directory-discovery-finish 
CREATE OR REPLACE FUNCTION "finfolk_rpc".native_directory_discovery_finish(
  i_user UUID,
  i_verified BOOLEAN,
  i_values JSONB
) RETURNS JSONB AS $$
BEGIN
  RETURN "finfolk_rpc".call_native_directory(i_user,i_verified,'discovery-finish',i_values);
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
 PERFORM finfolk_rpc.account_portrait(coalesce(d->>'image',''));
 RETURN jsonb_build_object('name',trim(d->>'name'),'category',d->>'category','state',coalesce(d->>'state',''),
 'country',left(coalesce(nullif(trim(d->>'country'),''),'Australia'),100),'locality',left(coalesce(d->>'locality',''),160),
 'description',left(coalesce(d->>'description',''),2000),'website',coalesce(d->>'website',''),
 'image',coalesce(d->>'image',''),'socials','[]'::jsonb,'sources',d->'sources');
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION finfolk_rpc.directory_socials(d jsonb) RETURNS jsonb AS $$
DECLARE s text; item text; out jsonb:='[]'; BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'array' OR jsonb_array_length(d)>10 THEN RAISE EXCEPTION 'Provide up to ten social links' USING ERRCODE='22023'; END IF;
 FOR s IN SELECT jsonb_array_elements_text(d) LOOP
 IF s ~ '^instagram:[A-Za-z0-9._]{1,30}$' THEN s:='https://www.instagram.com/'||split_part(s,':',2)||'/'; END IF;
 IF s ~ '^tiktok:[A-Za-z0-9._]{1,30}$' THEN s:='https://www.tiktok.com/@'||split_part(s,':',2)||'/'; END IF;
 IF s ~ '^https://(www[.])?instagram[.]com/' THEN item:='instagram:'||lower(split_part(finfolk_rpc.account_link(s,'instagram'),'/',4));
 ELSIF s ~ '^https://(www[.])?tiktok[.]com/' THEN item:='tiktok:'||lower(substr(split_part(finfolk_rpc.account_link(s,'tiktok'),'/',4),2));
 ELSE RAISE EXCEPTION 'Provide a provider profile link' USING ERRCODE='22023'; END IF;
 IF NOT out ? item THEN out:=out||jsonb_build_array(item); END IF; END LOOP; RETURN out; END $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION finfolk_rpc.directory_owner_row(l finfolk."DirectoryListing") RETURNS jsonb AS $$
 SELECT jsonb_build_object('id',l.id,'document',l.detail,'status',l.status,'revision',r.index,
 'owner_id',(SELECT member_id FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND level='owner' AND is_active),
 'role',(SELECT level FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=finfolk.auth_uid() AND is_active))
 FROM finfolk."Rev" r WHERE r.class_table='DirectoryListing' AND r.class_context='Global' AND r.id=l.rev_id;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION finfolk_rpc.directory_operation(op text,v jsonb) RETURNS jsonb AS $$
DECLARE
 actor uuid:=finfolk.auth_uid(); adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'')='true';
 discovery_run finfolk."DirectoryRun"; candidate jsonb; inserted_count integer; target_page finfolk."DirectoryListing"; l finfolk."DirectoryListing"; req finfolk."AccessRequest"; ident uuid; inv finfolk."AccessInviteExternal"; tok text; doc jsonb; ctx jsonb; result jsonb; off integer; rev integer;
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
 IF actor IS NULL OR coalesce(current_setting('finfolk.directory_verified',true),'')<>'true' THEN
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
 'challenge',r.detail->>'challenge','expires_at',r.expires_at/1000)) FROM finfolk."AccessRequest" r
 JOIN finfolk."DirectoryListing" p ON p.access_id=r.access_id AND p.class_table=r.class_table AND p.class_context=r.class_context WHERE r.from_id=actor),'[]'::jsonb)) INTO result; RETURN result;
 ELSIF op='page-access' THEN
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid;
 IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND is_active AND level IN ('owner','admin')) THEN
 RAISE EXCEPTION 'You do not manage this page' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('role',(SELECT level FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND is_active),
 'admins',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.member_id,'name',coalesce(u.profile->>'displayName','Diver')))
 FROM finfolk."AccessRole" a JOIN finfolk."User" u ON u.id=a.member_id WHERE a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=l.access_id AND a.is_active AND a.level='admin'),'[]'::jsonb),
 'invites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'expiresAt',expires_at/1000)) FROM finfolk."AccessInviteExternal" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND status='pending' AND expires_at>(extract(epoch from clock_timestamp())*1000000)::bigint),'[]'::jsonb));
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
 DO UPDATE SET detail=excluded.detail,expires_at=(extract(epoch from clock_timestamp())*1000000)::bigint+604800000000 RETURNING * INTO req;
 RETURN jsonb_build_object('id',req.id,'challenge',req.detail->>'challenge','expires_at',req.expires_at/1000);
 ELSIF op='report' THEN
 IF length(trim(coalesce(v->>'message','')))=0 OR length(v->>'message')>2000 THEN RAISE EXCEPTION 'Provide a correction reason' USING ERRCODE='22023'; END IF;
 IF finfolk_rpc.ret_directory_public((v->>'id')::uuid) IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF;
 INSERT INTO finfolk."DirectoryReport"(listing_id,author_id,message) VALUES((v->>'id')::uuid,actor,trim(v->>'message')); RETURN '{}'::jsonb;
 ELSIF op IN ('invite-create','invite-revoke','admin-remove') THEN
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF l.id IS NULL OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=actor AND level='owner' AND is_active) THEN
 RAISE EXCEPTION 'Page owner required' USING ERRCODE='42501'; END IF;
 IF op='invite-create' THEN
 IF (SELECT count(*) FROM finfolk."AccessInviteExternal" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND status='pending' AND expires_at>(extract(epoch from clock_timestamp())*1000000)::bigint)>=5 THEN
 RAISE EXCEPTION 'Revoke outstanding invitations first' USING ERRCODE='22023'; END IF;
 tok:=encode(gen_random_bytes(32),'hex');
 INSERT INTO finfolk."AccessInviteExternal"(class_table,class_context,access_id,secret,from_id) VALUES('DirectoryListing','Global',l.access_id,encode(digest(tok,'sha256'),'hex'),actor) RETURNING * INTO inv;
 RETURN jsonb_build_object('id',inv.id,'token',tok,'expiresAt',inv.expires_at/1000);
 ELSIF op='invite-revoke' THEN
 UPDATE finfolk."AccessInviteExternal" SET status='expired' WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND id=(v->>'invite')::uuid AND status='pending';
 ELSE
 UPDATE finfolk."AccessRole" SET is_active=false WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND member_id=(v->>'user')::uuid AND level='admin';
 END IF; RETURN '{}'::jsonb;
 ELSIF op='invite-redeem' THEN
 IF coalesce(v->>'token','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO inv FROM finfolk."AccessInviteExternal" WHERE class_table='DirectoryListing' AND class_context='Global' AND secret=encode(digest(v->>'token','sha256'),'hex');
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=inv.access_id FOR UPDATE;
 SELECT * INTO inv FROM finfolk."AccessInviteExternal" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND id=inv.id FOR UPDATE;
 IF inv.status='accepted' AND inv.reply_id=actor THEN RETURN jsonb_build_object('id',l.id); END IF;
 IF inv.status<>'pending' OR inv.expires_at<=(extract(epoch from clock_timestamp())*1000000)::bigint OR inv.from_id=actor OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=inv.access_id AND member_id=inv.from_id AND level='owner' AND is_active) THEN
 RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='40001'; END IF;
 INSERT INTO finfolk."AccessRole"(class_table,class_context,access_id,member_id,from_id,level) VALUES('DirectoryListing','Global',inv.access_id,actor,inv.from_id,'admin')
 ON CONFLICT(class_table,class_context,access_id,member_id) DO UPDATE SET level='admin',is_active=true,from_id=inv.from_id WHERE finfolk."AccessRole".level<>'owner';
 UPDATE finfolk."AccessInviteExternal" SET status='accepted',reply_id=actor,accepted_at=(extract(epoch from clock_timestamp())*1000000)::bigint WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=inv.access_id AND id=inv.id;
 RETURN jsonb_build_object('id',l.id);
 END IF;
 -- Review operations are deliberately explicit, never inferred from ownership.
 IF NOT adm THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF op='admin' THEN
 SELECT jsonb_build_object('listings',coalesce((SELECT jsonb_agg(finfolk_rpc.directory_owner_row(p)||jsonb_build_object('notes',p.notes,'outreach',p.outreach)) FROM finfolk."DirectoryListing" p),'[]'),
 'claims',coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'listing_id',p.id,'user_id',r.from_id,'state',CASE r.status WHEN 'accepted' THEN 'approved' ELSE r.status::text END,'challenge',r.detail->>'challenge','expires_at',r.expires_at/1000))
 FROM finfolk."AccessRequest" r JOIN finfolk."DirectoryListing" p ON p.access_id=r.access_id AND p.class_table=r.class_table AND p.class_context=r.class_context),'[]'),
 'reports',coalesce((SELECT jsonb_agg(r) FROM finfolk."DirectoryReport" r WHERE NOT r.resolved),'[]'),'runs',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'query',query,'state',status,'error',error,'count',coalesce((log->1->>'count')::integer,0)) ORDER BY time_created DESC) FROM (SELECT * FROM finfolk."DirectoryRun" ORDER BY time_created DESC LIMIT 50) runs),'[]'::jsonb),'audit','[]'::jsonb) INTO result; RETURN result;
 ELSIF op='discovery-start' THEN
 IF length(trim(coalesce(v->>'region','')))=0 OR length(v->>'region')>100 OR length(coalesce(v->>'seed',''))>100 OR length(coalesce(v->>'country',''))>100 OR NOT coalesce(v->>'category'=ANY(ARRAY['School','Instructor','Business','Club','Group','Freediver']),false) OR (v->>'category'<>'Freediver' AND NOT coalesce(v->>'state'=ANY(ARRAY['VIC','NSW','QLD','SA','WA','TAS','NT','ACT']),false)) THEN RAISE EXCEPTION 'Choose a region, category and state' USING ERRCODE='22023'; END IF;
 UPDATE finfolk."DirectoryRun" SET status='failed',error='Discovery timed out; retry the search.' WHERE status='running' AND time_created<(extract(epoch from clock_timestamp())*1000000)::bigint-300000000;
 IF EXISTS(SELECT 1 FROM finfolk."DirectoryRun" WHERE status='running' AND log->0->>'actor'=actor::text) THEN RAISE EXCEPTION 'A discovery run is already active' USING ERRCODE='40001'; END IF;
 ctx:=finfolk.op_fn(op,actor,'{}');
 INSERT INTO finfolk."DirectoryRun"(query,status,log,op_created,time_created) VALUES(concat_ws(' ',v->>'category',v->>'region',v->>'country',v->>'seed'),'running',jsonb_build_array(jsonb_build_object('actor',actor,'request',v)),(ctx->>'id')::uuid,(ctx->>'time')::bigint) RETURNING id INTO ident;
 RETURN jsonb_build_object('id',ident,'count',0,'state','running','error','');
 ELSIF op='discovery-finish' THEN
 SELECT * INTO discovery_run FROM finfolk."DirectoryRun" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF discovery_run.id IS NULL OR discovery_run.log->0->>'actor'<>actor::text THEN RAISE EXCEPTION 'Discovery run unavailable' USING ERRCODE='P0002'; END IF;
 IF discovery_run.status<>'running' THEN RETURN jsonb_build_object('id',discovery_run.id,'count',coalesce((discovery_run.log->1->>'count')::integer,0),'state',discovery_run.status,'error',discovery_run.error); END IF;
 IF NOT coalesce(v->>'state'=ANY(ARRAY['complete','failed']),false) OR jsonb_typeof(v->'candidates') IS DISTINCT FROM 'array' OR jsonb_array_length(v->'candidates')>60 THEN RAISE EXCEPTION 'Invalid discovery completion' USING ERRCODE='22023'; END IF;
 IF v->>'state'='failed' AND v->'candidates'<>'[]'::jsonb THEN RAISE EXCEPTION 'Failed discovery cannot publish candidates' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('directory-discovery-candidates',0));
 inserted_count:=0; ctx:=finfolk.op_fn(op,actor,'{}');
 FOR candidate IN SELECT value FROM jsonb_array_elements(v->'candidates') LOOP
 IF length(coalesce(candidate->>'identity',''))=0 OR length(candidate->>'identity')>2100 THEN RAISE EXCEPTION 'Invalid discovery identity' USING ERRCODE='22023'; END IF;
 doc:=finfolk_rpc.directory_document((candidate->'document')||'{"socials":[]}'::jsonb)||jsonb_build_object('socials',finfolk_rpc.directory_socials(candidate->'document'->'socials'),'discoveryIdentity',candidate->>'identity');
 IF jsonb_array_length(doc->'sources')=0 THEN RAISE EXCEPTION 'Discovery sources required' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM finfolk."DirectoryListing" WHERE detail->>'discoveryIdentity'=candidate->>'identity' OR (coalesce(doc->>'website','')<>'' AND detail->>'website'=doc->>'website') OR (jsonb_array_length(doc->'socials')>0 AND detail->'socials' ?| ARRAY(SELECT jsonb_array_elements_text(doc->'socials')))) THEN
 result:=finfolk_rpc.insert_directory_listing(doc,ctx);
 UPDATE finfolk."DirectoryListing" SET notes=left(coalesce(candidate->>'notes',''),2000) WHERE id=(result->>'id')::uuid;
 inserted_count:=inserted_count+1;
 END IF; END LOOP;
 UPDATE finfolk."DirectoryRun" SET status=v->>'state',error=CASE WHEN v->>'state'='failed' THEN 'Search failed; retry discovery.' ELSE '' END,log=log||jsonb_build_array(jsonb_build_object('count',inserted_count)),op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=discovery_run.id RETURNING * INTO discovery_run;
 RETURN jsonb_build_object('id',discovery_run.id,'count',inserted_count,'state',discovery_run.status,'error',discovery_run.error);
 ELSIF op='merge' THEN
 IF (v->>'source')::uuid=(v->>'target')::uuid THEN RAISE EXCEPTION 'Choose different pages' USING ERRCODE='22023'; END IF;
 PERFORM id FROM finfolk."DirectoryListing" WHERE id IN((v->>'source')::uuid,(v->>'target')::uuid) ORDER BY id FOR UPDATE;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'source')::uuid;
 SELECT * INTO target_page FROM finfolk."DirectoryListing" WHERE id=(v->>'target')::uuid;
 IF l.id IS NULL OR target_page.id IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF;
 IF l.status='archived' AND l.detail->>'mergedInto'=target_page.id::text THEN RETURN jsonb_build_object('id',target_page.id); END IF;
 IF l.status IN('archived','suppressed') OR target_page.status IN('archived','suppressed','rejected') OR EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND is_active AND level IN('owner','admin')) OR EXISTS(SELECT 1 FROM finfolk."Event" WHERE listing_id=l.id) THEN RAISE EXCEPTION 'Only unmanaged pages without events may be merged into an available target' USING ERRCODE='40001'; END IF;
 doc:=target_page.detail||jsonb_build_object('sources',(SELECT coalesce(jsonb_agg(value ORDER BY value),'[]') FROM (SELECT DISTINCT value FROM jsonb_array_elements(coalesce(l.detail->'sources','[]')||coalesce(target_page.detail->'sources','[]'))) q),'socials',(SELECT coalesce(jsonb_agg(value ORDER BY value),'[]') FROM (SELECT DISTINCT value FROM jsonb_array_elements(coalesce(l.detail->'socials','[]')||coalesce(target_page.detail->'socials','[]'))) q));
 ctx:=finfolk.op_fn('directory-merge',actor,'{}');
 UPDATE finfolk."DirectoryListing" SET detail=doc,op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=target_page.id;
 UPDATE finfolk."DirectoryListing" SET status='archived',detail=detail||jsonb_build_object('mergedInto',target_page.id),op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=l.id;
 UPDATE finfolk."AccessRequest" SET status='rejected' WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND status='pending';
 UPDATE finfolk."AccessInviteExternal" SET status='expired' WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND status='pending';
 FOR l IN SELECT * FROM finfolk."DirectoryListing" WHERE id IN((v->>'source')::uuid,(v->>'target')::uuid) LOOP
 UPDATE finfolk."Rev" SET current=l.detail,index=index+1 WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id RETURNING index INTO rev;
 INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created) VALUES('DirectoryListing','Global',l.rev_id,rev,l.detail,(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,entry,op_created,time_created) VALUES('DirectoryListing','Global',l.audit_id,jsonb_build_object('event','merge','source',v->>'source','target',v->>'target'),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 END LOOP;
 RETURN jsonb_build_object('id',target_page.id);
 ELSIF op='admin-save' THEN
 IF NOT coalesce(v->>'status'=ANY(ARRAY['candidate','published','rejected','archived','suppressed']),false) THEN RAISE EXCEPTION 'Choose a publication status' USING ERRCODE='22023'; END IF;
 IF NOT (v ? 'id') THEN
 doc:=finfolk_rpc.directory_document((v->'document')||'{"socials":[]}'::jsonb)||jsonb_build_object('socials',finfolk_rpc.directory_socials(v->'document'->'socials'));
 IF v->>'status'='published' AND jsonb_array_length(doc->'sources')=0 AND jsonb_array_length(doc->'socials')=0 THEN RAISE EXCEPTION 'Publication sources required' USING ERRCODE='22023'; END IF;
 ctx:=finfolk.op_fn('admin-create',actor,'{}'); result:=finfolk_rpc.insert_directory_listing(doc,ctx);
 UPDATE finfolk."DirectoryListing" SET status=(v->>'status')::finfolk."EnumDirectoryListingStatus",reviewed_at=(ctx->>'time')::bigint,notes=left(coalesce(v->>'notes',''),2000),outreach=left(coalesce(v->>'outreach','Not contacted'),100) WHERE id=(result->>'id')::uuid;
 RETURN jsonb_build_object('id',result->>'id'); END IF;
 IF NOT (v ? 'revision') THEN RAISE EXCEPTION 'Revision required' USING ERRCODE='22023'; END IF;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE id=(v->>'id')::uuid FOR UPDATE;
 IF l.id IS NULL THEN RAISE EXCEPTION 'Page unavailable' USING ERRCODE='P0002'; END IF;
 SELECT index INTO rev FROM finfolk."Rev" WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 IF rev IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Page changed. Reload before saving' USING ERRCODE='40001'; END IF;
 doc:=finfolk_rpc.directory_document((v->'document')||'{"socials":[]}'::jsonb)||jsonb_build_object('socials',finfolk_rpc.directory_socials(v->'document'->'socials'));
 IF l.detail ? 'creationRequest' THEN doc:=doc||jsonb_build_object('creationRequest',l.detail->'creationRequest'); END IF;
 IF v->>'status'='published' AND jsonb_array_length(doc->'sources')=0 AND jsonb_array_length(doc->'socials')=0 THEN RAISE EXCEPTION 'Publication sources required' USING ERRCODE='22023'; END IF;
 ctx:=finfolk.op_fn(op,actor,'{}');
 IF coalesce((v->>'revokeOwner')::boolean,false) THEN
 UPDATE finfolk."EventInviteDelivery" SET state='cancelled',sealed_token='',lease=NULL,lease_until=0,error='' WHERE state<>'sent' AND event_id IN(SELECT id FROM finfolk."Event" WHERE listing_id=l.id);
 UPDATE finfolk."AccessRole" SET is_active=false WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND level IN('owner','admin');
 UPDATE finfolk."AccessInviteExternal" SET status='expired' WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=l.access_id AND status='pending';
 END IF;
 UPDATE finfolk."DirectoryListing" SET detail=doc,status=(v->>'status')::finfolk."EnumDirectoryListingStatus",reviewed_at=(extract(epoch from clock_timestamp())*1000000)::bigint,notes=left(coalesce(v->>'notes',''),2000),outreach=left(coalesce(v->>'outreach','Not contacted'),100),op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=l.id;
 UPDATE finfolk."Rev" SET index=index+1,current=doc WHERE class_table='DirectoryListing' AND class_context='Global' AND id=l.rev_id;
 INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created) VALUES('DirectoryListing','Global',l.rev_id,rev+1,doc||jsonb_build_object('status',v->>'status'),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,entry,op_created,time_created) VALUES('DirectoryListing','Global',l.audit_id,jsonb_build_object('event',op,'status',v->>'status','revokedOwner',coalesce((v->>'revokeOwner')::boolean,false)),(ctx->>'id')::uuid,(ctx->>'time')::bigint);
 RETURN jsonb_build_object('id',l.id);
 ELSIF op='claim-review' THEN
 SELECT * INTO req FROM finfolk."AccessRequest" WHERE id=(v->>'id')::uuid AND class_table='DirectoryListing' AND class_context='Global' FOR UPDATE;
 IF req.id IS NULL OR req.status<>'pending' THEN RAISE EXCEPTION 'Claim no longer pending' USING ERRCODE='40001'; END IF;
 SELECT * INTO l FROM finfolk."DirectoryListing" WHERE access_id=req.access_id FOR UPDATE;
 IF coalesce((v->>'approve')::boolean,false) THEN
 IF req.expires_at<=(extract(epoch from clock_timestamp())*1000000)::bigint OR length(trim(coalesce(v->>'evidence','')))=0 THEN RAISE EXCEPTION 'Challenge expired or verification evidence missing' USING ERRCODE='22023'; END IF;
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

-- Native events use UUID members and shared page/event access providers.
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_manager(e finfolk."Event",actor uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM finfolk."DirectoryListing" p JOIN finfolk."AccessRole" a ON a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=p.access_id WHERE p.id=e.listing_id AND a.member_id=actor AND a.level IN('owner','admin') AND a.is_active)
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_active(e finfolk."Event") RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM finfolk."DirectoryListing" p JOIN finfolk."AccessRole" a ON a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=p.access_id JOIN finfolk."User" u ON u.id=a.member_id AND NOT u.deleted WHERE p.id=e.listing_id AND p.status='published' AND a.level='owner' AND a.is_active)
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_visible(e finfolk."Event",actor uuid,verified boolean) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT (verified AND finfolk_rpc.native_event_manager(e,actor)) OR (finfolk_rpc.native_event_active(e) AND NOT e.hidden AND e.status IN('published','cancelled') AND (e.visibility='public' OR (verified AND EXISTS(SELECT 1 FROM finfolk."AccessInviteEmail" i WHERE i.class_table='Event' AND i.class_context='Global' AND i.access_id=e.access_id AND i.status='accepted' AND i.reply_id=actor))))
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_row(e finfolk."Event",actor uuid,verified boolean,adm boolean) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',e.id,'page_id',e.listing_id,'document',e.detail,'state',e.status,'visibility',e.visibility,
 'starts_at',finfolk.as_iso_time(e.starts_at),'ends_at',finfolk.as_iso_time(e.ends_at),'timezone',e.timezone,'capacity',e.capacity,
 'going',(SELECT count(*) FROM finfolk."EventRsvp" r WHERE r.event_id=e.id AND r.status='going'),
 'myRsvp',(SELECT r.status FROM finfolk."EventRsvp" r WHERE r.event_id=e.id AND r.member_id=actor),
 'canManage',verified AND finfolk_rpc.native_event_manager(e,actor),'canModerate',verified AND adm,
 'revision',(SELECT index FROM finfolk."Rev" WHERE id=e.rev_id AND class_table='Event' AND class_context='Global'),
 'organiser',(SELECT detail->>'name' FROM finfolk."DirectoryListing" WHERE id=e.listing_id))
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_operation(op text,v jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE actor uuid:=finfolk.auth_uid(); verified boolean:=coalesce(current_setting('finfolk.event_verified',true),'')='true'; adm boolean:=coalesce(current_setting('finfolk.directory_admin',true),'')='true';
 e finfolk."Event"; p finfolk."DirectoryListing"; inv finfolk."AccessInviteEmail"; ident uuid; ctx jsonb; doc jsonb; answer jsonb; token text; mail text; n integer; revision integer; starts bigint; ends bigint; cap integer; now_us bigint:=(extract(epoch from clock_timestamp())*1000000)::bigint; manager boolean; allowed boolean;
BEGIN
 IF jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid event request' USING ERRCODE='22023'; END IF;
 IF op='list' THEN
 RETURN jsonb_build_object('events',coalesce((SELECT jsonb_agg(finfolk_rpc.native_event_row(q,NULL,false,false) ORDER BY q.starts_at,q.id) FROM (SELECT ev.* FROM finfolk."Event" ev WHERE ev.status='published' AND ev.visibility='public' AND NOT ev.hidden AND finfolk_rpc.native_event_active(ev) AND ev.ends_at>now_us
 AND (coalesce(v->>'page','')='' OR ev.listing_id=(v->>'page')::uuid) AND (coalesce(v->>'q','')='' OR strpos(lower(ev.detail->>'title'),lower(v->>'q'))>0)
 AND (coalesce(v->>'location','')='' OR strpos(lower(ev.detail->>'location'),lower(v->>'location'))>0) AND (coalesce(v->>'category','')='' OR ev.detail->>'category'=v->>'category')
 AND (coalesce(v->>'from','')='' OR ev.starts_at>=(extract(epoch from (v->>'from')::timestamptz)*1000000)::bigint)
 ORDER BY ev.starts_at,ev.id LIMIT 20 OFFSET greatest(0,least(10000,coalesce((v->>'offset')::integer,0)))) q),'[]'::jsonb));
 END IF;
 IF op='public-detail' THEN
 SELECT * INTO e FROM finfolk."Event" WHERE id=(v->>'id')::uuid;
 IF e.id IS NULL OR e.visibility<>'public' OR NOT finfolk_rpc.native_event_visible(e,NULL,false) THEN RETURN NULL; END IF;
 RETURN finfolk_rpc.native_event_row(e,NULL,false,false);
 END IF;
 IF actor IS NULL OR NOT verified OR NOT EXISTS(SELECT 1 FROM finfolk."User" WHERE id=actor AND NOT deleted) THEN RAISE EXCEPTION 'Verified member required' USING ERRCODE='42501'; END IF;
 IF op='mine' THEN RETURN jsonb_build_object('events',coalesce((SELECT jsonb_agg(finfolk_rpc.native_event_row(q,actor,verified,adm) ORDER BY q.starts_at DESC,q.id) FROM (SELECT ev.* FROM finfolk."Event" ev WHERE (adm OR finfolk_rpc.native_event_visible(ev,actor,verified)) AND (finfolk_rpc.native_event_manager(ev,actor) OR EXISTS(SELECT 1 FROM finfolk."EventRsvp" r WHERE r.event_id=ev.id AND r.member_id=actor) OR EXISTS(SELECT 1 FROM finfolk."AccessInviteEmail" i WHERE i.class_table='Event' AND i.class_context='Global' AND i.access_id=ev.access_id AND i.reply_id=actor AND i.status='accepted')) ORDER BY ev.starts_at DESC,ev.id LIMIT 100) q),'[]'::jsonb)); END IF;
 IF op='accept' THEN
 IF coalesce(v->>'token','') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO inv FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND secret=encode(digest(v->>'token','sha256'),'hex');
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 SELECT id INTO ident FROM finfolk."Event" WHERE access_id=inv.access_id;
 ELSE ident:=(v->>'id')::uuid; END IF;
 SELECT * INTO e FROM finfolk."Event" WHERE id=ident FOR UPDATE;
 IF op='accept' THEN SELECT * INTO inv FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=inv.id FOR UPDATE; END IF;
 IF e.id IS NULL AND op<>'save' THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='P0002'; END IF;
 now_us:=(extract(epoch from clock_timestamp())*1000000)::bigint;
 SELECT * INTO p FROM finfolk."DirectoryListing" WHERE id=coalesce(e.listing_id,(v->>'page')::uuid) FOR SHARE;
 manager:=coalesce(EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=p.access_id AND member_id=actor AND level IN('owner','admin') AND is_active),false);
 allowed:=coalesce(finfolk_rpc.native_event_visible(e,actor,verified),false);
 IF op='detail' THEN IF NOT allowed AND NOT adm THEN RAISE EXCEPTION 'Event unavailable' USING ERRCODE='P0002'; END IF; RETURN finfolk_rpc.native_event_row(e,actor,verified,adm); END IF;
 IF op IN('save','cancel','roster','invite','invite-retry','revoke') AND NOT manager THEN RAISE EXCEPTION 'Page owner or admin required' USING ERRCODE='42501'; END IF;
 IF op='save' THEN
 IF p.status<>'published' OR NOT EXISTS(SELECT 1 FROM finfolk."AccessRole" WHERE class_table='DirectoryListing' AND class_context='Global' AND access_id=p.access_id AND level='owner' AND is_active) THEN RAISE EXCEPTION 'Publish and claim the organising page first' USING ERRCODE='22023'; END IF;
 IF e.id IS NOT NULL AND e.listing_id IS DISTINCT FROM (v->>'page')::uuid THEN RAISE EXCEPTION 'Event organising page cannot change' USING ERRCODE='22023'; END IF;
 IF e.id IS NOT NULL THEN SELECT index INTO revision FROM finfolk."Rev" WHERE id=e.rev_id AND class_table='Event' AND class_context='Global'; IF revision IS DISTINCT FROM (v->>'revision')::integer THEN RAISE EXCEPTION 'Event changed; reload' USING ERRCODE='40001'; END IF; END IF;
 starts:=(extract(epoch from (v->>'starts')::timestamptz)*1000000)::bigint; ends:=(extract(epoch from (v->>'ends')::timestamptz)*1000000)::bigint; cap:=(v->>'capacity')::integer;
 IF starts IS NULL OR ends IS NULL OR ends<=starts OR length(trim(coalesce(v->>'title','')))=0 OR length(v->>'title')>160 OR length(trim(coalesce(v->>'location','')))=0 OR length(v->>'location')>300 OR length(coalesce(v->>'description',''))>5000 OR length(coalesce(v->>'category',''))>60 OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=v->>'timezone') OR NOT coalesce(v->>'visibility'=ANY(ARRAY['public','private']),false) OR NOT coalesce(v->>'state'=ANY(ARRAY['draft','published']),false) OR cap<=0 OR cap>100000 THEN RAISE EXCEPTION 'Check event fields and times' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO n FROM finfolk."EventRsvp" WHERE event_id=e.id AND status='going';
 IF (cap IS NOT NULL AND cap<n) OR (e.status='published' AND v->>'state'='draft' AND n>0) OR (e.status='published' AND e.visibility::text IS DISTINCT FROM v->>'visibility') THEN RAISE EXCEPTION 'Published visibility and existing places must be preserved' USING ERRCODE='40001'; END IF;
 ctx:=finfolk.op_fn('event-save',actor,'{}'); doc:=jsonb_build_object('title',trim(v->>'title'),'description',coalesce(v->>'description',''),'location',trim(v->>'location'),'category',coalesce(v->>'category','Meetup'),'capacity',cap);
 IF e.id IS NULL THEN answer:=finfolk_rpc.insert_event(p.id,doc,v->>'visibility',starts,ends,v->>'timezone',ctx); SELECT * INTO e FROM finfolk."Event" WHERE id=(answer->>'id')::uuid; revision:=1;
 ELSE UPDATE finfolk."Event" SET detail=doc,starts_at=starts,ends_at=ends,timezone=v->>'timezone',capacity=cap,visibility=(v->>'visibility')::finfolk."EnumEventVisibility",op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=e.id; END IF;
 UPDATE finfolk."Event" SET status=(v->>'state')::finfolk."EnumEventStatus" WHERE id=e.id;
 IF revision<>1 OR (v->>'id') IS NOT NULL THEN UPDATE finfolk."Rev" SET current=doc,index=index+1 WHERE id=e.rev_id AND class_table='Event' AND class_context='Global'; INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created) VALUES('Event','Global',e.rev_id,revision+1,doc,(ctx->>'id')::uuid,(ctx->>'time')::bigint); END IF;
 answer:=jsonb_build_object('id',e.id);
 ELSIF op IN('cancel','moderate') THEN
 IF op='moderate' AND NOT adm THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 UPDATE finfolk."EventInviteDelivery" SET state='cancelled',sealed_token='',lease=NULL,lease_until=0,error='' WHERE event_id=e.id AND state<>'sent';
 ctx:=finfolk.op_fn('event-'||op,actor,'{}');
 IF op='cancel' THEN UPDATE finfolk."Event" SET status='cancelled',op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=e.id; ELSE UPDATE finfolk."Event" SET hidden=true,op_updated=(ctx->>'id')::uuid,time_updated=(ctx->>'time')::bigint WHERE id=e.id; END IF;
 UPDATE finfolk."Rev" SET index=index+1 WHERE id=e.rev_id AND class_table='Event' AND class_context='Global' RETURNING index INTO revision;
 INSERT INTO finfolk."RevLog"(class_table,class_context,rev_id,version,deltas,op_created,time_created) VALUES('Event','Global',e.rev_id,revision,jsonb_build_object('event',op),(ctx->>'id')::uuid,(ctx->>'time')::bigint); answer:='{"ok":true}';
 ELSIF op='roster' THEN RETURN jsonb_build_object('attendees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(u.profile->>'displayName','Diver')) ORDER BY u.id) FROM finfolk."EventRsvp" r JOIN finfolk."User" u ON u.id=r.member_id AND NOT u.deleted WHERE r.event_id=e.id AND r.status='going'),'[]'),
 'invitations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'email',i.email,'expires',i.expires_at/1000,'revoked',i.status IN('expired','rejected'),'delivery',(SELECT jsonb_build_object('state',d.state,'attempts',d.attempts,'error',d.error) FROM finfolk."EventInviteDelivery" d WHERE d.event_id=e.id AND d.invite_id=i.id))) FROM finfolk."AccessInviteEmail" i WHERE i.class_table='Event' AND i.class_context='Global' AND i.access_id=e.access_id),'[]'));
 ELSIF op='invite-retry' THEN
 SELECT * INTO inv FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=(v->>'invite')::uuid; IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF; answer:=jsonb_build_object('id',inv.id,'delivery',coalesce((SELECT jsonb_build_object('state',d.state,'attempts',d.attempts,'error',d.error) FROM finfolk."EventInviteDelivery" d WHERE d.event_id=e.id AND d.invite_id=inv.id),jsonb_build_object('state','cancelled','attempts',0,'error','Delivery is no longer available.')));
 ELSIF op='invite' THEN
 mail:=lower(trim(coalesce(v->>'email','')));
 IF e.visibility<>'private' OR e.status<>'published' OR e.starts_at<=now_us OR length(mail)>254 OR mail !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN RAISE EXCEPTION 'Enter a valid private-event email' USING ERRCODE='22023'; END IF;
 ident:=coalesce((v->>'requestId')::uuid,uuid_generate_v4()); SELECT * INTO inv FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=ident;
 IF inv.id IS NOT NULL THEN IF inv.from_id IS DISTINCT FROM actor OR inv.email<>mail OR inv.detail->'send' IS DISTINCT FROM to_jsonb(coalesce((v->>'send')::boolean,false)) OR inv.status<>'pending' THEN RAISE EXCEPTION 'Invitation request already used' USING ERRCODE='40001'; END IF; RETURN jsonb_build_object('id',inv.id,'token','','expires',inv.expires_at/1000); END IF;
 IF (SELECT count(*) FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id)>=200 THEN RAISE EXCEPTION 'Invitation limit reached' USING ERRCODE='22023'; END IF;
 token:=encode(gen_random_bytes(32),'hex');
 INSERT INTO finfolk."AccessInviteEmail"(id,class_table,class_context,access_id,email,secret,from_id,expires_at,detail) VALUES(ident,'Event','Global',e.access_id,mail,encode(digest(token,'sha256'),'hex'),actor,least(e.starts_at,now_us+604800000000),jsonb_build_object('send',coalesce((v->>'send')::boolean,false))) RETURNING * INTO inv;
 answer:=jsonb_build_object('id',inv.id,'token',token,'expires',inv.expires_at/1000);
 ELSIF op='accept' THEN
 IF inv.status<>'pending' OR inv.expires_at<=now_us OR lower(trim(coalesce(current_setting('finfolk.event_email',true),'')))<>inv.email OR NOT finfolk_rpc.native_event_active(e) OR e.hidden OR e.status<>'published' THEN RAISE EXCEPTION 'Invitation unavailable for this account' USING ERRCODE='40001'; END IF;
 UPDATE finfolk."AccessInviteEmail" SET reply_id=actor,status='accepted',accepted_at=now_us WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=inv.id;
 answer:=jsonb_build_object('id',e.id);
 ELSIF op='revoke' THEN
 SELECT * INTO inv FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=(v->>'invite')::uuid FOR UPDATE;
 IF inv.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 UPDATE finfolk."AccessInviteEmail" SET status='expired' WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND email=inv.email;
 UPDATE finfolk."EventInviteDelivery" SET state='cancelled',sealed_token='',lease=NULL,lease_until=0,error='' WHERE event_id=e.id AND invite_id IN(SELECT id FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND email=inv.email) AND state<>'sent';
 UPDATE finfolk."EventRsvp" SET status='cancelled' WHERE event_id=e.id AND member_id IN(SELECT reply_id FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND email=inv.email);
 answer:='{"ok":true}';
 ELSIF op='rsvp' THEN
 IF coalesce(v->>'state','')='going' THEN
 IF NOT allowed OR NOT finfolk_rpc.native_event_active(e) OR e.hidden OR e.status<>'published' OR e.starts_at<=now_us THEN RAISE EXCEPTION 'Event is closed' USING ERRCODE='40001'; END IF;
 SELECT count(*) INTO n FROM finfolk."EventRsvp" WHERE event_id=e.id AND status='going' AND member_id<>actor;
 IF e.capacity IS NOT NULL AND n>=e.capacity THEN RAISE EXCEPTION 'Event is full' USING ERRCODE='40001'; END IF;
 ELSE IF coalesce(v->>'state','')<>'cancelled' OR (NOT allowed AND NOT EXISTS(SELECT 1 FROM finfolk."EventRsvp" WHERE event_id=e.id AND member_id=actor)) THEN RAISE EXCEPTION 'Invalid RSVP' USING ERRCODE='22023'; END IF; END IF;
 INSERT INTO finfolk."EventRsvp"(event_id,member_id,status) VALUES(e.id,actor,(v->>'state')::finfolk."EnumEventRsvpStatus") ON CONFLICT(event_id,member_id) DO UPDATE SET status=excluded.status;
 answer:='{"ok":true}';
 ELSE RAISE EXCEPTION 'Unknown event operation' USING ERRCODE='22023'; END IF;
 IF ctx IS NULL THEN ctx:=finfolk.op_fn('event-'||op,actor,'{}'); END IF;
 IF op<>'save' OR (v->>'id') IS NOT NULL THEN INSERT INTO finfolk."AuditLog"(class_table,class_context,audit_id,entry,op_created,time_created) VALUES('Event','Global',e.audit_id,jsonb_build_object('event',op,'actor',actor),(ctx->>'id')::uuid,(ctx->>'time')::bigint); END IF;
 RETURN answer;
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_delivery_row(d finfolk."EventInviteDelivery") RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('state',d.state,'attempts',d.attempts,'error',d.error); $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_event_delivery_operation(op text,actor uuid,i_event uuid,invite uuid,token text,seal_key text,lease_id uuid,outcome text,receipt_id text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE e finfolk."Event"; i finfolk."AccessInviteEmail"; delivery finfolk."EventInviteDelivery"; clock bigint:=(extract(epoch from clock_timestamp())*1000000)::bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
 SELECT * INTO e FROM finfolk."Event" WHERE id=i_event FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM finfolk."User" WHERE id=actor AND NOT deleted AND email_verified) OR e.id IS NULL OR NOT finfolk_rpc.native_event_manager(e,actor) THEN RAISE EXCEPTION 'Event manager required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM finfolk."AccessInviteEmail" WHERE class_table='Event' AND class_context='Global' AND access_id=e.access_id AND id=invite FOR UPDATE;
 IF i.id IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
 SELECT * INTO delivery FROM finfolk."EventInviteDelivery" q WHERE q.event_id=e.id AND q.invite_id=i.id FOR UPDATE;
 clock:=(extract(epoch from clock_timestamp())*1000000)::bigint;
 IF op='enqueue' THEN
 IF length(coalesce(seal_key,''))<32 OR length(seal_key)>512 OR i.from_id IS DISTINCT FROM actor OR i.secret IS DISTINCT FROM encode(digest(token,'sha256'),'hex') OR i.status<>'pending' OR i.expires_at<=clock THEN RAISE EXCEPTION 'Invalid delivery work' USING ERRCODE='22023'; END IF;
 IF delivery.id IS NULL THEN INSERT INTO finfolk."EventInviteDelivery"(event_id,invite_id,requester_id,sealed_token) VALUES(e.id,i.id,actor,encode(pgp_sym_encrypt(token,seal_key),'hex')) RETURNING * INTO delivery; END IF;
 RETURN finfolk_rpc.native_event_delivery_row(delivery);
 END IF;
 IF delivery.id IS NULL THEN RETURN jsonb_build_object('state','cancelled','attempts',0,'error','Delivery is no longer available.'); END IF;
 IF op='complete' THEN
 IF delivery.state<>'sending' OR delivery.lease IS DISTINCT FROM lease_id THEN RETURN finfolk_rpc.native_event_delivery_row(delivery); END IF;
 IF NOT coalesce(outcome=ANY(ARRAY['sent','failed']),false) THEN RAISE EXCEPTION 'Invalid delivery outcome' USING ERRCODE='22023'; END IF;
 UPDATE finfolk."EventInviteDelivery" SET state=outcome,receipt=CASE WHEN outcome='sent' THEN left(coalesce(receipt_id,''),200) ELSE '' END,error=CASE WHEN outcome='failed' THEN 'Email could not be delivered. Retry this invitation.' ELSE '' END,sealed_token=CASE WHEN outcome='sent' OR delivery.attempts>=5 THEN '' ELSE sealed_token END,lease=NULL,lease_until=0,time_updated=clock WHERE id=delivery.id RETURNING * INTO delivery;
 RETURN finfolk_rpc.native_event_delivery_row(delivery);
 END IF;
 IF op<>'claim' THEN RAISE EXCEPTION 'Unknown delivery operation' USING ERRCODE='22023'; END IF;
 IF delivery.state IN('sent','cancelled') THEN RETURN finfolk_rpc.native_event_delivery_row(delivery); END IF;
 IF i.status<>'pending' OR i.expires_at<=clock OR e.status<>'published' OR e.hidden OR e.starts_at<=clock OR NOT finfolk_rpc.native_event_active(e) THEN UPDATE finfolk."EventInviteDelivery" SET state='cancelled',sealed_token='',lease=NULL,lease_until=0,error='',time_updated=clock WHERE id=delivery.id RETURNING * INTO delivery; RETURN finfolk_rpc.native_event_delivery_row(delivery); END IF;
 IF delivery.state='sending' AND delivery.lease_until>clock THEN RETURN finfolk_rpc.native_event_delivery_row(delivery); END IF;
 IF delivery.attempts>=5 THEN UPDATE finfolk."EventInviteDelivery" SET state='failed',sealed_token='',error='Maximum delivery attempts reached.',lease=NULL,lease_until=0,time_updated=clock WHERE id=delivery.id RETURNING * INTO delivery; RETURN finfolk_rpc.native_event_delivery_row(delivery); END IF;
 IF length(coalesce(seal_key,''))<32 OR lease_id IS NULL THEN RAISE EXCEPTION 'Delivery configuration unavailable' USING ERRCODE='22023'; END IF;
 token:=pgp_sym_decrypt(decode(delivery.sealed_token,'hex'),seal_key);
 IF encode(digest(token,'sha256'),'hex') IS DISTINCT FROM i.secret THEN RAISE EXCEPTION 'Invitation changed' USING ERRCODE='40001'; END IF;
 UPDATE finfolk."EventInviteDelivery" SET state='sending',attempts=attempts+1,lease=lease_id,lease_until=clock+60000000,error='',time_updated=clock WHERE id=delivery.id RETURNING * INTO delivery;
 RETURN finfolk_rpc.native_event_delivery_row(delivery)||jsonb_build_object('id',delivery.id,'email',i.email,'token',token,'title',e.detail->>'title');
END $$;
-- Public atlas projection from canonical native entities. Private payload keys never cross the boundary.
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_row(i_site uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE p finfolk."SiteProfile"; s finfolk."Site"; point jsonb;
BEGIN
 SELECT * INTO p FROM finfolk."SiteProfile" WHERE site_id=i_site AND status='published';
 SELECT * INTO s FROM finfolk."Site" WHERE id=i_site;
 IF p.id IS NULL OR s.id IS NULL THEN RETURN NULL; END IF;
 point:=p.payload->'point';
 IF jsonb_typeof(point) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
 IF jsonb_array_length(point)<>2 OR jsonb_typeof(point->0)<>'number' OR jsonb_typeof(point->1)<>'number' THEN RETURN NULL; END IF;
 IF abs((point->>0)::numeric)>180 OR abs((point->>1)::numeric)>85 THEN RETURN NULL; END IF;
 RETURN coalesce((SELECT jsonb_object_agg(key,value) FROM jsonb_each(p.payload) WHERE key=ANY(ARRAY['description','archived','features','requirements','restrictions','timezone','source_url','timezone_provenance','name','reference_label','booking_url','state','access_mode','activity_status','region','coordinate_purpose','licence','area_id','id','attribution','point','depth_evidence','activities','aliases','area_name','coordinate_provenance','facts','source_id','access_points','reviewed_at','waterbody','state_id'])),'{}'::jsonb)||jsonb_build_object('id',s.id,'name',s.name,'timezone',s.timezone,'state',s.state,'state_id',s.state,'area_name',s.area_name,
 'area_id',coalesce(nullif(p.payload->>'area_id',''),s.state||'-native'),'point',point,'region',coalesce(p.payload->>'region','site-'||s.id::text),
 'waterbody',p.waterbody,'access_mode',p.access_mode,'revision',p.revision,'catalog_managed',true,
 'description',left(coalesce(p.payload->>'description',''),2000),
 'source_url',CASE WHEN p.payload->>'source_url' ~ '^https://[^/@[:space:]]+([/:?#]|$)' THEN left(p.payload->>'source_url',2048) ELSE '' END,'source_id',left(coalesce(p.payload->>'source_id','native-reviewed-sites'),128),'reference_label',left(coalesce(p.payload->>'reference_label',s.name),200),'attribution',left(coalesce(p.payload->>'attribution',''),2000),'licence',left(coalesce(p.payload->>'licence',''),500),
 'aliases',coalesce((SELECT jsonb_agg(value) FROM (SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.payload->'aliases')='array' THEN p.payload->'aliases' ELSE '[]' END) WHERE jsonb_typeof(value)='string' LIMIT 20) q),'[]'::jsonb),
 'features',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.payload->'features')='array' THEN p.payload->'features' ELSE '[]' END) WHERE value #>> '{}' IN('beach','reef','wreck','wall','training')),'[]'::jsonb),
 'activities',coalesce((SELECT jsonb_agg(value) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.payload->'activities')='array' THEN p.payload->'activities' ELSE '[]' END) WHERE value #>> '{}' IN('freediving','ocean-swimming','spearfishing')),'[]'::jsonb));
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_catalog() RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH rows AS MATERIALIZED (SELECT finfolk_rpc.native_site_row(site_id) value FROM finfolk."SiteProfile" WHERE status='published'), published AS (SELECT value FROM rows WHERE value IS NOT NULL)
 SELECT jsonb_build_object('revision',coalesce((SELECT revision FROM finfolk."SiteCatalog" WHERE singleton),0),
 'beaches',coalesce((SELECT jsonb_agg(value ORDER BY lower(value->>'name'),value->>'id') FROM published),'[]'::jsonb),
 'states',coalesce((SELECT jsonb_agg(jsonb_build_object('id',state,'name',state) ORDER BY state) FROM (SELECT DISTINCT value->>'state_id' state FROM published) states),'[]'::jsonb),
 'areas',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'name',name,'state_id',state,'center',jsonb_build_array(x,y)) ORDER BY id) FROM (SELECT value->>'area_id' id,min(value->>'area_name') name,min(value->>'state_id') state,avg((value->'point'->>0)::numeric) x,avg((value->'point'->>1)::numeric) y FROM published GROUP BY value->>'area_id') areas),'[]'::jsonb),
 'sources','[]'::jsonb,'location_note','Published native dive sites. Reference maps and their attribution are shown separately.');
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_detail(i_site uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE answer jsonb; BEGIN answer:=finfolk_rpc.native_site_row(i_site); IF answer IS NULL THEN RAISE EXCEPTION 'Dive site unavailable' USING ERRCODE='P0002'; END IF; RETURN answer; END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_discover_popular() RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('places',coalesce(jsonb_agg(site_id ORDER BY members DESC,site_id),'[]'::jsonb)) FROM (
 SELECT c.site_id,count(DISTINCT u.id) members FROM finfolk."UserCheckin" c JOIN finfolk."User" u ON u.id=c.user_id
 JOIN finfolk."Site" s ON s.id=c.site_id WHERE NOT u.deleted AND u.email_verified AND u.profile->>'open'='true'
 AND c.visit_day<= (now() AT TIME ZONE s.timezone)::date AND c.visit_day>(now() AT TIME ZONE s.timezone)::date-30
 AND finfolk_rpc.native_site_row(s.id) IS NOT NULL GROUP BY c.site_id HAVING count(DISTINCT u.id)>=3 ORDER BY members DESC,c.site_id LIMIT 12) spots;
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_url(value text,required boolean DEFAULT false) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
 IF value IS NULL OR value='' THEN IF required THEN RAISE EXCEPTION 'A source URL is required' USING ERRCODE='22023'; END IF; RETURN ''; END IF;
 IF length(value)>2048 OR value !~ '^https://[^/@[:space:]]+([/:?#]|$)' OR value ~ '[[:space:]]' THEN RAISE EXCEPTION 'Use a valid HTTPS source URL' USING ERRCODE='22023'; END IF; RETURN value;
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_point(value jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN IF jsonb_typeof(value) IS DISTINCT FROM 'array' THEN RETURN false; END IF; IF jsonb_array_length(value)<>2 THEN RETURN false; END IF; IF jsonb_typeof(value->0)<>'number' OR jsonb_typeof(value->1)<>'number' THEN RETURN false; END IF; RETURN abs((value->>0)::numeric)<=180 AND abs((value->>1)::numeric)<=85; END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_document(d jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE item jsonb; field text; doc jsonb; allowed text[]:=ARRAY['description','archived','features','requirements','restrictions','timezone','source_url','timezone_provenance','name','reference_label','booking_url','state','access_mode','activity_status','region','coordinate_purpose','licence','area_id','id','attribution','point','depth_evidence','activities','aliases','area_name','coordinate_provenance','facts','source_id','access_points','reviewed_at','waterbody','state_id'];
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Enter site details' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE NOT k=ANY(allowed)) THEN RAISE EXCEPTION 'Unknown site field' USING ERRCODE='22023'; END IF;
 FOREACH field IN ARRAY ARRAY['id','name','state_id','area_name','timezone','source_url'] LOOP IF jsonb_typeof(d->field) IS DISTINCT FROM 'string' OR length(trim(d->>field))=0 THEN RAISE EXCEPTION 'Required site field missing' USING ERRCODE='22023'; END IF; END LOOP;
 FOREACH field IN ARRAY allowed LOOP IF d ? field AND NOT field=ANY(ARRAY['point','archived','features','activities','aliases','access_points','depth_evidence','facts','restrictions']) AND jsonb_typeof(d->field)<>'string' THEN RAISE EXCEPTION 'Invalid site field' USING ERRCODE='22023'; END IF; END LOOP;
 IF d->>'id' !~ '^[a-z0-9][a-z0-9_-]{0,127}$' OR length(d->>'name')>160 OR length(d->>'area_name')>120 OR NOT d->>'state_id'=ANY(ARRAY['VIC','NSW','JBT','QLD','SA','WA','NT','TAS','ACT','EXT']) OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=d->>'timezone') OR NOT finfolk_rpc.native_site_point(d->'point') THEN RAISE EXCEPTION 'Check site identity, timezone and coordinates' USING ERRCODE='22023'; END IF;
 doc:='{"waterbody":"unknown","access_mode":"unknown","features":[],"activities":[],"aliases":[],"access_points":[],"depth_evidence":[],"facts":[],"restrictions":[],"archived":false,"activity_status":"unknown","coordinate_purpose":"reference"}'::jsonb||d;
 IF NOT coalesce(doc->>'waterbody'=ANY(ARRAY['ocean','lake','river','quarry','sinkhole','pool','unknown']),false) OR NOT coalesce(doc->>'access_mode'=ANY(ARRAY['shore','boat_only','shore_or_boat','unknown']),false) OR NOT coalesce(doc->>'activity_status'=ANY(ARRAY['documented','unknown']),false) OR NOT coalesce(doc->>'coordinate_purpose'=ANY(ARRAY['reference','entry','dive']),false) OR jsonb_typeof(doc->'archived')<>'boolean' THEN RAISE EXCEPTION 'Invalid site categories' USING ERRCODE='22023'; END IF;
 PERFORM finfolk_rpc.native_site_url(doc->>'source_url',true); PERFORM finfolk_rpc.native_site_url(doc->>'booking_url',false);
 FOREACH field IN ARRAY ARRAY['features','activities','aliases','access_points','depth_evidence','facts','restrictions'] LOOP IF jsonb_typeof(doc->field)<>'array' THEN RAISE EXCEPTION 'Site records must be lists' USING ERRCODE='22023'; END IF; IF jsonb_array_length(doc->field)>(CASE WHEN field='facts' THEN 40 ELSE 20 END) THEN RAISE EXCEPTION 'Too many site records' USING ERRCODE='22023'; END IF; END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'features') a WHERE NOT a #>> '{}'=ANY(ARRAY['beach','reef','wreck','wall','training'])) OR EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'activities') a WHERE NOT a #>> '{}'=ANY(ARRAY['freediving','ocean-swimming','spearfishing'])) OR EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'aliases') a WHERE jsonb_typeof(a)<>'string' OR length(a #>> '{}')>160) THEN RAISE EXCEPTION 'Invalid site lists' USING ERRCODE='22023'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(doc->'access_points') LOOP
 IF jsonb_typeof(item)<>'object' OR NOT coalesce(item->>'mode'=ANY(ARRAY['shore','departure']),false) OR length(trim(coalesce(item->>'name','')))=0 OR length(item->>'name')>160 OR NOT finfolk_rpc.native_site_point(item->'point') OR (doc->>'access_mode'='boat_only' AND item->>'mode'='shore') THEN RAISE EXCEPTION 'Check access point details' USING ERRCODE='22023'; END IF;
 IF NOT ARRAY(SELECT jsonb_object_keys(item)) <@ ARRAY['mode','name','point','source_url','booking_url','notes','verified'] THEN RAISE EXCEPTION 'Unknown access point field' USING ERRCODE='22023'; END IF;
 PERFORM finfolk_rpc.native_site_url(item->>'source_url',true); PERFORM finfolk_rpc.native_site_url(item->>'booking_url',false);
 IF item ? 'verified' AND jsonb_typeof(item->'verified')<>'boolean' THEN RAISE EXCEPTION 'Invalid access verification' USING ERRCODE='22023'; END IF; END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(doc->'depth_evidence') LOOP
 IF jsonb_typeof(item)<>'object' OR NOT coalesce(item->>'kind'=ANY(ARRAY['reported','surveyed']),false) OR jsonb_typeof(item->'depth_m') IS DISTINCT FROM 'number' OR (item->>'depth_m')::numeric<=0 OR (item->>'depth_m')::numeric>1500 OR length(trim(coalesce(item->>'reference','')))=0 THEN RAISE EXCEPTION 'Check depth evidence' USING ERRCODE='22023'; END IF; IF NOT ARRAY(SELECT jsonb_object_keys(item)) <@ ARRAY['kind','depth_m','reference','source_url','reviewed_at','vertical_datum','datum_type','uncertainty_m'] THEN RAISE EXCEPTION 'Unknown depth field' USING ERRCODE='22023'; END IF; PERFORM finfolk_rpc.native_site_url(item->>'source_url',true); END LOOP;
 FOR item IN SELECT value FROM jsonb_array_elements(doc->'facts') UNION ALL SELECT value FROM jsonb_array_elements(doc->'restrictions') LOOP
 IF jsonb_typeof(item)<>'object' OR length(trim(coalesce(item->>'text','')))=0 OR length(item->>'text')>2000 OR length(trim(coalesce(item->>'label',item->>'activity','')))=0 THEN RAISE EXCEPTION 'Check source-backed facts' USING ERRCODE='22023'; END IF;
 IF NOT ARRAY(SELECT jsonb_object_keys(item)) <@ (CASE WHEN item ? 'activity' THEN ARRAY['activity','status','text','source_url','reviewed_at'] ELSE ARRAY['label','text','source_url','reviewed_at'] END) THEN RAISE EXCEPTION 'Unknown site fact field' USING ERRCODE='22023'; END IF; IF item ? 'activity' AND NOT coalesce(item->>'status'=ANY(ARRAY['restricted','closed','unknown']),false) THEN RAISE EXCEPTION 'Check restriction status' USING ERRCODE='22023'; END IF; PERFORM finfolk_rpc.native_site_url(item->>'source_url',true); END LOOP;
 RETURN doc||jsonb_build_object('name',trim(doc->>'name'),'area_name',trim(doc->>'area_name'),'area_id',coalesce(nullif(doc->>'area_id',''),lower(doc->>'state_id')||'-'||trim(both '-' from regexp_replace(lower(doc->>'area_name'),'[^a-z0-9]+','-','g'))));
END $$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_draft_row(r finfolk."SiteRevision") RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',r.id,'site_id',r.site_id,'site_key',r.site_key,'owner_id',r.owner_id,'import_id',r.import_id,'base_revision',r.base_revision,'version',r.version,'status',r.status,'payload',r.payload,'reason',r.reason,'reviewed_by',r.reviewed_by_id,'created_at',finfolk.as_iso_time(r.time_created),'updated_at',finfolk.as_iso_time(r.time_updated));
$$;
CREATE OR REPLACE FUNCTION finfolk_rpc.native_site_review_operation(op text,v jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE actor uuid:=finfolk.auth_uid(); verified boolean:=coalesce(current_setting('finfolk.site_verified',true),'')='true'; adm boolean:=coalesce(current_setting('finfolk.site_admin',true),'')='true'; r finfolk."SiteRevision"; s finfolk."Site"; p finfolk."SiteProfile"; doc jsonb; ctx jsonb; ident uuid; site_key text; base bigint; clock bigint:=(extract(epoch from clock_timestamp())*1000000)::bigint;
BEGIN
 IF actor IS NULL OR NOT verified OR NOT EXISTS(SELECT 1 FROM finfolk."User" WHERE id=actor AND NOT deleted) THEN RAISE EXCEPTION 'Verified member required' USING ERRCODE='42501'; END IF;
 IF op='mine' THEN RETURN jsonb_build_object('admin',adm,'submissions',coalesce((SELECT jsonb_agg(finfolk_rpc.native_site_draft_row(q) ORDER BY q.time_updated DESC,q.id) FROM (SELECT * FROM finfolk."SiteRevision" WHERE owner_id=actor ORDER BY time_updated DESC,id LIMIT 100) q),'[]'::jsonb)); END IF;
 IF op NOT IN('submit','withdraw') AND NOT adm THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF op='admin' THEN RETURN jsonb_build_object('drafts',coalesce((SELECT jsonb_agg(finfolk_rpc.native_site_draft_row(q) ORDER BY q.time_updated DESC,q.id) FROM (SELECT * FROM finfolk."SiteRevision" ORDER BY time_updated DESC,id LIMIT 200) q),'[]'::jsonb),'imports','[]'::jsonb); END IF;
 IF op IN('save','submit') THEN
 doc:=finfolk_rpc.native_site_document(v->'site'); site_key:=doc->>'id';
 PERFORM pg_advisory_xact_lock(hashtextextended('site-key:'||site_key,0));
 SELECT * INTO s FROM finfolk."Site" WHERE key=site_key OR id::text=site_key;
 IF s.id IS NOT NULL THEN doc:=doc||jsonb_build_object('id',s.id); END IF;
 ident:=coalesce((v->>'id')::uuid,(v->>'requestId')::uuid,uuid_generate_v4()); SELECT * INTO r FROM finfolk."SiteRevision" WHERE id=ident FOR UPDATE;
 IF r.id IS NOT NULL THEN
 IF NOT adm AND r.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Submission unavailable' USING ERRCODE='42501'; END IF;
 IF NOT (v ? 'id') THEN IF r.owner_id IS DISTINCT FROM actor OR r.payload IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Draft request already used' USING ERRCODE='40001'; END IF; RETURN finfolk_rpc.native_site_draft_row(r); END IF;
 IF r.status NOT IN('draft','submitted') OR r.version IS DISTINCT FROM (v->>'version')::bigint OR r.payload->>'id' IS DISTINCT FROM doc->>'id' THEN RAISE EXCEPTION 'Draft changed; reload before editing' USING ERRCODE='40001'; END IF;
 UPDATE finfolk."SiteRevision" SET payload=doc,version=version+1,status=CASE WHEN op='submit' THEN 'submitted'::finfolk."EnumSiteRevisionStatus" ELSE 'draft'::finfolk."EnumSiteRevisionStatus" END,reason='',time_updated=clock WHERE id=r.id RETURNING * INTO r;
 ELSE
 IF v ? 'id' THEN RAISE EXCEPTION 'Submission unavailable' USING ERRCODE='P0002'; END IF;
 IF (SELECT count(*) FROM finfolk."SiteRevision" WHERE owner_id=actor AND status IN('draft','submitted'))>=20 THEN RAISE EXCEPTION 'Review pending submissions before adding more' USING ERRCODE='22023'; END IF;
 SELECT revision INTO base FROM finfolk."SiteProfile" WHERE site_id=s.id;
 INSERT INTO finfolk."SiteRevision"(id,site_id,site_key,owner_id,base_revision,version,status,payload,time_created,time_updated) VALUES(ident,s.id,site_key,actor,coalesce(base,0),1,CASE WHEN op='submit' THEN 'submitted'::finfolk."EnumSiteRevisionStatus" ELSE 'draft'::finfolk."EnumSiteRevisionStatus" END,doc,clock,clock) RETURNING * INTO r;
 END IF;
 DELETE FROM finfolk."SiteAccessPoint" WHERE revision_id=r.id; DELETE FROM finfolk."SiteDepthEvidence" WHERE revision_id=r.id;
 INSERT INTO finfolk."SiteAccessPoint"(revision_id,mode,payload) SELECT r.id,(value->>'mode')::finfolk."EnumSiteAccessPointMode",value FROM jsonb_array_elements(doc->'access_points');
 INSERT INTO finfolk."SiteDepthEvidence"(revision_id,kind,payload) SELECT r.id,(value->>'kind')::finfolk."EnumSiteDepthEvidenceType",value FROM jsonb_array_elements(doc->'depth_evidence');
 PERFORM finfolk.op_fn('site-'||op,actor,jsonb_build_object('draft',r.id,'version',r.version)); RETURN finfolk_rpc.native_site_draft_row(r);
 END IF;
 IF op='publish' THEN PERFORM pg_advisory_xact_lock(hashtextextended('native-site-publication',0)); END IF;
 SELECT * INTO r FROM finfolk."SiteRevision" WHERE id=(v->>'id')::uuid;
 IF r.id IS NULL THEN RAISE EXCEPTION 'Submission unavailable' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('site-key:'||r.site_key,0)); SELECT * INTO r FROM finfolk."SiteRevision" WHERE id=r.id FOR UPDATE;
 IF op='withdraw' AND r.owner_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Submission unavailable' USING ERRCODE='42501'; END IF;
 IF op='publish' AND r.status='published' AND r.version=(v->>'version')::bigint+1 THEN RETURN jsonb_build_object('ok',true,'site',r.site_id,'revision',r.base_revision+1); END IF;
 IF r.version IS DISTINCT FROM (v->>'version')::bigint OR r.status NOT IN('draft','submitted') THEN RAISE EXCEPTION 'Submission changed; reload before reviewing' USING ERRCODE='40001'; END IF;
 IF op='withdraw' THEN UPDATE finfolk."SiteRevision" SET status='withdrawn',version=version+1,time_updated=clock WHERE id=r.id; RETURN '{"ok":true}'; END IF;
 IF op='reject' THEN IF length(trim(coalesce(v->>'reason','')))=0 OR length(v->>'reason')>2000 THEN RAISE EXCEPTION 'A review reason is required' USING ERRCODE='22023'; END IF; UPDATE finfolk."SiteRevision" SET status='rejected',reason=trim(v->>'reason'),reviewed_by_id=actor,version=version+1,time_updated=clock WHERE id=r.id; RETURN '{"ok":true}'; END IF;
 IF op<>'publish' THEN RAISE EXCEPTION 'Unknown site operation' USING ERRCODE='22023'; END IF;
 IF r.import_id IS NOT NULL THEN RAISE EXCEPTION 'Publish this record with its import batch' USING ERRCODE='40001'; END IF;
 doc:=finfolk_rpc.native_site_document(r.payload);
 SELECT * INTO s FROM finfolk."Site" WHERE id=r.site_id OR key=r.site_key OR id::text=r.site_key FOR UPDATE;
 SELECT * INTO p FROM finfolk."SiteProfile" WHERE site_id=s.id FOR UPDATE;
 IF r.base_revision<>coalesce(p.revision,0) THEN RAISE EXCEPTION 'Published site changed; refresh the draft' USING ERRCODE='40001'; END IF;
 IF s.id IS NULL THEN INSERT INTO finfolk."Site"(key,name,timezone,state,area_name) VALUES(r.site_key,doc->>'name',doc->>'timezone',doc->>'state_id',doc->>'area_name') RETURNING * INTO s;
 ELSE UPDATE finfolk."Site" SET name=doc->>'name',timezone=doc->>'timezone',state=doc->>'state_id',area_name=doc->>'area_name' WHERE id=s.id; END IF;
 doc:=doc||jsonb_build_object('id',s.id); base:=coalesce(p.revision,0)+1;
 INSERT INTO finfolk."SiteProfile"(site_id,revision,waterbody,access_mode,status,payload,time_updated) VALUES(s.id,base,(doc->>'waterbody')::finfolk."EnumSiteProfileWaterbody",(doc->>'access_mode')::finfolk."EnumSiteProfileAccessMode",CASE WHEN (doc->>'archived')::boolean THEN 'archived'::finfolk."EnumSiteProfileStatus" ELSE 'published'::finfolk."EnumSiteProfileStatus" END,doc,clock)
 ON CONFLICT(site_id) DO UPDATE SET revision=excluded.revision,waterbody=excluded.waterbody,access_mode=excluded.access_mode,status=excluded.status,payload=excluded.payload,time_updated=excluded.time_updated;
 INSERT INTO finfolk."SiteCatalog"(singleton,revision,metadata) VALUES(true,1,'{}') ON CONFLICT(singleton) DO UPDATE SET revision=finfolk."SiteCatalog".revision+1;
 UPDATE finfolk."SiteRevision" SET site_id=s.id,payload=doc,status='published',version=version+1,reviewed_by_id=actor,time_updated=clock WHERE id=r.id;
 PERFORM finfolk.op_fn('site-publish',actor,jsonb_build_object('draft',r.id,'site',s.id,'revision',base));
 RETURN jsonb_build_object('ok',true,'site',s.id,'revision',base);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA finfolk FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_api;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_directory') THEN CREATE ROLE finfolk_directory NOLOGIN NOINHERIT; END IF; END $$;
GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_directory;
GRANT SELECT,INSERT,UPDATE ON finfolk."DirectoryRun",finfolk."DirectoryListing",finfolk."DirectoryReport",finfolk."Access",finfolk."AccessRole",finfolk."AccessRequest",finfolk."AccessInviteExternal",finfolk."Rev",finfolk."RevLog",finfolk."Audit",finfolk."AuditLog",finfolk."Social",finfolk."Op",finfolk."User",finfolk."Activity",finfolk."ActivityLog" TO finfolk_directory;
GRANT EXECUTE ON FUNCTION finfolk.auth_uid(),finfolk.as_jsonb(jsonb),finfolk.op_fn(text,uuid,jsonb),finfolk.insert_base_addons(text,uuid,jsonb,jsonb),finfolk.ret_social_url(text),finfolk.ret_social_urls(jsonb),finfolk_rpc.insert_user(uuid,jsonb,jsonb),finfolk_rpc.insert_directory_listing(jsonb,jsonb),finfolk_rpc.ret_directory_public(uuid),finfolk_rpc.account_portrait(text),finfolk_rpc.account_link(text,text),finfolk_rpc.directory_socials(jsonb),finfolk_rpc.directory_document(jsonb),finfolk_rpc.directory_owner_row(finfolk."DirectoryListing"),finfolk_rpc.directory_operation(text,jsonb) TO finfolk_directory;
COMMIT;
