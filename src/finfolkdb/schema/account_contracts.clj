(ns finfolkdb.schema.account-contracts
  "Portable application contracts. SQL signatures alone do not describe JSON payloads."
  (:require [finfolkdb.schema.buddy-contracts :as buddy-contracts]
            [clojure.data.json :as json] [clojure.string :as str]
            [finfolkdb.schema.directory-contracts :as directory]
            [finfolkdb.schema.event-contracts :as events]
            [finfolkdb.schema.note-contracts :as notes]
            [finfolkdb.schema.site-contracts :as sites]
            [finfolkdb.schema.site-review-contracts :as site-review]))
(def REGULAR-DAYS 8)
(def EMPTY {:type "object" :properties {} :additionalProperties false})
(def UUID {:type "string" :format "uuid"})
(def STRING {:type "string"})
(def PROFILE-PATCH
  {:type "object" :additionalProperties false
   :properties {:displayName STRING :bio STRING :instagram STRING :tiktok STRING
                :portrait STRING :featuredLogs {:type "array" :items UUID} :featuredPosts {:type "array" :items UUID}
                :open {:type "boolean"}
                :sharing {:type "object" :additionalProperties false
                          :properties (into {} (for [key [:visits :months :dives :time :depth]] [key {:type "boolean"}]))}
                :beaches {:type "array" :items UUID}
                :activities {:type "array" :items {:type "string" :enum ["freediving" "ocean-swimming" "spearfishing"]}}
                :availability {:type "array" :items {:type "string" :enum ["weekday mornings" "weekday afternoons" "weekend mornings" "weekend afternoons"]}}
                :experience {:type "string" :enum ["" "new" "comfortable" "experienced"]}
                :depthGoal {:type ["number" "null"]}}})
;; Preference writes validate portraits and published-item ownership in the DB.
;; Returned private profiles may additionally contain server-owned fields.
(def PROFILE (assoc PROFILE-PATCH :additionalProperties true))
(def ACCOUNT
  {:type "object" :required ["id" "profile"] :additionalProperties false
   :properties {:id UUID :profile PROFILE}})
(def OK {:type "object" :properties {:ok {:type "boolean"}} :required ["ok"] :additionalProperties false})
(def RELATION {:type "object" :required ["id" "name" "status" "requested_by" "instagram" "tiktok"]
               :properties {:id UUID :name STRING :status STRING :requested_by UUID
                            :instagram {:type ["string" "null"]} :tiktok {:type ["string" "null"]}}
               :additionalProperties false})
(def SESSION-INPUT
  {:type "object" :additionalProperties false :required ["date" "locationName"]
   :properties {:date {:type "string" :format "date"} :locationName STRING :beachId STRING :notes STRING
                :point {:type ["array" "null"] :items {:type "number"}}
                :durationMinutes {:type ["number" "null"]} :maxDepthMetres {:type ["number" "null"]}}})
(def SESSION
  {:type "object" :additionalProperties false
   :required ["id" "ownerId" "beachId" "date" "locationName" "notes" "point" "durationMinutes" "maxDepthMetres" "visibility" "photos" "linkedMedia"]
   :properties (merge (:properties SESSION-INPUT)
                      {:id UUID :ownerId UUID :visibility {:type "string" :enum ["private" "public"]}
                       :photos {:type "array" :items STRING}
                       :linkedMedia {:type "array" :items {:type "object" :additionalProperties true}}})})
(def PUBLIC-SESSION (assoc-in SESSION [:properties :visibility :enum] ["public"]))
(def PROFILE-POST
  {:type "object" :additionalProperties false :required ["id" "beach_id" "beach_name" "url" "platform" "status" "public_consent"]
   :properties {:id UUID :beach_id UUID :beach_name STRING :url STRING :platform STRING :status STRING :public_consent {:type "boolean"}}})
