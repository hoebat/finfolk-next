(ns finfolkdb.common.type-user-report
  "Member reports with real target relationships rather than prefixed IDs."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-trip-base :as ttb]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-trip-base :as ttb]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; UserReport
;;

(deftype.pg ^{:finfolk/legacy-tables ["reports"]
              :final true
              :! (et/E {:class :0d/entry
                        :id    :id/v4})}
  UserReport
  "The API may encode a trip target as trip:UUID; storage keeps a typed link."
  [:author {:type :ref :required true
            :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :target {:type :ref
            :ref {:ns finfolkdb.common.type-user/User}}
   :trip   {:type :ref
            :ref {:ns finfolkdb.common.type-trip-base/Trip} :sql {:cascade true}}
   :reason {:type :text :required true}]
  {:constraints {:one-target (or (and [#{"target_id"} :is-not-null] [#{"trip_id"} :is-null])
                                 (and [#{"target_id"} :is-null] [#{"trip_id"} :is-not-null]))}})
