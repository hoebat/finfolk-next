(ns finfolkbuild.testing.scaffold-common
  "Use code.manage to add executable contracts for common PostgreSQL declarations."
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [code.framework :as framework]
            [code.framework.cache :as cache]
            [code.manage :as manage]
            [code.manage.unit.scaffold :as scaffold]))

(defn source-namespaces []
  (sort
    (for [file (file-seq (io/file "src/finfolkdb/common"))
          :when (and (.isFile file) (str/ends-with? (.getName file) ".clj"))]
      (with-open [reader (java.io.PushbackReader. (io/reader file))]
        (binding [*read-eval* false] (second (read reader)))))))

(defn test-namespaces []
  (mapv #(symbol (str % "-test")) (source-namespaces)))

(def FUNCTION_FORMS
  {'auth-uid '(do (t/auth-uid) => "")
   'as-iso-time '(do (t/as-iso-time "2026-11-05T01:02:03.456+11") => "2026-11-04T14:02:03.456Z")
   'as-jsonb '(do (t/as-jsonb nil) => {} (t/as-jsonb "[]") => (throws))
   'as-jsonb-array '(do (t/as-jsonb-array nil) => [] (t/as-jsonb-array "{}") => (throws))
   'ret-social-url '(do (t/ret-social-url "instagram:alice") => "https://www.instagram.com/alice/" (t/ret-social-url "other:alice") => nil)
   'ret-social-urls '(do (t/ret-social-urls "[\"instagram:alice\",\"other:x\"]") => ["https://www.instagram.com/alice/"])
   'op-fn '(do (:tag (t/op-fn "runtime-test" "alice" {})) => "runtime-test")
   'ret-rev-default '(do (t/ret-rev-default "User" "Global" "missing") => nil)
   'sel-rev-all '(do (t/sel-rev-all "User" "Global") => nil)})

(defn fact-form [source var version]
  (str (format "^{:refer %s/%s :added %s}\n" source var (pr-str version))
       (cond
         (FUNCTION_FORMS var) (str "(fact " (pr-str (str var " executes directly on local PostgreSQL")) "\n  " (str/join "\n  " (map pr-str (rest (FUNCTION_FORMS var)))) ")")
         (str/starts-with? (name var) "Enum")
         (format "(fact %s\n  (binding [jdbc/*connection-fn* local/contract-connection] (common/check! '%s/%s))\n  => true)" (pr-str (str var " labels on local PostgreSQL")) source var)
         :else (format "(fact %s\n  (fixture/persisted! '%s/%s)\n  => true)" (pr-str (str var " persists linked data and rejects missing parents atomically")) source var))))

(defn covered-vars [path]
  (if (and path (.isFile (io/file (str path))))
    (set (for [[_ body] (re-seq #":covers\s+\[([^\]]+)\]" (slurp path))
               reference (str/split (str/trim body) #"\s+")]
           (symbol (name (symbol reference)))))
    #{}))

(defn check-coverage! []
  (binding [framework/*toplevel-forms* (conj framework/*toplevel-forms* 'defenum.pg 'pg/defsel.pg)]
    (with-redefs [cache/fetch (fn [& _] nil)]
      (doseq [source (source-namespaces)]
        (let [missing (manage/missing source {:print {:function false :summary false :result false :item false}})]
          (let [path (str "test/" (str/replace (str source) "." "/") "_test.clj")
                path (str/replace path "-" "_")
                text (slurp path)
                covered (set (map (comp symbol name symbol)
                              (mapcat #(str/split (second %) #"\s+")
                                      (re-seq #":covers\s+\[([^\]]+)\]" text))))
                missing (remove covered missing)]
          (when (re-find #"is reachable through the typed PostgreSQL runtime|\(fact \"TODO" text)
            (throw (ex-info "Application tests contain placeholder facts" {:namespace source})))
          (when (seq missing)
            (throw (ex-info "Common declarations need tests; run make scaffold-db-common"
                            {:namespace source :missing missing})))))))))

(defn -main [& _]
  (try
    ;; Extend only this invocation; leave the pinned foundation dependency intact.
    (binding [framework/*toplevel-forms* (conj framework/*toplevel-forms* 'defenum.pg 'pg/defsel.pg)
              scaffold/*ns-form-fn*
              (fn [source target _]
                (format "(ns %s\n  (:use code.test)\n  (:require [lang.core :as l]\n            [finfolkbuild.testing.local :as local]\n            [finfolkbuild.testing.jdbc :as jdbc]\n            [finfolkbuild.testing.common :as common]\n            [finfolkbuild.testing.behavior :as fixture]))\n\n(l/script- :postgres\n  {:runtime :jdbc.client\n   :config (local/config)\n   :require [[finfolkdb.main.scaffold-001-entity :as main] [%s :as t] [postgres.core :as pg]]})\n\n(fact:global {:setup [(local/setup!)]\n              :teardown [(local/teardown!)]})" target source))]
      (let [original-vars framework/vars]
      (with-redefs [scaffold/test-fact-form fact-form
                    framework/vars (fn [module params lookup project]
                                     (let [vars (original-vars module params lookup project)]
                                       (if (str/ends-with? (str module) "-test")
                                         (vec (distinct (concat vars (covered-vars (lookup module)))))
                                         vars)))
                    cache/fetch (fn [& _] nil)]
        (doseq [source (source-namespaces)]
          (manage/scaffold source {:write true :print {:function false :summary false :result false :item false}})))))
    (finally (shutdown-agents))))