(def PUBLIC-PROFILE
  {:type "object" :additionalProperties false :required ["id" "uid" "displayName" "open" "restricted"]
   :properties {:id UUID :uid UUID :displayName STRING :open {:type "boolean"} :restricted {:type "boolean"}
                :bio STRING :instagram STRING :tiktok STRING :portrait STRING
                :featuredLogs {:type "array" :items UUID} :featuredPosts {:type "array" :items UUID}
                :posts {:type "array" :items PROFILE-POST}
                :availability {:type "array" :items STRING} :experience STRING :beaches {:type "array" :items UUID}}})
(defn session-list [row]
  {:type "object" :required ["sessions" "cursor" "more"] :additionalProperties false
   :properties {:sessions {:type "array" :items row} :cursor {:type ["string" "null"]} :more {:type "boolean"}}})
(def PUBLIC-PERSON
  {:type "object" :additionalProperties false
   :required ["id" "displayName" "open" "bio" "instagram" "tiktok" "portrait" "availability" "experience" "beaches" "regular" "recent" "connection"]
   :properties {:id UUID :displayName STRING :open {:type "boolean"} :bio STRING :instagram STRING :tiktok STRING
                :portrait STRING :availability {:type "array" :items STRING} :experience STRING
                :beaches {:type "array" :items UUID} :regular {:type "boolean"} :recent {:type "boolean"}
                :connection {:type ["string" "null"]}}})
(def TARGET {:type "object" :properties {:target UUID} :required ["target"] :additionalProperties false})
(defn operation [rpc arguments request result write]
  {:rpc rpc :arguments arguments :actor "server" :request request :result result :write write})
