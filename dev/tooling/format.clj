(ns tooling.format
  "Project-local zprint runner and Foundation clj-kondo form adapter."
  (:require [clojure.edn :as edn]
            [clojure.java.io :as io]
            [clojure.pprint :as pprint]
            [clojure.string :as str]
            [rewrite-clj.node :as node]
            [rewrite-clj.parser :as parser]
            [zprint.core :as zp])
  (:import [java.nio.file Files]
           [java.security MessageDigest]))

(def hook-styles
  {"defn-pg" "defn"
   "defn-xt" "defn"
   "defgen-xt" "defn"
   "def-xt" "def"
   "defvar-xt" "def"
   "defglobal-xt" "def"
   "defspec-xt" "def"
   "defimpl-xt" "def"
   "defmacro-xt" "defmacro"
   "defprotocol-xt" "defprotocol"
   "deftype-pg" [:arg1-force-nl-body
                 {:meta {:split? true}
                  :binding {:justify? true :justify {:max-variance 1000}}
                  :fn-map {"E" [:arg1-body {:map {:force-nl? true
                                                  :justify? true
                                                  :justify {:max-variance 1000}
                                                  :key-value-options
                                                  {:id {:map {:force-nl? false :justify? false}}
                                                   :track {:map {:force-nl? false :justify? false}}
                                                   :access {:map {:force-nl? false
                                                                  :justify? false}}}}}]}}]
   "script" [:arg1-force-nl-body
             {:map {:key-value-options
                    {:require {:vector {:wrap? false :force-nl? true}
                               :next-inner {:next-inner {:vector {:wrap? true :force-nl? false}}}}
                     :static {:map {:force-nl? true
                                    :justify? true
                                    :justify {:max-variance 1000}}}}}}]
   "fact-xt" :arg1-force-nl-body
   "fact-global-xt" :none-body})

