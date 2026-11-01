(ns finfolkbuild.testing.jdbc
  "Disposable local PostgreSQL fixture access for code.test facts."
  (:require [clojure.string :as str]))
(defn connection []
  (let [url (or (System/getenv "FINFOLK_TEST_DATABASE_URL") (throw (ex-info "Run make test-db" {})))
        uri (java.net.URI. url)
        [user password] (str/split (.getUserInfo uri) #":" 2)]
    (when-not (and (#{"127.0.0.1" "localhost" "postgres"} (.getHost uri))
                   (re-matches #"/finfolk_test_[a-z0-9_]+" (.getPath uri)))
      (throw (ex-info "Refusing non-disposable database" {})))
    (Class/forName "org.postgresql.Driver")
    (java.sql.DriverManager/getConnection
      (str "jdbc:postgresql://" (.getHost uri) ":" (.getPort uri) (.getPath uri)) user password)))
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
