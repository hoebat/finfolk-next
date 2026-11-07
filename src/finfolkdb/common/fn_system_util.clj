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

(defn.pg ^{:%% :sql :- [:text]}
  auth-uid
  "Returns the identity set by the authenticated backend transaction."
  []
  (pg/coalesce (pg/current-setting "finfolk.actor_id" true) ""))

;;
;; API Time Serialization
;;

(defn.pg ^{:%% :sql :- [:text] :props [:immutable :parallel-safe]}
  as-iso-time
  "Matches JSON serialization of the legacy Node PostgreSQL Date values."
  [:timestamptz i-time]
  (pg/to-char (#{"timezone"} "UTC" i-time) "YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\""))
