(ns finfolkbuild.project.account-page-fixture
  "Disposable native schema for saved account page/model cases. Auth belongs to the child fixture."
  (:require [app.manage.integration.postgres :as db]
            [finfolkdb.schema.logbook-demo :as schema]
            [finfolkdb.schema.directory :as directory-schema]
            [finfolkdb.schema.events :as event-schema]
            [finfolkdb.schema.event-delivery :as delivery-schema]
            [finfolkdb.schema.site-catalog :as site-schema]
            [finfolkdb.schema.site-review :as site-review-schema]
            [finfolkdb.schema.account-access :as access]
            [lang.core :as l] [lang.core.script :as script]
            [postgres.core :as pg] [finfolkdb.common.type-system-site :as sites]
            [finfolkdb.common.type-site-base :as public-sites]))
(def SITE "30000000-0000-0000-0000-000000000003")
(def DATABASE (db/database {:label "account_pages" :admin-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres"}))
(defn with-database [f]
  (binding [*ns* (the-ns 'finfolkbuild.project.account-page-fixture)]
    (try
      (db/start! DATABASE) (db/execute! DATABASE schema/BOOTSTRAP)
      (script/script-test :postgres {:runtime :jdbc.client :config (db/config DATABASE)
                                    :require '[[finfolkdb.fn.user.user-account :as account]
                                               [finfolkdb.fn.user.user-community :as community]
                                               [finfolkdb.fn.user.user-logbook :as native-logbook]
                                               [finfolkdb.fn.user.user-profile :as native-profile]
                                               [finfolkdb.fn.directory.directory-app :as native-directory]
                                               [finfolkdb.fn.event.event-app :as native-events]
                                               [finfolkdb.fn.event.event-delivery :as event-delivery]
                                               [finfolkdb.fn.site.site-note-app :as native-notes]
                                               [finfolkdb.fn.site.site-catalog :as native-sites]
                                               [finfolkdb.fn.site.site-review :as native-site-review]
                                               [postgres.core :as pg]
                                               [finfolkdb.common.type-system-site :as sites]
                                               [finfolkdb.common.type-site-base :as public-sites]]})
      (l/rt:setup :postgres)
      (db/execute! DATABASE directory-schema/SQL)
      (db/execute! DATABASE (directory-schema/grants-sql))
      (db/execute! DATABASE event-schema/SQL)
      (db/execute! DATABASE delivery-schema/SQL)
      (db/execute! DATABASE site-schema/SQL)
      (db/execute! DATABASE site-review-schema/SQL)
      (pg/t:insert sites/Site {:id SITE :name "Native fixture beach" :timezone "Australia/Sydney" :state "VIC" :area-name "Example Area"})
      (pg/t:insert public-sites/SiteProfile {:site SITE :revision 1 :waterbody "ocean" :access-mode "shore" :status "published"
                                            :payload {:point [145.0 -38.0] :region "example-bay" :area_id "example-area"}})
      (pg/t:insert public-sites/SiteCatalog {:revision 1 :metadata {}})
      (db/execute! DATABASE (access/grants-sql))
      (db/execute! DATABASE "GRANT finfolk_account TO postgres")
      (db/execute! DATABASE "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC")
      (let [{:keys [user pass host port dbname]} (db/config DATABASE)]
        (f (str "postgresql://" user ":" pass "@" host ":" port "/" dbname)))
      (finally (try (l/rt:stop :postgres) (finally (db/stop! DATABASE)))))))
