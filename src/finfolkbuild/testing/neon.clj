(ns finfolkbuild.testing.neon
  "Direct TLS runtime on the dedicated FinFolk Neon test branch."
  (:require [clojure.string :as str]
            [clojure.java.io :as io]
            [std.json :as json]
            [clojure.java.shell :as shell]
            [lib.postgres.connection :as conn]
            [lang.core :as l]
            [finfolkdb.schema.namespaces :as namespaces])
  (:import [java.net URI URLDecoder] [java.sql Connection]))
(def ^:dynamic *suite* false)
(defonce lock-connection (atom nil))
(defn config []
  (let [c (try (json/read (slurp ".cache/neon-test/config.json"))
               (catch Exception _ (throw (ex-info "Run make neon-test-setup" {}))))
        uri (URI. (get c "url"))]
    (when-not (and (= "odd-voice-85400108" (get c "project"))
                   (= "finfolkdb-test" (get c "name"))
                   (= "finfolkdb_test" (get c "database"))
                   (= "/finfolkdb_test" (.getPath uri))
                   (str/ends-with? (.getHost uri) ".neon.tech")
                   (not (str/includes? (.getHost uri) "-pooler"))
                   (str/includes? (.getQuery uri) "sslmode=verify-full"))
      (throw (ex-info "Refusing non-test Neon configuration" {})))
    (let [[user pass] (str/split (.getRawUserInfo uri) #":" 2)
          decode #(URLDecoder/decode (str/replace % "+" "%2B") "UTF-8")]
      {:rt/id :finfolkdb.neon-test :vendor :finfolk-neon
       :host (.getHost uri) :port 5432 :dbname "finfolkdb_test"
       :sslmode "verify-full" :user (decode user) :pass (decode pass)})))
(defn root-cert []
  (or (some #(when (and % (.isFile (io/file %))) %)
            [(System/getenv "FINFOLK_TEST_SSL_ROOT_CERT") "/etc/ssl/cert.pem" "/etc/ssl/certs/ca-certificates.crt"])
      (throw (ex-info "Set FINFOLK_TEST_SSL_ROOT_CERT to a trusted CA bundle" {}))))
(defn data-source [{:keys [host port dbname user pass]}]
    (doto (org.postgresql.ds.PGConnectionPoolDataSource.)
      (.setServerName host) (.setPortNumber port) (.setDatabaseName dbname)
      (.setSocketTimeout 30) (.setTcpKeepAlive true)
      (.setOptions "-c statement_timeout=15000 -c lock_timeout=5000")
      (.setConnectTimeout 15) (.setSslResponseTimeout 15000)
      (.setUser user) (.setPassword pass) (.setSslMode "verify-full")
      (.setSslfactory "org.postgresql.ssl.LibPQFactory")
      (.setSslRootCert (root-cert))))
(defn connect-with-retry [connect]
  (loop [attempt 0]
    (let [result (try {:value (connect)}
                     (catch java.sql.SQLException e
                       (if (and (< attempt 2) (str/starts-with? (or (.getSQLState e) "") "08"))
                         {:retry true}
                         (throw e))))]
      (if (:retry result) (recur (inc attempt)) (:value result)))))
(defn create-pool [config] (connect-with-retry #(.getPooledConnection (data-source config))))
(swap! conn/+impls+ assoc :finfolk-neon {:status :loaded :ns 'finfolkbuild.testing.neon})
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
  (when-not @lock-connection (throw (ex-info "Acquire the Neon test lock before DDL" {})))
  (with-open [s (.createStatement @lock-connection)] (.execute s sql)))
(defn acquire! []
  (when-not @lock-connection
    (let [c (json/read (slurp ".cache/neon-test/config.json"))
          result (shell/sh "neon" "branches" "list" "--project-id" "odd-voice-85400108" "--output" "json")
          branch (some #(when (= (get % "id") (get c "branch")) %) (when (zero? (:exit result)) (json/read (:out result))))
          endpoint (shell/sh "neon" "connection-string" (get c "branch") "--project-id" "odd-voice-85400108" "--database-name" "finfolkdb_test")]
      (when-not (and (= "finfolkdb-test" (get branch "name"))
                     (zero? (:exit endpoint))
                     (= (.getHost (URI. (str/trim (:out endpoint)))) (:host (config))))
        (throw (ex-info "Neon endpoint does not belong to the recorded test branch" {:branch-name (get branch "name") :list-exit (:exit result) :endpoint-exit (:exit endpoint)}))))
    (let [db (connection)]
      (try
        (with-open [s (.createStatement db) r (.executeQuery s "SELECT pg_try_advisory_lock(734763211)")]
          (.next r)
          (when-not (.getBoolean r 1) (throw (ex-info "Another Neon test run owns the database" {}))))
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
