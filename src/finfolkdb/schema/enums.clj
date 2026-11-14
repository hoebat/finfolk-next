(ns finfolkdb.schema.enums
  "Publish native PostgreSQL enums from authored Clojure declarations."
  (:require [clojure.string :as str]
            [finfolkdb.common.type-domain-enum :as domain]
            [lang.core.compile :as compile]
            [std.make.compile :as make]))

;;
;; Publication
;;

(defn sql
  []
  (let [[_ content] (binding [make/*mock-compile* true]
                      (compile/compile-module-schema {:lang :postgres
                                                      :main 'finfolkdb.common.type-domain-enum
                                                      :output "enums.sql"
                                                      :emit {:code {:label {:line-number?
                                                                            false}}}}))]
    (str "-- Generated from finfolkdb.common.type-domain-enum.\n"
         "CREATE SCHEMA IF NOT EXISTS finfolk;\n"
         content
         ;; Foundation's enum emitter suppresses CREATE TYPE errors. Validate
         ;; labels explicitly so missing/conflicting types cannot pass silently.
         (str/join
          "\n"
          (for [{:keys [name values]} (vals domain/COLUMN_ENUMS)]
            (str "DO $$ BEGIN IF (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) "
                 "FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid "
                 "JOIN pg_namespace n ON n.oid=t.typnamespace "
                 "WHERE n.nspname='finfolk' AND t.typname='"
                 name
                 "') IS DISTINCT FROM ARRAY["
                 (str/join "," (map #(str "'" (str/replace % "'" "''") "'") values))
                 "]::text[] THEN RAISE EXCEPTION 'Enum declaration mismatch: "
                 name
                 "'; END IF; END $$;")))
         "\n")))

(defn contracts
  []
  (mapv (fn [[[table column] spec]] (assoc spec :table table :column column))
        (sort-by key domain/COLUMN_ENUMS)))
