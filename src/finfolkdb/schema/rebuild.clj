(ns finfolkdb.schema.rebuild
  "Owner-only, fixed-table reference import publication. No dynamic identifiers or migration replay."
  (:require [clojure.string :as str]
            [finfolkdb.schema.entity-catalog :as catalog]))

;; Each declaration specifies the complete immutable import projection. PostgreSQL
;; casts through the native composite type, enforcing enums, references and checks.
(def tables
  [["DataSource" ["id" "key" "metadata" "enabled"]] ["GeoArea" ["id" "key" "source_id" "metadata"]]
   ["DataAsset" ["id" "key" "source_id" "checksum" "bytes" "kind" "uri" "metadata"]]
   ["DepthDataset" ["id" "key" "source_id" "upstream_id" "version" "checksum" "status" "metadata"]]
   ["DepthDatasetAsset" ["dataset_id" "asset_id"]]
   ["GeoFeature" ["id" "key" "dataset_id" "geometry" "properties"]]
   ["GeoBoundary" ["id" "key" "asset_id" "area_id" "geometry" "properties"]]
   ["Beach" ["id" "key" "name" "timezone" "area_name" "state"]]
   ["SiteLocation" ["beach_id" "area_id" "source_id" "geometry"]]
   ["SiteProfile" ["beach_id" "revision" "waterbody" "access_mode" "status" "payload"]]
   ["SiteRevision" ["id" "site_id" "base_revision" "version" "status" "payload" "reason"]]
   ["SiteAccessPoint" ["id" "revision_id" "mode" "payload"]]
   ["SiteDepthEvidence" ["id" "revision_id" "kind" "payload"]]
   ["SiteDepthDataset" ["revision_id" "dataset_id" "relationship" "evidence"]]
   ["TideStation" ["id" "key" "source_id" "upstream_id" "metadata" "active"]]
   ["SiteTideStation" ["revision_id" "station_id" "evidence"]]
   ["SiteCatalog" ["id" "revision" "metadata"]]
   ["DatabaseRelease" ["id" "key" "manifest" "counts"]]])

(defn quote-name [s] (str "\"" s "\""))
(defn quote-text [s] (str "'" (str/replace s "'" "''") "'"))

(defn contracts [] (into (array-map) tables))

(defn branch
  [declarations [table columns]]
  (let [spec (get declarations table)
        known (set (map :sql-name (:columns spec)))
        primary (map :sql-name
                     (filter (if (some #{"id"} columns)
                               :primary
                               #(some #{"entity_key"} (get-in % [:spec :sql :unique])))
                             (:columns spec)))
        target (str "finfolk." (quote-name table))
        cols (str/join "," (map quote-name columns))
        projection (str/join ","
                             (mapcat (fn [c] [(quote-text c) (str "t." (quote-name c))]) columns))
        where (str/join " AND " (map #(str "t." (quote-name %) "=r." (quote-name %)) primary))]
    (when-not (and (seq primary) (every? known columns) (every? (set columns) primary))
      (throw (ex-info "Invalid native import projection" {:table table :columns columns})))
    (str
     "WHEN "
     (quote-text table)
     " THEN\n"
     " IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY["
     (str/join "," (map quote-text (sort columns)))
     "]::text[] THEN RAISE EXCEPTION 'Invalid import columns for "
     table
     "'; END IF;\n"
     " INSERT INTO "
     target
     " ("
     cols
     ") SELECT "
     cols
     " FROM jsonb_populate_record(NULL::"
     target
     ",doc) ON CONFLICT ("
     (str/join "," (map quote-name primary))
     ") DO NOTHING;\n"
     " SELECT jsonb_build_object("
     projection
     ") INTO existing FROM "
     target
     " t CROSS JOIN jsonb_populate_record(NULL::"
     target
     ",doc) r WHERE "
     where
     ";\n"
     " IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for "
     table
     "' USING ERRCODE='23505'; END IF;\n")))

(defn sql
  []
  (let [declarations (catalog/declarations)]
    (str
     "-- Generated from finfolkdb.schema.rebuild; install only after the fresh native schema.\nBEGIN;\n"
     "DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finfolk_shop') THEN RAISE EXCEPTION 'Fresh rebuild requires an empty finfolk_shop schema'; END IF; END $$;\n"
     "CREATE FUNCTION finfolk_rpc.import_reference_batch(import_kind text, documents jsonb) RETURNS integer LANGUAGE plpgsql AS $$\n"
     "DECLARE doc jsonb; existing jsonb; n integer:=0;\nBEGIN\n"
     " IF jsonb_typeof(documents) IS DISTINCT FROM 'array' OR jsonb_array_length(documents)>500 THEN RAISE EXCEPTION 'Expected at most 500 reference rows'; END IF;\n"
     " PERFORM pg_advisory_xact_lock(hashtext('finfolk:native-reference-import'));\n"
     " FOR doc IN SELECT * FROM jsonb_array_elements(documents) LOOP\n CASE import_kind\n"
     (apply str (map #(branch declarations %) tables))
     " ELSE RAISE EXCEPTION 'Unknown reference import kind';\n END CASE;\n n:=n+1;\n END LOOP;\n RETURN n;\nEND $$;\n"
     "REVOKE ALL ON FUNCTION finfolk_rpc.import_reference_batch(text,jsonb) FROM PUBLIC;\n"
     "CREATE FUNCTION finfolk_rpc.verify_reference_release(release_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$\n"
     "SELECT jsonb_build_object('id',r.id,'expected',r.counts,'actual',jsonb_build_object("
     (str/join ","
               (for [[table _] tables
                     :when (not= table "DatabaseRelease")]
                 (str (quote-text table) ",(SELECT count(*) FROM finfolk." (quote-name table) ")")))
     ")) FROM finfolk.\"DatabaseRelease\" r WHERE r.id=release_id;\n$$;\n"
     "REVOKE ALL ON FUNCTION finfolk_rpc.verify_reference_release(uuid) FROM PUBLIC;\nCOMMIT;\n")))
