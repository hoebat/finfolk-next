(ns finfolkbuild.testing.behavior
  "Fixture constructors for application-level SQL runtime tests."
  (:require [finfolkdb.fn.user.user-manage :as user]
            [finfolkdb.fn.user.user-manage-logbook :as logbook]
            [finfolkdb.common.type-system-base :as system]
            [finfolkdb.common.type-system-site :as site]
            [postgres.core :as pg]
            [std.json :as json]))
(defn id
  [value]
  (try (str (java.util.UUID/fromString value))
       (catch IllegalArgumentException _
         (str (java.util.UUID/nameUUIDFromBytes (.getBytes value "UTF-8"))))))
(defn op [tag actor] (system/op-fn tag (id actor) {}))
(defn member
  [id]
  (user/insert-user (finfolkbuild.testing.behavior/id id) {:displayName id} (op "create-user" id)))
(defn beach
  [id]
  (pg/t:insert site/Beach
    {:id (finfolkbuild.testing.behavior/id id) :key id :name id :timezone "Australia/Sydney"}))

;; Declaration-only entities still need real linked data. These constructors
;; supply required inputs; assertions below inspect persisted values, not catalogs.
(require '[finfolkdb.schema.entity-catalog :as catalog]
         '[finfolkbuild.testing.common :as sql]
         '[finfolkbuild.testing.local :as local]
         '[clojure.string :as str])
(defn typed [verb table & args] (eval (apply list (symbol "postgres.core" (name verb)) table args)))
(defn literal [value] (list 'quote value))
(defn row-key [column] (keyword (str/replace (:sql-name column) "_" "-")))
(defn fixture-graph
  []
  (let [id (str (java.util.UUID/randomUUID))
        alice (member (str "alice-" id))
        bob (member (str "bob-" id))
        site (beach (str "beach-" id))
        rows (atom {"User" alice "Beach" site})
        tables (catalog/declarations)]
    {:id id :alice alice :bob bob :rows rows :tables tables}))
(defn identity-insert!
  [graph table values]
  (let [columns (:columns ((:tables graph) table))
        selected (filter #(and (contains? values (keyword (:name %)))
                               (not= :default (values (keyword (:name %)))))
                         columns)
        sql-type (fn [c]
                   (if (:reference c)
                     (let [p ((:tables graph) (get-in c [:reference :table]))]
                       (:type (first (filter :primary (:columns p)))))
                     (if (= "enum" (:type c))
                       (str "finfolk.\"" (name (get-in c [:spec :enum :ns])) "\"")
                       (:type c))))
        statement (str "INSERT INTO finfolk.\""
                       table
                       "\" ("
                       (str/join "," (map #(str "\"" (:sql-name %) "\"") selected))
                       ") VALUES ("
                       (str/join "," (map #(str "?::" (sql-type %)) selected))
                       ") RETURNING row_to_json(\""
                       table
                       "\")::text")
        result (apply sql/rows
                      @local/lock-connection
                      statement
                      (map #(values (keyword (:name %))) selected))]
    (json/read (ffirst result) json/+keyword-case-mapper+)))

(declare entity!)
(defn entity!
  [{:keys [id alice bob rows tables] :as graph} table]
  (or
   (@rows table)
   (let
     [spec (tables table)
      target (symbol (:module spec) table)
      scope (atom {})
      overrides
      {"SiteCatalog" {:singleton true}
       "SiteImport" {:preview "{}"}
       "UserBlock" {:owner (:id alice) :target (:id bob)}
       "UserConnection" {:user (:id alice) :target (:id bob) :requested-by (:id alice)}
       "UserInvitationJoin" {:invitee (:id alice) :inviter (:id bob)}
       "UserReport" {:target (:id bob)}
       "EnvironmentSnapshot" {:valid-from 1793750400000000
                              :valid-to 1793836800000000
                              :fresh-until 1793836800000000
                              :delete-after 4070908800000000}
       "Event" {:starts-at 1793750400000000 :ends-at 1793836800000000 :timezone "Australia/Sydney"}
       "Trip" {:start-date "2026-11-01" :end-date "2026-11-10"}
       "MessagingAccount" {:provider "instagram"}
       "MessagingMessage" {:external-id (str "message-" id) :sent-at 1793750400000000}
       "MessagingReceipt" {:deadline 4070908800000000}
       "MessagingOutbox" {:deadline 4070908800000000}
       "MessagingOauthState" {:expires-at 4070908800000000}
       "InstagramClaim" {:expires-at 4070908800000000}
       "AccessInviteEmail" {:expires-at 4070908800000000}}
      provided (get overrides table {})
      values
      (reduce
       (fn [out column]
         (let [key (keyword (:name column))
               default? (contains? (get-in column [:spec :sql]) :default)]
           (cond
             (contains? out key) out
             (str/includes? (pr-str (get-in column [:spec :sql :raw])) "identity")
             (assoc out key :default)
             (or (not (:required column)) default?) out
             (:reference column)
             (let [parent (entity! graph (get-in column [:reference :table]))
                   primary (first (filter :primary
                                          (:columns (tables (get-in column [:reference :table])))))]
               (swap! scope merge (select-keys parent [:class-table :class-context]))
               (assoc out key (get parent (keyword (str/replace (:sql-name primary) "_" "-")))))
             :else
             (assoc
              out
              key
              (case (:type column)
                "enum"
                (let [enum-name (name (get-in column [:spec :enum :ns]))]
                  (if (= enum-name "EnumClassType")
                    (if (= key :class-context) "Global" "User")
                    (ffirst
                     (sql/rows
                      @local/lock-connection
                      "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=? ORDER BY e.enumsortorder LIMIT 1"
                      enum-name))))
                "uuid" (str (java.util.UUID/randomUUID))
                ("integer" "bigint" "long") 1
                "boolean" false
                ("jsonb" "map") "{}"
                "array" "[]"
                "date" "2026-11-04"
                "timestamptz" 1793750400000000
                "text" (str table "-" (:name column) "-" id)
                (throw (ex-info "Fixture requires an explicit value"
                                {:table table :column column})))))))
       provided
       (:columns spec))
      values (merge values @scope)
      row (if (some #{:default} (vals values))
            (identity-insert! graph table values)
            (typed :t:insert
                   target
                   (literal values)
                   {:track {} :returning (set (map (comp keyword :name) (:columns spec)))}))]
     (swap! rows assoc table row)
     row)))

(defn sqlstate
  [work]
  (try (work)
       nil
       (catch Throwable failure
         (loop [cause failure]
           (if (instance? java.sql.SQLException cause)
             (.getSQLState ^java.sql.SQLException cause)
             (if-let [next (.getCause cause)]
               (recur next)
               (throw failure)))))))

(defn expect!
  [label expected actual]
  (when-not (= expected actual) (throw (ex-info label {:expected expected :actual actual}))))

(defn domain-behavior!
  [graph qualified row where]
  (let [table (name qualified)
        update! #(typed :t:update qualified {:where where :set % :track {}})
        saved #(typed :t:get qualified {:where where :single true})
        reject!
        (fn [values state]
          (let [before (saved)]
            (expect! (str table " rejects invalid state") state (sqlstate #(update! values)))
            (expect! (str table " failed write is atomic") before (saved))))]
    (case table
      "UserInvitationJoin" (reject! {:invitee (:inviter-id row)} "23514")
      "UserPointsEntry" (do (reject! {:points 2} "23514")
                            (update! {:reversed true})
                            (expect! "Reward reversal persists" true (:reversed (saved))))
      "UserRequestLimit" (do (update! {:count 4})
                             (expect! "Request counter persists per user" 4 (:count (saved))))
      "UserConnection" (do (reject! {:requested-by "outsider"} "23514")
                           (update! {:status "accepted"})
                           (expect! "Acceptance persists" "accepted" (:status (saved)))
                           (update! {:status "removed"})
                           (expect! "Removal persists" "removed" (:status (saved))))
      "EnvironmentJob"
      (do (reject! {:attempts -1} "23514")
          (reject! {:lease-token (str (java.util.UUID/randomUUID))} "23514")
          (update! {:lease-token (str (java.util.UUID/randomUUID)) :lease-until 4070908800000000})
          (expect! "A complete lease persists" true (some? (:lease-token (saved)))))
      "EnvironmentSnapshot" (do (reject! {:valid-to (:valid-from row)} "23514")
                                (reject! {:schema-version 0} "23514"))
      "SiteCatalog" (do (reject! {:revision -1} "23514") (reject! {:singleton false} "23514"))
      "SiteRevision" (do (update! {:status "submitted"})
                         (expect! "Revision submission persists" "submitted" (:status (saved))))
      "SiteProfile"
      (do (update! {:payload "{\"name\":\"Reviewed beach\"}"})
          (expect! "Site content round-trips" "Reviewed beach" (:name (:payload (saved)))))
      "MediaImport"
      (let [beach-id (:id (get @(:rows graph) "Beach"))
            owner (:owner-id row)
            session (logbook/insert-dive-session owner
                                                 beach-id
                                                 "{\"date\":\"2026-11-04\"}"
                                                 (op "session" owner))
            other (:id (:bob graph))
            foreign (logbook/insert-dive-session other
                                                 beach-id
                                                 "{\"date\":\"2026-11-04\"}"
                                                 (op "session" other))]
        (update! {:session (:id session)})
        (reject! {:session (:id foreign)} "23503")
        (expect! "Owned media retains its correct session" (:id session) (:session-id (saved)))
        (typed :t:delete
               'finfolkdb.common.type-logbook-base/DiveSession
               {:where {:id (:id session)}})
        (expect! "Deleting a dive detaches rather than deletes imported media"
                 nil
                 (:session-id (saved))))
      "AccessRequest"
      (let [values {:class-table (:class-table row)
                    :class-context (:class-context row)
                    :access (:access-id row)
                    :from (:from-id row)}]
        (expect! "One pending request per claimant"
                 "23505"
                 (sqlstate #(typed :t:insert qualified (literal values) {:track {}})))
        (update! {:status "accepted"})
        (expect! "Accepted requests do not block a new pending request"
                 "pending"
                 (:status (typed :t:insert qualified (literal values) {:track {}}))))
      nil)))

(defn persisted!
  [qualified]
  (let [graph (fixture-graph)
        table (name qualified)
        row (entity! graph table)
        columns (:columns ((:tables graph) table))
        where (into {}
                    (for [c columns
                          :when (:primary c)]
                      [(keyword (:name c))
                       (get row (keyword (str/replace (:sql-name c) "_" "-")))]))
        read-row #(typed
                   :t:get
                   qualified
                   {:where where :single true :returning (set (map (comp keyword :name) columns))})
        read-back (read-row)]
    (when-not (and (seq where) (= row (select-keys read-back (keys row))))
      (throw (ex-info "Persisted entity differs from its created values"
                      {:table table :created row :persisted read-back})))
    (when-let [reference (first (filter :reference columns))]
      (let [parent ((:tables graph) (get-in reference [:reference :table]))
            primary (first (filter :primary (:columns parent)))
            missing
            (if (= "uuid" (:type primary)) (str (java.util.UUID/randomUUID)) "0000-missing-parent")
            values (if (and (= table "UserConnection") (= "user" (:name reference)))
                     {:user missing :requested-by missing}
                     {(keyword (:name reference)) missing})
            state (sqlstate #(typed :t:update qualified {:where where :set values :track {}}))]
        (when-not (= "23503" state)
          (throw (ex-info "A linked entity must reject missing parents"
                          {:table table :reference (:name reference) :sqlstate state})))
        (when-not (= read-back (read-row))
          (throw (ex-info "Rejected relationship write changed persisted state" {:table table})))))
    (domain-behavior! graph qualified row where)
    true))

(defn concurrent-claims!
  [application account]
  (let [barrier (java.util.concurrent.CyclicBarrier. 2)
        claim (fn [commit?]
                (with-open [db (local/connection)]
                  (.setAutoCommit db false)
                  (try (.await barrier 15 java.util.concurrent.TimeUnit/SECONDS)
                       (let [result (ffirst (sql/rows db
                                                      "SELECT finfolk_rpc.claim_message(?,?)::text"
                                                      application
                                                      account))]
                         (if commit? (.commit db) (.rollback db))
                         (json/read result json/+keyword-case-mapper+))
                       (catch Throwable e (.rollback db) (throw e)))))
        first (future (claim true))
        second (future (claim false))
        committed @first
        rolled-back @second
        recovered (json/read (ffirst (sql/rows @local/lock-connection
                                               "SELECT finfolk_rpc.claim_message(?,?)::text"
                                               application
                                               account))
                             json/+keyword-case-mapper+)]
    (expect! "Concurrent workers claim different receipts"
             false
             (= (get-in committed [:receipt :id]) (get-in rolled-back [:receipt :id])))
    (expect! "Rolled-back receipt is recoverable"
             (get-in rolled-back [:receipt :id])
             (get-in recovered [:receipt :id]))
    true))