(def OPERATIONS
  (merge directory/OPERATIONS events/OPERATIONS notes/OPERATIONS sites/OPERATIONS site-review/OPERATIONS
  (buddy-contracts/operations operation UUID EMPTY)
  {"publicTrips" (assoc (operation "ret_public_trips" ["$values"]
                    {:type "object" :additionalProperties false :properties {:beachId UUID :ownerId UUID}}
                    {:type "object" :additionalProperties false :required ["trips"]
                     :properties {:trips {:type "array" :items {:type "object" :additionalProperties false
                       :required ["id" "title" "authorName" "beachId" "beachName" "start" "end" "total" "publishedAt"]
                       :properties {:id UUID :title STRING :authorName STRING :beachId UUID :beachName STRING
                         :start STRING :end STRING :total {:type "object" :additionalProperties true} :publishedAt STRING}}}}} false) :public true)
   "publicTrip" (assoc (operation "ret_trip_public" ["id"]
                    {:type "object" :additionalProperties false :required ["id"] :properties {:id UUID}}
                    {:type "object" :additionalProperties true} false) :public true :not-found "Trip unavailable.")
   "myPosts" (operation "ret_my_profile_posts" ["$actor"] EMPTY {:type "array" :items PROFILE-POST} false)
   "stats" (operation "ret_profile_statistics" ["$actor" "target" "beachId"]
             {:type "object" :additionalProperties false :required ["target" "beachId"] :properties {:target UUID :beachId UUID}}
             {:type "object" :additionalProperties false :required ["profile" "level" "stats" "progress" "sharingClosed" "expiresWithActivity"]
              :properties {:profile PROFILE :level {:type "integer"} :progress {:type "integer"}
                           :sharingClosed {:type "boolean"} :expiresWithActivity {:type "boolean"}
                           :stats {:type "object" :additionalProperties false
                                   :properties {:visits {:type "integer"} :months {:type "integer"} :dives {:type "integer"}
                                                :minutes {:type ["number" "null"]} :typicalDepth {:type ["number" "null"]}}}}} false)
   "saveSession" (operation "save_private_session" ["$actor" "id" "values"]
                  {:type "object" :properties {:id UUID :values SESSION-INPUT} :required ["values"] :additionalProperties false}
                  {:type "object" :properties {:id UUID} :required ["id"] :additionalProperties false} true)
   "session" (operation "ret_visible_session" ["$actor" "id"]
                  {:type "object" :properties {:id UUID} :required ["id"] :additionalProperties false}
                  (assoc SESSION :type ["object" "null"]) false)
   "sessions" (operation "ret_visible_sessions" ["$actor" "$values"]
                  {:type "object" :properties {:owner UUID :publicOnly {:type "boolean"} :cursor {:type ["string" "null"]}} :additionalProperties false}
                  {:type "object" :required ["sessions" "cursor" "more"] :additionalProperties false
                   :properties {:sessions {:type "array" :items SESSION} :cursor {:type ["string" "null"]} :more {:type "boolean"}}} false)
   "deleteSession" (operation "delete_private_session" ["$actor" "id"]
                  {:type "object" :properties {:id UUID} :required ["id"] :additionalProperties false}
                  {:type "object" :properties {:deleted {:type "boolean"}} :required ["deleted"] :additionalProperties false} true)
   "profile" (operation "ret_visible_profile" ["$actor" "target"]
                  {:type "object" :properties {:target UUID} :additionalProperties false}
                  (-> PROFILE (update :properties assoc :id UUID :uid UUID) (assoc :required ["id" "uid"])) false)
   "visibility" (operation "set_session_visibility" ["$actor" "id" "visibility" "$verified"]
                  {:type "object" :properties {:id UUID :visibility {:type "string" :enum ["private" "public"]}}
                   :required ["id" "visibility"] :additionalProperties false}
                  {:type "object" :properties {:visibility {:type "string" :enum ["private" "public"]}} :required ["visibility"] :additionalProperties false} true)
   "publicSession" (assoc (operation "ret_public_session" ["id"]
                  {:type "object" :properties {:id UUID} :required ["id"] :additionalProperties false}
                  (assoc PUBLIC-SESSION :type ["object" "null"]) false) :public true)
   "publicSessions" (assoc (operation "ret_public_sessions" ["$values"]
                  {:type "object" :properties {:owner UUID :publicOnly {:type "boolean"} :cursor {:type ["string" "null"]}}
                   :required ["owner"] :additionalProperties false}
                  (session-list PUBLIC-SESSION) false) :public true)
   "publicProfile" (assoc (operation "ret_public_profile" ["target"]
                  {:type "object" :properties {:target UUID} :required ["target"] :additionalProperties false}
                  PUBLIC-PROFILE false) :public true)
   "checkin" (operation "record_community_checkin" ["$actor" "beachId" "$verified"]
               {:type "object" :properties {:beachId UUID} :required ["beachId"] :additionalProperties false}
               {:type "object" :properties {:day STRING :count {:type "integer"} :selfReported {:type "boolean"}}
                :required ["day" "count" "selfReported"] :additionalProperties false} true)
   "removeCheckin" (operation "remove_community_checkin" ["$actor" "beachId" "day"]
               {:type "object" :properties {:beachId UUID :day {:type "string" :format "date"}} :required ["beachId" "day"] :additionalProperties false}
               {:type "object" :properties {:removed {:type "boolean"}} :required ["removed"] :additionalProperties false} true)
   "myCheckins" (operation "ret_community_checkins" ["$actor"] EMPTY
               {:type "array" :items {:type "object" :properties {:beach_id UUID :day STRING :name STRING}
                                     :required ["beach_id" "day" "name"] :additionalProperties false}} false)
   "community" (operation "discover_community_people" ["$actor" "$values"]
               {:type "object" :properties {:mode {:type "string" :enum ["discover"]} :seed STRING
                 :beachId {:type ["string" "null"]} :availability STRING :experience STRING :cursor {:type ["string" "null"]}}
                :required ["mode" "seed"] :additionalProperties false}
               {:type "object" :properties {:people {:type "array" :items PUBLIC-PERSON}
                                            :cursor {:type ["string" "null"]}}
                :required ["people" "cursor"] :additionalProperties false} false)
   "deleteAccount" (assoc (operation "erase_account" ["$actor"]
                     {:type "object" :properties {:password STRING} :required ["password"] :additionalProperties false} OK true) :effect "delete-auth-user")
   "me" (operation "ensure_account" ["$actor"] EMPTY
          (-> ACCOUNT (update :required conj "verified") (assoc-in [:properties :verified] {:type "boolean"})) false)
   "preferences" (operation "save_account_preferences" ["$actor" "profile" "$verified"]
                   {:type "object" :properties {:profile PROFILE-PATCH} :required ["profile"] :additionalProperties false} PROFILE true)
   "connections" (operation "ret_account_connections" ["$actor"] EMPTY {:type "array" :items RELATION} false)
   "blocks" (operation "ret_account_blocks" ["$actor"] EMPTY
              {:type "array" :items {:type "object" :properties {:id UUID :name STRING}
                                    :required ["id" "name"] :additionalProperties false}} false)
   "connection" (operation "set_account_connection" ["$actor" "target" "mode" "$verified"]
                  (-> TARGET (assoc-in [:properties :mode] {:type "string" :enum ["request" "accept" "decline" "remove"]})
                      (update :required conj "mode")) OK true)
   "block" (operation "set_account_block" ["$actor" "target" "$true"] TARGET OK true)
   "postStatus" (operation "ret_account_status" ["$actor"] EMPTY
                 {:type "object" :properties {:admin {:type "boolean"} :enabled {:type "boolean"}
                   :tag STRING :pilotBeaches {:type "array" :items UUID}}
                  :required ["admin" "enabled" "tag" "pilotBeaches"] :additionalProperties false} false)
   "unblock" (operation "set_account_block" ["$actor" "target" "$false"] TARGET OK true)}))
