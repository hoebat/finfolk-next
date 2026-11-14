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
    [(get-in tables ["User" :entity :class]) (get-in fields ["rev" :reference :table])
     (get-in fields ["audit" :reference :table]) (get-in fields ["activity" :reference :table])
     (get-in fields ["class-table" :spec :ignore])])
  =>
  [:0d/entry "Rev" "Audit" "Activity" true])

^{:id scoped-provider-identities}
(fact "provider and log identities retain their dimensional scope and ownership"
  (let [tables (catalog/declarations)]
    [(get-in tables ["Activity" :entity :class]) (get-in tables ["Rev" :entity :class])
     (get-in tables ["AuditLog" :entity :class])
     (set (map :name (filter :primary (:columns (get tables "AuditLog")))))])
  =>
  [:1d/base :2d/base :2d/log #{"id" "class-table" "class-context" "audit"}])

^{:id portable-catalog}
(fact "portable contracts preserve namespaces and the complete inherited field set"
  (let [tables (catalog/portable (catalog/declarations))]
    [(get-in (first (filter #(= "user" (get % "name")) (get-in tables ["UserCheckin" "columns"])))
             ["reference" "table"]) (get-in tables ["Rev" "entity" "class"])
     (get-in tables ["User" "entity" "addons"])])
  =>
  ["User" "2d/base" ["rev" "audit" "activity"]])

^{:id historical-schema-mapping}
(fact "the mapping report distinguishes declarations from remaining historical tables"
  (let [report (coverage/current)]
    [(get-in report [:mappings "directory_page_admins"])
     (get-in report [:mappings "directory_claims"]) (get-in report [:mappings "event_invites"])
     (get-in report [:mappings "trips"])
     (= (:historical-total report) (+ (:mapped-total report) (count (:remaining report))))])
  =>
  ["AccessRole" "AccessRequest" "AccessInviteEmail" "Trip" true])

^{:id invalid-historical-mappings}
(fact "unknown and duplicate historical mappings fail instead of inflating coverage"
  (coverage/report {"known" {}} {"Entity" {:legacy-tables ["unknown"]}})
  =>
  (throws clojure.lang.ExceptionInfo)
  (coverage/report {"known" {}}
                   {"First" {:legacy-tables ["known"]} "Second" {:legacy-tables ["known"]}})
  =>
  (throws clojure.lang.ExceptionInfo))

^{:id content-relationships}
(fact "content records use linked owners, sites and imports rather than scalar ID declarations"
  (let [tables (catalog/declarations)
        fields (fn [table] (into {} (map (juxt :name identity) (:columns (get tables table)))))]
    [(get-in (fields "MediaImport") ["session" :reference :table])
     (get-in (fields "MediaImport") ["owner" :spec :foreign :session-owner :column])
     (get-in (fields "TripImport") ["trip" :reference :table])
     (contains? (fields "Trip") "active-import")
     (get-in (fields "UserReport") ["trip" :reference :table])])
  =>
  ["DiveSession" :owner-id "Trip" false "Trip"])

^{:id native-identity-and-time-conventions}
(fact "native entities declare standalone IDs through et/E and store instants as longs"
  (let [tables (catalog/declarations)
        columns (mapcat :columns (vals tables))]
    [(every? #(not= "timestamptz" (:type %)) columns)
     (not-any? #(#{"created-at" "updated-at"} (:name %)) columns)
     (every? #(#{"long" "time"} (:type %))
             (filter #(#{"time-created" "time-updated"} (:name %)) columns))
     (every? (fn [[_ table]]
               (or (not-any? #(= "id" (:name %)) (:columns table))
                   (let [id (get-in table [:entity :id])]
                     (or (nil? id) (map? id) (#{:id/v4 :id/v1 :id/text} id)))))
             tables)])
  =>
  [true true true true])

^{:id relationship-identities}
(fact "relationship IDs are generated and natural keys remain unique"
  (let [tables (catalog/declarations)
        columns (into {} (map (juxt :name identity) (get-in tables ["UserBlock" :columns])))]
    [(every? #(not= :id/none (get-in % [:entity :id])) (vals tables)) (get-in columns ["id" :type])
     (get-in columns ["id" :primary]) (get-in columns ["owner" :spec :sql :unique])
     (get-in columns ["target" :spec :sql :unique]) (get-in columns ["owner" :primary])])
  =>
  [true "uuid" true ["entity_key"] ["entity_key"] false])

^{:id uuid-entity-identities}
(fact "all native IDs, addon identities and relationship targets use UUIDs"
  (let [tables (catalog/declarations)
        id-type (fn [table]
                  (:type (first (filter #(= "id" (:name %)) (:columns (get tables table))))))]
    [(every? #(= "uuid" (id-type %)) (keys tables))
     (every? #(= "uuid" (:type %))
             (filter #(= "class-ref" (:name %)) (mapcat :columns (vals tables))))
     (every? #(= "uuid" (id-type (get-in % [:reference :table])))
             (filter :reference (mapcat :columns (vals tables))))])
  =>
  [true true true])
