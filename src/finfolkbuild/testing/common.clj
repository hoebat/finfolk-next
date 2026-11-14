(ns finfolkbuild.testing.common
  "Common declaration contracts against the disposable Neon-compatible database."
  (:require [clojure.set :as set]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkdb.schema.entity-catalog :as catalog]
            [lang.core.impl :as impl]))

(defn rows
  [db sql & args]
  (with-open [statement (.prepareStatement db sql)]
    (doseq [[i value] (map-indexed vector args)] (.setObject statement (inc i) value))
    (with-open [result (.executeQuery statement)]
      (let [n (.getColumnCount (.getMetaData result))]
        (loop [out []]
          (if (.next result)
            (recur (conj out (mapv #(.getString result %) (range 1 (inc n)))))
            out))))))

(defn equal!
  [label expected actual]
  (when-not (= expected actual) (throw (ex-info label {:expected expected :actual actual})))
  true)

(defn table!
  [db id]
  (let
    [spec (get (catalog/declarations) (name id))
     columns (:columns spec)
     actual
     (rows
      db
      "SELECT a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull::text FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finfolk' AND c.relname=? AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum"
      (name id))
     sql-type (fn [column]
                (case (:type column)
                  "ref" (let [target (get (catalog/declarations)
                                          (get-in column [:reference :table]))]
                          (:type (first (filter :primary (:columns target)))))
                  "enum" (str "finfolk.\"" (name (get-in column [:spec :enum :ns])) "\"")
                  "timestamptz" "timestamp with time zone"
                  ("time" "long") "bigint"
                  ("map" "array") "jsonb"
                  (:type column)))
     expected (mapv (fn [column] [(:sql-name column) (sql-type column) (str (:required column))])
                    columns)]
    (equal! (str id " columns/types/nullability") expected actual)
    (equal!
     (str id " primary key")
     (set (map :sql-name (filter :primary columns)))
     (set
      (map
       first
       (rows
        db
        "SELECT a.attname FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(k.conkey) WHERE n.nspname='finfolk' AND c.relname=? AND k.contype='p'"
        (name id)))))
    (equal!
     (str id " declared foreign key targets exist (including scoped composite links)")
     true
     (set/subset?
      (set (for [column columns
                 :when (:reference column)]
             [(:sql-name column) (get-in column [:reference :table])]))
      (set
       (rows
        db
        "SELECT a.attname,t.relname FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_class t ON t.oid=k.confrelid JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=ANY(k.conkey) WHERE n.nspname='finfolk' AND c.relname=? AND k.contype='f'"
        (name id)))))
    true))

(defn enum!
  [db entry]
  (let [labels (nth (:form entry) 2)
        labels (if (vector? labels)
                 (mapv name labels)
                 ;; The class discriminator is resolved after all addons load.
                 (binding [*ns* (find-ns (:module entry))] (mapv name (eval (second labels)))))]
    (equal!
     (str (:id entry) " ordered enum labels")
     labels
     (mapv
      first
      (rows
       db
       "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='finfolk' AND t.typname=? ORDER BY e.enumsortorder"
       (name (:id entry)))))))

(defn function!
  [db id]
  (case (name id)
    "auth-uid" (do
                 (equal! "identity absent on a new connection"
                         nil
                         (jdbc/scalar db "SELECT finfolk.auth_uid()"))
                 (equal! "transaction identity visible only inside transaction"
                         "28a317d9-c760-504c-826c-69da285e319f"
                         (jdbc/transaction "28a317d9-c760-504c-826c-69da285e319f"
                                           #(jdbc/scalar % "SELECT finfolk.auth_uid()")))
                 (equal! "identity does not leak" nil (jdbc/scalar db "SELECT finfolk.auth_uid()")))
    "as-iso-time"
    (equal! "UTC serialization and null"
            [["2026-11-04T14:02:03.456Z" nil]]
            (rows db "SELECT finfolk.as_iso_time(1793800923456000),finfolk.as_iso_time(NULL)"))
    ("as-jsonb" "as-jsonb-array")
    (let [array? (= "as-jsonb-array" (name id))
          function (if array? "as_jsonb_array" "as_jsonb")
          empty-json (if array? "[]" "{}")
          valid-json (if array? "[1, true]" "{\"a\": 1}")
          invalid-json (if array? "{}" "[]")]
      (equal! "null is coerced and valid JSON preserved"
              [[empty-json valid-json]]
              (rows
               db
               (str "SELECT finfolk." function "(NULL)::text,finfolk." function "(?::jsonb)::text")
               valid-json))
      (equal! "wrong JSON shape rejected"
              "P0001"
              (try (jdbc/scalar db (str "SELECT finfolk." function "(?::jsonb)") invalid-json)
                   nil
                   (catch java.sql.SQLException e (.getSQLState e)))))
    "ret-social-url"
    (equal!
     "known providers and unknown provider"
     [["https://www.instagram.com/alice/" "https://www.tiktok.com/@bob" nil]]
     (rows
      db
      "SELECT finfolk.ret_social_url('instagram:alice'),finfolk.ret_social_url('tiktok:bob'),finfolk.ret_social_url('other:alice')"))
    "ret-social-urls"
    (equal!
     "list filters unsupported providers and handles null"
     [["[\"https://www.instagram.com/alice/\", \"https://www.tiktok.com/@bob\"]" "[]"]]
     (rows
      db
      "SELECT finfolk.ret_social_urls('[\"instagram:alice\",\"other:x\",\"tiktok:bob\"]'::jsonb)::text,finfolk.ret_social_urls(NULL)::text"))
    "op-fn"
    (jdbc/transaction
     "28a317d9-c760-504c-826c-69da285e319f"
     (fn [tx]
       (equal!
        "operation context persists supplied data and owner"
        [["common-test" "28a317d9-c760-504c-826c-69da285e319f" "{\"test\": true}"]]
        (rows
         tx
         "SELECT o->>'tag',o->>'user_id',(o->'data')::text FROM (SELECT finfolk.op_fn('common-test','28a317d9-c760-504c-826c-69da285e319f','{\"test\":true}'::jsonb) o) s"))))
    ("ret-rev-default" "sel-rev-all")
    (jdbc/transaction
     "28a317d9-c760-504c-826c-69da285e319f"
     (fn [tx]
       (let
         [revision
          (jdbc/scalar
           tx
           "INSERT INTO finfolk.\"Rev\"(class_table,class_context,class_ref) VALUES('User','Global','1c4529e7-aec4-5965-a713-30662c70680b') RETURNING id::text")]
         (if (= "ret-rev-default" (name id))
           (equal!
            "revision lookup respects entity scope"
            [["1c4529e7-aec4-5965-a713-30662c70680b" nil]]
            (rows
             tx
             "SELECT finfolk.ret_rev_default('User','Global','1c4529e7-aec4-5965-a713-30662c70680b')->>'class_ref',finfolk.ret_rev_default('User','Post','1c4529e7-aec4-5965-a713-30662c70680b')->>'class_ref'"))
           (equal!
            "revision selection respects context"
            [["true" "true"]]
            (rows
             tx
             "SELECT jsonb_exists(finfolk.sel_rev_all('User','Global'),?)::text,(NOT jsonb_exists(coalesce(finfolk.sel_rev_all('User','Post'),'[]'::jsonb),?))::text"
             revision
             revision))))))
    (throw (ex-info "Missing behavior contract for common function" {:id id}))))

(defn check!
  [qualified]
  (let [module (symbol (namespace qualified))
        id (symbol (name qualified))
        entry (impl/get-entry (impl/runtime-library) :postgres module id)]
    (when-not entry (throw (ex-info "Declaration not loaded" {:declaration qualified})))
    (with-open [db (jdbc/connection)]
      (case (:static/dbtype entry)
        :table (table! db id)
        :enum (enum! db entry)
        (function! db id)))))
