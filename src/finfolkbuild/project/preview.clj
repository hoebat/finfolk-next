(ns finfolkbuild.project.preview
  "Reuses the local native preview or starts its owned Auth/database fixture."
  (:require [clojure.data.json :as json]
            [clojure.java.io :as io]))

(def SITE "js/finfolk-next/site/web-main")

(defn running-server
  [site]
  (let [native-lock (io/file site (str ".cache/native-preview-" (or (System/getenv "PREVIEW_PORT") "3010") "/dev/lock"))]
    (some (fn [[lock native?]]
            (when (.isFile lock)
              (try
                (let [{:keys [pid port]} (json/read-str (slurp lock) :key-fn keyword)
                      process (when (integer? pid) (java.lang.ProcessHandle/of pid))]
                  (when (and process (.isPresent process) (.isAlive (.get process))
                             (integer? port) (< 0 port 65536))
                    {:port port :origin (str "http://127.0.0.1:" port) :native native?}))
                (catch Exception _ nil))))
          [[native-lock true] [(io/file site ".next/dev/lock") false]])))

(defn origin []
  (or (System/getenv "FINFOLK_PREVIEW_ORIGIN")
      (:origin (running-server SITE))
      (str "http://127.0.0.1:" (or (System/getenv "PREVIEW_PORT") "3010"))))

(defn -main [& _]
  (if-let [running (running-server SITE)]
    (if (:native running)
      (println "FinFolk native preview is already running:" (:origin running))
      (throw (ex-info "A legacy Next preview is running. Stop it, then restart the local native preview."
                     {:origin (:origin running)})))
    ((requiring-resolve 'finfolkbuild.project.native-preview/-main)
      (or (System/getenv "PREVIEW_PORT") "3010")))
  (shutdown-agents))
