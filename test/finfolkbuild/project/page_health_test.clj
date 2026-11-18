(ns finfolkbuild.project.page-health-test
  (:require [app.manage :as manage]
            [app.manage.server :as server]
            [app.manage.slices :as slices]
            [clojure.java.io :as io]
            [finfolkbuild.project.management :as management])
  (:use code.test))

^{:refer finfolkbuild.project.management/PROJECT :id page-health-declaration}
(fact "live page health is an independent workbench check against the configured preview"
  [(manage/plan management/PROJECT [:page-health])
   (get-in management/PROJECT [:checks :page-health :command])
   (get-in management/PROJECT [:slices :page-health :stages 0 :checks])]
  => [[:page-health]
      ["node" "scripts/check_pages.mjs" "--base" management/PREVIEW-ORIGIN]
      [:page-health]])

^{:refer finfolkbuild.project.management/PROJECT :id page-health-evidence :timeout 60000}
(fact "workbench keeps failed scan output, records red evidence, recovers and marks source edits stale"
  (let [root (.toFile (java.nio.file.Files/createTempDirectory "page-health-workbench-" (make-array java.nio.file.attribute.FileAttribute 0)))
        script (io/file root "scripts/check_pages.mjs")
        project {:id 'page-health-test :root (str root)
                 :targets {:page-health (assoc (get-in management/PROJECT [:targets :page-health]) :sources ["scripts/check_pages.mjs"])}
                 :slices (select-keys (:slices management/PROJECT) [:page-health])
                 :checks (select-keys (:checks management/PROJECT) [:page-health])}
        _ (io/make-parents script)
        _ (spit script "console.log('FAIL /people: Error screen displayed');process.exitCode=1;")
        session (server/session! (constantly project))]
    (try
      (let [run! (fn []
                   (let [{:keys [id]} (server/submit! session {:operation "build" :slice "page-health" :stage "browser" :tests true})]
                     (server/await-run session id 30000)
                     (get-in @(:state session) [:runs id])))
            failed (run!)
            failed-status (get-in (first (slices/status project)) [:stages 0 :status])
            _ (spit script "console.log('PASS /people');")
            passed (run!)
            passed-status (get-in (first (slices/status project)) [:stages 0 :status])
            _ (spit script "console.log('source changed');")
            stale-status (get-in (first (slices/status project)) [:stages 0 :status])]
        [(:status failed)
         (boolean (re-find #"FAIL /people" (get-in failed [:result :verification :checks 0 :stdout])))
         failed-status (:status passed) passed-status stale-status])
      (finally
        (server/stop! session)
        (doseq [file (reverse (file-seq root))] (.delete file)))))
  => [:error true :failed :ok :verified :stale])
