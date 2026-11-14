(ns finfolkdb.common.type-site-base
  "Published site metadata, review revisions and linked environmental evidence."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-environment-base :as teb]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-environment-base :as teb]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; SiteCatalog
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_catalog"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  SiteCatalog
  [:singleton {:type :boolean :required true
               :sql {:default true :unique ["singleton"]}}
   :revision  {:type :bigint :required true
               :sql {:default 0}}
   :metadata  {:type :jsonb :required true
               :sql {:default "{}"}}]
  {:constraints {:singleton #{"singleton"} :check-1 (>= #{"revision"} 0)}})

;;
;; SiteProfile
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_profiles"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  SiteProfile
  [:beach        {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-system-site/Beach}
                  :sql {:unique ["entity_key"]}}
   :revision     {:type :bigint :required true}
   :waterbody    {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteProfileWaterbody}}
   :access-mode  {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteProfileAccessMode}}
   :status       {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteProfileStatus}}
   :payload      {:type :jsonb :required true}
   :time-updated {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; SiteImport
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_imports"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  SiteImport
  [:owner        {:type :ref
                  :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :preview      {:type :jsonb :required true
                  :sql {:default "{}"}}
   :status       {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteImportStatus}
                  :sql {:default "draft"}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; SiteRevision
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_revisions"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  SiteRevision
  [:site          {:type :ref :required true
                   :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :owner         {:type :ref
                   :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :import        {:type :ref
                   :ref {:ns finfolkdb.common.type-site-base/SiteImport} :sql {:cascade true}}
   :base-revision {:type :bigint :required true
                   :sql {:default 0}}
   :version       {:type :bigint :required true
                   :sql {:default 1}}
   :status        {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteRevisionStatus}}
   :payload       {:type :jsonb :required true}
   :reason        {:type :text :required true
                   :sql {:default ""}}
   :reviewed-by   {:type :ref
                   :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :time-created  {:type :long :required true
                   :sql {:default (pg/time-us)}}
   :time-updated  {:type :long :required true
                   :sql {:default (pg/time-us)}}])

;;
;; SiteAccessPoint
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_access_points"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  SiteAccessPoint
  [:revision {:type :ref :required true
              :ref {:ns finfolkdb.common.type-site-base/SiteRevision} :sql {:cascade true}}
   :mode     {:type :enum :required true
              :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteAccessPointMode}}
   :payload  {:type :jsonb :required true}])

;;
;; SiteDepthEvidence
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_depth_evidence"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  SiteDepthEvidence
  [:revision {:type :ref :required true
              :ref {:ns finfolkdb.common.type-site-base/SiteRevision} :sql {:cascade true}}
   :kind     {:type :enum :required true
              :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteDepthEvidenceType}}
   :payload  {:type :jsonb :required true}])

;;
;; SiteDepthDataset
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_depth_datasets"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  SiteDepthDataset
  [:revision     {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-site-base/SiteRevision}
                  :sql {:cascade true :unique ["entity_key"]}}
   :dataset      {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-environment-base/DepthDataset}
                  :sql {:unique ["entity_key"]}}
   :relationship {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumSiteDepthDatasetRelationship}}
   :evidence     {:type :jsonb :required true}])

;;
;; SiteTideStation
;;

(deftype.pg ^{:finfolk/legacy-tables ["site_tide_stations"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  SiteTideStation
  [:revision {:type :ref :required true
              :ref {:ns finfolkdb.common.type-site-base/SiteRevision}
              :sql {:cascade true :unique ["entity_key"]}}
   :station  {:type :ref :required true
              :ref {:ns finfolkdb.common.type-environment-base/TideStation}}
   :evidence {:type :jsonb :required true}])
