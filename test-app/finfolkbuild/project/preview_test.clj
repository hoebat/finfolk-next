(ns finfolkbuild.project.preview-test
  (:require [clojure.java.io :as io]
            [finfolkbuild.project.preview :as preview])
  (:use code.test))

^{:refer finfolkbuild.project.preview/running-server :added "0.1"}
(fact "finds the existing Next server and ignores malformed, dead or invalid lock data"
  (let [site (.toFile (java.nio.file.Files/createTempDirectory
                      "finfolk-preview-" (make-array java.nio.file.attribute.FileAttribute 0)))
        lock (io/file site ".next/dev/lock")
        pid (.pid (java.lang.ProcessHandle/current))]
    (try
      (io/make-parents lock)
      (spit lock (str "{\"pid\":" pid ",\"port\":3329}"))
      (let [running (preview/running-server site)]
        (spit lock "{\"pid\":9223372036854775807,\"port\":3329}")
        (let [dead (preview/running-server site)]
          (spit lock (str "{\"pid\":" pid ",\"port\":99999}"))
          (let [invalid (preview/running-server site)]
            (spit lock "broken json")
            [running dead invalid (preview/running-server site)])))
      (finally (doseq [file (reverse (file-seq site))] (.delete file)))))
  => [{:port 3329 :origin "http://127.0.0.1:3329"} nil nil nil])
