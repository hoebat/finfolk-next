(ns finfolkbuild.project.page-verification
  (:require [clojure.data.json :as json] [clojure.java.io :as io]))
(def ^:dynamic *origin* "http://127.0.0.1:8132")
(defn with-fixture [f]
  (let [runtime ((requiring-resolve 'finfolkbuild.project.logbook-demo/start!) {:port 0})]
    (try (binding [*origin* (:origin runtime)] (f)) (finally ((:stop runtime))))))
(defn- run-worker [request command environment]
  (let [out (java.io.File/createTempFile "page-verify-" ".out")
        err (java.io.File/createTempFile "page-verify-" ".err")]
    (try
      (let [builder (doto (ProcessBuilder. ^java.util.List command)
                      (.redirectOutput out) (.redirectError err))
            _ (doseq [[key value] environment] (.put (.environment builder) key value))
            p (.start builder)]
        (with-open [w (io/writer (.getOutputStream p))] (.write w (json/write-str request)))
        (when-not (.waitFor p 60 java.util.concurrent.TimeUnit/SECONDS)
          (.destroyForcibly p) (throw (ex-info "Verification timed out" {})))
        (when-not (zero? (.exitValue p)) (throw (ex-info "Verification worker failed" {:stderr (slurp err)}))))
      (json/read-str (slurp out) :key-fn keyword)
      (finally (.delete out) (.delete err)))))
(defn execute [request]
  (let [steps (if (seq (:steps request)) (:steps request) [request])
        native? (and (not= "sql-demo" (:runtime request))
                     (or (= "native" (:runtime request)) (some #(not= "resolve" (:kind %)) steps)))]
    (cond
      native?
      (if-not (.isFile (io/file "generated/verification/native-account/account-verifier.mjs"))
        {:blocked "Build the page-verifier target first"}
        ((requiring-resolve 'finfolkbuild.project.account-page-fixture/with-database)
          (fn [url] (run-worker request ["node" "tests/fixtures/native-account-verifier.mjs"] {"NATIVE_ACCOUNT_TEST_DB" url}))))
      (not (.isFile (io/file "generated/verification/worker.mjs")))
      {:blocked "Build the page-verifier target first"}
      :else (run-worker request ["node" "generated/verification/worker.mjs"] {"PAGE_VERIFY_ORIGIN" *origin*}))))
