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

(defenum.pg
  EnumDataAssetKind
  [:geojson :raster :archive :document :other])

;;
;; DatabaseRelease
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  DatabaseRelease
  [:id {:type :text :required true :primary true}
   :manifest {:type :jsonb :required true}
   :counts {:type :jsonb :required true}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; DataAsset
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  DataAsset
  [:id {:type :text :required true :primary true}
   :source {:type :ref :required true :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :checksum {:type :text :required true}
   :bytes {:type :bigint :required true}
   :kind {:type :enum :required true :enum {:ns finfolkdb.common.type-import-base/EnumDataAssetKind}}
   :uri {:type :text :required true}
   :metadata {:type :jsonb :required true}]
  {:constraints {:check-0 (>= #{"bytes"} 0)}})

;;
;; GeoArea
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  GeoArea
  [:id {:type :text :required true :primary true}
   :source {:type :ref :required true :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :metadata {:type :jsonb :required true}])

;;
;; GeoFeature
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  GeoFeature
  [:id {:type :text :required true :primary true}
   :dataset {:type :ref :required true :ref {:ns finfolkdb.common.type-environment-base/DepthDataset}}
   :geometry {:type :jsonb :required true}
   :properties {:type :jsonb :required true}])

;;
;; SiteLocation
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  SiteLocation
  [:beach {:type :ref :required true :primary true :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :area {:type :ref :ref {:ns finfolkdb.common.type-import-base/GeoArea}}
   :source {:type :ref :required true :ref {:ns finfolkdb.common.type-environment-base/DataSource}}
   :geometry {:type :jsonb :required true}])

;;
;; DepthDatasetAsset
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  DepthDatasetAsset
  [:dataset {:type :ref :required true :primary true :ref {:ns finfolkdb.common.type-environment-base/DepthDataset}}
   :asset {:type :ref :required true :primary true :ref {:ns finfolkdb.common.type-import-base/DataAsset}}])

;;
;; GeoBoundary
;;

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  GeoBoundary
  [:id {:type :text :required true :primary true}
   :asset {:type :ref :required true :ref {:ns finfolkdb.common.type-import-base/DataAsset}}
   :area {:type :ref :ref {:ns finfolkdb.common.type-import-base/GeoArea}}
   :geometry {:type :jsonb :required true}
   :properties {:type :jsonb :required true}])
