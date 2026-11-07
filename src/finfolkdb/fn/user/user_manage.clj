(ns finfolkdb.fn.user.user-manage
  "Typed user creation and addon initialization."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-user-activity :as tua]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; User Creation
;;

(defn.pg insert-user
  "Creates the user and its scoped addon streams in one statement transaction."
  [:text i-user-id :jsonb i-profile :jsonb o-op]
  (let [o-rev (pg/t:insert tsb/Rev
                {:class-table "User"
                 :class-context "Global"
                 :class-ref i-user-id
                 :current (tss/as-jsonb i-profile)}
                {:track o-op})
        o-audit (pg/t:insert tsb/Audit
                  {:class-table "User"
                   :class-context "Global"
                   :class-ref i-user-id}
                  {:track o-op})
        o-activity (pg/t:insert tsb/Activity
                     {:class-table "User" :class-ref i-user-id}
                     {:track o-op})
        o-user (pg/t:insert tu/User
              {:id i-user-id
               :profile (tss/as-jsonb i-profile)
               :rev (pg/id o-rev)
               :audit (pg/id o-audit)
               :activity (pg/id o-activity)})
        o-audit-log (pg/t:insert tsb/AuditLog
                      {:class-table "User"
                       :class-context "Global"
                       :audit (pg/id o-audit)
                       :entry (pg/jsonb-build-object "status" "created")}
                      {:track o-op})
        o-activity-log (pg/t:insert tua/ActivityLog
                         {:class-table "User"
                          :activity (pg/id o-activity)
                          :actor i-user-id
                          :action "create"
                          :detail (pg/jsonb-build-object "status" "created")}
                         {:track o-op})]
    (return o-user)))
