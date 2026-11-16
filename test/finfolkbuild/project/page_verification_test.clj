(ns finfolkbuild.project.page-verification-test
  (:require [app.manage.verify :as verify]
            [finfolkbuild.project.management :as management])
  (:use code.test))

^{:refer app.manage.verify/run-cases! :id native-page-verification :timeout 120000 :added "0.1"}
(fact "saved page checks execute native RPCs through generated page/models and isolate actors"
  (let [report (verify/run-cases! management/PROJECT)]
    (when-not (= :ok (:status report)) (spit "/tmp/finfolk-page-verification-failure.edn" (pr-str report)))
    [(:status report) (mapv (fn [c] [(:id c) (mapv :status (:steps c))]) (:cases report))])
  => [:ok [["logbook-branches" [:passed :passed :passed]]
           ["logbook-ownership" [:passed :passed :passed :passed :passed]]
           ["model-contracts" [:passed :passed :passed]]]])

^{:refer app.manage.verify/definitions! :id all-page-contracts :added "0.1"}
(fact "all registered page read models resolve to declared read operations"
  (select-keys (verify/definitions! management/PROJECT) [:status :pages :findings])
  => {:status :ok :pages 61 :findings []})

^{:id workbench-ui-roundtrip :timeout 120000 :added "0.1"}
(fact "the emitted manager UI loads, verifies, fails, corrects, saves and reloads checks"
  (let [root (.toFile (java.nio.file.Files/createTempDirectory "page-workbench-" (make-array java.nio.file.attribute.FileAttribute 0)))
        p {:id 'workbench :root (str root) :default-targets [:runtime]
           :targets {:runtime {:sources [] :outputs ["generated"] :render (fn [_] {})}}
           :verification-targets [:runtime]
           :pages (fn [] []) :page-verifier (fn [request] {:result {:name (:member request)}})}
        start (requiring-resolve 'app.manage.server/start!) stop (requiring-resolve 'app.manage.server/stop!)
        server (atom nil)]
    (try
      (verify/save! p {:id "contract" :revision 0
                      :case {:page "logbook" :kind "resolve" :member "session" :expect {:contains {:name "session"}}}})
      (reset! server (start (constantly p) {:port 0}))
      (doseq [[path content] (:assets @server)]
        (let [file (clojure.java.io/file root "assets" path)]
          (clojure.java.io/make-parents file) (spit file content)))
      (let [result ((requiring-resolve 'app.manage.process/run)
                    {:root "." :timeout-ms 90000
                     :command ["node" "tests/app_manage_workbench.mjs"
                               (str "http://127.0.0.1:" (:port @server))
                               (str (.toURI (clojure.java.io/file root "assets/app.mjs")))]})]
        (when-not (= :ok (:status result)) (throw (ex-info "Workbench UI failed" result)))
        (:stdout result))
      (finally (when @server (stop @server))
               (doseq [file (reverse (file-seq root))] (.delete file)))))
  => "PASS: load, run, fail, correct, save, reload\n")
