(ns finfolkdb.common.type-domain-enum-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.common.type-domain-enum :as t] [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)]
              :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform :added "0.1"}
(fact "EnumSocialReferralPlatform labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialReferralPlatform))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumUserConnectionStatus :added "0.1"}
(fact "EnumUserConnectionStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumUserConnectionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus :added "0.1"}
(fact "EnumDepthDatasetStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus :added "0.1"}
(fact "EnumDirectoryClaimStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDirectoryClaimStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus :added "0.1"}
(fact "EnumDirectoryListingStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct :added "0.1"}
(fact "EnumEnvironmentTargetProduct labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventRsvpStatus :added "0.1"}
(fact "EnumEventRsvpStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventRsvpStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventStatus :added "0.1"}
(fact "EnumEventStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumEventVisibility :added "0.1"}
(fact "EnumEventVisibility labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumEventVisibility))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramActionType :added "0.1"}
(fact "EnumInstagramActionType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramActionType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus :added "0.1"}
(fact "EnumInstagramClaimStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandContext :added "0.1"}
(fact "EnumInstagramCommandContext labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandContext))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState :added "0.1"}
(fact "EnumInstagramCommandSendState labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus :added "0.1"}
(fact "EnumInstagramCommandStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus :added "0.1"}
(fact "EnumInstagramDiscoveryStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason :added "0.1"}
(fact "EnumInstagramPostReportReason labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumInstagramSourceType :added "0.1"}
(fact "EnumInstagramSourceType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumInstagramSourceType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMediaImportPlatform :added "0.1"}
(fact "EnumMediaImportPlatform labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMediaImportPlatform))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMediaImportStatus :added "0.1"}
(fact "EnumMediaImportStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMediaImportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingAccountMode :added "0.1"}
(fact "EnumMessagingAccountMode labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingAccountMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind :added "0.1"}
(fact "EnumMessagingOutboxReplyKind labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus :added "0.1"}
(fact "EnumMessagingOutboxStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus :added "0.1"}
(fact "EnumSocialPostReportStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSocialPostStatus :added "0.1"}
(fact "EnumSocialPostStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSocialPostStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode :added "0.1"}
(fact "EnumSiteAccessPointMode labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship :added "0.1"}
(fact "EnumSiteDepthDatasetRelationship labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType :added "0.1"}
(fact "EnumSiteDepthEvidenceType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteImportStatus :added "0.1"}
(fact "EnumSiteImportStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteImportStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody :added "0.1"}
(fact "EnumSiteProfileWaterbody labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode :added "0.1"}
(fact "EnumSiteProfileAccessMode labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteProfileStatus :added "0.1"}
(fact "EnumSiteProfileStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteProfileStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus :added "0.1"}
(fact "EnumSiteRevisionStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus :added "0.1"}
(fact "EnumTiktokConnectionStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus))
  => true)

^{:refer finfolkdb.common.type-domain-enum/EnumTripImportStatus :added "0.1"}
(fact "EnumTripImportStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! 'finfolkdb.common.type-domain-enum/EnumTripImportStatus))
  => true)