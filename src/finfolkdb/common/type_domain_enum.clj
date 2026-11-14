(ns finfolkdb.common.type-domain-enum
  "Closed domain values for the fresh entity database."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]]
   :static {:application ["finfolk-enum"]
            :all         {:schema ["finfolk"]}}})

;;
;; Domain Enums
;;

(defenum.pg EnumSocialReferralPlatform [:instagram :tiktok])

(defenum.pg EnumUserConnectionStatus [:pending :accepted :declined :removed])

(defenum.pg EnumDepthDatasetStatus [:staged :published :superseded])

(defenum.pg EnumDirectoryClaimStatus [:pending :approved :rejected])

(defenum.pg EnumDirectoryListingStatus [:candidate :published :rejected :archived :suppressed])

(defenum.pg EnumEnvironmentTargetProduct [:weather :marine :tides])

(defenum.pg EnumEventRsvpStatus [:going :cancelled])

(defenum.pg EnumEventStatus [:draft :published :cancelled])

(defenum.pg EnumEventVisibility [:public :private])

(defenum.pg EnumInstagramActionType [:reply :stats :dive :points])

(defenum.pg EnumInstagramClaimStatus
  [:waiting :checking :follow_required :failed :review_requested :claimed :cancelled])

(defenum.pg EnumInstagramCommandContext [:mention :owned])

(defenum.pg EnumInstagramCommandSendState [:pending :sending :sent :uncertain :skipped])

(defenum.pg EnumInstagramCommandStatus [:new :confirmation :done :cancelled :limited])

(defenum.pg EnumInstagramDiscoveryStatus [:pending :published :hidden :rejected :unavailable])

(defenum.pg EnumInstagramPostReportReason [:wrong_location :inappropriate :removed :other])

(defenum.pg EnumInstagramSourceType [:tags :hashtag :recheck])

(defenum.pg EnumMediaImportPlatform [:instagram :tiktok])

(defenum.pg EnumMediaImportStatus [:active :hidden])

(defenum.pg EnumMessagingAccountMode [:disabled :pilot :live])

(defenum.pg EnumMessagingOutboxReplyKind [:text :connect_code :connect_guidance])

(defenum.pg EnumMessagingOutboxStatus
  [:pending :sending :provider_accepted :failed :uncertain :cancelled :expired])

(defenum.pg EnumSocialPostReportStatus [:open :resolved])

(defenum.pg EnumSocialPostStatus [:pending :approved :rejected :removed])

(defenum.pg EnumSiteAccessPointMode [:shore :departure])

(defenum.pg EnumSiteDepthDatasetRelationship [:candidate :confirmed])

(defenum.pg EnumSiteDepthEvidenceType [:surveyed :reported])

(defenum.pg EnumSiteImportStatus [:draft :published])

(defenum.pg EnumSiteProfileWaterbody [:ocean :lake :river :quarry :sinkhole :pool :unknown])

(defenum.pg EnumSiteProfileAccessMode [:shore :boat_only :shore_or_boat :unknown])

(defenum.pg EnumSiteProfileStatus [:published :archived])

(defenum.pg EnumSiteRevisionStatus [:draft :submitted :published :rejected :withdrawn])

(defenum.pg EnumTiktokConnectionStatus [:pending :connected :disconnected :reconnect])

(defenum.pg EnumTripImportStatus [:uploading :complete])

;;
;; Physical Column Bindings
;;

