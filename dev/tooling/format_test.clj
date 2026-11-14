(ns tooling.format-test
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [clojure.test :refer :all]
            [tooling.format :as fmt]
            [zprint.core :as zp])
  (:import [java.nio.file Files]
           [java.nio.file.attribute FileAttribute]))

(defn options [] (fmt/read-config ".zprintrc"))

(deftest foundation-form-classifications
  (let [m (:fn-map (options))]
    (is (= "defn" (m "defn.pg") (m "defrun.pg") (m "defn.js")))
    (is (= "def" (m "defvar.xt")))
    (is (= :arg1-force-nl-body (first (m "deftype.pg")) (first (m "script-")) (m "fact")))
    (is (= {"custom" "let" "defn.pg" "defn"}
           (fmt/foundation-fn-map
            [{:lint-as {'example/custom 'clojure.core/let}
              :hooks {:analyze-call {'defn.pg 'clj-kondo.hooks.lang-postgres/defn-pg}}}])))))

(deftest reflows-existing-line-breaks
  (let
    [input
     "(defn.pg long-function [i-value] (let [v-first (+ i-value 1) v-second (+ v-first 2)] (return (+ v-first v-second))))"
     output (fmt/format-string input "test" (assoc (options) :width 60))]
    (is (> (count (str/split-lines output)) 1))
    (is (every? #(<= (count %) 60) (str/split-lines output)))
    (is (= output (fmt/format-string output "test" (assoc (options) :width 60))))
    (is (= (str/replace output "defn.pg" "defn")
           (fmt/format-string (str/replace input "defn.pg" "defn")
                              "test"
                              (assoc (options) :width 60)))))
  (is (str/includes? (fmt/format-string "(def values [1\n  2\n  3])" "test" (options)) "[1 2 3]")))

(deftest preserves-data-and-metadata
  (let
    [input
     "(deftype.pg ^{:final true :! (et/E {:class :0d/entry})} Entry [:id {:type :uuid :required true} :sql {:default \"a  b\\n c\"}])"
     output (fmt/format-string input "test" (options))]
    (is (= (read-string input) (read-string output)))
    (is (= (meta (second (read-string input))) (meta (second (read-string output)))))))

(deftest foundation-assertions-and-postgres-macros
  (let [input "(fact \"works\" (t/auth-uid) => \"\" (let [x 1] (inc x) => 2))"
        output (fmt/format-string input "test" (options))]
    (is (= "(fact \"works\"\n  (t/auth-uid) => \"\"\n  (let [x 1]\n    (inc x) => 2))\n" output))
    (is (= (read-string input) (read-string output)))
    (is (= output (fmt/format-string output "test" (options)))))
  (doseq [form ["t:insert" "t:get" "t:update" "g:insert" "g:select" "g:get"]]
    (is (= :arg1-body (get-in (options) [:fn-map form])))
    (let [input
          (str "(pg/"
               form
               " Table {:where {:owner-id user-id} :returning #{:id :name :status} :single true})")
          output (fmt/format-string input "test" (assoc (options) :width 60))]
      (is (= (read-string input) (read-string output)))
      (is (str/includes? output "\n  {")))))

(deftest script-options-have-one-entry-per-line
  (doseq [head ["l/script" "l/script-" "l/script+" "lang.core/script" "script"]]
    (let [input (str
                 "(" head
                 " :postgres {:require [[a.core :as a] [b.core :refer [x y]]] "
                 ":static {:application [\"app\"] :all {:schema [\"public\"] :owner \"app\"}}})")
          output (fmt/format-string input "test" (options))]
      (is (re-find #":require \[\[a\.core :as a\]\n +\[b\.core :refer \[x y\]\]\]" output))
      (is (re-find #":static \{:application \[\"app\"\]\n +:all" output))
      (is (re-find #":schema \[\"public\"\]\n +:owner" output))
      (is (= output (fmt/format-string output "test" (options))))))
  (is (= "(def config {:require [[a] [b]] :static {:a 1 :b 2}})\n"
         (fmt/format-string "(def config {:require [[a] [b]] :static {:a 1 :b 2}})"
                            "test"
                            (options)))))

(deftest when-bodies-start-on-a-new-line
  (is (= "(when ready?\n  (save!))\n"
         (fmt/format-string "(when ready? (save!))" "test" (options)))))

(deftest aligned-table-layout
  (let [input (str "(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none "
                   ":track :track/none :access :none})} Sample "
                   "[:name {:type :text :required true :sql {:default \"\"}} "
                   ":owner {:type :ref :required true :primary \"default\" "
                   ":ref {:ns -/User} :sql {:cascade true}}])")
        output (fmt/format-string input "test" (options))
        lines (str/split-lines output)
        name-line (first (filter #(str/includes? % "[:name") lines))
        owner-line (first (filter #(str/includes? % ":owner") lines))]
    (is (str/includes? output "\n  Sample\n  [:name"))
    (is (= (.indexOf name-line "{") (.indexOf owner-line "{")))
    (is (str/includes? name-line "{:type :text :required true"))
    (is (str/includes? owner-line "{:type :ref :required true :primary \"default\""))
    (is (str/includes? output ":ref {:ns -/User} :sql {:cascade true}"))
    (is (str/includes? output ":class  :0d/entry\n"))
    (is (str/includes? output ":id     :id/none\n"))
    (is (= output (fmt/format-string output "test" (options)))))
  (let
    [input
     "(deftype.pg ^{:final true} Commented [:name {;; Keep this explanation\n:type :text :required true}])"
     output (fmt/format-string input "test" (options))]
    (is (str/includes? output ";; Keep this explanation"))
    (is (= output (fmt/format-string output "test" (options))))))

(deftest skips-editor-files-and-symbolic-links
  (let [dir (.toFile (Files/createTempDirectory "zprint-fixture-" (make-array FileAttribute 0)))
        good (io/file dir "sample.clj")
        lock (io/file dir ".#sample.clj")
        link (io/file dir "linked.clj")
        hidden (io/file dir ".editor")
        hidden-file (io/file hidden "sample.clj")]
    (try (spit good "(def value 1)\n")
         (Files/createSymbolicLink (.toPath lock)
                                   (.toPath (io/file dir "missing"))
                                   (make-array FileAttribute 0))
         (Files/createSymbolicLink (.toPath link) (.toPath good) (make-array FileAttribute 0))
         (.mkdir hidden)
         (spit hidden-file "(def hidden 1)\n")
         (is (= [good] (vec (fmt/source-files [(str dir)]))))
         (finally (doseq [file [hidden-file hidden link lock good dir]]
                    (io/delete-file file true))))))

(deftest checks-before-writing
  (let [dir (.toFile (Files/createTempDirectory "zprint-atomic-" (make-array FileAttribute 0)))
        good (io/file dir "a.clj")
        bad (io/file dir "b.clj")
        input "(defn sample[x](+ x 1))"]
    (try (spit good input)
         (spit bad "(")
         (is (thrown? Exception (fmt/run-format! "fix" [(str dir)])))
         (is (= input (slurp good)))
         (io/delete-file bad)
         (binding [*out* (java.io.StringWriter.)]
           (is (= 1 (fmt/run-format! "check" [(str dir)])))
           (is (= input (slurp good)))
           (is (= 0 (fmt/run-format! "fix" [(str dir)])))
           (is (= 0 (fmt/run-format! "check" [(str dir)]))))
         (finally (doseq [file [bad good dir]] (io/delete-file file true))))))

(deftest preserves-concurrent-edits
  (let [dir (.toFile (Files/createTempDirectory "zprint-edited-" (make-array FileAttribute 0)))
        file (io/file dir "edited.clj")
        edited "(def saved-by-another-editor true)\n"]
    (try (spit file "(defn sample[x](+ x 1))")
         (let [format-original fmt/format-string]
           (with-redefs [fmt/format-string (fn [text filename opts]
                                             (let [result (format-original text filename opts)]
                                               (spit file edited)
                                               result))]
             (binding [*out* (java.io.StringWriter.)]
               (is (thrown-with-msg? clojure.lang.ExceptionInfo
                                     #"File changed while formatting"
                                     (fmt/run-format! "fix" [(str file)]))))))
         (is (= edited (slurp file)))
         (finally (io/delete-file file true) (io/delete-file dir true)))))

(defn -main
  [& _]
  (zp/set-options! {:configured? true})
  (let [{:keys [fail error]} (run-tests 'tooling.format-test)]
    (shutdown-agents)
    (System/exit (if (zero? (+ fail error)) 0 1))))
