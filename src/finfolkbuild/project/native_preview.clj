(ns finfolkbuild.project.native-preview
  "Owned local Supabase fixture serving the real Next UI and generated backbone."
  (:require [finfolkbuild.project.account-page-fixture :as fixture]
            [app.manage.integration.postgres :as database]))

(defn -main [& [port]]
  (let [child (atom nil) finished (promise) stopping (atom false)
        main-thread (Thread/currentThread)
        hook (Thread. ^Runnable (fn []
                                 (let [p (locking child (reset! stopping true) @child)]
                                   (if p (.destroy p) (.interrupt main-thread)))
                                 (when-not (deref finished 55000 false)
                                   (database/stop! fixture/DATABASE))))]
    (.addShutdownHook (Runtime/getRuntime) hook)
    (try
      (fixture/with-database
        (fn [url]
          (let [builder (doto (ProcessBuilder. ^java.util.List ["node" "scripts/native_preview.mjs"])
                          (.inheritIO))]
            (.put (.environment builder) "NATIVE_ACCOUNT_TEST_DB" url)
            (when port (.put (.environment builder) "NATIVE_PREVIEW_PORT" port))
            (let [p (locking child
                      (when @stopping (throw (ex-info "Native preview startup was stopped" {})))
                      (let [p (.start builder)] (reset! child p) p))]
              (let [exit (.waitFor p)]
                (when-not (zero? exit)
                  (throw (ex-info "Native preview stopped" {:exit exit}))))))))
      (finally
        (when-let [p @child] (.destroy p))
        (deliver finished true)
        (try (.removeShutdownHook (Runtime/getRuntime) hook) (catch IllegalStateException _))
        (shutdown-agents)))))
