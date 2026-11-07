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

(defonce +run+
  [(et/init-default-ns-str)])

(def REQUIRED_EXTENSIONS
  ["citext" "pgcrypto" "uuid-ossp"])

(def +legacy-class-types+
  ["Global" "Post" "TaskProvider"])

(defenum.pg ^{:static/no-cache true}
  EnumClassType
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
