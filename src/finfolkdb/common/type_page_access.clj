(ns finfolkdb.common.type-page-access (:require [lang.core :as l]))
(l/script :postgres {:require [[postgres.core :as pg]] :static {:application ["finfolk"] :all {:schema ["finfolk"]}}})
(deftype.pg ^{:finfolk/constraints ["NOT NULL page_id" "NOT NULL user_id" "NOT NULL created_at" "PRIMARY KEY (page_id, user_id)" "FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE" "FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE" "FOREIGN KEY (added_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL"]}
 directory_page_admins
 [:page-id {:type :uuid :required true} :user-id {:type :text :required true}
  :added-by {:type :text} :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
(deftype.pg ^{:finfolk/constraints ["NOT NULL token_hash" "NOT NULL page_id" "NOT NULL invited_by" "NOT NULL expires_at" "NOT NULL created_at" "PRIMARY KEY (token_hash)" "FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id) ON DELETE CASCADE" "FOREIGN KEY (invited_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE" "FOREIGN KEY (redeemed_by) REFERENCES finfolk.members(user_id) ON DELETE SET NULL"]}
 directory_page_invites
 [:token-hash {:type :text :required true} :page-id {:type :uuid :required true} :invited-by {:type :text :required true}
  :expires-at {:type :timestamptz :required true :finfolk/default-sql "(now() + '7 days'::interval)"}
  :redeemed-by {:type :text} :redeemed-at {:type :timestamptz}
  :created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
