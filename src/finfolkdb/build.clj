(ns finfolkdb.build
  "Standalone database publication. Generates files; never connects to PostgreSQL."
  (:require [clojure.java.io :as io]
            [finfolkdb.schema.entity :as entity]
            [finfolkdb.schema.account-access :as account-access]
            [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.entity-coverage :as coverage]
            [finfolkdb.schema.enums :as enums]
            [finfolkdb.schema.messaging :as messaging]
            [finfolkdb.schema.site-notes :as site-notes]
            [finfolkdb.schema.social :as social]
            [finfolkdb.schema.rebuild :as rebuild]
            [finfolkdb.schema.namespaces :as namespaces]
            [finfolkdb.schema.rpc-catalog :as rpc]
            [std.json :as json]
            [finfolkdb.schema.feature-flags :as flags]
            [finfolkdb.shop :as shop]))

(def SQL-OUTPUTS
  ["resources/finfolkdb/feature-flags.sql" "resources/finfolkdb/entity-schema.sql" "resources/finfolkdb/enums.sql"
   "resources/finfolkdb/rebuild.sql" "resources/finfolkdb/shop.sql"
   "resources/finfolkdb/messaging-grants.sql" "resources/finfolkdb/site-notes-grants.sql"
   "resources/finfolkdb/social-grants.sql" "resources/finfolkdb/account-grants.sql"])

(def JSON-OUTPUTS
  ["resources/finfolkdb/feature-flags.json" "resources/finfolkdb/entity-catalog.json" "resources/finfolkdb/entity-coverage.json"
   "resources/finfolkdb/enums.json" "resources/finfolkdb/rebuild-contract.json"
   "resources/finfolkdb/rpc-catalog.json" "resources/finfolkdb/type-namespaces.json"])

(defn sql-artifacts
  "Compiles executable SQL exclusively from finfolkdb source declarations."
  []
  (namespaces/load-all!)
  (sorted-map
   "resources/finfolkdb/feature-flags.sql" (flags/sql)
   "resources/finfolkdb/account-grants.sql" (account-access/grants-sql)
   "resources/finfolkdb/entity-schema.sql" (entity/sql)
   "resources/finfolkdb/enums.sql" (enums/sql)
   "resources/finfolkdb/rebuild.sql" (rebuild/sql)
   "resources/finfolkdb/shop.sql" (str "-- Generated from finfolkdb.shop/SQL.\n" shop/SQL)
   "resources/finfolkdb/messaging-grants.sql" (messaging/grants-sql)
   "resources/finfolkdb/site-notes-grants.sql" (site-notes/grants-sql)
   "resources/finfolkdb/social-grants.sql" (social/grants-sql)))

(defn json-artifacts
  "Publishes metadata from the loaded finfolkdb declarations, independently of SQL text."
  []
  (namespaces/load-all!)
  (sorted-map
   "resources/finfolkdb/feature-flags.json" (flags/json-artifact)
   "resources/finfolkdb/entity-catalog.json" (str (json/write (catalog/portable (catalog/declarations))) "\n")
   "resources/finfolkdb/entity-coverage.json" (str (json/write (coverage/current)) "\n")
   "resources/finfolkdb/enums.json" (str (json/write (enums/contracts)) "\n")
   "resources/finfolkdb/rebuild-contract.json" (str (json/write (rebuild/contracts)) "\n")
   "resources/finfolkdb/rpc-catalog.json" (str (json/write (rpc/declarations)) "\n")
   "resources/finfolkdb/type-namespaces.json"
   (str (json/write (into (sorted-map) (map (fn [[ns path]] [(str ns) path]) (namespaces/declarations)))) "\n")))

(defn artifacts
  "Combines independently generated SQL and JSON publications."
  []
  (into (sql-artifacts) (json-artifacts)))

(defn publish!
  ([root check?] (publish! root check? nil))
  ([root check? format]
   (doseq [[path content] (case format :sql (sql-artifacts) :json (json-artifacts) nil (artifacts))]
     (let [file (io/file root path)]
       (if check?
         (when-not (and (.isFile file) (= content (slurp file)))
           (throw (ex-info "Stale database artifact; run make generate-db" {:file path})))
         (do (io/make-parents file) (spit file content)))))))

(defn -main [& args]
  (try
    (when (or (some #(not (#{"--check" "--sql" "--json"} %)) args)
              (and (some #{"--sql"} args) (some #{"--json"} args)))
      (throw (ex-info "Use --sql or --json, optionally with --check" {:args args})))
    (publish! "." (boolean (some #{"--check"} args))
              (cond (some #{"--sql"} args) :sql (some #{"--json"} args) :json))
    (finally (shutdown-agents))))
