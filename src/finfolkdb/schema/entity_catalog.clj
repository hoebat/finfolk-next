(ns finfolkdb.schema.entity-catalog
  "Resolved entity declarations, including fields contributed by addons."
  (:require [clojure.string :as str]
            [clojure.walk :as walk]
            [finfolkdb.main.scaffold-001-entity]
            [lang.core.impl :as impl]
            [lang.core.library :as library]
            [lang.core.library-snapshot :as snapshot]))

;;
;; Entity Metadata
;;

(defn entry [{:keys [module id]}] (impl/get-entry (impl/runtime-library) :postgres module id))

(defn reference
  [{:keys [link]}]
  (when link
    (let [target (entry link)]
      {:table (str (:id target))
       :module (str (:module target))
       :primary (mapv (comp name :id)
                      (let [primary (:static/schema-primary target)]
                        (if (map? primary) [primary] primary)))})))

(defn column
  [[key spec]]
  (cond-> {:name (name key)
           :sql-name (str (str/replace (name key) "-" "_")
                          (when (= :ref (:type spec))
                            "_id"))
           :type (name (:type spec))
           :required (boolean (or (:required spec) (:primary spec)))
           :primary (boolean (:primary spec))
           :spec spec}
    (:ref spec) (assoc :reference (reference (:ref spec)))))

(defn declarations
  []
  (let [book (snapshot/get-book (library/get-snapshot (impl/runtime-library)) :postgres)
        entries (for [module (vals (:modules book))
                      table (vals (:code module))
                      :when (and (= :table (:static/dbtype table))
                                 (some #{"finfolk-entity"} (:static/application table)))]
                  table)]
    (when-not (= (count entries) (count (distinct (map :id entries))))
      (throw (ex-info "Duplicate fresh entity table names" {:tables (mapv :id entries)})))
    (into (sorted-map)
          (for [table entries]
            [(str (:id table))
             {:module (str (:module table))
              :entity (:api/input table)
              :legacy-tables (or (:finfolk/legacy-tables table)
                                 (:finfolk/legacy-tables (meta (second (:form table))))
                                 [])
              :columns (mapv column (partition 2 (nth (:form table) 2)))
              :constraints (:constraints (nth (:form table) 3))}]))))

(defn portable
  "Keep runtime pointers and callable objects out of the published contract."
  [value]
  (walk/postwalk (fn [item]
                   (cond (symbol? item) (str item)
                         (keyword? item) (if-let [ns (namespace item)]
                                           (str ns "/" (name item))
                                           (name item))
                         (set? item) (vec (sort-by str item))
                         :else item))
                 value))
