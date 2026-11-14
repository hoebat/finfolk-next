(ns finfolkdb.common.type-logbook-base
  "Private dive sessions with typed owner and site relationships."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-system-site :as tss]))

;;
;; Namespace relationships
;;
;; [User] --owns--> [DiveSession] --site--> [Beach]
;; [DiveSession] --addons--> [Rev / Audit]; imported media links back to the session.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-system-site :as tss]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; DiveSession
;;

(deftype.pg ^{:finfolk/legacy-tables ["sessions"]
              :final true
              :! (et/E {:class   :0d/entry
                        :addons  [:detail :rev :audit]
                        :columns {:id {:sql {:unique ["session_owner"]}}}})}
  DiveSession
  "A member-owned dive record. API serialization restores the site ID in its data."
  [:owner {:type :ref :required true
           :ref {:ns finfolkdb.common.type-user/User}
           :sql {:cascade true :index true :unique ["session_owner"]}}
   :beach {:type :ref
           :ref {:ns finfolkdb.common.type-system-site/Beach} :sql {:index true}}])
