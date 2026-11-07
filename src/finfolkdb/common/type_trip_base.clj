(ns finfolkdb.common.type-trip-base
  "Trips, private raw imports and independent public snapshots."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-domain-enum :as tde]))

;;
;; Namespace relationships
;;
;; [User] --owns--> [Trip] --site--> [Beach]
;; [Trip] --raw imports--> [TripImport] --rows/batches--> [TripDive / TripImportBatch]
;; [Trip] --public snapshots--> [TripPublication]; private draft edits are independent.
;; The active import is the unique active child, avoiding a circular root pointer.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Trip
;;

(deftype.pg ^{:finfolk/legacy-tables ["trips"]
              :final true
              :! (et/E {:class :0d/entry :addons [:detail :rev :audit]})}
  Trip
  "A private trip draft. detail omits the separately linked beachId."
  [:owner {:type :ref :required true
           :ref {:ns finfolkdb.common.type-user/User}
           :sql {:cascade true :index true}}
   :beach {:type :ref :required true
           :ref {:ns finfolkdb.common.type-system-site/Beach}
           :sql {:index true}}
   :start-date {:type :date :required true}
   :end-date   {:type :date :required true}]
  {:constraints {:ordered-dates (and (>= #{"end_date"} #{"start_date"})
                                   (<= (- #{"end_date"} #{"start_date"}) 365))}})

;;
;; TripImport
;;

(deftype.pg ^{:finfolk/legacy-tables ["trip_imports"]
              :final true
              :! (et/E {:class :0d/entry})}
  TripImport
  [:trip          {:type :ref :required true :ref {:ns -/Trip}
                   :sql {:cascade true :index true}}
   :expected-rows {:type :integer :required true}
   :status        {:type :enum :required true
                   :enum {:ns finfolkdb.common.type-domain-enum/EnumTripImportStatus}
                   :sql {:default "uploading"}}
   :is-active     {:type :boolean :required true :sql {:default false}}
   :fingerprint   {:type :text}]
  {:constraints {:bounded-import (and (>= #{"expected_rows"} 1)
                                     (<= #{"expected_rows"} 10000))
                 :active-complete (or (not #{"is_active"}) (== #{"status"} "complete"))}})

;;
;; TripDive
;;

(deftype.pg ^{:finfolk/legacy-tables ["trip_dives"]
              :final true
              :! (et/E {:class :0d/entry :id :id/none :addons [:detail]})}
  TripDive
  [:import  {:type :ref :required true :primary "default" :ref {:ns -/TripImport}
             :sql {:cascade true}}
   :ordinal {:type :integer :required true :primary "default"}
   :day     {:type :date :required true}]
  {:constraints {:positive-ordinal (> #{"ordinal"} 0)}})

;;
;; TripImportBatch
;;

(deftype.pg ^{:finfolk/legacy-tables ["trip_import_batches"]
              :final true
              :! (et/E {:class :0d/entry :id :id/none})}
  TripImportBatch
  [:import {:type :ref :required true :primary "default" :ref {:ns -/TripImport}
            :sql {:cascade true}}
   :index  {:type :integer :required true :primary "default"}
   :rows   {:type :jsonb :required true}]
  {:constraints {:bounded-batch (and (>= #{"index"} 0) (<= #{"index"} 9999))
                 :array-rows (== (pg/jsonb-typeof #{"rows"}) "array")}})

;;
;; TripPublication
;;

(defenum.pg
  EnumTripReviewDecision
  [:approve :reject :remove])

(defenum.pg
  EnumTripPublicationStatus
  [:pending :published])

(deftype.pg ^{:final true
              :! (et/E {:class :0d/entry :addons [:detail]})}
  TripPublication
  "A consented snapshot independent of the editable draft and private raw dives."
  [:trip           {:type :ref :required true :ref {:ns -/Trip}
                    :sql {:cascade true :unique ["publication_status"]}}
   :beach          {:type :ref :required true
                    :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :status         {:type :enum :required true :enum {:ns -/EnumTripPublicationStatus}
                    :sql {:default "pending" :unique ["publication_status"]}}
   :public-consent {:type :boolean :required true :sql {:default false}}
   :published-at   {:type :timestamptz}]
  {:constraints {:consented-publication
                 (or (not= #{"status"} "published")
                     (and #{"public_consent"} [#{"published_at"} :is-not-null]))}})

;;
;; Import Indexes
;;

(defrun.pg __trip_import_indexes__
  [:create-unique-index :if-not-exists #{"TripImportActive"}
   :on -/TripImport (>-< [#{"trip_id"}]) :where #{"is_active"}])
