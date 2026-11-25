(ns app.manage.environments
  "Independent environment console; no application namespace loading."
  (:require [clojure.java.io :as io] [clojure.data.json :as json]))
(defn ensure-console! [root]
  (let [root (.getCanonicalFile (io/file root))
        descriptor (io/file root "config/environments.json")
        config (json/read-str (slurp descriptor))
        directory (io/file root ".cache/app.manage/environments")
        file (io/file directory "controller.mjs")
        port (get config "port")]
    (.mkdirs directory)
    (spit file (slurp (io/resource "assets/app.manage/environments/controller.mjs")))
    (let [url (str "http://127.0.0.1:" port)
          ready? (fn [] (try
                         (let [connection (.openConnection (.toURL (java.net.URI. (str url "/state"))))]
                           (.setConnectTimeout connection 500)
                           (.setReadTimeout connection 500)
                           (with-open [reader (io/reader (.getInputStream connection))]
                             (= (get config "platform") (get (json/read reader) "platform"))))
                         (catch Exception _ false)))]
      (when-not (ready?)
        (doto (ProcessBuilder. ["node" (str file) (str root)])
          (.directory root)
          (.redirectOutput (java.lang.ProcessBuilder$Redirect/appendTo (io/file directory "console.log")))
          (.redirectErrorStream true)
          (.start)))
      (loop [remaining 50]
        (cond (ready?) url
              (zero? remaining) (throw (ex-info "Environment console unavailable; inspect console.log" {}))
              :else (do (Thread/sleep 100) (recur (dec remaining))))))))
(defn -main [& [root]] (println (ensure-console! (or root "."))) (shutdown-agents))
