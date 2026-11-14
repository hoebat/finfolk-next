(ns finfolkdb.common.fn-system-util
  "Transaction-local identity helpers for the managed-auth backend."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Authentication Context
;;

(defn.pg ^{:%% :sql :- [:uuid]} auth-uid
  "Returns the identity set by the authenticated backend transaction."
  []
  (:uuid (#{"nullif"} (pg/current-setting "finfolk.actor_id" true) "")))

;;
;; API Time Serialization
;;

(defn.pg ^{:%% :sql :- [:text] :props [:immutable :parallel-safe]} as-iso-time
  "Serializes epoch microseconds as a UTC ISO timestamp at the API boundary."
  [:bigint i-time]
  (pg/to-char (#{"timezone"} "UTC" (pg/to-timestamp (/ (:numeric i-time) 1000000)))
              "YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\""))
