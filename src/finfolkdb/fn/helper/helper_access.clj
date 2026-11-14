(ns finfolkdb.fn.helper.helper-access
  "Shared relationship guards for member-owned content."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Member Visibility
;;

(defn.pg ^{:- [:boolean]} is-user-blocked
  [:uuid i-viewer :uuid i-owner]
  (let [(:boolean v-forward) (pg/t:exists tu/UserBlock {:where {:owner i-viewer :target i-owner}})
        (:boolean v-reverse) (pg/t:exists tu/UserBlock {:where {:owner i-owner :target i-viewer}})]
    (return (or v-forward v-reverse))))

(defn.pg ^{:- [:boolean]} is-user-active
  [:uuid i-user]
  (let [(:boolean v-active) (pg/t:exists tu/User {:where {:id i-user :deleted false}})]
    (return v-active)))
