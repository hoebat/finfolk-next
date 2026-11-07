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
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  DataSource
  [:id {:type :text :required true :primary true}
   :metadata {:type :jsonb :required true}
   :enabled {:type :boolean :required true :sql {:default false}}])

;;
;; DepthDataset
;;

(deftype.pg ^{:finfolk/legacy-tables ["depth_datasets"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  DepthDataset
  [:id {:type :text :required true :primary true}
   :source {:type :ref :required true
            :ref {:ns finfolkdb.common.type-environment-base/DataSource}
            :sql {:unique ["source_upstream_version"]}}
   :upstream-id {:type :text :required true :sql {:unique ["source_upstream_version"]}}
   :version {:type :text :required true :sql {:unique ["source_upstream_version"]}}
   :checksum {:type :text :required true}
   :status {:type :enum :required true
            :enum {:ns finfolkdb.common.type-domain-enum/EnumDepthDatasetStatus}
            :sql {:default "staged"}}
   :metadata {:type :jsonb :required true}])

;;
;; TideStation
;;

(deftype.pg ^{:finfolk/legacy-tables ["tide_stations"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  TideStation
  [:id {:type :text :required true :primary true}
   :source {:type :ref :required true
            :ref {:ns finfolkdb.common.type-environment-base/DataSource}
            :sql {:unique ["source_upstream"]}}
   :upstream-id {:type :text :required true :sql {:unique ["source_upstream"]}}
   :metadata {:type :jsonb :required true}
   :active {:type :boolean :required true :sql {:default true}}])

;;
;; EnvironmentTarget
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_targets"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  EnvironmentTarget
  [:id {:type :text :required true :primary true}
   :source {:type :ref :required true
            :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :product {:type :enum :required true
             :enum {:ns finfolkdb.common.type-domain-enum/EnumEnvironmentTargetProduct}}
   :configuration {:type :jsonb :required true}
   :last-requested-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; EnvironmentSnapshot
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_snapshots"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  EnvironmentSnapshot
  [:id {:type :uuid :required true :primary true :sql {:default (pg/gen-random-uuid)}}
   :target {:type :ref :required true
            :ref {:ns finfolkdb.common.type-environment-base/EnvironmentTarget}
            :sql {:cascade true}}
   :issued-at {:type :timestamptz}
   :retrieved-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :valid-from {:type :timestamptz :required true}
   :valid-to {:type :timestamptz :required true}
   :fresh-until {:type :timestamptz :required true}
   :delete-after {:type :timestamptz :required true}
   :checksum {:type :text :required true}
   :schema-version {:type :integer :required true :sql {:default 1}}
   :payload {:type :jsonb :required true}]
  {:constraints {:check-0 (> #{"valid_to"} #{"valid_from"})
                 :check-1 (>= #{"delete_after"} #{"retrieved_at"})
                 :check-2 (> #{"schema_version"} 0)}})

;;
;; EnvironmentJob
;;

(deftype.pg ^{:finfolk/legacy-tables ["environment_jobs"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  EnvironmentJob
  [:target {:type :ref :required true
            :ref {:ns finfolkdb.common.type-environment-base/EnvironmentTarget} :primary true
            :sql {:cascade true}}
   :next-attempt-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :lease-token {:type :uuid}
   :lease-until {:type :timestamptz}
   :attempts {:type :integer :required true :sql {:default 0}}
   :last-success {:type :timestamptz}
   :error-code {:type :text}]
  {:constraints {:check-0 (>= #{"attempts"} 0)
                 :check-1 (or (and [#{"lease_token"} :is-null] [#{"lease_until"} :is-null])
                              (and [#{"lease_token"} :is-not-null] [#{"lease_until"} :is-not-null]))}})
