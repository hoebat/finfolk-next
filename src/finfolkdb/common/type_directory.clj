(ns finfolkdb.common.type-directory
 (:require [lang.core :as l]))
(l/script :postgres {:require [[postgres.core :as pg]] :static {:application ["finfolk"] :all {:schema ["finfolk"]}}})

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL event" "NOT NULL created_at" "PRIMARY KEY (id)" "FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id)"]}
 directory_audit
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
  :listing-id {:type :uuid}
  :actor {:type :text}
  :event {:type :text :required true}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["CHECK ((state = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))" "NOT NULL id" "NOT NULL listing_id" "NOT NULL challenge" "NOT NULL expires_at" "NOT NULL state" "NOT NULL evidence" "NOT NULL created_at" "PRIMARY KEY (id)" "FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id)" "FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE"]}
 directory_claims
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
  :listing-id {:type :uuid :required true}
  :user-id {:type :text}
  :challenge {:type :text :required true}
  :expires-at {:type :timestamptz :required true :finfolk/default-sql "(now() + '7 days'::interval)"}
  :state {:type :text :required true :finfolk/default-sql "'pending'::text"}
  :evidence {:type :text :required true :finfolk/default-sql "''::text"}
  :reviewed-by {:type :text}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["CHECK ((status = ANY (ARRAY['candidate'::text, 'published'::text, 'rejected'::text, 'archived'::text, 'suppressed'::text])))" "NOT NULL id" "NOT NULL document" "NOT NULL status" "NOT NULL revision" "NOT NULL outreach" "NOT NULL notes" "NOT NULL updated_at" "PRIMARY KEY (id)" "FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL"]}
 directory_listings
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
  :document {:type :jsonb :required true}
  :status {:type :text :required true :finfolk/default-sql "'candidate'::text"}
  :owner-id {:type :text}
  :revision {:type :integer :required true :finfolk/default-sql "1"}
  :reviewed-at {:type :timestamptz}
  :outreach {:type :text :required true :finfolk/default-sql "'Not contacted'::text"}
  :notes {:type :text :required true :finfolk/default-sql "''::text"}
  :updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL listing_id" "NOT NULL message" "NOT NULL resolved" "NOT NULL created_at" "PRIMARY KEY (id)" "FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id)" "FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE SET NULL"]}
 directory_reports
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
  :listing-id {:type :uuid :required true}
  :user-id {:type :text}
  :message {:type :text :required true}
  :resolved {:type :boolean :required true :finfolk/default-sql "false"}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL query" "NOT NULL state" "NOT NULL error" "NOT NULL created_at" "PRIMARY KEY (id)"]}
 directory_runs
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
  :query {:type :text :required true}
  :state {:type :text :required true :finfolk/default-sql "'running'::text"}
  :error {:type :text :required true :finfolk/default-sql "''::text"}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

(deftype.pg ^{:finfolk/constraints ["NOT NULL identity" "NOT NULL listing_id" "PRIMARY KEY (identity)" "FOREIGN KEY (listing_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE"]}
 directory_socials
 [:identity {:type :text :required true}
  :listing-id {:type :uuid :required true}])
