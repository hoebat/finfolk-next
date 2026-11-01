(ns finfolkdb.testing.catalog
  "Read the authored table contracts without executing or installing their SQL."
  (:require [clojure.java.io :as io] [clojure.string :as str]))
(defn declarations []
  (into (sorted-map)
    (for [file (sort (filter #(re-matches #"type_.*\.clj" (.getName %))
                            (file-seq (io/file "src/finfolkdb/common"))))
          form (with-open [reader (java.io.PushbackReader. (io/reader file))]
                 (binding [*read-eval* false]
                   (doall (take-while #(not= ::end %) (repeatedly #(read reader false ::end))))))
          :when (and (seq? form) (= 'deftype.pg (first form)))
          :let [[_ table columns] form]]
      [(name table)
       {:columns (mapv (fn [[column spec]]
                         {:name (str/replace (name column) "-" "_")
                          :type (name (:type spec)) :nullable (not (:required spec))
                          :default (:finfolk/default-sql spec)
                          :identity (or (:finfolk/identity spec) "")})
                       (partition 2 columns))
        :constraints (:finfolk/constraints (meta table))}])))
