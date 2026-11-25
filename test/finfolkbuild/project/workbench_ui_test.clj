(ns finfolkbuild.project.workbench-ui-test
  (:require [lang.core :as l] [app.manage.make :as make] [app.manage.server :as server]
            [app.manage.process :as process] [clojure.java.io :as io] [clojure.data.json :as json]
            [finfolkbuild.project.management :as management])
  (:use code.test))
(l/script- :js {:import [["playwright" :as playwright]] :static {:export [inspectWorkspace inspectDevServer]}})
(defn.js ^{:- [:async]} inspectWorkspace [origin]
  (var browser (await (playwright.chromium.launch {"headless" true})))
  (try
    (var page (await (browser.newPage {"viewport" {"width" 1500 "height" 1000}})))
    (var errors [])
    (page.on "pageerror" (fn [error] (. errors (push error.stack))))
    (await (page.goto origin))
    (var filter (page.locator ".inspector [data-file-filter]"))
    (await (. filter (first) (fill "type_social_base.clj")))
    (var matches (await (. (page.locator ".inspector .file-row:visible") (count))))
    (await (. (page.getByRole "button" {"name" "type_social_base.clj" "exact" true}) (first) (click)))
    (await (. (page.locator ".monaco-editor") (waitFor)))
    (await (. (page.getByLabel "Go to line") (fill "67")))
    (await (. (page.getByLabel "Go to line") (press "Enter")))
    (await (page.waitForFunction (fn [] (return (. (. (document.querySelector ".view-lines") textContent) (includes "ret-social-url"))))))
    (var readable (> (await (. (page.locator ".monaco-editor") (evaluate (fn [element] (return element.clientHeight))))) 200))
    (var position (await (page.evaluate (fn [] (return (. (. (. (window.monaco.editor.getEditors) [0]) (getPosition)) lineNumber))))))
    (await (. (page.getByRole "button" {"name" "Close" "exact" true}) (click)))
    (await (. (page.getByRole "button" {"name" "Source & tests" "exact" true}) (click)))
    (await (. (page.locator "#unit-query") (fill "ret-social-url")))
    (await (. (page.getByRole "button" {"name" "Scan / search" "exact" true}) (click)))
    (await (. (page.locator ".unit-list [data-unit]") (first) (click)))
    (await (. (page.getByRole "button" {"name" "Run namespace" "exact" true}) (first) (click)))
    (await (. (page.locator ".test-namespace > summary") (filter {"hasText" "finfolkdb.common.type-social-base-test · ok"}) (waitFor {"timeout" 120000})))
    (var response (await (page.request.get (+ origin "/api/state"))))
    (var snapshot (await (response.json)))
    (var run (. snapshot.runs (find (fn [r] (return (== r.operation "run-test-namespaces"))))))
    (var values (. (. run.result.report.namespaces [0] assertions) (map (fn [a] (return a.data)))))
    ;; A synthetic historical failure tests presentation/navigation only; the PG values above are real.
    (var failure (page.locator "[data-folder='run:failure-ui']"))
    (when (not (await (failure.evaluate (fn [element] (return element.open)))))
      (await (. (. failure (locator ":scope > summary")) (click))))
    (await (. (. failure (locator ".test-fact > summary")) (click)))
    (await (. (. failure (locator ".test-assertion [data-source]")) (click)))
    (await (. (page.locator ".monaco-editor") (waitFor)))
    (var failureLine (await (page.evaluate (fn [] (return (. (. (. (window.monaco.editor.getEditors) [0]) (getPosition)) lineNumber))))))
    (return {"matches" matches "readable" readable "line" position "failure-line" failureLine "values" values "errors" errors})
    (catch error (throw error))
    (finally (await (browser.close)))))
(defn.js ^{:- [:async]} inspectDevServer [origin endpoint]
  (var browser (await (playwright.chromium.launch {"headless" true})))
  (try
    (var page (await (browser.newPage)))
    (var errors [])
    (page.on "pageerror" (fn [error] (. errors (push error.stack))))
    (await (page.goto (+ origin "?view=servers")))
    (var card (page.locator "[data-server-card='nextjs']"))
    (await (. (card.getByRole "button" {"name" "Start" "exact" true}) (click)))
    (await (. (card.locator "header .status") (filter {"hasText" "running"}) (waitFor {"timeout" 90000})))
    (var initial (await (. (card.locator "header code") (innerText))))
    (var first (await (page.request.get endpoint {"maxRedirects" 0 "timeout" 90000})))
    (await (. (page.getByRole "button" {"name" "Previews" "exact" true}) (click)))
    (await (. (page.locator ".preview-stage iframe") (evaluate (fn [frame] (:= frame.dataset.persisted "yes")))))
    (await (page.request.get endpoint {"maxRedirects" 0}))
    (await (page.waitForTimeout 1800))
    (var preserved (await (. (page.locator ".preview-stage iframe") (evaluate (fn [frame] (return (== frame.dataset.persisted "yes")))))))
    (await (. (page.getByRole "button" {"name" "Servers" "exact" true}) (click)))
    (await (. (card.getByRole "button" {"name" "Restart" "exact" true}) (click)))
    (await (page.waitForFunction (fn [old]
      (var pid (document.querySelector "[data-server-card='nextjs'] header code"))
      (return (and pid (not (== pid.textContent old))))) initial {"timeout" 90000}))
    (await (. (card.locator "header .status") (filter {"hasText" "running"}) (waitFor {"timeout" 90000})))
    (var second (await (page.request.get endpoint {"maxRedirects" 0 "timeout" 90000})))
    (await (. (card.getByRole "button" {"name" "Stop" "exact" true}) (click)))
    (await (. (card.locator "header .status") (filter {"hasText" "stopped"}) (waitFor {"timeout" 90000})))
    (var closed false)
    (try (await (page.request.get endpoint {"timeout" 2000}))
         (catch error (:= closed true)))
    (return {"first-status" (first.status) "first-location" (. (new URL (or (. (first.headers) location) endpoint)) pathname)
             "second-status" (second.status) "preview-preserved" preserved "closed" closed "errors" errors})
    (catch error (throw error))
    (finally (await (browser.close)))))