(defn foundation-fn-map
  "Translate lint-as aliases and hook classifications; never execute lint hooks.
   Zprint also resolves qualified calls by their unqualified form name."
  [configs]
  (let [lint-as (apply merge (map :lint-as configs))
        hooks (apply merge (map #(get-in % [:hooks :analyze-call]) configs))]
    (into (sorted-map)
          (concat (for [[form target] lint-as]
                    [(name form) (if (= "quote" (name target)) :none (name target))])
                  (for [[form hook] (sort-by (comp str key) hooks)
                        :let [style (hook-styles (name hook))]
                        :when style]
                    [(name form) style])))))

(defn read-config [file] (edn/read-string (slurp file)))

(defn postgres-macro-styles
  [files]
  (into (sorted-map)
        (for [file files
              form (with-open [reader (java.io.PushbackReader. (io/reader file))]
                     (binding [*read-eval* false]
                       (doall (take-while #(not= ::eof %)
                                          (repeatedly #(read {:eof ::eof} reader))))))
              :when (and (seq? form) (= 'defmacro.pg (first form)))
              :let [macro-name (second form)
                    indent (:style/indent (meta macro-name))]
              :when (and (symbol? macro-name) (re-find #"^[tg]:" (name macro-name)))]
          [(name macro-name)
           (case indent
             0 :none-body
             1 :arg1-body
             2 :arg2-body
             (throw (ex-info "Unsupported PostgreSQL macro indentation"
                             {:macro macro-name :indent indent})))])))

(defn write-emacs-data!
  [fn-map]
  (let [indent (fn [form style]
                 (let [style (if (vector? style) (first style) style)]
                   (cond (#{"fact" "deftype.pg"} form) ":defn"
                         (#{"defn" "def" "defmacro"} style) ":defn"
                         (= style "defrecord") 2
                         (= style "defprotocol") 1
                         (#{:arg1-body :arg1-force-nl-body} style) 1
                         (= style :arg2-body) 2
                         :else 0)))]
    (.mkdirs (io/file "dev/emacs"))
    (spit
     "dev/emacs/foundation-form-data.el"
     (str
      ";;; foundation-form-data.el --- Foundation form classifications -*- lexical-binding: t; -*-\n"
      ";; Generated from Foundation clj-kondo config and PostgreSQL :style/indent metadata.\n"
      "(defconst foundation-format-form-indents\n  '("
      (str/join "\n    "
                (for [[form style] fn-map] (str "(" (pr-str form) " . " (indent form style) ")")))
      "))\n(provide 'foundation-form-data)\n"))))

(defn sync-kondo!
  [foundation-root]
  (let [paths ["resources/clj-kondo.exports/zcaudate/lang/config.edn" ".clj-kondo/config.edn"]
        macro-paths ["src-lang/postgres/core/impl.clj" "src-lang/postgres/core/graph.clj"]
        macro-files (mapv #(io/file foundation-root %) macro-paths)
        files (mapv #(io/file foundation-root %) paths)
        configs (mapv read-config files)
        fingerprint (format "%064x"
                            (java.math.BigInteger.
                             1
                             (.digest (MessageDigest/getInstance "SHA-256")
                                      (.getBytes (str/join "\n"
                                                           (map slurp (concat files macro-files)))
                                                 "UTF-8"))))
        existing
        (if (.isFile (io/file ".zprintrc"))
          (read-config ".zprintrc")
          {:width 100 :style :community :map {:sort? false :comma? false} :set {:sort? false}})
        options (assoc existing
                       :fn-map
                       (merge (foundation-fn-map configs)
                              (postgres-macro-styles macro-files)
                              ;; PostgreSQL declarations created by the script hook
                              ;; have no individual analyzer hook in Foundation.
                              {"defenum.pg" :arg1-body
                               "defindex.pg" :arg1-body
                               "defpolicy.pg" :arg1-body
                               "deftrigger.pg" :arg1-body
                               "when" :arg1-force-nl-body}))]
    (spit
     ".zprintrc"
     (str
      "; Foundation clj-kondo form mappings, generated by lein zprint sync-kondo.
; Sources: resources/clj-kondo.exports/zcaudate/lang/config.edn and .clj-kondo/config.edn
; PostgreSQL macro metadata: src-lang/postgres/core/impl.clj and graph.clj
; Source SHA-256: "
      fingerprint
      "\n"
      (with-out-str (pprint/pprint options))))
    (write-emacs-data! (:fn-map options))
    (println "Wrote .zprintrc with" (count (:fn-map options)) "Foundation form mappings.")))

(defn symlink? [file] (Files/isSymbolicLink (.toPath (io/file file))))

(defn source-file?
  [file]
  (let [file (io/file file)]
    (and (.isFile file)
         (not (symlink? file))
         (not (re-find #"^[.#]" (.getName file)))
         (re-matches #".*\.clj[cs]?$" (.getName file)))))

(defn source-files
  [paths]
  (->> paths
       (mapcat (fn [path]
                 (let [root (io/file path)]
                   (when-not (.exists root) (throw (ex-info (str "No such path: " path) {})))
                   (when (symlink? root)
                     (throw (ex-info (str "Refusing symbolic-link root: " path) {})))
                   (tree-seq
                    #(and (.isDirectory %) (not (symlink? %)) (not (re-find #"^[.#]" (.getName %))))
                    #(seq (.listFiles %))
                    root))))
       (filter source-file?)
       (sort-by str)
       distinct))

(def assertion-arrows '#{=> =not=> =throws=> =future=> =eventually=>})

(defn assertion-guide
  ([] "Foundation fact assertions")
  ([_ _ forms]
   (let [head (when (symbol? (first forms))
                (name (first forms)))
         fact? (= head "fact")]
     (when (or fact? (some assertion-arrows forms))
       (let [header-count (cond fact? (if (string? (second forms)) 2 1)
                                (#{"let" "loop" "binding" "doseq" "when" "if"} head) 2
                                :else 1)
             binding? (#{"let" "loop" "binding" "doseq"} head)
             header (if binding? [:element :element-binding-vec] (repeat header-count :element))
             guide (loop [remaining (drop header-count forms)
                          guide (vec (concat header [:indent 2]))]
                     (if (seq remaining)
                       (if (and (assertion-arrows (second remaining)) (<= 3 (count remaining)))
                         (recur (drop 3 remaining)
                                (into guide
                                      [:newline :group-begin :element :element :element :group-end
                                       :element-wrap-flow-group]))
                         (recur (next remaining) (into guide [:newline :element-best])))
                       guide))]
         {:guide guide :fn-style :guided-body})))))

(defn schema-vector-options
  ([] "PostgreSQL field pairs")
  ([_ _ forms]
   (when (and (seq forms)
              (even? (count forms))
              (every? (fn [[field spec]] (and (keyword? field) (map? spec))) (partition 2 forms)))
     {:map {:respect-nl? true}
      :guide (vec (concat [:group-begin]
                          (repeat (count forms) :element)
                          [:group-end :element-binding-group]))})))

(defn significant-children
  [n]
  (remove #(#{:whitespace :newline :comma} (node/tag %)) (node/children n)))

(defn field-spec-layout
  "Normalize field-map breaks before zprint measures and aligns the table."
  [n]
  (let [children (vec (significant-children n))
        pairs (partition 2 children)]
    ;; Preserve comment/discard placement and unfamiliar map syntax verbatim.
    (if (and (even? (count children))
             (not-any? #(#{:comment :uneval} (node/tag %)) children)
             (every? #(and (= :token (node/tag (first %))) (keyword? (node/sexpr (first %))))
                     pairs))
      (let [nested-index (first (keep-indexed (fn [index [_ value]]
                                                (when (= :map (node/tag value))
                                                  index))
                                              pairs))]
        (node/replace-children
         n
         (mapcat (fn [index [key value]]
                   (concat (when (pos? index)
                             [(if (= index nested-index) (node/newlines 1) (node/spaces 1))])
                           [key (node/spaces 1) value]))
          (range)
          pairs)))
      n)))

(defn next-column
  [column text]
  (if (str/includes? text "\n") (count (last (str/split text #"\n" -1))) (+ column (count text))))

(defn aligned-field-spec
  "Keep scalar attributes together, then pack nested attributes within WIDTH.
   Multiline values retain their zprint indentation; entries are never reordered."
  [n column width]
  (let [children (vec (significant-children n))
        pairs (partition 2 children)
        indent (inc column)]
    (if (and (even? (count children))
             (not-any? #(#{:comment :uneval} (node/tag %)) children)
             (every? #(and (= :token (node/tag (first %))) (keyword? (node/sexpr (first %))))
                     pairs))
      (let [nested-index (first (keep-indexed (fn [index [_ value]]
                                                (when (= :map (node/tag value))
                                                  index))
                                              pairs))]
        (node/replace-children
         n
         (loop [remaining pairs
                index 0
                current-column indent
                out []]
           (if-let [[key value] (first remaining)]
             (let [pair-text (str (node/string key) " " (node/string value))
                   newline? (and (pos? index)
                                 (or (= index nested-index)
                                     (str/includes? pair-text "\n")
                                     (> (+ current-column 1 (count pair-text)) (- width 3))))
                   padding (cond (zero? index) []
                                 newline? [(node/newlines 1) (node/spaces indent)]
                                 :else [(node/spaces 1)])
                   start (cond (zero? index) indent
                               newline? indent
                               :else (inc current-column))]
               (recur (next remaining)
                      (inc index)
                      (next-column start pair-text)
                      (into out (concat padding [key (node/spaces 1) value]))))
             out))))
      n)))

(defn finish-table-layout
  "Reflow only direct table field maps, tracking their actual output columns."
  [n column role width]
  (let [table? (and (= :list (node/tag n))
                    (= "deftype.pg"
                       (some-> (first (significant-children n))
                               node/string
                               (str/split #"/")
                               last)))
        n (if (node/inner? n)
            (node/replace-children
             n
             (loop [remaining (node/children n)
                    col (+ column (node/leader-length n))
                    out []]
               (if-let [child (first remaining)]
                 (let [child-role (cond (and table? (= :vector (node/tag child))) :fields
                                        (and (= role :fields) (= :map (node/tag child))) :spec)
                       updated (finish-table-layout child col child-role width)]
                   (recur (next remaining)
                          (next-column col (node/string updated))
                          (conj out updated)))
                 out)))
            n)]
    (if (= role :spec) (aligned-field-spec n column width) n)))

(defn table-layout
  [n]
  (let [n (if (node/inner? n) (node/replace-children n (map table-layout (node/children n))) n)]
    (if (and (= :list (node/tag n))
             (= "deftype.pg"
                (some-> (first (significant-children n))
                        node/string
                        (str/split #"/")
                        last)))
      (node/replace-children n
                             (for [child (node/children n)]
                               (if (= :vector (node/tag child))
                                 (node/replace-children
                                  child
                                  (for [field (node/children child)]
                                    (if (= :map (node/tag field)) (field-spec-layout field) field)))
                                 child)))
      n)))

(defn syntax-content
  [n]
  (when-not (#{:whitespace :newline :comma :comment} (node/tag n))
    (if (node/inner? n)
      [(node/tag n) (vec (keep syntax-content (node/children n)))]
      [(node/tag n) (node/string n)])))

(defn format-string
  [text filename options]
  (let [prepared (node/string (table-layout (parser/parse-string-all text)))
        printed (zp/zprint-file-str prepared
                                    filename
                                    (-> options
                                        (assoc-in [:list :option-fn] assertion-guide)
                                        (assoc-in [:vector :option-fn] schema-vector-options)))
        formatted
        (node/string
         (finish-table-layout (parser/parse-string-all printed) 0 nil (:width options 100)))]
    (when-not (= (syntax-content (parser/parse-string-all text))
                 (syntax-content (parser/parse-string-all formatted)))
      (throw (ex-info (str "Formatter changed source tokens: " filename) {})))
    (str (str/replace formatted #"\n*$" "") "\n")))

(defn run-format!
  [command paths]
  ;; Project configuration is deterministic and independent of ~/.zprintrc.
  (zp/set-options! {:configured? true})
  (let [options (read-config ".zprintrc")
        files (source-files paths)
        changes (doall (for [file files
                             :let [before (slurp file)
                                   after (format-string before (str file) options)]
                             :when (not= before after)]
                         [file before after]))]
    (when (empty? files)
      (throw (ex-info "No Clojure source files found in the supplied paths" {})))
    ;; Parse every file before writing, avoiding a partially formatted tree if
    ;; one source file cannot be parsed.
    (doseq [[file before text] changes]
      (println (if (= command "fix") "Formatting" "Needs formatting:") (str file))
      (when (= command "fix")
        (when-not (= before (slurp file))
          (throw (ex-info (str "File changed while formatting; retry: " file) {})))
        (spit file text)))
    (println (count changes)
             "of"
             (count files)
             (if (= command "fix") "files reformatted." "files need formatting."))
    (if (and (= command "check") (seq changes)) 1 0)))

(defn -main
  [& [command & paths]]
  (try
    (let
      [status
       (cond
         (and (= command "sync-kondo") (= 1 (count paths))) (do (sync-kondo! (first paths)) 0)
         (and (#{"fix" "check"} command) (seq paths)) (run-format! command paths)
         (= command "stdin") (do (zp/set-options! {:configured? true})
                                 (print (format-string (slurp *in*)
                                                       (or (first paths) "stdin")
                                                       (read-config ".zprintrc")))
                                 (flush)
                                 0)
         :else
         (do (println
              "Usage: lein zprint fix|check PATH...\n       lein zprint sync-kondo FOUNDATION_ROOT")
             2))]
      (shutdown-agents)
      (System/exit status))
    (catch Exception e
      (binding [*out* *err*] (println (.getMessage e)))
      (shutdown-agents)
      (System/exit 2))))
