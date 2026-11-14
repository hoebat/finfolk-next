(ns finfolkdb.schema.entity
  (:require [clojure.string :as str]
            [finfolkdb.common.type-system-seed :as seed]
            [finfolkdb.main.scaffold-001-entity]
            [lang.core.compile :as compile]
            [std.make.compile :as make]
            [std.json :as json]
            [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.directory :as directory]))

(defn sql
  []
  (let [[_ content] (binding [make/*mock-compile* true]
                      (compile/compile-module-schema {:lang :postgres
                                                      :main 'finfolkdb.main.scaffold-001-entity
                                                      :output "entity-schema.sql"
                                                      :emit {:code {:label {:line-number?
                                                                            false}}}}))]
    (str
     "-- Generated standalone FinFolk entity schema.\nBEGIN;\n"
     "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') OR to_regclass('neon_auth.\"user\"') IS NULL THEN RAISE EXCEPTION 'Provision finfolk_api and managed authentication first'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) THEN RAISE EXCEPTION 'Fresh entity schema requires empty application schemas'; END IF; END $$;\n"
     "CREATE SCHEMA IF NOT EXISTS finfolk;\nCREATE SCHEMA IF NOT EXISTS finfolk_rpc;\n"
     (str/join "\n"
               (map #(str "CREATE EXTENSION IF NOT EXISTS \"" % "\";") seed/REQUIRED_EXTENSIONS))
     "\n"
     content
     "\n"
     directory/SQL
     "\nREVOKE ALL ON ALL TABLES IN SCHEMA finfolk FROM PUBLIC;\n"
     "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC;\n"
     "GRANT USAGE ON SCHEMA finfolk,finfolk_rpc TO finfolk_api;\n"
     (directory/grants-sql)
     "COMMIT;\n")))

(defn -main
  [& args]
  (print
   (if (= "--catalog" (first args)) (json/write (catalog/portable (catalog/declarations))) (sql)))
  (shutdown-agents))
