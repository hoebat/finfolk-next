(ns finfolkbuild.project.preview
  "Reuses a running Next development server or starts the project's standard preview."
  (:require [clojure.data.json :as json]
            [clojure.java.io :as io]))

(def SITE "js/finfolk-next/site/web-main")

(defn running-server
  [site]
  (let [lock (io/file site ".next/dev/lock")]
    (when (.isFile lock)
      (try
        (let [{:keys [pid port]} (json/read-str (slurp lock) :key-fn keyword)
              process (when (integer? pid) (java.lang.ProcessHandle/of pid))]
          (when (and process (.isPresent process) (.isAlive (.get process))
                     (integer? port) (< 0 port 65536))
            {:port port :origin (str "http://127.0.0.1:" port)}))
        (catch Exception _ nil)))))

(defn origin []
  (or (System/getenv "FINFOLK_PREVIEW_ORIGIN")
      (:origin (running-server SITE))
      (str "http://127.0.0.1:" (or (System/getenv "PREVIEW_PORT") "3010"))))

(defn -main [& _]
  (if-let [running (running-server SITE)]
    (println "FinFolk preview is already running:" (:origin running))
    (let [port (or (System/getenv "PREVIEW_PORT") "3010")
          process (.start (doto (ProcessBuilder.
                                 ^java.util.List ["corepack" "yarn" "workspace" "@finfolk/web-main"
                                                  "dev" "--hostname" "127.0.0.1" "--port" port])
                            (.inheritIO)))
          hook (Thread. ^Runnable #(.destroy process))]
      (.addShutdownHook (Runtime/getRuntime) hook)
      (try
        (let [exit (.waitFor process)]
          (when-not (zero? exit) (throw (ex-info "FinFolk preview failed" {:exit exit}))))
        (finally
          (.destroy process)
          (try (.removeShutdownHook (Runtime/getRuntime) hook)
               (catch IllegalStateException _))))))
  (shutdown-agents))
