(ns finfolk-web.integration.logbook-test
  (:use code.test)
  (:require [lang.core :as l]
            [app.manage.integration :as integration]
            [app.manage.integration.postgres :as database]
            [finfolkdb.schema.rpc-catalog :as catalog]))

(def DATABASE
  (database/database {:label "finfolk"
                      :admin-url (or (System/getenv "APP_TEST_POSTGRES_URL")
                                     "postgresql://postgres:postgres@127.0.0.1:55432/postgres")}))
(def OWNER "20000000-0000-0000-0000-000000000001")
(def OTHER "20000000-0000-0000-0000-000000000002")
(def SITE "20000000-0000-0000-0000-000000000003")
(def OP (atom nil))
(defn registry
  []
  (into {}
        (for [[name spec] (catalog/declarations)]
          [name {:id name :schema (:schema spec) :input (:arguments spec)}])))

(l/script- :postgres
  {:runtime :jdbc.client
   :test-mode true
   :config (database/config DATABASE)
   :require [[postgres.core :as pg]
             [finfolkdb.fn.user.user-manage :as users]
             [finfolkdb.fn.user.user-manage-logbook :as logbook]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-logbook-base :as tables]]})
(l/script- :js
  {:runtime :basic
   :test-mode true
   :require [[xt.lang.common-repl :as repl]
             [xt.lang.common-protocol :as protocol]
             [app.manage.integration.client :as client]
             [finfolk-web.lib.backbone :as backbone]]})

(def SCAFFOLD
  (integration/fixture
   [(database/resource DATABASE)
    {:id :runtimes
     :start
     (fn [_]
       (database/execute!
        DATABASE
        "CREATE SCHEMA finfolk; CREATE SCHEMA finfolk_rpc; CREATE EXTENSION citext; CREATE EXTENSION pgcrypto; CREATE EXTENSION \"uuid-ossp\";")
       (l/rt:restart)
       (l/rt:setup :postgres)
       (!.js (:= protocol/PROTOCOLS {}) (:= protocol/IMPLEMENTATIONS {}))
       (users/insert-user OWNER {:displayName "Alice"} (system/op-fn "integration" OWNER {}))
       (users/insert-user OTHER {:displayName "Bob"} (system/op-fn "integration" OTHER {}))
       (pg/t:insert sites/Site {:id SITE :name "Integration site" :timezone "Australia/Sydney"})
       (reset! OP (system/op-fn "integration" OWNER {}))
       true)
     :stop (fn [_ _] (l/rt:stop))}
    {:id :client
     :start (fn [_]
              (integration/await-js (. (client/open (@! (database/client-config DATABASE))
                                                    (@! (registry)))
                                       (then (fn [db] (:= (!:G DB) db) (return true)))))
              true)
     :stop (fn [_ _] (integration/await-js (client/close DB)))}]))
(fact:global {:setup [(integration/start! SCAFFOLD)] :teardown [(integration/stop! SCAFFOLD)]})

^{:refer finfolk-web.lib.backbone/createBackbone :id live-create}
(fact "the real account model creates a private session through native PostgreSQL functions"
  (!.js (:= (!:G STATES) [])
        (:= (!:G ACCOUNT)
            (backbone/createBackbone
             (@! OWNER)
             (async
              (fn [name values]
                (when (== name "saveSession")
                  (return (await (client/call DB
                                              "insert_dive_session"
                                              [(@! OWNER) values.beachId values (@! (deref OP))]))))
                (when (== name "session")
                  (return (await (client/call DB "ret_dive_session_owned" [values.id (@! OWNER)]))))
                (throw (new Error (+ "Undeclared integration operation: " name)))))
             {})))
  (integration/await-js
   (. (. ACCOUNT
         (call
          "saveSession"
          {"beachId" (@! SITE) "notes" "First dive" "visibility" "public" "photos" ["untrusted"]}))
      (then (fn [row] (:= (!:G SESSION) row.id) (return [row.owner_id row.site_id row.detail])))))
  =>
  [OWNER SITE {"notes" "First dive" "visibility" "private" "photos" []}]
  (pg/t:count tables/DiveSession) => 1
  (logbook/ret-dive-session-owned (!.js SESSION) OTHER) => nil)

^{:refer finfolk-web.lib.backbone/invalidate :id live-read-refresh}
(fact "subscriptions and xt.db cache follow committed writes and refresh their real database reads"
  (!.js (:= (!:G UNSUBSCRIBE)
            (. ACCOUNT
               (subscribe "session" {"id" SESSION} (fn [state] (. STATES (push state.status)))))))
  (integration/await-js (. (. ACCOUNT (call "session" {"id" SESSION}))
                           (then (fn [row]
                                   (return [row.id row.ownerId row.beachId row.notes row.visibility
                                            row.photos])))))
  =>
  [(!.js SESSION) OWNER SITE "First dive" "private" []]
  (!.js (. (. ACCOUNT (read "session" {"id" SESSION})) notes)) => "First dive"
  (integration/await-js (. (. ACCOUNT
                              (call "saveSession" {"beachId" (@! SITE) "notes" "Second dive"}))
                           (then (fn [row] (return row.detail.notes)))))
  =>
  "Second dive"
  (!.js [(STATES.includes "stale") (. STATES [(- STATES.length 1)])
         (. (. ACCOUNT (read "session" {"id" SESSION})) notes)])
  =>
  [true "ready" "First dive"]
  (pg/t:count tables/DiveSession) => 2
  (logbook/ret-dive-session-owned (!.js SESSION) OTHER) => nil)

^{:refer finfolk-web.lib.backbone/call :id rejection}
(fact "database constraint failures reach the account model without persisting a partial session"
  (integration/await-js
   (. (. ACCOUNT (call "saveSession" {"beachId" "20000000-0000-0000-0000-000000000099"}))
      (then (fn [] (return {"rejected" false})))
      (catch (fn [error] (return {"rejected" true "code" error.code "status" error.status})))))
  =>
  {"rejected" true "code" "23503" "status" 400}
  (pg/t:count tables/DiveSession) => 2
  (!.js (. (. ACCOUNT (read "session" {"id" SESSION})) notes)) => "First dive")

^{:refer finfolk-web.lib.backbone/close :id cleanup}
(fact "account disposal clears cache and stops subsequent requests; scaffold removes its database"
  (!.js (UNSUBSCRIBE)
        (. ACCOUNT (close))
        (== (. ACCOUNT (read "session" {"id" SESSION})) undefined))
  =>
  true
  (integration/await-js (. (. ACCOUNT (call "session" {"id" SESSION}))
                           (then (fn [] (return "unexpected")))
                           (catch (fn [error] (return error.message)))))
  =>
  "Account context closed."
  (integration/stop! SCAFFOLD) => true
  (database/exists? DATABASE) => false)
