(ns finfolkbuild.project.application
  "Application integration checks share the native publication graph."
  (:require [app.manage.integration :as integration]
            [finfolkdb.build :as database]))

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
             :integration {:depends [:database-json]
                           :sources ["src-app/finfolk_web" "test-app/finfolk_web/integration"]
                           :outputs []
                           :render (fn [_] {})}}
   :checks {:integration (integration/check {:targets [:integration]
                                             :namespaces
                                             ['finfolk-web.integration.logbook-test]})}})
