(ns finfolkdb.common.type-site
  (:require [lang.core :as l]))
(l/script :postgres {:require [[postgres.core :as pg]] :static {:application ["finfolk"] :all {:schema ["finfolk"]}}})

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL revision" "NOT NULL metadata" "PRIMARY KEY (id)" "CHECK ((id = 1))" "CHECK ((revision >= 0))"]}
 site_catalog
 [:id {:type :integer :required true :primary true}
  :revision {:type :bigint :required true :finfolk/default-sql "0"}
  :metadata {:type :jsonb :required true :finfolk/default-sql "'{}'::jsonb"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL revision" "NOT NULL waterbody" "NOT NULL access_mode" "NOT NULL status" "NOT NULL payload" "NOT NULL updated_at" "PRIMARY KEY (id)" "FOREIGN KEY (id) REFERENCES finfolk.beaches(id)" "CHECK ((waterbody = ANY (ARRAY['ocean'::text, 'lake'::text, 'river'::text, 'quarry'::text, 'sinkhole'::text, 'pool'::text, 'unknown'::text])))" "CHECK ((access_mode = ANY (ARRAY['shore'::text, 'boat_only'::text, 'shore_or_boat'::text, 'unknown'::text])))" "CHECK ((status = ANY (ARRAY['published'::text, 'archived'::text])))"]}
 site_profiles
 [:id {:type :text :required true :primary true}
  :revision {:type :bigint :required true}
  :waterbody {:type :text :required true}
  :access-mode {:type :text :required true}
  :status {:type :text :required true}
  :payload {:type :jsonb :required true}
  :updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL preview" "NOT NULL status" "NOT NULL created_at" "PRIMARY KEY (id)" "FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL" "CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text])))"]}
 site_imports
 [:id {:type :uuid :required true :primary true :finfolk/default-sql "gen_random_uuid()"}
  :owner-id {:type :text}
  :preview {:type :jsonb :required true :finfolk/default-sql "'{}'::jsonb"}
  :status {:type :text :required true :finfolk/default-sql "'draft'::text"}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL site_id" "NOT NULL base_revision" "NOT NULL version" "NOT NULL status" "NOT NULL payload" "NOT NULL reason" "NOT NULL created_at" "NOT NULL updated_at" "PRIMARY KEY (id)" "FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL" "FOREIGN KEY (reviewed_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL" "FOREIGN KEY (import_id) REFERENCES finfolk.site_imports(id) ON DELETE CASCADE" "CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'published'::text, 'rejected'::text, 'withdrawn'::text])))"]}
 site_revisions
 [:id {:type :uuid :required true :primary true :finfolk/default-sql "gen_random_uuid()"}
  :site-id {:type :text :required true}
  :owner-id {:type :text}
  :import-id {:type :uuid}
  :base-revision {:type :bigint :required true :finfolk/default-sql "0"}
  :version {:type :bigint :required true :finfolk/default-sql "1"}
  :status {:type :text :required true}
  :payload {:type :jsonb :required true}
  :reason {:type :text :required true :finfolk/default-sql "''::text"}
  :reviewed-by {:type :text}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}
  :updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL revision_id" "NOT NULL mode" "NOT NULL payload" "PRIMARY KEY (id)" "FOREIGN KEY (revision_id) REFERENCES finfolk.site_revisions(id) ON DELETE CASCADE" "CHECK ((mode = ANY (ARRAY['shore'::text, 'departure'::text])))"]}
 site_access_points
 [:id {:type :uuid :required true :primary true :finfolk/default-sql "gen_random_uuid()"}
  :revision-id {:type :uuid :required true}
  :mode {:type :text :required true}
  :payload {:type :jsonb :required true}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL revision_id" "NOT NULL kind" "NOT NULL payload" "PRIMARY KEY (id)" "FOREIGN KEY (revision_id) REFERENCES finfolk.site_revisions(id) ON DELETE CASCADE" "CHECK ((kind = ANY (ARRAY['surveyed'::text, 'reported'::text])))"]}
 site_depth_evidence
 [:id {:type :uuid :required true :primary true :finfolk/default-sql "gen_random_uuid()"}
  :revision-id {:type :uuid :required true}
  :kind {:type :text :required true}
  :payload {:type :jsonb :required true}])
