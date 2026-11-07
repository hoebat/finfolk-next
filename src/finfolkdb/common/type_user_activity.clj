(ns finfolkdb.common.type-user-activity
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]))

;;
;; Namespace relationships
;;
;; [User] --activity addon--> [Activity] --owner--> [ActivityLog] --actor--> [User]
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(defenum.pg
  EnumActionType
  [:create :read :update :delete :login :logout :invite :join :leave :share :export :import])

(deftype.pg ^{:final true
              :! (et/E {:class  :1d/log
                        :owner  finfolkdb.common.type-system-base/Activity
                        :access :access/system
                        :addons [:detail]})}
  ActivityLog
  "An immutable activity entry linked to a provider and authenticated actor."
  [:action {:type :enum :required true :enum {:ns -/EnumActionType}}
   :actor  {:type :ref :ref {:ns finfolkdb.common.type-user/User}}])
