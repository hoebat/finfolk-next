(ns finfolkdb.build
  "Standalone database publication. Generates files; never connects to PostgreSQL."
  (:require [clojure.java.io :as io]
            [finfolkdb.schema.entity :as entity]
            [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.entity-coverage :as coverage]
            [finfolkdb.schema.enums :as enums]
            [finfolkdb.schema.messaging :as messaging]
            [finfolkdb.schema.site-notes :as site-notes]
            [finfolkdb.schema.rebuild :as rebuild]
            [finfolkdb.schema.namespaces :as namespaces]
            [finfolkdb.schema.rpc-catalog :as rpc]
            [std.json :as json]
            [finfolkdb.shop :as shop]))

(defn artifacts
  []
  (namespaces/load-all!)
  (into (sorted-map)
    {"resources/finfolkdb/rebuild.sql" (rebuild/sql)
     "resources/finfolkdb/rebuild-contract.json" (str (json/write (rebuild/contracts)) "\n")
     "resources/finfolkdb/shop.sql" (str "-- Generated from finfolkdb.shop/SQL.\n" shop/SQL)
     "resources/finfolkdb/messaging-grants.sql" (messaging/grants-sql)
     "resources/finfolkdb/site-notes-grants.sql" (site-notes/grants-sql)
     "resources/finfolkdb/entity-schema.sql" (entity/sql)
     "resources/finfolkdb/rpc-catalog.json" (str (json/write (rpc/declarations)) "\n")
     "resources/finfolkdb/entity-catalog.json" (str (json/write (catalog/portable (catalog/declarations))) "\n")
     "resources/finfolkdb/entity-coverage.json" (str (json/write (coverage/current)) "\n")
     "resources/finfolkdb/type-namespaces.json" (str (json/write (into (sorted-map) (map (fn [[ns path]] [(str ns) path]) (namespaces/declarations)))) "\n")
     "resources/finfolkdb/enums.sql" (enums/sql)
     "resources/finfolkdb/enums.json" (str (json/write (enums/contracts)) "\n")}))

(defn publish!
  [root check?]
  (doseq [[path content] (artifacts)]
    (let [file (io/file root path)]
      (if check?
        (when-not (and (.isFile file) (= content (slurp file)))
          (throw (ex-info "Stale database artifact; run make generate-db" {:file path})))
        (do (io/make-parents file) (spit file content))))))

(defn -main
  [& args]
  (try
    (publish! "." (= ["--check"] (vec args)))
    (finally (shutdown-agents))))
