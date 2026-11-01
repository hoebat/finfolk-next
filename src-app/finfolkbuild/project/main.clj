(ns finfolkbuild.project.main
  "Reproducible publication from the pinned Foundation and FinFolk sources."
  (:require [clojure.java.io :as io]
            [clojure.string :as str]
            [std.json :as json]
            [lang.core.compile :as compile]
            [lang.core.impl :as impl]
            [lang.core.library :as library]
            [lang.core.library-snapshot :as snapshot]
            [finfolkbuild.db.publication :as db]
            [finfolkdb.testing.catalog :as catalog]
            [finfolk-web.lib.operations]
            [finfolk-web.lib.backbone]
            [finfolk-web.lib.application]
            [finfolk-web.lib.browser]
            [finfolk-web.lib.sqlite]
            [finfolk-web.lib.kernel]
            [finfolk-web.lib.sharedworker]
            [finfolk-web.lib.worker-bridge]))
(def WEB "js/finfolk-next/site/web-main/src")
(def EDGE "js/finfolk-next/packages/edge")
(def PREFIX {'finfolk-web.lib "@finfolk/edge" 'xt.lang "@xtalk/lang" 'xt.event "@xtalk/event"
             'xt.db "@xtalk/db" 'xt.substrate "@xtalk/substrate" 'xt.net "@xtalk/net"})
(defn links []
  (let [book (snapshot/get-book (library/get-snapshot (impl/runtime-library)) :js)]
    (compile/compile-module-create-links (keys (:modules book)) 'finfolk-web.lib
     {:path-suffix ".js" :root-prefix PREFIX :root-libs "." :path-separator "/"})))
(def GENERATED (atom #{}))
(defn write! [root path value]
  (swap! GENERATED conj path)
  (let [file (io/file root path)] (io/make-parents file) (spit file value)))
(defn json-pretty
  ([value] (str (json-pretty value 0) "\n"))
  ([value level]
   (let [pad #(apply str (repeat (* 2 %) " "))]
    (cond
     (map? value)
     (let [value (cond (and (contains? value "dependencies") (empty? (get value "dependencies"))) (dissoc value "dependencies")
                       (contains? value "dependencies") (update value "dependencies" #(into (sorted-map) %))
                       :else value)]
      (if (empty? value) "{}"
       (str "{\n" (str/join ",\n" (for [[k v] value] (str (pad (inc level)) (json/write (str k)) ": " (json-pretty v (inc level))))) "\n" (pad level) "}")))
     (sequential? value)
     (if (empty? value) "[]" (str "[\n" (str/join ",\n" (map #(str (pad (inc level)) (json-pretty % (inc level))) value)) "\n" (pad level) "]"))
     :else (json/write value)))))

(defn manifest! [root path data] (write! root path (json-pretty data)))
(defn xtalk-module [spec]
  (let [[_ family path] (re-matches #"@xtalk/([^/]+)/(.+)\.js" spec)]
    (symbol (if (and (= family "substrate") (= path "substrate")) "xt.substrate"
              (str "xt." family "." (str/replace path "/" "."))))))
(defn generate-xtalk! [root]
  (let [seen (atom #{})]
    (letfn [(emit! [spec]
              (when-not (@seen spec)
                (swap! seen conj spec)
                (let [module (xtalk-module spec)
                      [_ family path] (re-matches #"@xtalk/([^/]+)/(.+)\.js" spec)
                      target (str "js/finfolk-next/packages/libs/xt-" family)
                      output (str path ".js")]
                  (require module)
                  (swap! GENERATED conj (str target "/" output))
                  (compile/compile-module-single
                   {:lang :js :main module :root root :target target :file output
                    :emit {:compile {:type :directory :links (links)} :lang/format :commonjs
                           :code {:label false :link {:path-suffix ".js" :root-prefix PREFIX}}}})
                  (let [body (slurp (io/file root target output))]
                    (write! root (str target "/" output) (str "// Generated from " module "; do not edit.\n" (str/replace body #"(?m)[ \t]+$" "")))
                    (doseq [[_ dependency] (re-seq #"[\"'](@xtalk/[^\"']+\.js)[\"']" body)]
                      (emit! dependency))))))]
      (doseq [spec ["@xtalk/substrate/substrate.js" "@xtalk/substrate/page-core.js"
                    "@xtalk/event/base-model.js" "@xtalk/db/system/impl-memory.js" "@xtalk/db/system/memory-util.js" "@xtalk/net/conn-sql.js" "@xtalk/db/system/impl-sqlite.js"]] (emit! spec)))
    (doseq [family (sort (set (map #(second (str/split % #"/")) @seen)))]
      (manifest! root (str "js/finfolk-next/packages/libs/xt-" family "/package.json")
                 {"name" (str "@xtalk/" family) "version" "0.1.0" "private" true "license" "MIT"
                  "exports" {"./*.js" "./*.js"} "dependencies" (into (sorted-map)
                    (for [other (sort (disj
                        (set (for [spec @seen :when (str/starts-with? spec (str "@xtalk/" family "/"))
                                   :let [[_ _ path] (re-matches #"@xtalk/([^/]+)/(.+)\.js" spec)
                                         body (slurp (io/file root (str "js/finfolk-next/packages/libs/xt-" family "/" path ".js")))]
                                   [_ dependency] (re-seq #"@xtalk/([^/]+)/" body)] dependency)) family))]
                      [(str "@xtalk/" other) "workspace:*"]))})
      (write! root (str "js/finfolk-next/packages/libs/xt-" family "/LICENSE") (slurp "ref/foundation/LICENSE")))
    (manifest! root "resources/xtalk-publication.json" {"foundation" "f60ecc0c30247190fd3a1ea86973563c8f9501ac" "modules" (sort @seen)})))
(defn generate! [root]
  (reset! GENERATED #{})
  (generate-xtalk! root)
  (doseq [[module file] [['finfolk-web.lib.operations "operations.js"] ['finfolk-web.lib.backbone "backbone.js"]
                         ['finfolk-web.lib.application "application.js"] ['finfolk-web.lib.browser "browser.js"]
                         ['finfolk-web.lib.sqlite "sqlite.js"] ['finfolk-web.lib.kernel "kernel.js"]
                         ['finfolk-web.lib.sharedworker "sharedworker.js"] ['finfolk-web.lib.worker-bridge "worker-bridge.js"]]]
    (swap! GENERATED conj (str EDGE "/" file))
    (compile/compile-module-single
     {:lang :js :main module :root root :target EDGE :file file
      :emit {:compile {:type :directory :links (links)} :lang/format :module :code {:label false :link {:path-suffix ".js" :root-prefix PREFIX}}}})
    (let [path (str EDGE "/" file)] (write! root path (str "// Generated from " module "; do not edit.\n" (str/replace (slurp (io/file root path)) #"(?m)[ \t]+$" "")))))
  (write! root (str EDGE "/index.js") "// Generated by finfolkbuild.project.main.\nexport {createBackbone,stableKey} from './backbone.js';\nexport {createApplicationBackbone} from './application.js';\nexport {operations,operation,restOperation} from './operations.js';\n")
  (manifest! root (str EDGE "/package.json") {"name" "@finfolk/edge" "version" "0.1.0" "private" true "type" "module" "exports" {"." "./index.js" "./*.js" "./*.js"}
    "dependencies" {"@sqlite.org/sqlite-wasm" "3.54.1-build1" "@xtalk/net" "workspace:*" "@xtalk/lang" "workspace:*" "@xtalk/event" "workspace:*" "@xtalk/substrate" "workspace:*" "@xtalk/db" "workspace:*"}})
  (write! root "resources/finfolkdb/pilot.sql" (db/sql))
  (write! root "resources/finfolkdb/catalog.json" (str (json/write (catalog/declarations)) "\n"))
  (write! root (str WEB "/next-contracts.json") (db/contracts))
  (manifest! root "resources/generated-files.json" (sort (conj @GENERATED "resources/generated-files.json")))
  (println "Generated SQL, operation contracts, XTalk packages and FinFolk backbone."))
(defn -main [& args]
  (generate! (or (first args) "."))
  (shutdown-agents))
