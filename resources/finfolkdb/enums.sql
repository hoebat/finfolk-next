-- Generated from finfolkdb.common.type-domain-enum.
CREATE SCHEMA IF NOT EXISTS finfolk;


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
$$ LANGUAGE 'plpgsql';DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteAccessPointMode') IS DISTINCT FROM ARRAY['shore','departure']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteAccessPointMode'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramActionType') IS DISTINCT FROM ARRAY['reply','stats','dive','points']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramActionType'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramCommandStatus') IS DISTINCT FROM ARRAY['new','confirmation','done','cancelled','limited']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramCommandStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumEventVisibility') IS DISTINCT FROM ARRAY['public','private']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumEventVisibility'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramClaimStatus') IS DISTINCT FROM ARRAY['waiting','checking','follow_required','failed','review_requested','claimed','cancelled']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramClaimStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteDepthEvidenceType') IS DISTINCT FROM ARRAY['surveyed','reported']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteDepthEvidenceType'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSocialPostReportStatus') IS DISTINCT FROM ARRAY['open','resolved']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSocialPostReportStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumDirectoryClaimStatus') IS DISTINCT FROM ARRAY['pending','approved','rejected']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumDirectoryClaimStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramCommandContext') IS DISTINCT FROM ARRAY['mention','owned']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramCommandContext'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSocialPostStatus') IS DISTINCT FROM ARRAY['pending','approved','rejected','removed']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSocialPostStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramPostReportReason') IS DISTINCT FROM ARRAY['wrong_location','inappropriate','removed','other']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramPostReportReason'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumTiktokConnectionStatus') IS DISTINCT FROM ARRAY['pending','connected','disconnected','reconnect']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumTiktokConnectionStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumMediaImportStatus') IS DISTINCT FROM ARRAY['active','hidden']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumMediaImportStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteRevisionStatus') IS DISTINCT FROM ARRAY['draft','submitted','published','rejected','withdrawn']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteRevisionStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumEventStatus') IS DISTINCT FROM ARRAY['draft','published','cancelled']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumEventStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteProfileWaterbody') IS DISTINCT FROM ARRAY['ocean','lake','river','quarry','sinkhole','pool','unknown']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteProfileWaterbody'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramCommandSendState') IS DISTINCT FROM ARRAY['pending','sending','sent','uncertain','skipped']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramCommandSendState'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumDirectoryListingStatus') IS DISTINCT FROM ARRAY['candidate','published','rejected','archived','suppressed']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumDirectoryListingStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramDiscoveryStatus') IS DISTINCT FROM ARRAY['pending','published','hidden','rejected','unavailable']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramDiscoveryStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumMessagingOutboxReplyKind') IS DISTINCT FROM ARRAY['text','connect_code','connect_guidance']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumMessagingOutboxReplyKind'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumUserConnectionStatus') IS DISTINCT FROM ARRAY['pending','accepted','declined','removed']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumUserConnectionStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSocialReferralPlatform') IS DISTINCT FROM ARRAY['instagram','tiktok']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSocialReferralPlatform'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteProfileStatus') IS DISTINCT FROM ARRAY['published','archived']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteProfileStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumMediaImportPlatform') IS DISTINCT FROM ARRAY['instagram','tiktok']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumMediaImportPlatform'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumMessagingAccountMode') IS DISTINCT FROM ARRAY['disabled','pilot','live']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumMessagingAccountMode'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumTripImportStatus') IS DISTINCT FROM ARRAY['uploading','complete']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumTripImportStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumInstagramSourceType') IS DISTINCT FROM ARRAY['tags','hashtag','recheck']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumInstagramSourceType'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteDepthDatasetRelationship') IS DISTINCT FROM ARRAY['candidate','confirmed']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteDepthDatasetRelationship'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumEnvironmentTargetProduct') IS DISTINCT FROM ARRAY['weather','marine','tides']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumEnvironmentTargetProduct'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteProfileAccessMode') IS DISTINCT FROM ARRAY['shore','boat_only','shore_or_boat','unknown']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteProfileAccessMode'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumDepthDatasetStatus') IS DISTINCT FROM ARRAY['staged','published','superseded']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumDepthDatasetStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumSiteImportStatus') IS DISTINCT FROM ARRAY['draft','published']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumSiteImportStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumMessagingOutboxStatus') IS DISTINCT FROM ARRAY['pending','sending','provider_accepted','failed','uncertain','cancelled','expired']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumMessagingOutboxStatus'; END IF; END $$;
DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname='EnumEventRsvpStatus') IS DISTINCT FROM ARRAY['going','cancelled']::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: EnumEventRsvpStatus'; END IF; END $$;