(def COLUMN_ENUMS
  {["community_referrals" "platform"] {:name "EnumSocialReferralPlatform"
                                       :values ["instagram" "tiktok"]}
   ["connections" "status"] {:name "EnumUserConnectionStatus"
                             :values ["pending" "accepted" "declined" "removed"]}
   ["depth_datasets" "status"] {:name "EnumDepthDatasetStatus"
                                :values ["staged" "published" "superseded"]}
   ["directory_claims" "state"] {:name "EnumDirectoryClaimStatus"
                                 :values ["pending" "approved" "rejected"]}
   ["directory_listings" "status"] {:name "EnumDirectoryListingStatus"
                                    :values ["candidate" "published" "rejected" "archived"
                                             "suppressed"]}
   ["environment_targets" "product"] {:name "EnumEnvironmentTargetProduct"
                                      :values ["weather" "marine" "tides"]}
   ["event_rsvps" "state"] {:name "EnumEventRsvpStatus" :values ["going" "cancelled"]}
   ["events" "state"] {:name "EnumEventStatus" :values ["draft" "published" "cancelled"]}
   ["events" "visibility"] {:name "EnumEventVisibility" :values ["public" "private"]}
   ["instagram_actions" "kind"] {:name "EnumInstagramActionType"
                                 :values ["reply" "stats" "dive" "points"]}
   ["instagram_claims" "state"] {:name "EnumInstagramClaimStatus"
                                 :values ["waiting" "checking" "follow_required" "failed"
                                          "review_requested" "claimed" "cancelled"]}
   ["instagram_commands" "context"] {:name "EnumInstagramCommandContext"
                                     :values ["mention" "owned"]}
   ["instagram_commands" "send_state"] {:name "EnumInstagramCommandSendState"
                                        :values ["pending" "sending" "sent" "uncertain" "skipped"]}
   ["instagram_commands" "state"] {:name "EnumInstagramCommandStatus"
                                   :values ["new" "confirmation" "done" "cancelled" "limited"]}
   ["instagram_discoveries" "state"] {:name "EnumInstagramDiscoveryStatus"
                                      :values ["pending" "published" "hidden" "rejected"
                                               "unavailable"]}
   ["instagram_post_reports" "reason"] {:name "EnumInstagramPostReportReason"
                                        :values ["wrong_location" "inappropriate" "removed"
                                                 "other"]}
   ["instagram_sources" "kind"] {:name "EnumInstagramSourceType"
                                 :values ["tags" "hashtag" "recheck"]}
   ["media_imports" "platform"] {:name "EnumMediaImportPlatform" :values ["instagram" "tiktok"]}
   ["media_imports" "state"] {:name "EnumMediaImportStatus" :values ["active" "hidden"]}
   ["messaging_accounts" "mode"] {:name "EnumMessagingAccountMode"
                                  :values ["disabled" "pilot" "live"]}
   ["messaging_outbox" "reply_kind"] {:name "EnumMessagingOutboxReplyKind"
                                      :values ["text" "connect_code" "connect_guidance"]}
   ["messaging_outbox" "state"] {:name "EnumMessagingOutboxStatus"
                                 :values ["pending" "sending" "provider_accepted" "failed"
                                          "uncertain" "cancelled" "expired"]}
   ["post_reports" "status"] {:name "EnumSocialPostReportStatus" :values ["open" "resolved"]}
   ["posts" "status"] {:name "EnumSocialPostStatus"
                       :values ["pending" "approved" "rejected" "removed"]}
   ["site_access_points" "mode"] {:name "EnumSiteAccessPointMode" :values ["shore" "departure"]}
   ["site_depth_datasets" "relationship"] {:name "EnumSiteDepthDatasetRelationship"
                                           :values ["candidate" "confirmed"]}
   ["site_depth_evidence" "kind"] {:name "EnumSiteDepthEvidenceType"
                                   :values ["surveyed" "reported"]}
   ["site_imports" "status"] {:name "EnumSiteImportStatus" :values ["draft" "published"]}
   ["site_profiles" "waterbody"] {:name "EnumSiteProfileWaterbody"
                                  :values ["ocean" "lake" "river" "quarry" "sinkhole" "pool"
                                           "unknown"]}
   ["site_profiles" "access_mode"] {:name "EnumSiteProfileAccessMode"
                                    :values ["shore" "boat_only" "shore_or_boat" "unknown"]}
   ["site_profiles" "status"] {:name "EnumSiteProfileStatus" :values ["published" "archived"]}
   ["site_revisions" "status"] {:name "EnumSiteRevisionStatus"
                                :values ["draft" "submitted" "published" "rejected" "withdrawn"]}
   ["tiktok_connections" "status"] {:name "EnumTiktokConnectionStatus"
                                    :values ["pending" "connected" "disconnected" "reconnect"]}
   ["trip_imports" "state"] {:name "EnumTripImportStatus" :values ["uploading" "complete"]}})
