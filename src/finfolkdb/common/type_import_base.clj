(ns finfolkdb.common.type-import-base
  "Verified reference imports. Assets retain their provenance and geometry remains linked to its dataset."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-environment-base :as teb]
            [finfolkdb.common.type-system-site :as tss]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-environment-base :as teb]
             [finfolkdb.common.type-system-site :as tss]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(defenum.pg EnumDataAssetKind [:geojson :raster :archive :document :other])

;;
;; DatabaseRelease
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  DatabaseRelease
  [:key          {:type :text
                  :sql {:unique ["key"]}}
   :manifest     {:type :jsonb :required true}
   :counts       {:type :jsonb :required true}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; DataAsset
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  DataAsset
  [:key      {:type :text
              :sql {:unique ["key"]}}
   :source   {:type :ref :required true
              :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :checksum {:type :text :required true}
   :bytes    {:type :bigint :required true}
   :kind     {:type :enum :required true
              :enum {:ns finfolkdb.common.type-import-base/EnumDataAssetKind}}
   :uri      {:type :text :required true}
   :metadata {:type :jsonb :required true}]
  {:constraints {:check-0 (>= #{"bytes"} 0)}})

;;
;; GeoArea
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  GeoArea
  [:key      {:type :text
              :sql {:unique ["key"]}}
   :source   {:type :ref :required true
              :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :metadata {:type :jsonb :required true}])

;;
;; GeoFeature
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  GeoFeature
  [:key        {:type :text
                :sql {:unique ["key"]}}
   :dataset    {:type :ref :required true
                :ref {:ns finfolkdb.common.type-environment-base/DepthDataset}}
   :geometry   {:type :jsonb :required true}
   :properties {:type :jsonb :required true}])

;;
;; SiteLocation
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  SiteLocation
  [:beach    {:type :ref :required true
              :ref {:ns finfolkdb.common.type-system-site/Beach} :sql {:unique ["entity_key"]}}
   :area     {:type :ref
              :ref {:ns finfolkdb.common.type-import-base/GeoArea}}
   :source   {:type :ref :required true
              :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :geometry {:type :jsonb :required true}])

;;
;; DepthDatasetAsset
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  DepthDatasetAsset
  [:dataset {:type :ref :required true
             :ref {:ns finfolkdb.common.type-environment-base/DepthDataset}
             :sql {:unique ["entity_key"]}}
   :asset   {:type :ref :required true
             :ref {:ns finfolkdb.common.type-import-base/DataAsset} :sql {:unique ["entity_key"]}}])

;;
;; GeoBoundary
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  GeoBoundary
  [:key        {:type :text
                :sql {:unique ["key"]}}
   :asset      {:type :ref :required true
                :ref {:ns finfolkdb.common.type-import-base/DataAsset}}
   :area       {:type :ref
                :ref {:ns finfolkdb.common.type-import-base/GeoArea}}
   :geometry   {:type :jsonb :required true}
   :properties {:type :jsonb :required true}])
