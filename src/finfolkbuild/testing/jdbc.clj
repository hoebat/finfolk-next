(ns finfolkbuild.testing.jdbc
  "Disposable local PostgreSQL fixture access for code.test facts."
  (:require [finfolkbuild.testing.local :as local]))
(def ^:dynamic *connection-fn* nil)
(defn local-connection []
  (local/connection))
(defn connection [] (if *connection-fn* (*connection-fn*) (local-connection)))
(defn scalar [connection sql & args]
  (with-open [statement (.prepareStatement connection sql)]
    (doseq [[i value] (map-indexed vector args)] (.setObject statement (inc i) value))
    (with-open [result (.executeQuery statement)] (when (.next result) (.getString result 1)))))
(defn transaction [actor work]
  (with-open [db (connection)]
    (.setAutoCommit db false)
    (try
      (scalar db "SELECT set_config('finfolk.actor_id',?,true)" actor)
      (work db)
      (finally (.rollback db)))))
