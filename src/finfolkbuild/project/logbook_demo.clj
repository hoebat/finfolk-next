(ns finfolkbuild.project.logbook-demo
  "Loopback-only native logbook demo. Owns its disposable database and HTTP server."
  (:require [app.manage.integration.postgres :as database]
            [app.manage :as manage]
            [clojure.data.json :as json] [clojure.java.io :as io] [clojure.string :as str]
            [lang.core :as l] [lang.core.script :as script] [postgres.core :as pg] [org.httpkit.server :as http]
            [finfolkdb.schema.logbook-demo :as schema]
            [finfolkdb.fn.user.user-manage :as users]
            [finfolkdb.fn.user.user-manage-logbook :as logbook]
            [finfolkdb.common.type-system-base :as system]
            [finfolkdb.common.type-system-site :as sites]))
(def OWNER "20000000-0000-0000-0000-000000000001")
(def OTHER "20000000-0000-0000-0000-000000000002")
(def SITE "20000000-0000-0000-0000-000000000003")
(def DATABASE (database/database {:label "logbook_demo" :admin-url (or (System/getenv "APP_TEST_POSTGRES_URL") "postgresql://postgres:postgres@127.0.0.1:55432/postgres")}))


(defn invoke! [{:keys [actor operation values]}]
  (let [owner (case actor "alice" OWNER "bob" OTHER (throw (ex-info "Unknown fixture actor" {})))]
    (case operation
      "saveSession" (logbook/insert-dive-session owner
                       (if (:invalidSite values) "20000000-0000-0000-0000-000000000099" SITE)
                       (dissoc values :invalidSite) (system/op-fn "demo" owner {}))
      "profile" (let [target (:target values)]
                  (when-not (#{OWNER OTHER} target) (throw (ex-info "Unknown fixture profile" {})))
                  (schema/ret-demo-profile target))
      "me" (schema/ret-demo-profile owner)
      "session" (do (java.util.UUID/fromString (:id values)) (logbook/ret-dive-session-owned (:id values) owner))
      (throw (ex-info "Undeclared demo operation" {})))))

(defn html [token]
  (str "<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><meta name=demo-token content='" token "'><title>FinFolk logbook lab</title>"
    "<style>body{font:16px system-ui;background:#f3f6f3;color:#20382e;margin:0;padding:24px}main{max-width:1100px;margin:auto}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}section,aside{padding:24px;background:white;border:1px solid #cfdbd3;border-radius:12px}button,select,textarea{font:inherit;padding:10px;margin:6px 0}textarea{display:block;width:90%;height:90px}button{background:#21543d;color:white;border:0;border-radius:6px;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 monospace}small{color:#65756c}@media(max-width:750px){.grid{grid-template-columns:1fr}}</style>"
    "<main><small>APP.MANAGE · LOCAL FIXTURE · POSTGRESQL + GENERATED SUBSTRATE</small><h1>Private logbook lab</h1><p>Fixture identity switching is for this local demo; it is not production authentication. Data lasts for the server session.</p>"
    "<div class=grid><section><label>Devtool actor <select id=actor><option value=alice>Alice</option><option value=bob>Bob</option></select></label><label>Dive notes<textarea id=notes>First dive</textarea></label>"
    "<button data-operation=save>Create private session</button> <button data-operation=read>Refresh current session</button> <button data-operation=reject>Test invalid site</button>"
    "<p id=status role=status>Ready</p><h2>Database result</h2><pre id=result>No session yet. Create one, switch to Bob, and refresh to test ownership.</pre></section>"
    "<aside><h2>Backbone devtool</h2><p>Live model state, cache and transport events.</p><pre id=inspector></pre><a href='http://127.0.0.1:8131' target=_blank rel=noopener>Open app.manage</a></aside></div></main><script type=module src='/assets/demo.mjs'></script></html>"))
(defn handler [token request]
  (binding [*ns* (the-ns 'finfolkbuild.project.logbook-demo)]
    (try
      (cond
        (and (= :get (:request-method request)) (= "/" (:uri request)))
        {:status 200 :headers {"content-type" "text/html; charset=utf-8" "cache-control" "no-store"} :body (html token)}
        (and (= :post (:request-method request)) (= "/rpc" (:uri request)))
        (do (when-not (= token (get-in request [:headers "x-demo-token"])) (throw (ex-info "Missing demo token" {:status 403})))
            (let [text (slurp (:body request))]
              (when (> (count text) 16000) (throw (ex-info "Request too large" {:status 413})))
              {:status 200 :headers {"content-type" "application/json"} :body (json/write-str (invoke! (json/read-str text :key-fn keyword)))}))
        (and (= :get (:request-method request)) (str/starts-with? (:uri request) "/assets/"))
        (let [path (subs (:uri request) 8)
              file (manage/project-file {:root "generated/slices/logbook"} path)]
          (if (.isFile file) {:status 200 :headers {"content-type" "text/javascript"} :body file} {:status 404 :body "Build the demo first"}))
        :else {:status 404 :body "Not found"})
      (catch Throwable e
        (let [sql (first (filter #(instance? java.sql.SQLException %) (take-while some? (iterate #(.getCause ^Throwable %) e))))]
          {:status (or (:status (ex-data e)) 400) :headers {"content-type" "application/json"}
           :body (json/write-str {:error (if sql "Database rejected the operation" (.getMessage e)) :code (when sql (.getSQLState ^java.sql.SQLException sql))})})))))
(defn start! [{:keys [port] :or {port 8132}}]
  (binding [*ns* (the-ns 'finfolkbuild.project.logbook-demo)]
    (let [server (atom nil)
          cleanup (bound-fn [] (try (when-let [stop @server] (stop) (reset! server nil))
                                    (finally (try (l/rt:stop :postgres) (finally (database/stop! DATABASE))))))]
      (try
        (database/start! DATABASE)
        (database/execute! DATABASE schema/BOOTSTRAP)
        (script/script-test :postgres
          {:runtime :jdbc.client :config (database/config DATABASE)
           :require '[[finfolkdb.schema.logbook-demo :as schema] [postgres.core :as pg]
                      [finfolkdb.fn.user.user-manage :as users]
                      [finfolkdb.fn.user.user-manage-logbook :as logbook]
                      [finfolkdb.common.type-system-base :as system] [finfolkdb.common.type-system-site :as sites]]})
        (l/rt:setup :postgres)
        (users/insert-user OWNER {:displayName "Alice"} (system/op-fn "demo" OWNER {}))
        (users/insert-user OTHER {:displayName "Bob"} (system/op-fn "demo" OTHER {}))
        (pg/t:insert sites/Site {:id SITE :name "Demo site" :timezone "Australia/Sydney"})
        (reset! server (http/run-server (partial handler (str (java.util.UUID/randomUUID))) {:ip "127.0.0.1" :port port}))
        {:origin (str "http://127.0.0.1:" (:local-port (meta @server))) :stop cleanup}
        (catch Throwable error (cleanup) (throw error))))))

(defn -main [& _]
  (let [runtime (start! {:port (Integer/parseInt (or (System/getenv "LOGBOOK_DEMO_PORT") "8132"))})
        hook (Thread. ^Runnable (:stop runtime))]
    (.addShutdownHook (Runtime/getRuntime) hook)
    (println "Logbook demo:" (:origin runtime))
    (try @(promise)
         (finally ((:stop runtime))
                  (try (.removeShutdownHook (Runtime/getRuntime) hook) (catch IllegalStateException _))
                  (shutdown-agents)))))
