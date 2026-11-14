(ns finfolkdb.common.type-environment-base
  "Environmental provider catalogs, products, leased jobs and immutable snapshots."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-system-base :as tsb]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-system-base :as tsb]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; DataSource
;;

(deftype.pg ^{:finfolk/legacy-tables ["data_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  DataSource
  [:key      {:type :text
              :sql {:unique ["key"]}}
   :metadata {:type :jsonb :required true}
   :enabled  {:type :boolean :required true
              :sql {:default false}}])

;;
;; DepthDataset
;;

(deftype.pg ^{:finfolk/legacy-tables ["depth_datasets"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  DepthDataset
  [:key         {:type :text
                 :sql {:unique ["key"]}}
   :source      {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-environment-base/DataSource}
                 :sql {:unique ["source_upstream_version"]}}
   :upstream-id {:type :text :required true
                 :sql {:unique ["source_upstream_version"]}}
   :version     {:type :text :required true
                 :sql {:unique ["source_upstream_version"]}}
   :checksum    {:type :text :required true}
   :status      {:type :enum :required true
                 :enum {:ns finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus}
                 :sql {:default "staged"}}
   :metadata    {:type :jsonb :required true}])

;;
;; TideStation
;;

(deftype.pg ^{:finfolk/legacy-tables ["tide_stations"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  TideStation
  [:key         {:type :text
                 :sql {:unique ["key"]}}
   :source      {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-environment-base/DataSource}
                 :sql {:unique ["source_upstream"]}}
   :upstream-id {:type :text :required true
                 :sql {:unique ["source_upstream"]}}
   :metadata    {:type :jsonb :required true}
   :active      {:type :boolean :required true
                 :sql {:default true}}])

;;
;; EnvironmentTarget
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_targets"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  EnvironmentTarget
  [:key               {:type :text
                       :sql {:unique ["key"]}}
   :source            {:type :ref :required true
                       :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :product           {:type :enum :required true
                       :enum {:ns finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct}}
   :configuration     {:type :jsonb :required true}
   :last-requested-at {:type :long :required true
                       :sql {:default (pg/time-us)}}])

;;
;; EnvironmentSnapshot
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_snapshots"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  EnvironmentSnapshot
  [:target         {:type :ref :required true
                    :ref {:ns finfolkdb.common.type-environment-base/EnvironmentTarget}
                    :sql {:cascade true}}
   :issued-at      {:type :long}
   :retrieved-at   {:type :long :required true
                    :sql {:default (pg/time-us)}}
   :valid-from     {:type :long :required true}
   :valid-to       {:type :long :required true}
   :fresh-until    {:type :long :required true}
   :delete-after   {:type :long :required true}
   :checksum       {:type :text :required true}
   :schema-version {:type :integer :required true
                    :sql {:default 1}}
   :payload        {:type :jsonb :required true}]
  {:constraints {:check-0 (> #{"valid_to"} #{"valid_from"})
                 :check-1 (>= #{"delete_after"} #{"retrieved_at"})
                 :check-2 (> #{"schema_version"} 0)}})

;;
;; EnvironmentJob
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_jobs"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  EnvironmentJob
  [:target          {:type :ref :required true
                     :ref {:ns finfolkdb.common.type-environment-base/EnvironmentTarget}
                     :sql {:cascade true :unique ["entity_key"]}}
   :next-attempt-at {:type :long :required true
                     :sql {:default (pg/time-us)}}
   :lease-token     {:type :uuid}
   :lease-until     {:type :long}
   :attempts        {:type :integer :required true
                     :sql {:default 0}}
   :last-success    {:type :long}
   :error-code      {:type :text}]
  {:constraints {:check-0 (>= #{"attempts"} 0)
                 :check-1 (or (and [#{"lease_token"} :is-null] [#{"lease_until"} :is-null])
                              (and [#{"lease_token"} :is-not-null]
                                   [#{"lease_until"} :is-not-null]))}})
