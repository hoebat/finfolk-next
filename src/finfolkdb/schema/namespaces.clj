(ns finfolkdb.schema.namespaces
  "Discover authored type namespaces so new modules cannot silently evade tests."
  (:require [clojure.java.io :as io]
            [clojure.string :as str]))

(defn declarations
  []
  (let [entries
        (for [file (file-seq (io/file "src/finfolkdb"))
              :when (and (.isFile file)
                         (re-matches #"type_.*\.clj" (.getName file)))
              :let [form (with-open [reader (java.io.PushbackReader. (io/reader file))]
                           (binding [*read-eval* false] (read reader)))
                    expected (-> (str file)
                                 (str/replace #"^src/|\.clj$" "")
                                 (str/replace "/" ".")
                                 (str/replace "_" "-")
                                 symbol)]]
          (do
            (when-not (and (= 'ns (first form)) (= expected (second form)))
              (throw (ex-info "Type namespace must match its source path"
                              {:file (str file) :expected expected :form form})))
            [(second form) (str file)]))
        modules (into (sorted-map) entries)]
    (when-not (= (count entries) (count modules))
      (throw (ex-info "Duplicate type namespaces" {:entries entries})))
    modules))

(defn load-all!
  []
  (doseq [module (keys (declarations))]
    (require module)))
