(ns finfolkdb.common.type-events (:require [lang.core :as l]))
(l/script :postgres {:require [[postgres.core :as pg]] :static {:application ["finfolk"] :all {:schema ["finfolk"]}}})
(deftype.pg ^{:finfolk/constraints ["CHECK ((state = ANY (ARRAY['draft'::text, 'published'::text, 'cancelled'::text])))" "CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text])))" "CHECK ((capacity > 0))" "CHECK ((ends_at > starts_at))" "NOT NULL id" "NOT NULL page_id" "NOT NULL document" "NOT NULL state" "NOT NULL visibility" "NOT NULL starts_at" "NOT NULL ends_at" "NOT NULL timezone" "NOT NULL revision" "NOT NULL hidden" "NOT NULL updated_at" "PRIMARY KEY (id)" "FOREIGN KEY (page_id) REFERENCES finfolk.directory_listings(id)"]} events
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
:page-id {:type :uuid :required true}
:document {:type :jsonb :required true}
:state {:type :text :required true :finfolk/default-sql "'draft'::text"}
:visibility {:type :text :required true :finfolk/default-sql "'public'::text"}
:starts-at {:type :timestamptz :required true}
:ends-at {:type :timestamptz :required true}
:timezone {:type :text :required true}
:capacity {:type :integer}
:revision {:type :integer :required true :finfolk/default-sql "1"}
:hidden {:type :boolean :required true :finfolk/default-sql "false"}
:updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
(deftype.pg ^{:finfolk/constraints ["CHECK ((state = ANY (ARRAY['going'::text, 'cancelled'::text])))" "NOT NULL event_id" "NOT NULL user_id" "NOT NULL state" "NOT NULL updated_at" "PRIMARY KEY (event_id, user_id)" "FOREIGN KEY (event_id) REFERENCES finfolk.events(id)" "FOREIGN KEY (user_id) REFERENCES finfolk.members(user_id) ON DELETE CASCADE"]} event_rsvps
 [:event-id {:type :uuid :required true}
:user-id {:type :text :required true}
:state {:type :text :required true}
:updated-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
(deftype.pg ^{:finfolk/constraints ["NOT NULL token_hash" "NOT NULL event_id" "NOT NULL email" "NOT NULL expires_at" "NOT NULL revoked" "PRIMARY KEY (token_hash)" "FOREIGN KEY (event_id) REFERENCES finfolk.events(id)" "FOREIGN KEY (accepted_by) REFERENCES finfolk.members(user_id) ON DELETE CASCADE"]} event_invites
 [:token-hash {:type :text :required true}
:event-id {:type :uuid :required true}
:email {:type :text :required true}
:expires-at {:type :timestamptz :required true}
:accepted-by {:type :text}
:revoked {:type :boolean :required true :finfolk/default-sql "false"}])
(deftype.pg ^{:finfolk/constraints ["NOT NULL id" "NOT NULL event" "NOT NULL created_at" "PRIMARY KEY (id)" "FOREIGN KEY (event_id) REFERENCES finfolk.events(id)"]} event_audit
 [:id {:type :uuid :required true :finfolk/default-sql "gen_random_uuid()"}
:event-id {:type :uuid}
:actor {:type :text}
:event {:type :text :required true}
:created-at {:type :timestamptz :required true :finfolk/default-sql "now()"}])
