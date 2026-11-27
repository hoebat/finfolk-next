(ns finfolkdb.fn.user.user-session-planning
  "Invite-only planning on the same DiveSession record as the completed log."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.fn.user.user-community :as community]
             [finfolkdb.fn.user.user-logbook :as logbook]
             [finfolkdb.fn.helper.helper-access :as access]
             [finfolkdb.common.type-logbook-base :as book]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-system-base :as system]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(def LIST-SQL
  "SELECT coalesce(jsonb_agg(jsonb_build_object('id',s.id,'ownerId',s.owner_id,'locationName',s.detail->>'locationName','beachId',s.site_id,'plan',s.detail->'plan') ORDER BY s.detail->'plan'->>'startsAt'),'[]'::jsonb) FROM finfolk.\"DiveSession\" s JOIN finfolk.\"User\" u ON u.id=s.owner_id WHERE NOT u.deleted AND s.detail ? 'plan' AND (s.owner_id=$1 OR s.detail->'plan'->'members' ? $1::text) AND NOT finfolk.is_user_blocked($1,s.owner_id)")
(def RETRY-SQL "SELECT to_jsonb(s) FROM finfolk.\"DiveSession\" s WHERE owner_id=($1->>'actor')::uuid AND detail->'plan'->>'requestId'=$1->>'id' LIMIT 1")
(defn.pg ^{:- [:jsonb]} session-planning [:uuid i-user :jsonb i-values]
  [:perform (account/ret-account i-user)]
  ;; Serialize creation retries and updates, including invitee responses.
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} "session-planning" 0))]
  (let [(:text v-mode) (:->> i-values "mode")
        (:uuid v-id) (:uuid (:->> i-values "id"))
        o-op (system/op-fn "session-planning" i-user (:jsonb "{}"))
        o-row nil o-plan nil o-list nil (:text v-member) nil]
    (when (== v-mode "list")
      [:execute (@! LIST-SQL) :into o-list :using i-user]
      (return (pg/jsonb-build-object "sessions" o-list "connections" (account/ret-account-connections i-user))))
    (let [o-loaded (pg/t:get book/DiveSession {:where {:id v-id} :returning #{:*/standard :detail} :for [:update]})] (:= o-row o-loaded))
    (when (and (== v-mode "save") [o-row :is-null])
      [:execute (@! RETRY-SQL) :into o-row :using (pg/jsonb-build-object "actor" i-user "id" v-id)]
      (when [o-row :is-not-null] (return (pg/jsonb-build-object "id" (:-> o-row "id")))))
    (:= o-plan (:-> (:-> o-row "detail") "plan"))
    (when (== v-mode "invite")
      (when (or [o-row :is-null] (not= (:uuid (:->> o-row "owner_id")) i-user)
                (not (pg/jsonb-exists (:jsonb "[\"upcoming\",\"current\"]") (pg/coalesce (:->> o-plan "state") ""))))
        [:raise-exception "Organiser access to an active session required"])
      [:for v-member :in :select (pg/jsonb-array-elements-text (pg/coalesce (:-> i-values "invitees") (:jsonb "[]")))
       (loop [] (let [(:uuid v-target) (:uuid v-member)
                     (:boolean v-connected) (pg/t:exists users/UserConnection {:where {:user (least i-user v-target) :target (greatest i-user v-target) :status "accepted"}})]
        (when (or (== v-target i-user) (access/is-user-blocked i-user v-target) (not v-connected))
          [:raise-exception "Invite an available connection"])
        (when (not (pg/jsonb-exists (:-> o-plan "members") (:text v-target)))
          (:= o-plan (#{"jsonb_set"} o-plan (#{"string_to_array"} (|| "members," (:text v-target)) ",")
            (pg/jsonb-build-object "name" (:->> (:-> (account/ret-account v-target) "profile") "displayName") "state" "invited") true)))))]
      (let [o-saved (pg/t:update book/DiveSession {:where {:id v-id :owner i-user} :track o-op :set {:detail (|| (:-> o-row "detail") (pg/jsonb-build-object "plan" o-plan))}})])
      (return (pg/jsonb-build-object "id" v-id)))
    (when (== v-mode "save")
      (when (and [o-row :is-not-null] (not= (:uuid (:->> o-row "owner_id")) i-user)) [:raise-exception "Session unavailable"])
      ;; A retry of the initial request returns the existing record.
      (when (and [o-row :is-not-null] [o-plan :is-null]) [:raise-exception "Session unavailable"])
      (when (and [o-plan :is-not-null] (pg/jsonb-exists (:jsonb "[\"completed\",\"cancelled\"]") (:->> o-plan "state"))) [:raise-exception "Session is closed"])
      (when (or (== (#{"btrim"} (pg/coalesce (:->> i-values "title") "")) "")
                (> (#{"char_length"} (:->> i-values "title")) 160)
                (> (#{"char_length"} (pg/coalesce (:->> i-values "meetingPoint") "")) 500)
                (not (pg/jsonb-exists (:jsonb "[\"upcoming\",\"current\"]") (pg/coalesce (:->> i-values "state") "")))) [:raise-exception "Enter a title and session type"])
      (let [(:timestamptz v-start) (:timestamptz (:->> i-values "startsAt"))
            (:text v-zone) (:->> i-values "timezone")
            (:text v-date) (#{"to_char"} (#{"timezone"} v-zone v-start) "YYYY-MM-DD")]
        (when [v-start :is-null] [:raise-exception "Choose a meeting time"])
        (when (and (== (:->> i-values "state") "upcoming") (<= v-start (pg/now))) [:raise-exception "Choose a future meeting time"])
        (when [o-row :is-null]
          (let [o-created (logbook/save-private-session i-user nil (pg/jsonb-build-object "date" v-date "locationName" "Session" "beachId" (:->> i-values "beachId")))]
            (:= v-id (:uuid (:->> o-created "id")))
            (let [o-loaded (pg/t:get book/DiveSession {:where {:id v-id} :returning #{:*/standard :detail}})] (:= o-row o-loaded))))
        (:= o-plan (|| (pg/coalesce o-plan (:jsonb "{}"))
          (pg/jsonb-build-object "requestId" (pg/coalesce (:->> o-plan "requestId") (:->> i-values "id")) "title" (:->> i-values "title") "startsAt" v-start "timezone" v-zone
            "meetingPoint" (pg/coalesce (:->> i-values "meetingPoint") "") "state" (pg/coalesce (:->> o-plan "state") (:->> i-values "state"))
            "members" (pg/coalesce (:-> o-plan "members") (:jsonb "{}")))))
        [:for v-member :in :select (pg/jsonb-array-elements-text (pg/coalesce (:-> i-values "invitees") (:jsonb "[]")))
         (loop []
           (let [(:uuid v-target) (:uuid v-member)
                 (:boolean v-connected) (pg/t:exists users/UserConnection {:where {:user (least i-user v-target) :target (greatest i-user v-target) :status "accepted"}})]
             (when (or (not v-connected) (access/is-user-blocked i-user v-target) (== v-target i-user)) [:raise-exception "Invite an available connection"])
             (when (not (pg/jsonb-exists (:-> o-plan "members") (:text v-target)))
               (:= o-plan (#{"jsonb_set"} o-plan (#{"string_to_array"} (|| "members," (:text v-target)) ",")
                 (pg/jsonb-build-object "name" (:->> (:-> (account/ret-account v-target) "profile") "displayName") "state" "invited") true)))))])
      (let [o-site (pg/t:get sites/Site {:where {:id (:uuid (:->> i-values "beachId"))}})]
        (when [o-site :is-null] [:raise-exception "Choose an existing beach"])
        (let [o-saved (pg/t:update book/DiveSession {:where {:id v-id :owner i-user}
                      :track o-op :set {:site (:uuid (:->> i-values "beachId")) :detail (|| (:-> o-row "detail") (pg/jsonb-build-object "locationName" (:->> o-site "name") "date" (#{"to_char"} (#{"timezone"} (:->> o-plan "timezone") (:timestamptz (:->> o-plan "startsAt"))) "YYYY-MM-DD") "plan" o-plan))}})]))
      (return (pg/jsonb-build-object "id" v-id)))
    (when (or [o-plan :is-null] (access/is-user-blocked i-user (:uuid (:->> o-row "owner_id")))) [:raise-exception "Session unavailable"])
    (when (== v-mode "respond")
      (when (or (not (pg/jsonb-exists (:-> o-plan "members") (:text i-user)))
                (not (pg/jsonb-exists (:jsonb "[\"joined\",\"declined\"]") (pg/coalesce (:->> i-values "state") "")))
                (pg/jsonb-exists (:jsonb "[\"completed\",\"cancelled\"]") (:->> o-plan "state"))) [:raise-exception "Invitation unavailable"])
      (:= o-plan (#{"jsonb_set"} o-plan (#{"string_to_array"} (|| "members," (:text i-user) ",state") ",") (:-> i-values "state") false)))
    (when (not= v-mode "respond")
      (when (not= (:uuid (:->> o-row "owner_id")) i-user) [:raise-exception "Organiser access required"])
      (when (not (or (and (== v-mode "start") (== (:->> o-plan "state") "upcoming"))
                     (and (== v-mode "finish") (== (:->> o-plan "state") "current"))
                     (and (== v-mode "cancel") (pg/jsonb-exists (:jsonb "[\"upcoming\",\"current\"]") (:->> o-plan "state"))))) [:raise-exception "Session cannot make that transition"])
      (:= o-plan (|| o-plan (pg/jsonb-build-object "state" (pg/case (== v-mode "start") "current" (== v-mode "finish") "completed" true "cancelled")))))
    (let [o-saved (pg/t:update book/DiveSession {:where {:id v-id} :track o-op :set {:detail (|| (:-> o-row "detail") (pg/jsonb-build-object "plan" o-plan))}})]
      (return (pg/jsonb-build-object "id" v-id)))))

(defn.pg ^{:- [:jsonb]} session-plans [:uuid i-user]
  (return (-/session-planning i-user (pg/jsonb-build-object "mode" "list"))))

(defn.pg ^{:- [:jsonb]} session-checkin [:uuid i-user :boolean i-verified :jsonb i-values]
  (when (not (pg/coalesce i-verified false)) [:raise-exception "Verify your email before checking in"])
  (when (not (or (== (:->> i-values "mode") "start")
                (and (== (:->> i-values "mode") "save") (== (:->> i-values "state") "current")))) [:raise-exception "Choose a current session"])
  (let [o-result (-/session-planning i-user i-values)
        o-row (pg/t:get book/DiveSession {:where {:id (:uuid (:->> o-result "id")) :owner i-user}})]
    [:perform (community/record-community-checkin i-user (:uuid (:->> o-row "site_id")) i-verified)]
    (return o-result)))
