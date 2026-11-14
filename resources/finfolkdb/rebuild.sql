-- Generated from finfolkdb.schema.rebuild; install only after the fresh native schema.
BEGIN;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='finfolk_shop') THEN RAISE EXCEPTION 'Fresh rebuild requires an empty finfolk_shop schema'; END IF; END $$;
CREATE FUNCTION finfolk_rpc.import_reference_batch(import_kind text, documents jsonb) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE doc jsonb; existing jsonb; n integer:=0;
BEGIN
 IF jsonb_typeof(documents) IS DISTINCT FROM 'array' OR jsonb_array_length(documents)>500 THEN RAISE EXCEPTION 'Expected at most 500 reference rows'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('finfolk:native-reference-import'));
 FOR doc IN SELECT * FROM jsonb_array_elements(documents) LOOP
 CASE import_kind
WHEN 'DataSource' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['enabled','id','key','metadata']::text[] THEN RAISE EXCEPTION 'Invalid import columns for DataSource'; END IF;
 INSERT INTO finfolk."DataSource" ("id","key","metadata","enabled") SELECT "id","key","metadata","enabled" FROM jsonb_populate_record(NULL::finfolk."DataSource",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'metadata',t."metadata",'enabled',t."enabled") INTO existing FROM finfolk."DataSource" t CROSS JOIN jsonb_populate_record(NULL::finfolk."DataSource",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for DataSource' USING ERRCODE='23505'; END IF;
WHEN 'GeoArea' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['id','key','metadata','source_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for GeoArea'; END IF;
 INSERT INTO finfolk."GeoArea" ("id","key","source_id","metadata") SELECT "id","key","source_id","metadata" FROM jsonb_populate_record(NULL::finfolk."GeoArea",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'source_id',t."source_id",'metadata',t."metadata") INTO existing FROM finfolk."GeoArea" t CROSS JOIN jsonb_populate_record(NULL::finfolk."GeoArea",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for GeoArea' USING ERRCODE='23505'; END IF;
WHEN 'DataAsset' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['bytes','checksum','id','key','kind','metadata','source_id','uri']::text[] THEN RAISE EXCEPTION 'Invalid import columns for DataAsset'; END IF;
 INSERT INTO finfolk."DataAsset" ("id","key","source_id","checksum","bytes","kind","uri","metadata") SELECT "id","key","source_id","checksum","bytes","kind","uri","metadata" FROM jsonb_populate_record(NULL::finfolk."DataAsset",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'source_id',t."source_id",'checksum',t."checksum",'bytes',t."bytes",'kind',t."kind",'uri',t."uri",'metadata',t."metadata") INTO existing FROM finfolk."DataAsset" t CROSS JOIN jsonb_populate_record(NULL::finfolk."DataAsset",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for DataAsset' USING ERRCODE='23505'; END IF;
WHEN 'DepthDataset' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['checksum','id','key','metadata','source_id','status','upstream_id','version']::text[] THEN RAISE EXCEPTION 'Invalid import columns for DepthDataset'; END IF;
 INSERT INTO finfolk."DepthDataset" ("id","key","source_id","upstream_id","version","checksum","status","metadata") SELECT "id","key","source_id","upstream_id","version","checksum","status","metadata" FROM jsonb_populate_record(NULL::finfolk."DepthDataset",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'source_id',t."source_id",'upstream_id',t."upstream_id",'version',t."version",'checksum',t."checksum",'status',t."status",'metadata',t."metadata") INTO existing FROM finfolk."DepthDataset" t CROSS JOIN jsonb_populate_record(NULL::finfolk."DepthDataset",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for DepthDataset' USING ERRCODE='23505'; END IF;
WHEN 'DepthDatasetAsset' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['asset_id','dataset_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for DepthDatasetAsset'; END IF;
 INSERT INTO finfolk."DepthDatasetAsset" ("dataset_id","asset_id") SELECT "dataset_id","asset_id" FROM jsonb_populate_record(NULL::finfolk."DepthDatasetAsset",doc) ON CONFLICT ("dataset_id","asset_id") DO NOTHING;
 SELECT jsonb_build_object('dataset_id',t."dataset_id",'asset_id',t."asset_id") INTO existing FROM finfolk."DepthDatasetAsset" t CROSS JOIN jsonb_populate_record(NULL::finfolk."DepthDatasetAsset",doc) r WHERE t."dataset_id"=r."dataset_id" AND t."asset_id"=r."asset_id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for DepthDatasetAsset' USING ERRCODE='23505'; END IF;
WHEN 'GeoFeature' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['dataset_id','geometry','id','key','properties']::text[] THEN RAISE EXCEPTION 'Invalid import columns for GeoFeature'; END IF;
 INSERT INTO finfolk."GeoFeature" ("id","key","dataset_id","geometry","properties") SELECT "id","key","dataset_id","geometry","properties" FROM jsonb_populate_record(NULL::finfolk."GeoFeature",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'dataset_id',t."dataset_id",'geometry',t."geometry",'properties',t."properties") INTO existing FROM finfolk."GeoFeature" t CROSS JOIN jsonb_populate_record(NULL::finfolk."GeoFeature",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for GeoFeature' USING ERRCODE='23505'; END IF;
WHEN 'GeoBoundary' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['area_id','asset_id','geometry','id','key','properties']::text[] THEN RAISE EXCEPTION 'Invalid import columns for GeoBoundary'; END IF;
 INSERT INTO finfolk."GeoBoundary" ("id","key","asset_id","area_id","geometry","properties") SELECT "id","key","asset_id","area_id","geometry","properties" FROM jsonb_populate_record(NULL::finfolk."GeoBoundary",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'asset_id',t."asset_id",'area_id',t."area_id",'geometry',t."geometry",'properties',t."properties") INTO existing FROM finfolk."GeoBoundary" t CROSS JOIN jsonb_populate_record(NULL::finfolk."GeoBoundary",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for GeoBoundary' USING ERRCODE='23505'; END IF;
WHEN 'Beach' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['area_name','id','key','name','state','timezone']::text[] THEN RAISE EXCEPTION 'Invalid import columns for Beach'; END IF;
 INSERT INTO finfolk."Beach" ("id","key","name","timezone","area_name","state") SELECT "id","key","name","timezone","area_name","state" FROM jsonb_populate_record(NULL::finfolk."Beach",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'name',t."name",'timezone',t."timezone",'area_name',t."area_name",'state',t."state") INTO existing FROM finfolk."Beach" t CROSS JOIN jsonb_populate_record(NULL::finfolk."Beach",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for Beach' USING ERRCODE='23505'; END IF;
WHEN 'SiteLocation' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['area_id','beach_id','geometry','source_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteLocation'; END IF;
 INSERT INTO finfolk."SiteLocation" ("beach_id","area_id","source_id","geometry") SELECT "beach_id","area_id","source_id","geometry" FROM jsonb_populate_record(NULL::finfolk."SiteLocation",doc) ON CONFLICT ("beach_id") DO NOTHING;
 SELECT jsonb_build_object('beach_id',t."beach_id",'area_id',t."area_id",'source_id',t."source_id",'geometry',t."geometry") INTO existing FROM finfolk."SiteLocation" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteLocation",doc) r WHERE t."beach_id"=r."beach_id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteLocation' USING ERRCODE='23505'; END IF;
WHEN 'SiteProfile' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['access_mode','beach_id','payload','revision','status','waterbody']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteProfile'; END IF;
 INSERT INTO finfolk."SiteProfile" ("beach_id","revision","waterbody","access_mode","status","payload") SELECT "beach_id","revision","waterbody","access_mode","status","payload" FROM jsonb_populate_record(NULL::finfolk."SiteProfile",doc) ON CONFLICT ("beach_id") DO NOTHING;
 SELECT jsonb_build_object('beach_id',t."beach_id",'revision',t."revision",'waterbody',t."waterbody",'access_mode',t."access_mode",'status',t."status",'payload',t."payload") INTO existing FROM finfolk."SiteProfile" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteProfile",doc) r WHERE t."beach_id"=r."beach_id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteProfile' USING ERRCODE='23505'; END IF;
WHEN 'SiteRevision' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['base_revision','id','payload','reason','site_id','status','version']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteRevision'; END IF;
 INSERT INTO finfolk."SiteRevision" ("id","site_id","base_revision","version","status","payload","reason") SELECT "id","site_id","base_revision","version","status","payload","reason" FROM jsonb_populate_record(NULL::finfolk."SiteRevision",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'site_id',t."site_id",'base_revision',t."base_revision",'version',t."version",'status',t."status",'payload',t."payload",'reason',t."reason") INTO existing FROM finfolk."SiteRevision" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteRevision",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteRevision' USING ERRCODE='23505'; END IF;
WHEN 'SiteAccessPoint' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['id','mode','payload','revision_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteAccessPoint'; END IF;
 INSERT INTO finfolk."SiteAccessPoint" ("id","revision_id","mode","payload") SELECT "id","revision_id","mode","payload" FROM jsonb_populate_record(NULL::finfolk."SiteAccessPoint",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'revision_id',t."revision_id",'mode',t."mode",'payload',t."payload") INTO existing FROM finfolk."SiteAccessPoint" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteAccessPoint",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteAccessPoint' USING ERRCODE='23505'; END IF;
WHEN 'SiteDepthEvidence' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['id','kind','payload','revision_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteDepthEvidence'; END IF;
 INSERT INTO finfolk."SiteDepthEvidence" ("id","revision_id","kind","payload") SELECT "id","revision_id","kind","payload" FROM jsonb_populate_record(NULL::finfolk."SiteDepthEvidence",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'revision_id',t."revision_id",'kind',t."kind",'payload',t."payload") INTO existing FROM finfolk."SiteDepthEvidence" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteDepthEvidence",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteDepthEvidence' USING ERRCODE='23505'; END IF;
WHEN 'SiteDepthDataset' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['dataset_id','evidence','relationship','revision_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteDepthDataset'; END IF;
 INSERT INTO finfolk."SiteDepthDataset" ("revision_id","dataset_id","relationship","evidence") SELECT "revision_id","dataset_id","relationship","evidence" FROM jsonb_populate_record(NULL::finfolk."SiteDepthDataset",doc) ON CONFLICT ("revision_id","dataset_id") DO NOTHING;
 SELECT jsonb_build_object('revision_id',t."revision_id",'dataset_id',t."dataset_id",'relationship',t."relationship",'evidence',t."evidence") INTO existing FROM finfolk."SiteDepthDataset" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteDepthDataset",doc) r WHERE t."revision_id"=r."revision_id" AND t."dataset_id"=r."dataset_id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteDepthDataset' USING ERRCODE='23505'; END IF;
WHEN 'TideStation' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['active','id','key','metadata','source_id','upstream_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for TideStation'; END IF;
 INSERT INTO finfolk."TideStation" ("id","key","source_id","upstream_id","metadata","active") SELECT "id","key","source_id","upstream_id","metadata","active" FROM jsonb_populate_record(NULL::finfolk."TideStation",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'source_id',t."source_id",'upstream_id',t."upstream_id",'metadata',t."metadata",'active',t."active") INTO existing FROM finfolk."TideStation" t CROSS JOIN jsonb_populate_record(NULL::finfolk."TideStation",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for TideStation' USING ERRCODE='23505'; END IF;
WHEN 'SiteTideStation' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['evidence','revision_id','station_id']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteTideStation'; END IF;
 INSERT INTO finfolk."SiteTideStation" ("revision_id","station_id","evidence") SELECT "revision_id","station_id","evidence" FROM jsonb_populate_record(NULL::finfolk."SiteTideStation",doc) ON CONFLICT ("revision_id") DO NOTHING;
 SELECT jsonb_build_object('revision_id',t."revision_id",'station_id',t."station_id",'evidence',t."evidence") INTO existing FROM finfolk."SiteTideStation" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteTideStation",doc) r WHERE t."revision_id"=r."revision_id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteTideStation' USING ERRCODE='23505'; END IF;
WHEN 'SiteCatalog' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['id','metadata','revision']::text[] THEN RAISE EXCEPTION 'Invalid import columns for SiteCatalog'; END IF;
 INSERT INTO finfolk."SiteCatalog" ("id","revision","metadata") SELECT "id","revision","metadata" FROM jsonb_populate_record(NULL::finfolk."SiteCatalog",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'revision',t."revision",'metadata',t."metadata") INTO existing FROM finfolk."SiteCatalog" t CROSS JOIN jsonb_populate_record(NULL::finfolk."SiteCatalog",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for SiteCatalog' USING ERRCODE='23505'; END IF;
WHEN 'DatabaseRelease' THEN
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(doc) k) IS DISTINCT FROM ARRAY['counts','id','key','manifest']::text[] THEN RAISE EXCEPTION 'Invalid import columns for DatabaseRelease'; END IF;
 INSERT INTO finfolk."DatabaseRelease" ("id","key","manifest","counts") SELECT "id","key","manifest","counts" FROM jsonb_populate_record(NULL::finfolk."DatabaseRelease",doc) ON CONFLICT ("id") DO NOTHING;
 SELECT jsonb_build_object('id',t."id",'key',t."key",'manifest',t."manifest",'counts',t."counts") INTO existing FROM finfolk."DatabaseRelease" t CROSS JOIN jsonb_populate_record(NULL::finfolk."DatabaseRelease",doc) r WHERE t."id"=r."id";
 IF existing IS DISTINCT FROM doc THEN RAISE EXCEPTION 'Immutable import conflict for DatabaseRelease' USING ERRCODE='23505'; END IF;
 ELSE RAISE EXCEPTION 'Unknown reference import kind';
 END CASE;
 n:=n+1;
 END LOOP;
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION finfolk_rpc.import_reference_batch(text,jsonb) FROM PUBLIC;
CREATE FUNCTION finfolk_rpc.verify_reference_release(release_id uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
SELECT jsonb_build_object('id',r.id,'expected',r.counts,'actual',jsonb_build_object('DataSource',(SELECT count(*) FROM finfolk."DataSource"),'GeoArea',(SELECT count(*) FROM finfolk."GeoArea"),'DataAsset',(SELECT count(*) FROM finfolk."DataAsset"),'DepthDataset',(SELECT count(*) FROM finfolk."DepthDataset"),'DepthDatasetAsset',(SELECT count(*) FROM finfolk."DepthDatasetAsset"),'GeoFeature',(SELECT count(*) FROM finfolk."GeoFeature"),'GeoBoundary',(SELECT count(*) FROM finfolk."GeoBoundary"),'Beach',(SELECT count(*) FROM finfolk."Beach"),'SiteLocation',(SELECT count(*) FROM finfolk."SiteLocation"),'SiteProfile',(SELECT count(*) FROM finfolk."SiteProfile"),'SiteRevision',(SELECT count(*) FROM finfolk."SiteRevision"),'SiteAccessPoint',(SELECT count(*) FROM finfolk."SiteAccessPoint"),'SiteDepthEvidence',(SELECT count(*) FROM finfolk."SiteDepthEvidence"),'SiteDepthDataset',(SELECT count(*) FROM finfolk."SiteDepthDataset"),'TideStation',(SELECT count(*) FROM finfolk."TideStation"),'SiteTideStation',(SELECT count(*) FROM finfolk."SiteTideStation"),'SiteCatalog',(SELECT count(*) FROM finfolk."SiteCatalog"))) FROM finfolk."DatabaseRelease" r WHERE r.id=release_id;
$$;
REVOKE ALL ON FUNCTION finfolk_rpc.verify_reference_release(uuid) FROM PUBLIC;
COMMIT;