^{:refer app.manage.ui/render :id classic-workbench :timeout 240000}
(fact "classic file trees, highlighted line navigation and failed-result source links work with actual DB execution"
  (let [s (server/start! (constantly management/PROJECT) {:port 0})]
    (try
      (swap! (:state s) #(-> % (assoc :order ["failure-ui"])
                            (assoc-in [:runs "failure-ui"]
                              {:id "failure-ui" :operation "UI navigation fixture" :status :error
                               :result {:report {:namespaces [{:namespace "ui.navigation-fixture" :status :error
                                                              :assertions [{:path "test/finfolkdb/common/type_social_base_test.clj"
                                                                            :line 33 :status :failed :desc "Navigation fixture"
                                                                            :check "expected" :data "actual"}]}]}}})))
      (doseq [[path content] (make/render-sections {:root (.getCanonicalFile (io/file "."))}
                             {:load [] :sections [{:type :module.single :lang :js :main 'finfolkbuild.project.workbench-ui-test
                                                   :file ".cache/workbench-browser.mjs" :emit {:code {:label false}}}]})]
        (io/make-parents (io/file path)) (spit path content))
      (let [result (process/run {:root "." :timeout-ms 180000
                                :command ["node" "--input-type=module" "-e"
                                          "import('./.cache/workbench-browser.mjs').then(async m=>console.log(JSON.stringify(await m.inspectWorkspace(process.argv[1]))))"
                                          (str "http://127.0.0.1:" (:port s))]})]
        (when-not (= :ok (:status result)) (throw (ex-info "Classic workbench browser check failed" result)))
        (json/read-str (:stdout result) :key-fn keyword))
      (finally (server/stop! s))))
  => {:matches 1 :readable true :line 67 :failure-line 33 :errors []
      :values [true true "https://www.instagram.com/alice/" nil ["https://www.instagram.com/alice/"]]})

^{:refer app.manage.services/execute! :id real-nextjs-ui-controls :timeout 300000}
(fact "classic UI starts, restarts and stops the real Next.js server serving its actual config route"
  (let [port (with-open [socket (java.net.ServerSocket. 0)] (.getLocalPort socket))
        item (-> (first (:dev-servers management/PROJECT))
                 (assoc :url (str "http://127.0.0.1:" port)
                        :directory management/SITE
                        :command ["node" "../../../../node_modules/next/dist/bin/next" "dev" "--hostname" "127.0.0.1" "--port" (str port)]
                        :env {"FINFOLK_AUTH_PROVIDER" "legacy" "FINFOLK_NEXT_DIST_DIR" (str ".cache/workbench-process-" port)
                              "NEXT_TELEMETRY_DISABLED" "1"})
                 (dissoc :stop-argument))
        project (assoc management/PROJECT :dev-servers [item]
                       :previews [{:id :next :label "Next.js" :target :web-main :server :nextjs :url (:url item)}])
        s (server/start! (constantly project) {:port 0})]
    (try
      (doseq [[path content] (make/render-sections {:root (.getCanonicalFile (io/file "."))}
                              {:load [] :sections [{:type :module.single :lang :js :main 'finfolkbuild.project.workbench-ui-test
                                                   :file ".cache/workbench-browser.mjs" :emit {:code {:label false}}}]})]
        (io/make-parents (io/file path)) (spit path content))
      (let [result (process/run {:root "." :timeout-ms 260000
                                :command ["node" "--input-type=module" "-e"
                                          "import('./.cache/workbench-browser.mjs').then(async m=>console.log(JSON.stringify(await m.inspectDevServer(process.argv[1],process.argv[2]))))"
                                          (str "http://127.0.0.1:" (:port s)) (str (:url item) "/api/account-config")]})]
        (when-not (= :ok (:status result)) (throw (ex-info "Real dev server browser check failed" result)))
        (json/read-str (:stdout result) :key-fn keyword))
      (finally (server/stop! s))))
  => {:first-status 503 :first-location "/api/account-config" :second-status 503 :preview-preserved true :closed true :errors []})
