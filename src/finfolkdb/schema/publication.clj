(ns finfolkdb.schema.publication
 (:require [clojure.string :as str] [std.make :as make]
           [std.json :as json] [finfolkdb.schema.catalog :as catalog]
           [finfolkdb.schema.indexes :as indexes] [finfolkbuild.db.publication :as release]))
(defn constraint-sql [s]
 (str/replace s #"((?:PRIMARY KEY|UNIQUE|FOREIGN KEY|REFERENCES [a-z_.]+) \()([a-z_ ,]+)(\))"
  (fn [[_ prefix columns suffix]] (str prefix (str/join ", " (str/split (str/replace columns "," " ") #"\s+")) suffix))))
(defn sql []
 (let [tables (catalog/declarations)]
 (str "-- Generated fresh-install schema. External prerequisites: finfolk_api and managed Neon Auth.\nBEGIN;\n"
 "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='finfolk_api') OR to_regclass('neon_auth.\"user\"') IS NULL THEN RAISE EXCEPTION 'Provision finfolk_api and Neon Auth before installing the schema'; END IF; IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('finfolk','finfolk_rpc')) THEN RAISE EXCEPTION 'Fresh schema requires empty application schemas'; END IF; END $$;\n"
 "CREATE SCHEMA IF NOT EXISTS finfolk;\nCREATE SCHEMA IF NOT EXISTS finfolk_rpc;\n"
 (str/join "\n" (for [[table spec] tables]
  (str "CREATE TABLE finfolk." table " (" (str/join ", "
   (concat (for [{:keys [name type nullable default identity]} (:columns spec)]
    (str name " " type (when-not (str/blank? identity) (str " GENERATED " (if (= identity "a") "ALWAYS" "BY DEFAULT") " AS IDENTITY"))
     (when-not nullable " NOT NULL") (when default (str " DEFAULT " default))))
    (map constraint-sql (remove #(or (str/starts-with? % "NOT NULL") (str/starts-with? % "FOREIGN KEY")) (:constraints spec))))) ");")))
 "\n" (str/join "\n" (for [[table spec] tables c (:constraints spec) :when (str/starts-with? c "FOREIGN KEY")]
  (str "ALTER TABLE finfolk." table " ADD " (constraint-sql c) ";")))
 "\n" (str/join "\n" (map #(str (:definition %) ";") indexes/INDEXES))
 "\nREVOKE ALL ON ALL TABLES IN SCHEMA finfolk FROM PUBLIC;\nGRANT USAGE ON SCHEMA finfolk TO finfolk_api;\nGRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA finfolk TO finfolk_api;\nGRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA finfolk TO finfolk_api;\n"
 ;; Reuse the byte-stable release publisher, including its harmless IF NOT EXISTS sections.
 (release/sql)
 "\nINSERT INTO finfolk.site_catalog(id) VALUES(1);\nINSERT INTO finfolk.messaging_accounts(id) VALUES('instagram');\n"
 "INSERT INTO finfolk.instagram_sources(key,kind) VALUES('tags','tags'),('recheck','recheck');\n"
 "INSERT INTO finfolk.instagram_sources(key,kind,data) SELECT 'hashtag:'||tag,'hashtag',jsonb_build_object('tag',tag) FROM unnest(ARRAY['portphillipbay','edithvale','morningtonpeninsula','portseabeach','bondibeach','maroubrabeach','gordonsbay','clovellybeach','jervisbay','hyamsbeach']) tag;\nCOMMIT;\n")))
(make/def.make SCHEMA
 {:default [{:type :custom :target "resources/finfolkdb" :file "schema.sql" :fn (fn [_] (sql))}]})
(defn publish! [root]
 (make/build-at root (:default @(:instance SCHEMA))))
(defn indexes-json []
 (str (json/write (mapv (fn [v] {"name" (:name v) "definition" (:definition v)}) indexes/INDEXES)) "\n"))
