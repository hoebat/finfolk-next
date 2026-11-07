(ns finfolkdb.schema.entity-catalog-test
  (:require [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.entity-coverage :as coverage])
  (:use code.test))

;;
;; Resolved Entity Contracts
;;

^{:id inherited-addon-links}
(fact "the catalog contains resolved addon fields, not only authored field vectors"
  (let [tables (catalog/declarations)
        fields (into {} (map (juxt :name identity) (:columns (get tables "User"))))]
    [(get-in tables ["User" :entity :class])
     (get-in fields ["rev" :reference :table])
     (get-in fields ["audit" :reference :table])
     (get-in fields ["activity" :reference :table])
     (get-in fields ["class-table" :spec :ignore])])
  => [:0d/entry "Rev" "Audit" "Activity" true])

^{:id scoped-provider-identities}
(fact "provider and log identities retain their dimensional scope and ownership"
  (let [tables (catalog/declarations)]
    [(get-in tables ["Activity" :entity :class])
     (get-in tables ["Rev" :entity :class])
     (get-in tables ["AuditLog" :entity :class])
     (set (map :name (filter :primary (:columns (get tables "AuditLog")))))])
  => [:1d/base :2d/base :2d/log #{"class-table" "class-context" "audit" "op-created"}])

^{:id portable-catalog}
(fact "portable contracts preserve namespaces and the complete inherited field set"
  (let [tables (catalog/portable (catalog/declarations))]
    [(get-in tables ["UserCheckin" "columns" 0 "reference" "table"])
     (get-in tables ["Rev" "entity" "class"])
     (get-in tables ["User" "entity" "addons"])])
  => ["User" "2d/base" ["rev" "audit" "activity"]])


^{:id historical-schema-mapping}
(fact "the mapping report distinguishes declarations from remaining historical tables"
  (let [report (coverage/current)]
    [(get-in report [:mappings "directory_page_admins"])
     (get-in report [:mappings "directory_claims"])
     (get-in report [:mappings "event_invites"])
     (get-in report [:mappings "trips"])
     (= (:historical-total report)
        (+ (:mapped-total report) (count (:remaining report))))])
  => ["AccessRole" "AccessRequest" "AccessInviteEmail" "Trip" true])

^{:id invalid-historical-mappings}
(fact "unknown and duplicate historical mappings fail instead of inflating coverage"
  (coverage/report {"known" {}} {"Entity" {:legacy-tables ["unknown"]}})
  => (throws clojure.lang.ExceptionInfo)
  (coverage/report {"known" {}}
    {"First" {:legacy-tables ["known"]}
     "Second" {:legacy-tables ["known"]}})
  => (throws clojure.lang.ExceptionInfo))


^{:id content-relationships}
(fact "content records use linked owners, sites and imports rather than scalar ID declarations"
  (let [tables (catalog/declarations)
        fields (fn [table] (into {} (map (juxt :name identity) (:columns (get tables table)))))]
    [(get-in (fields "MediaImport") ["session" :reference :table])
     (get-in (fields "MediaImport") ["owner" :spec :foreign :session-owner :column])
     (get-in (fields "TripImport") ["trip" :reference :table])
     (contains? (fields "Trip") "active-import")
     (get-in (fields "UserReport") ["trip" :reference :table])])
  => ["DiveSession" :owner-id "Trip" false "Trip"])
