(ns finfolkdb.common.type-domain-enum-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (neon/config)
   :require [[finfolkdb.common.type-domain-enum :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform :added "0.1"}
(fact "EnumSocialReferralPlatform labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumUserConnectionStatus :added "0.1"}
(fact "EnumUserConnectionStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumUserConnectionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus :added "0.1"}
(fact "EnumDepthDatasetStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus :added "0.1"}
(fact "EnumDirectoryClaimStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus :added "0.1"}
(fact "EnumDirectoryListingStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct :added "0.1"}
(fact "EnumEnvironmentTargetProduct labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventRsvpStatus :added "0.1"}
(fact "EnumEventRsvpStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventRsvpStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventStatus :added "0.1"}
(fact "EnumEventStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventVisibility :added "0.1"}
(fact "EnumEventVisibility labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventVisibility))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramActionType :added "0.1"}
(fact "EnumInstagramActionType labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramActionType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus :added "0.1"}
(fact "EnumInstagramClaimStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandContext :added "0.1"}
(fact "EnumInstagramCommandContext labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandContext))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState :added "0.1"}
(fact "EnumInstagramCommandSendState labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus :added "0.1"}
(fact "EnumInstagramCommandStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus :added "0.1"}
(fact "EnumInstagramDiscoveryStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason :added "0.1"}
(fact "EnumInstagramPostReportReason labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramSourceType :added "0.1"}
(fact "EnumInstagramSourceType labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramSourceType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMediaImportPlatform :added "0.1"}
(fact "EnumMediaImportPlatform labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMediaImportPlatform))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMediaImportStatus :added "0.1"}
(fact "EnumMediaImportStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMediaImportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingAccountMode :added "0.1"}
(fact "EnumMessagingAccountMode labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingAccountMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind :added "0.1"}
(fact "EnumMessagingOutboxReplyKind labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus :added "0.1"}
(fact "EnumMessagingOutboxStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus :added "0.1"}
(fact "EnumSocialPostReportStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSocialPostStatus :added "0.1"}
(fact "EnumSocialPostStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialPostStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode :added "0.1"}
(fact "EnumSiteAccessPointMode labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship :added "0.1"}
(fact "EnumSiteDepthDatasetRelationship labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType :added "0.1"}
(fact "EnumSiteDepthEvidenceType labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteImportStatus :added "0.1"}
(fact "EnumSiteImportStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteImportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody :added "0.1"}
(fact "EnumSiteProfileWaterbody labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode :added "0.1"}
(fact "EnumSiteProfileAccessMode labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileStatus :added "0.1"}
(fact "EnumSiteProfileStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus :added "0.1"}
(fact "EnumSiteRevisionStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus :added "0.1"}
(fact "EnumTiktokConnectionStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumTripImportStatus :added "0.1"}
(fact "EnumTripImportStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumTripImportStatus))
  => true)