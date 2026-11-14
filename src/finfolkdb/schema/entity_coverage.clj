(ns finfolkdb.schema.entity-coverage
  "Track historical-table replacement declarations without claiming API completion."
  (:require [finfolkbuild.db.legacy :as legacy]
            [finfolkdb.schema.entity-catalog :as entity]))

(defn report
  [historical fresh]
  (let [pairs (for [[name spec] fresh table (:legacy-tables spec)] [table name])
        mappings (into (sorted-map) pairs)]
    (when-not (= (count pairs) (count mappings))
      (throw (ex-info "Duplicate historical-table entity mapping" {:mappings pairs})))
    (doseq [table (keys mappings)]
      (when-not (contains? historical table)
        (throw (ex-info "Unknown historical table in entity mapping" {:table table}))))
    {:historical-total (count historical)
     :mapped-total (count mappings)
     :mappings mappings
     :remaining (vec (sort (remove #(contains? mappings %) (keys historical))))}))

(defn current [] (report (legacy/declarations) (entity/declarations)))
