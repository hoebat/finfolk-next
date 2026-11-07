(ns finfolkdb.fn.helper.helper-entity
  "Shared typed initialization for revisioned and audited domain entities."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-system-base :as tsb]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Entity Providers
;;

(defn.pg insert-base-addons
  "Creates the first revision and audit entries in the caller's transaction."
  [:text i-class-table :text i-class-ref :jsonb i-current :jsonb o-op]
  (let [o-current (tss/as-jsonb i-current)
        o-rev (pg/t:insert tsb/Rev
                {:class-table i-class-table :class-context "Global"
                 :class-ref i-class-ref :index 1 :current o-current}
                {:track o-op})
        o-audit (pg/t:insert tsb/Audit
                  {:class-table i-class-table :class-context "Global" :class-ref i-class-ref}
                  {:track o-op})
        o-revision (pg/t:insert tsb/RevLog
                     {:class-table i-class-table :class-context "Global"
                      :rev (pg/id o-rev) :version 1 :deltas o-current}
                     {:track o-op})
        o-log (pg/t:insert tsb/AuditLog
                {:class-table i-class-table :class-context "Global"
                 :audit (pg/id o-audit) :entry (pg/jsonb-build-object "event" "create")}
                {:track o-op})]
    (return (pg/jsonb-build-object "rev" (pg/id o-rev) "audit" (pg/id o-audit)))))
