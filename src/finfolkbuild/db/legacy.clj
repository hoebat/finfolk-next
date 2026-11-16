(ns finfolkbuild.db.legacy
  "Historical JSON metadata for compatibility and coverage; SQL publication is owned by finfolkdb."
  (:require [clojure.java.io :as io]
            [std.json :as json]))

(defn artifact
  [name]
  (when-not (.endsWith ^String name ".json")
    (throw (ex-info "SQL snapshots are retired; generate the current finfolkdb schema"
                    {:artifact name :reason :retired-sql-source})))
  (slurp (io/resource (str "finfolkbuild/legacy/" name))))

(defn declarations
  []
  (into (sorted-map)
    (map (fn [[table spec]]
           [table {:columns (mapv #(into {} (map (fn [[k v]] [(keyword k) v]) %))
                                  (get spec "columns"))
                   :constraints (get spec "constraints")}]))
    (json/read (artifact "catalog.json"))))

(defn contracts [] (artifact "contracts.json"))
(defn indexes-json [] (artifact "indexes.json"))
