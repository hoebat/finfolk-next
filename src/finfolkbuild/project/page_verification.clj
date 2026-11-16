(ns finfolkbuild.project.page-verification
  (:require [clojure.data.json :as json] [clojure.java.io :as io]))
(def ^:dynamic *origin* "http://127.0.0.1:8132")
(defn with-fixture [f]
  (let [runtime ((requiring-resolve 'finfolkbuild.project.logbook-demo/start!) {:port 0})]
    (try (binding [*origin* (:origin runtime)] (f)) (finally ((:stop runtime))))))

(defn execute [request]
  (if-not (.isFile (io/file "generated/verification/worker.mjs"))
    {:blocked "Build the page-verifier target first"}
    (let [out (java.io.File/createTempFile "page-verify-" ".out")
          err (java.io.File/createTempFile "page-verify-" ".err")]
      (try
        (let [p (.start (doto (ProcessBuilder. ^java.util.List ["node" "generated/verification/worker.mjs"])
                         (.redirectOutput out) (.redirectError err)
                         (-> .environment (.put "PAGE_VERIFY_ORIGIN" *origin*))))]
          (with-open [w (io/writer (.getOutputStream p))] (.write w (json/write-str request)))
          (when-not (.waitFor p 30 java.util.concurrent.TimeUnit/SECONDS)
            (.destroyForcibly p) (throw (ex-info "Verification timed out" {})))
          (when-not (zero? (.exitValue p)) (throw (ex-info "Verification worker failed" {:stderr (slurp err)})))
        (json/read-str (slurp out) :key-fn keyword))
        (finally (.delete out) (.delete err))))))
