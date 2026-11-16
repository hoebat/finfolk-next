(ns finfolkdb.common.type-system-seed
  "Shared seed and coercion primitives for entity addons."
  (:require [lang.core :as l]
            [postgres.entity :as et]))

;;
;; Namespace relationships
;;
;; [entity declarations] --> [shared addon coercions + class discriminators]
;;

(l/script :postgres
  {:require [[postgres.core :as pg]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(defonce +run+ [(et/init-default-ns-str)])

(def REQUIRED_EXTENSIONS ["citext" "pgcrypto" "uuid-ossp"])

(def +legacy-class-types+ ["Global" "Post" "TaskProvider"])

(defenum.pg ^{:static/no-cache true} EnumClassType
  @(et/class-types "finfolk-entity" +legacy-class-types+))

;;
;; JSON Coercions
;;

(defn.pg ^{:props [:immutable :parallel-safe]}
  as-jsonb
  [:jsonb input]
  (when [input :is-null]
    (return (:jsonb "{}")))
  (when (not= (pg/jsonb-typeof input) "object")
    [:raise-exception "Expected a JSON object"])
  (return input))

(defn.pg ^{:props [:immutable :parallel-safe]}
  as-jsonb-array
  [:jsonb input]
  (when [input :is-null]
    (return (:jsonb "[]")))
  (when (not= (pg/jsonb-typeof input) "array")
    [:raise-exception "Expected a JSON array"])
  (return input))

(defn.pg ^{:- [:text] :props [:immutable :parallel-safe]}
  as-bounded-text
  "Validate trimmed minimum and stored maximum length without silently truncating input."
  [:text input :integer minimum :integer maximum]
  (when (or (< (pg/length (pg/btrim input)) minimum) (> (pg/length input) maximum))
    [:raise-exception "Text length is outside the permitted bounds"])
  (return input))

(defn.pg ^{:- [:date] :props [:immutable :parallel-safe]}
  as-finite-date
  [:date input]
  (when (and [input :is-not-null] (not (#{"isfinite"} input)))
    [:raise-exception "A finite date is required"])
  (return input))

(defn.pg ^{:- [:integer] :props [:immutable :parallel-safe]}
  as-bounded-integer
  [:integer input :integer minimum :integer maximum]
  (when (or (< input minimum) (> input maximum))
    [:raise-exception "Integer is outside the permitted bounds"])
  (return input))
