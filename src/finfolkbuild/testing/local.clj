(ns finfolkbuild.testing.local
  "JDBC runtime restricted to disposable local PostgreSQL test databases."
  (:require [clojure.string :as str]
            [lib.postgres.connection :as conn]
            [lang.core :as l]
            [finfolkdb.schema.namespaces :as namespaces])
  (:import [java.net URI URLDecoder]))

(def ^:dynamic *suite* false)
(defonce lock-connection (atom nil))
(def default-url "postgresql://postgres:postgres@127.0.0.1:55432/finfolk_test_repl")

(defn parse-config [url]
  (let [uri (URI. url)]
    ;; setup! resets application schemas, so never accept arbitrary DB names,
    ;; remote hosts, or JDBC URL parameters that can override the destination.
    (when-not (and (#{"postgres" "postgresql"} (.getScheme uri))
                   (#{"127.0.0.1" "localhost" "postgres"} (.getHost uri))
                   (re-matches #"/finfolk_test_[a-z0-9_]+" (or (.getPath uri) ""))
                   (.getRawUserInfo uri)
                   (nil? (.getRawQuery uri))
                   (nil? (.getRawFragment uri)))
      (throw (ex-info "Refusing non-disposable local PostgreSQL configuration" {})))
    (let [[user pass] (str/split (.getRawUserInfo uri) #":" 2)
          decode #(when % (URLDecoder/decode (str/replace % "+" "%2B") "UTF-8"))]
      {:rt/id :finfolkdb.local-test :vendor :finfolk-local
       :host (.getHost uri) :port (if (= -1 (.getPort uri)) 5432 (.getPort uri))
       :dbname (subs (.getPath uri) 1) :user (decode user) :pass (decode pass)})))

(defn config []
  (parse-config (or (System/getenv "FINFOLK_TEST_DATABASE_URL") default-url)))

(defn data-source [{:keys [host port dbname user pass]}]
  (doto (org.postgresql.ds.PGConnectionPoolDataSource.)
    (.setServerName host) (.setPortNumber port) (.setDatabaseName dbname)
    (.setSocketTimeout 30) (.setTcpKeepAlive true)
    (.setOptions "-c statement_timeout=15000 -c lock_timeout=5000")
    (.setConnectTimeout 15)
    (.setUser user) (.setPassword pass) (.setSslMode "disable")))

(defn connect-with-retry [connect]
  (loop [attempt 0]
    (let [result (try {:value (connect)}
                     (catch java.sql.SQLException e
                       (if (and (< attempt 2) (str/starts-with? (or (.getSQLState e) "") "08"))
                         {:retry true}
                         (throw e))))]
      (if (:retry result) (recur (inc attempt)) (:value result)))))
(defn create-pool [config] (connect-with-retry #(.getPooledConnection (data-source config))))
(swap! conn/+impls+ assoc :finfolk-local {:status :loaded :ns 'finfolkbuild.testing.local})
(defn connection [] (connect-with-retry #(.getConnection (data-source (config)))))
(defn contract-connection []
  (java.lang.reflect.Proxy/newProxyInstance
    (.getClassLoader java.sql.Connection) (into-array Class [java.sql.Connection])
    (reify java.lang.reflect.InvocationHandler
      (invoke [_ _ method args]
        (when-not (= "close" (.getName method))
          (try (.invoke method @lock-connection args)
               (catch java.lang.reflect.InvocationTargetException e (throw (.getCause e)))))))))
(defn execute! [sql]
  (when-not @lock-connection (throw (ex-info "Acquire the local test lock before DDL" {})))
  (with-open [s (.createStatement @lock-connection)] (.execute s sql)))
(defn acquire! []
  (when-not @lock-connection
    (let [db (connection)]
      (try
        (with-open [s (.createStatement db) r (.executeQuery s "SELECT pg_try_advisory_lock(734763211)")]
          (.next r)
          (when-not (.getBoolean r 1) (throw (ex-info "Another local test run owns the database" {}))))
        (reset! lock-connection db)
        (catch Throwable e (.close db) (throw e))))))
(defn release! []
  (when-let [db @lock-connection] (.close db) (reset! lock-connection nil)))
(defn setup! []
  (acquire!)
  (namespaces/load-all!)
  (execute! "DROP SCHEMA IF EXISTS finfolk_rpc CASCADE; DROP SCHEMA IF EXISTS finfolk CASCADE; CREATE SCHEMA finfolk; CREATE SCHEMA finfolk_rpc; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
  (l/rt:restart)
  (l/rt:setup :postgres))
(defn teardown! []
  (try (l/rt:teardown :postgres)
       (finally
         (try (l/rt:stop)
              (finally
                (execute! "DROP SCHEMA IF EXISTS finfolk_rpc CASCADE; DROP SCHEMA IF EXISTS finfolk CASCADE;")
                (when-not *suite* (release!)))))))
