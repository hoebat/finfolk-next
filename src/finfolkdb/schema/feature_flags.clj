(ns finfolkdb.schema.feature-flags
  "Additive runtime release controls, independent of legacy ApplicationFeature."
  (:require [clojure.string :as str] [clojure.data.json :as json]))

(def DEFINITIONS
  [{:id "buddies" :label "Buddies" :description "Private buddy messages and session chats"}
   {:id "shop" :label "Shop" :description "Shop, rewards, management and checkout"}
   {:id "events" :label "Events" :description "Events, invitations and RSVP"}
   {:id "practice.progress" :label "Progress" :description "Personal recorded progress"}
   {:id "practice.breathing" :label "Breathing practice" :description "Routines and practice history"}
   {:id "practice.watch-imports" :label "Watch imports" :description "Import watch sessions"}
   {:id "practice.breath-check" :label "Breath check" :description "Breath checks and journal"}])

(def CONTRACT
  {:version 1 :modes ["off" "testers" "everyone"] :definitions DEFINITIONS
   :update {:type "object" :additionalProperties false :required ["id" "mode" "testers" "revision"]
            :properties {:id {:enum (mapv :id DEFINITIONS)} :mode {:enum ["off" "testers" "everyone"]}
                         :testers {:type "array" :maxItems 1000 :uniqueItems true :items {:type "string" :format "uuid"}}
                         :revision {:type "integer" :minimum 0 :maximum 2147483646}}}})

(defn sql []
  (str "-- Generated from finfolkdb.schema.feature-flags. Additive; never resets existing flags.\nBEGIN;\n"
       "CREATE SCHEMA IF NOT EXISTS finfolk_flags;\n"
       "CREATE TABLE IF NOT EXISTS finfolk_flags.flags (id text PRIMARY KEY, mode text NOT NULL DEFAULT 'off' CHECK(mode IN ('off','testers','everyone')), testers uuid[] NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0 CHECK(revision>=0), updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL DEFAULT 'installation');\n"
       "CREATE TABLE IF NOT EXISTS finfolk_flags.history (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, flag_id text NOT NULL REFERENCES finfolk_flags.flags(id), revision integer NOT NULL, previous jsonb NOT NULL, current jsonb NOT NULL, changed_at timestamptz NOT NULL DEFAULT now(), changed_by text NOT NULL, UNIQUE(flag_id,revision));\n"
       "INSERT INTO finfolk_flags.flags(id) VALUES "
       (str/join "," (map #(str "('" (:id %) "')") DEFINITIONS)) " ON CONFLICT DO NOTHING;\n"
       "REVOKE ALL ON SCHEMA finfolk_flags FROM PUBLIC;\nREVOKE ALL ON ALL TABLES IN SCHEMA finfolk_flags FROM PUBLIC;\n"
       "DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON SCHEMA finfolk_flags FROM %I',r); EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA finfolk_flags FROM %I',r); EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA finfolk_flags FROM %I',r); END IF; END LOOP; END $$;\n"
       "DO $$ DECLARE r text; BEGIN FOREACH r IN ARRAY ARRAY['finfolk_api','finfolk_next_api','finfolk_account'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('GRANT USAGE ON SCHEMA finfolk_flags TO %I',r); EXECUTE format('REVOKE ALL ON finfolk_flags.flags,finfolk_flags.history FROM %I',r); EXECUTE format('GRANT SELECT,UPDATE ON finfolk_flags.flags TO %I',r); EXECUTE format('GRANT SELECT,INSERT ON finfolk_flags.history TO %I',r); EXECUTE format('GRANT USAGE ON ALL SEQUENCES IN SCHEMA finfolk_flags TO %I',r); END IF; END LOOP; END $$;\nCOMMIT;\n"))
(defn json-artifact [] (str (json/write-str CONTRACT) "\n"))
