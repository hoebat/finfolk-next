(ns finfolkbuild.project.native-account-test
  (:require [app.manage.integration.postgres :as db]
            [app.manage.process :as process]
            [finfolkdb.schema.logbook-demo :as schema]
            [finfolkdb.schema.directory :as directory-schema]
            [finfolkdb.schema.events :as event-schema]
            [finfolkdb.schema.event-delivery :as delivery-schema]
            [finfolkdb.schema.site-catalog :as site-schema]
            [finfolkdb.schema.site-review :as site-review-schema]
            [finfolkdb.schema.account-access :as account-access]
            [lang.core :as l])
  (:use code.test))
(def DATABASE (db/database {:label "native_account" :admin-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres"}))
(l/script- :postgres {:runtime :jdbc.client :test-mode true :config (db/config DATABASE)
                     :require [[finfolkdb.fn.user.user-account :as account]
                               [finfolkdb.fn.user.user-community :as community]
                               [finfolkdb.fn.user.user-logbook :as native-logbook]
                                               [finfolkdb.fn.user.user-profile :as native-profile]
                                               [finfolkdb.fn.directory.directory-app :as native-directory]
                                               [finfolkdb.fn.event.event-app :as native-events]
                                               [finfolkdb.fn.event.event-delivery :as event-delivery]
                                               [finfolkdb.fn.site.site-note-app :as native-notes]
                                               [finfolkdb.fn.site.site-catalog :as native-sites]
                                               [finfolkdb.fn.site.site-review :as native-site-review]
                                               [finfolkdb.fn.user.user-manage-posts :as post-fixture]
                               [finfolkdb.fn.user.user-manage-logbook :as logbook]]})
^{:id real-supabase-native-account :timeout 300000 :added "0.1"}
(fact "real Auth requests bind trusted UUIDs into the native account database"
  (try
    (db/start! DATABASE)
    (db/execute! DATABASE schema/BOOTSTRAP)
    (l/rt:restart :postgres) (l/rt:setup :postgres)
      (db/execute! DATABASE directory-schema/SQL)
      (db/execute! DATABASE (directory-schema/grants-sql))
      (db/execute! DATABASE event-schema/SQL)
      (db/execute! DATABASE delivery-schema/SQL)
      (db/execute! DATABASE site-schema/SQL)
      (db/execute! DATABASE site-review-schema/SQL)
    (db/execute! DATABASE (account-access/grants-sql))
    ;; Reapplying the current installer removes obsolete role-escalation grants.
    (db/execute! DATABASE "GRANT UPDATE ON finfolk.\"UserRole\" TO finfolk_account")
    (db/execute! DATABASE (account-access/grants-sql))
    (db/execute! DATABASE "GRANT finfolk_account TO postgres")
    (db/execute! DATABASE "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC")
    (let [config (db/config DATABASE)
          url (str "postgresql://" (:user config) ":" (:pass config) "@" (:host config) ":" (:port config) "/" (:dbname config))
          result (process/run {:root "." :timeout-ms 240000 :command ["env" (str "NATIVE_ACCOUNT_TEST_DB=" url) "node" "tests/native_account_auth.mjs"]})]
      (when-not (= :ok (:status result)) (throw (ex-info "Native auth integration failed" result)))
      (:stdout result))
    (finally (try (l/rt:stop :postgres) (finally (db/stop! DATABASE)))))
  => "PASS: real Supabase sign-in/refresh, native idempotent provisioning, actor isolation, invalid tokens and deleted account rejection\n")

^{:id public-account-configuration :added "0.1"}
(fact "public browser configuration excludes private Auth credentials"
  (let [result (process/run {:root "." :timeout-ms 15000 :command ["node" "tests/native_account_config.mjs"]})]
    (when-not (= :ok (:status result)) (throw (ex-info "Public configuration check failed" result)))
    (:stdout result))
  => "PASS: public Auth configuration is allowlisted, uncached and rejects secret/service-role keys\n")

^{:id account-ui-types :added "0.1"}
(fact "generated UI types enforce the native preference contract"
  (let [result (process/run {:root "." :timeout-ms 15000 :command ["node" "tests/native_account_types.mjs"]})]
    (when-not (= :ok (:status result)) (throw (ex-info "Generated account types failed" result)))
    (:stdout result))
  => "PASS: generated account types compile and reject invalid preference patches\n")

^{:id standalone-native-install :timeout 120000 :added "0.1"}
(fact "published SQL installs on an empty native database without historical or legacy provider schemas"
  (let [database (db/database {:label "native_install" :admin-url "postgresql://postgres:postgres@127.0.0.1:55432/postgres"})]
    (try
      (db/start! database)
      (db/execute! database (slurp "resources/finfolkdb/entity-schema.sql"))
      (db/execute! database (slurp "resources/finfolkdb/account-grants.sql"))
      (db/execute! database "DO $$ BEGIN IF to_regprocedure('finfolk_rpc.native_site_review_submit(uuid,boolean,jsonb)') IS NULL OR to_regprocedure('finfolk_rpc.event_delivery_claim(uuid,uuid,uuid,text,uuid)') IS NULL OR to_regprocedure('finfolk_rpc.native_public_site_catalog()') IS NULL OR to_regprocedure('finfolk_rpc.native_directory_discovery_finish(uuid,boolean,jsonb)') IS NULL OR to_regprocedure('finfolk_rpc.native_events_save(uuid,boolean,text,jsonb)') IS NULL OR to_regprocedure('finfolk_rpc.native_directory_merge(uuid,boolean,jsonb)') IS NULL THEN RAISE EXCEPTION 'Published native RPCs missing'; END IF; IF has_table_privilege('finfolk_account','finfolk.\"UserRole\"','UPDATE') THEN RAISE EXCEPTION 'Account role can escalate privileges'; END IF; IF has_table_privilege('anon','finfolk.\"EventInviteDelivery\"','SELECT') OR has_function_privilege('anon','finfolk_rpc.event_delivery_claim(uuid,uuid,uuid,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous roles can access delivery work'; END IF; IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='legacy_auth') THEN RAISE EXCEPTION 'Unexpected legacy Auth dependency'; END IF; END $$;")
      :ok
      (finally (db/stop! database))))
  => :ok)
