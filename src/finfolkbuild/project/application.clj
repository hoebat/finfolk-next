(ns finfolkbuild.project.application
  "Application integration checks share the native publication graph."
  (:require [app.manage.integration :as integration]
            [finfolkdb.build :as database]))

(defn isolated-check
  "Execute source-sensitive integration facts in a fresh JVM, including from a long-lived manager."
  [targets namespaces]
  {:targets targets :timeout-ms 360000
   :command ["lein" "run" "-m" "clojure.main" "-e"
             (str "(require '[app.manage.integration :as i]) (let [r (i/run! '" (pr-str namespaces)
                  ")] (prn r) (shutdown-agents) (System/exit (if (= :ok (:status r)) 0 1)))")]})

(def PROJECT
  {:id 'finfolk
   :root "."
   :default-targets [:integration]
   :project-sources ["src/finfolkbuild/project/application.clj"]
   :targets {:database-sql
             {:label "Database SQL" :sources ["src/finfolkdb"] :outputs database/SQL-OUTPUTS
              :render (fn [_] (database/sql-artifacts))}
             :database-json
             {:label "Database JSON" :depends [:database-sql] :sources ["src/finfolkdb"] :outputs database/JSON-OUTPUTS
              :render (fn [_] (database/json-artifacts))}
             :native-account {:depends [:database-json]
                           :sources ["src-app/finfolk_web" "test-app/finfolk_web/integration"
                                     "test/finfolkbuild/project/native_account_test.clj"
                                     "test/finfolkdb/schema/account_contracts_test.clj"
                                     "backend/event-delivery.mjs" "backend/directory-discovery.mjs" "scripts/lib/mock_event_delivery.mjs" "scripts/lib/mock_directory_search.mjs" "backend/native-account.mjs" "backend/native-account-deletion.mjs"
                                     "backend/native-rpc.mjs" "backend/api.mjs" "backend/server.mjs" "backend/db.mjs"
                                     "scripts/lib/local_supabase.mjs"
                                     "tests/native_event_delivery.mjs" "tests/native_site_review.mjs" "tests/native_sites.mjs" "tests/native_discovery.mjs" "tests/native_notes.mjs" "tests/native_directory.mjs" "tests/native_events.mjs" "tests/fixtures/native-site-review-browser.mjs" "tests/fixtures/native-atlas-browser.mjs" "tests/fixtures/native-directory-events-browser.mjs" "tests/native_profile.mjs" "tests/native_account_auth.mjs" "tests/fixtures/native-account-browser.mjs"
                                     "tests/native_account_config.mjs" "tests/native_account_types.mjs"
                                     "js/finfolk-next/site/web-main/app/(atlas)/account"
                                     "js/finfolk-next/site/web-main/app/api/account-config"
                                     "js/finfolk-next/site/web-main/lib"
                                     "js/finfolk-next/site/web-main/src/site-catalog.js"
                                     "js/finfolk-next/site/web-main/app/(atlas)/atlas"
                                     "js/finfolk-next/site/web-main/app/(atlas)/logbook"
                                     "js/finfolk-next/site/web-main/app/(community)/people"
                                     "js/finfolk-next/site/web-main/app/(community)/profile"
                                     "js/finfolk-next/site/web-main/app/(community)/directory"
                                     "js/finfolk-next/site/web-main/app/(community)/pages"
                                     "js/finfolk-next/site/web-main/app/(community)/events"
                                     "js/finfolk-next/site/web-main/package.json" "yarn.lock"]
                           :outputs []
                           :render (fn [_] {})}
             :integration {:depends [:database-json :native-account]
                           :sources ["test-app/finfolk_web/integration"] :outputs [] :render (fn [_] {})}}
   :checks {:native-account (isolated-check [:native-account]
                                               '[finfolkbuild.project.native-account-test
                                                 finfolkdb.schema.account-contracts-test])
            :integration (integration/check {:targets [:integration]
                                             :namespaces
                                             ['finfolk-web.integration.logbook-test]})}})
