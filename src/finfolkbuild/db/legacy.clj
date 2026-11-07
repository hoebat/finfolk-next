(ns finfolkbuild.db.legacy
  "Frozen release fixtures for the pre-entity API; never an active schema model."
  (:require [clojure.java.io :as io]
            [std.json :as json]))

(defn artifact
  [name]
  (slurp (io/resource (str "finfolkbuild/legacy/" name))))

(defn declarations
  []
  (into (sorted-map)
    (map (fn [[table spec]]
           [table {:columns (mapv #(into {} (map (fn [[k v]] [(keyword k) v]) %))
                                  (get spec "columns"))
                   :constraints (get spec "constraints")}]))
    (json/read (artifact "catalog.json"))))

(defn sql [] (artifact "pilot.sql"))
(defn contracts [] (artifact "contracts.json"))
(defn schema-sql [] (artifact "site-schema.sql"))
(defn indexes-json [] (artifact "indexes.json"))

(defn publish!
  [root]
  (let [file (io/file root "resources/finfolkdb/schema.sql")]
    (io/make-parents file)
    (spit file (artifact "schema.sql"))))
