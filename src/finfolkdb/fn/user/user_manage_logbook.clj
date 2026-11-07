(ns finfolkdb.fn.user.user-manage-logbook
  "Typed private dive-session creation and owned reads."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-logbook-base :as tlb]
             [finfolkdb.fn.helper.helper-entity :as he]
             [finfolkdb.fn.helper.helper-access :as ha]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; DiveSession Creation
;;

(defn.pg insert-dive-session
  "New saves are private and cannot persist photo payloads supplied by callers."
  [:text i-owner :text i-beach :jsonb i-data :jsonb o-op]
  (let [(:uuid v-id) (pg/uuid-generate-v4)
        o-data (|| (- (tss/as-jsonb i-data) "beachId")
                   (pg/jsonb-build-object "visibility" "private" "photos" (:jsonb "[]")))
        o-base (he/insert-base-addons "DiveSession" (:text v-id) o-data o-op)
        o-session (pg/t:insert tlb/DiveSession
                    {:id v-id :owner i-owner :beach (nullif i-beach "") :detail o-data
                     :rev (:uuid (:->> o-base "rev")) :audit (:uuid (:->> o-base "audit"))}
                    {:track o-op :returning #{:*/standard :detail}})]
    (return o-session)))

;;
;; Owned Session Read
;;

(defn.pg ret-dive-session-owned
  "Returns only the requested owner's record; the API composes media separately."
  [:uuid i-session-id :text i-owner]
  (let [o-session (pg/t:get tlb/DiveSession
                    {:where {:id i-session-id :owner i-owner}
                     :returning #{:id :owner :beach :detail}})]
    (when (or [o-session :is-null] (not (ha/is-user-active i-owner)))
      (return nil))
    (return (|| (:-> o-session "detail")
                (pg/jsonb-build-object "id" (:->> o-session "id")
                                      "ownerId" (:->> o-session "owner_id")
                                      "beachId" (pg/coalesce (:->> o-session "beach_id") ""))))))
