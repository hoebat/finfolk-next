(ns finfolkdb.common.type-media
  (:require [lang.core :as l]))

(l/script :postgres
 {:require [[postgres.core :as pg]]
  :static {:application ["finfolk"] :all {:schema ["finfolk"]}}})

;; Physical table: finfolk.media_imports
(deftype.pg ^{:finfolk/constraints ["FOREIGN KEY (beach_id) REFERENCES finfolk.beaches(id)" "NOT NULL candidates" "NOT NULL created_at" "NOT NULL edited" "NOT NULL id" "NOT NULL kind" "NOT NULL location_name" "NOT NULL notes" "FOREIGN KEY (owner_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE" "NOT NULL owner_id" "UNIQUE (owner_id, platform, provider_id)" "PRIMARY KEY (id)" "CHECK ((platform = ANY (ARRAY['instagram'::text, 'tiktok'::text])))" "NOT NULL platform" "NOT NULL provider_id" "FOREIGN KEY (session_id) REFERENCES finfolk.sessions(id) ON DELETE SET NULL" "CHECK ((state = ANY (ARRAY['active'::text, 'hidden'::text])))" "NOT NULL state" "NOT NULL updated_at" "NOT NULL url"]}
  media_imports
  [:id {:type :uuid :required true :primary true :finfolk/default-sql "gen_random_uuid()"}
   :owner-id {:type :text :required true}
   :platform {:type :text :required true}
   :provider-id {:type :text :required true}
   :url {:type :text :required true}
   :kind {:type :text :required true :finfolk/default-sql "'post'::text"}
   :posted-at {:type :timestamptz}
   :day {:type :date}
   :beach-id {:type :text}
   :location-name {:type :text :required true :finfolk/default-sql "''::text"}
   :candidates {:type :jsonb :required true :finfolk/default-sql "'[]'::jsonb"}
   :notes {:type :text :required true :finfolk/default-sql "''::text"}
   :session-id {:type :uuid}
   :state {:type :text :required true :finfolk/default-sql "'active'::text"}
   :edited {:type :boolean :required true :finfolk/default-sql "false"}
   :assignment-key {:type :uuid}
   :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}
   :updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])

;; Physical table: finfolk.tiktok_connections
(deftype.pg ^{:finfolk/constraints ["NOT NULL app_id" "UNIQUE (app_id, open_id)" "NOT NULL display_name" "NOT NULL failures" "NOT NULL next_at" "PRIMARY KEY (user_id)" "CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'disconnected'::text, 'reconnect'::text])))" "NOT NULL status" "NOT NULL updated_at" "FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE" "NOT NULL user_id"]}
  tiktok_connections
  [:user-id {:type :text :required true :primary true}
   :app-id {:type :text :required true}
   :open-id {:type :text}
   :display-name {:type :text :required true :finfolk/default-sql "''::text"}
   :status {:type :text :required true :finfolk/default-sql "'pending'::text"}
   :credential-ciphertext {:type :text}
   :access-expires-at {:type :timestamptz}
   :refresh-expires-at {:type :timestamptz}
   :oauth-hash {:type :text}
   :oauth-expires-at {:type :timestamptz}
   :oauth-nonce-hash {:type :text}
   :last-success {:type :timestamptz}
   :next-at {:type :timestamptz :required true :finfolk/default-sql "now()"}
   :lease-until {:type :timestamptz}
   :cursor {:type :text}
   :failures {:type :integer :required true :finfolk/default-sql "0"}
   :updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
