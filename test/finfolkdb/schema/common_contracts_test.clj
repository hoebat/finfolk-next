(ns finfolkdb.schema.common-contracts-test
  (:use code.test)
  (:require [finfolkbuild.testing.common :as common]
            [finfolkdb.schema.namespaces :as namespaces]))
(fact "all common declarations match the installed local schema"
  (do
    (namespaces/load-all!)
    (every?
     common/check!
     '[finfolkdb.common.type-media-import/MediaImport finfolkdb.common.type-site-base/SiteCatalog
       finfolkdb.common.type-site-base/SiteProfile finfolkdb.common.type-site-base/SiteImport
       finfolkdb.common.type-site-base/SiteRevision finfolkdb.common.type-site-base/SiteAccessPoint
       finfolkdb.common.type-site-base/SiteDepthEvidence
       finfolkdb.common.type-site-base/SiteDepthDataset
       finfolkdb.common.type-site-base/SiteTideStation
       finfolkdb.common.type-user-activity/EnumActionType
       finfolkdb.common.type-user-activity/ActivityLog finfolkdb.common.type-event/Event
       finfolkdb.common.type-event/EventRsvp finfolkdb.common.type-system-base/Op
       finfolkdb.common.type-system-base/Rev finfolkdb.common.type-system-base/RevLog
       finfolkdb.common.type-system-base/Audit finfolkdb.common.type-system-base/AuditLog
       finfolkdb.common.type-system-base/sel-rev-all
       finfolkdb.common.type-system-base/ret-rev-default finfolkdb.common.type-system-base/Activity
       finfolkdb.common.type-system-base/op-fn finfolkdb.common.type-social-base/Social
       finfolkdb.common.type-social-base/EnumSocialHandleType
       finfolkdb.common.type-social-base/SocialHandle
       finfolkdb.common.type-social-base/ret-social-url
       finfolkdb.common.type-social-base/ret-social-urls
       finfolkdb.common.type-social-instagram/InstagramSource
       finfolkdb.common.type-social-instagram/InstagramSuppressedSource
       finfolkdb.common.type-social-instagram/InstagramAction
       finfolkdb.common.type-social-instagram/InstagramAudit
       finfolkdb.common.type-social-instagram/InstagramConnection
       finfolkdb.common.type-social-instagram/InstagramClaim
       finfolkdb.common.type-social-instagram/InstagramCommentIdentity
       finfolkdb.common.type-social-instagram/InstagramDiscovery
       finfolkdb.common.type-social-instagram/InstagramDiscoveryAudit
       finfolkdb.common.type-social-instagram/InstagramPostReport
       finfolkdb.common.type-social-instagram/InstagramCommand
       finfolkdb.common.type-social-instagram/InstagramEvent
       finfolkdb.common.type-social-instagram/InstagramDmLimit
       finfolkdb.common.type-social-instagram/InstagramConnectCode
       finfolkdb.common.type-social-instagram/InstagramConnectLimit
       finfolkdb.common.type-environment-base/DataSource
       finfolkdb.common.type-environment-base/DepthDataset
       finfolkdb.common.type-environment-base/TideStation
       finfolkdb.common.type-environment-base/EnvironmentTarget
       finfolkdb.common.type-environment-base/EnvironmentSnapshot
       finfolkdb.common.type-environment-base/EnvironmentJob finfolkdb.common.type-trip-base/Trip
       finfolkdb.common.type-trip-base/TripImport finfolkdb.common.type-trip-base/TripDive
       finfolkdb.common.type-trip-base/TripImportBatch
       finfolkdb.common.type-trip-base/EnumTripReviewDecision
       finfolkdb.common.type-trip-base/EnumTripPublicationStatus
       finfolkdb.common.type-trip-base/TripPublication finfolkdb.common.type-user-report/UserReport
       finfolkdb.common.type-user/User finfolkdb.common.type-user/UserBlock
       finfolkdb.common.type-user/UserCheckin finfolkdb.common.type-user/UserConnection
       finfolkdb.common.type-system-seed/EnumClassType finfolkdb.common.type-system-seed/as-jsonb
       finfolkdb.common.type-system-seed/as-jsonb-array
       finfolkdb.common.type-user-reward/UserInvitation
       finfolkdb.common.type-user-reward/UserInvitationJoin
       finfolkdb.common.type-user-reward/UserPointsEntry
       finfolkdb.common.type-user-reward/UserRequestLimit
       finfolkdb.common.type-social-tiktok/TiktokConnection finfolkdb.common.type-system-site/Beach
       finfolkdb.common.type-directory-base/DirectoryListing
       finfolkdb.common.type-directory-base/DirectoryReport
       finfolkdb.common.type-directory-base/DirectoryRun
       finfolkdb.common.type-messaging-base/EnumMessagingProvider
       finfolkdb.common.type-messaging-base/EnumMessagingDirection
       finfolkdb.common.type-messaging-base/EnumMessagingReceiptStatus
       finfolkdb.common.type-messaging-base/MessagingApplication
       finfolkdb.common.type-messaging-base/MessagingAccount
       finfolkdb.common.type-messaging-base/MessagingAudit
       finfolkdb.common.type-messaging-base/MessagingIdempotency
       finfolkdb.common.type-messaging-base/MessagingOauthState
       finfolkdb.common.type-messaging-base/MessagingIdentity
       finfolkdb.common.type-messaging-base/MessagingConversation
       finfolkdb.common.type-messaging-base/MessagingMessage
       finfolkdb.common.type-messaging-base/MessagingReceipt
       finfolkdb.common.type-messaging-base/MessagingOutbox finfolkdb.common.fn-system-util/auth-uid
       finfolkdb.common.fn-system-util/as-iso-time finfolkdb.common.type-logbook-base/DiveSession
       finfolkdb.common.type-social-post/SocialPost
       finfolkdb.common.type-social-post/SocialPostReport
       finfolkdb.common.type-social-post/SocialReferral
       finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform
       finfolkdb.common.type-domain-enum/EnumUserConnectionStatus
       finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus
       finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus
       finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus
       finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct
       finfolkdb.common.type-domain-enum/EnumEventRsvpStatus
       finfolkdb.common.type-domain-enum/EnumEventStatus
       finfolkdb.common.type-domain-enum/EnumEventVisibility
       finfolkdb.common.type-domain-enum/EnumInstagramActionType
       finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus
       finfolkdb.common.type-domain-enum/EnumInstagramCommandContext
       finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState
       finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus
       finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus
       finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason
       finfolkdb.common.type-domain-enum/EnumInstagramSourceType
       finfolkdb.common.type-domain-enum/EnumMediaImportPlatform
       finfolkdb.common.type-domain-enum/EnumMediaImportStatus
       finfolkdb.common.type-domain-enum/EnumMessagingAccountMode
       finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind
       finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus
       finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus
       finfolkdb.common.type-domain-enum/EnumSocialPostStatus
       finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode
       finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship
       finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType
       finfolkdb.common.type-domain-enum/EnumSiteImportStatus
       finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody
       finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode
       finfolkdb.common.type-domain-enum/EnumSiteProfileStatus
       finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus
       finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus
       finfolkdb.common.type-domain-enum/EnumTripImportStatus
       finfolkdb.common.type-user-access/EnumAccessSetting finfolkdb.common.type-user-access/Access
       finfolkdb.common.type-user-access/EnumAccessRoleLevel
       finfolkdb.common.type-user-access/AccessRole
       finfolkdb.common.type-user-access/EnumAccessRequestStatus
       finfolkdb.common.type-user-access/AccessRequest
       finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus
       finfolkdb.common.type-user-access/AccessInviteExternal
       finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus
       finfolkdb.common.type-user-access/AccessInviteEmail]))
  =>
  true)

(fact "fresh reference import types and enum match the installed local PostgreSQL schema"
  (do
    (namespaces/load-all!)
    (every?
     common/check!
     '[finfolkdb.common.type-import-base/EnumDataAssetKind
       finfolkdb.common.type-import-base/DatabaseRelease finfolkdb.common.type-import-base/DataAsset
       finfolkdb.common.type-import-base/DepthDatasetAsset finfolkdb.common.type-import-base/GeoArea
       finfolkdb.common.type-import-base/GeoFeature finfolkdb.common.type-import-base/GeoBoundary
       finfolkdb.common.type-import-base/SiteLocation]))
  =>
  true)