(def RPCS (merge (into {} (for [[_ spec] OPERATIONS] [(:rpc spec) {:result (:result spec)}]))
                 {"ensure_account" {:result ACCOUNT} "ret_account" {:result ACCOUNT}}))
(defn annotate [declarations]
  (into {} (for [[name spec] declarations]
    [name (if-let [native (get OPERATIONS name)]
            (assoc spec "native-rpc" (:rpc native) "request-shape" (:request native) "result-shape" (:result native)) spec)])))
(defn schema-type [schema]
  (cond
    (vector? (:type schema)) (str/join " | " (map #(schema-type (assoc schema :type %)) (:type schema)))
    (:enum schema) (str/join " | " (map json/write-str (:enum schema)))
    :else (case (:type schema)
    "string" "string"
    "boolean" "boolean"
    "number" "number"
    "integer" "number"
    "null" "null"
    "array" (str "Array<" (schema-type (:items schema)) ">")
    "object" (let [properties (:properties schema) required (set (:required schema))]
               (if (seq properties)
                 (str "{" (str/join ";" (for [[key shape] (sort-by key properties)]
                     (str (json/write-str (name key)) (when-not (required (name key)) "?") ":" (schema-type shape))))
                      (when (:additionalProperties schema) ";[key:string]:JsonValue|undefined") "}")
                 (if (:additionalProperties schema) "{[key:string]:JsonValue}" "Record<string, never>")))
    (throw (ex-info "Unsupported RPC contract type" {:schema schema})))))
(defn typescript []
  (str "// Generated from finfolkdb.schema.account-contracts.\n"
       "export type JsonValue = null | boolean | number | string | JsonValue[] | {[key:string]:JsonValue};\n"
       "export type NativeAccountRequest = " (schema-type (get-in OPERATIONS ["me" :request])) ";\n"
       "export type NativeAccountProfile = " (schema-type PROFILE) ";\n"
       "export type NativeAccount = " (schema-type (get-in OPERATIONS ["me" :result])) ";\n"
       "export interface NativeAccountOperations {\n"
       (str/join "\n" (for [[name spec] (sort-by key OPERATIONS)]
         (str (json/write-str name) ": {input:" (schema-type (:request spec)) ";output:" (schema-type (:result spec)) "};")))
       "\n}\n"))
