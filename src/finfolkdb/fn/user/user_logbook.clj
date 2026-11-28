(ns finfolkdb.fn.user.user-logbook
  "Owned logbook writes and explicit public session projections."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.fn.user.user-manage-logbook :as sessions]
             [finfolkdb.common.type-logbook-base :as book]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.fn.helper.helper-access :as access]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-system-base :as system]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} private-session-dives [:jsonb i-dives]
  (let [o-dives (pg/coalesce i-dives (:jsonb "[]")) o-dive nil (:text v-key) nil]
    (when (not= (pg/jsonb-typeof o-dives) "array") [:raise-exception "Dives must be an array"])
    (when (> (pg/jsonb-array-length o-dives) 500) [:raise-exception "Maximum 500 dives per session"])
    [:for o-dive :in :select (pg/jsonb-array-elements o-dives)
     (loop []
       (when (not= (pg/jsonb-typeof o-dive) "object") [:raise-exception "Invalid dive"])
       [:for v-key :in :select (pg/jsonb-object-keys o-dive)
        (loop []
          (when (not (pg/jsonb-exists (:jsonb "[\"durationSeconds\",\"depthMetres\",\"restSeconds\"]") v-key)) [:raise-exception "Unknown dive field"])
          (let [o-value (:-> o-dive v-key)]
            (when (not (pg/jsonb-exists (:jsonb "[\"number\",\"null\"]") (pg/jsonb-typeof o-value))) [:raise-exception "Dive measurements must be numeric"])
            (when (and (not= o-value (:jsonb "null"))
                       (or (< (:numeric (:text o-value)) 0)
                           (> (:numeric (:text o-value)) (pg/case (== v-key "depthMetres") 300 (== v-key "durationSeconds") 3600 true 86400)))) [:raise-exception "Dive measurement out of range"])))])]
    (return o-dives)))
(defn.pg ^{:- [:jsonb]} private-session-values [:jsonb i-values]
  (when (not= (pg/coalesce (pg/jsonb-typeof i-values) "null") "object")
    [:raise :exception :using '[[errcode := "22023"] [message := "Invalid session"]]])
  (let [(:text v-key) nil]
    [:for v-key :in :select (pg/jsonb-object-keys i-values)
     (loop []
       (when (not (pg/jsonb-exists (:jsonb "[\"date\",\"locationName\",\"beachId\",\"point\",\"durationMinutes\",\"maxDepthMetres\",\"notes\",\"dives\"]") v-key))
         [:raise :exception :using '[[errcode := "22023"] [message := "Unknown session field"]]]))])
  (let [(:text v-date) (pg/coalesce (:->> i-values "date") "")
        (:text v-place) (#{"btrim"} (pg/coalesce (:->> i-values "locationName") ""))
        (:text v-notes) (pg/coalesce (:->> i-values "notes") "")
        o-duration (pg/coalesce (:-> i-values "durationMinutes") (:jsonb "null"))
        o-depth (pg/coalesce (:-> i-values "maxDepthMetres") (:jsonb "null"))
        o-point (pg/coalesce (:-> i-values "point") (:jsonb "null"))]
    (when (or (not= (pg/coalesce (pg/jsonb-typeof (:-> i-values "date")) "null") "string")
              (not (#{"regexp_like"} v-date "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"))
              (not= (pg/coalesce (pg/jsonb-typeof (:-> i-values "locationName")) "null") "string")
              (== v-place "") (> (#{"char_length"} v-place) 160) (> (#{"char_length"} v-notes) 10000)
              (and (pg/jsonb-exists i-values "notes") (not= (pg/jsonb-typeof (:-> i-values "notes")) "string"))
              (and (pg/jsonb-exists i-values "beachId") (not= (pg/jsonb-typeof (:-> i-values "beachId")) "string")))
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose a valid session date, location and notes"]]])
    (let [(:date v-valid-date) (:date v-date)])
    (when (or (not (pg/jsonb-exists (:jsonb "[\"number\",\"null\"]") (pg/jsonb-typeof o-duration)))
              (not (pg/jsonb-exists (:jsonb "[\"number\",\"null\"]") (pg/jsonb-typeof o-depth))))
      [:raise :exception :using '[[errcode := "22023"] [message := "Enter numeric dive statistics"]]])
    (when (or (and (not= o-duration (:jsonb "null")) (or (< (:numeric (:text o-duration)) 0) (> (:numeric (:text o-duration)) 1440)))
              (and (not= o-depth (:jsonb "null")) (or (< (:numeric (:text o-depth)) 0) (> (:numeric (:text o-depth)) 300))))
      [:raise :exception :using '[[errcode := "22023"] [message := "Dive statistics are outside the allowed range"]]])
    (when (not= o-point (:jsonb "null"))
      (when (or (not= (pg/jsonb-typeof o-point) "array") (not= (pg/jsonb-array-length o-point) 2)
                (not= (pg/jsonb-typeof (:-> o-point 0)) "number") (not= (pg/jsonb-typeof (:-> o-point 1)) "number")
                (> (#{"abs"} (:numeric (:->> o-point 0))) 180) (> (#{"abs"} (:numeric (:->> o-point 1))) 85))
        [:raise :exception :using '[[errcode := "22023"] [message := "Choose a valid map location"]]]))
    (return (pg/jsonb-build-object "date" v-date "locationName" v-place "notes" v-notes
      "beachId" (pg/coalesce (:->> i-values "beachId") "") "point" o-point
      "dives" (-/private-session-dives (:-> i-values "dives")) "durationMinutes" o-duration "maxDepthMetres" o-depth "visibility" "private" "photos" (:jsonb "[]") "linkedMedia" (:jsonb "[]")))))
(defn.pg ^{:- [:jsonb]} private-session-row [:jsonb i-row]
  (let [o-data (:-> i-row "detail")
        o-site (pg/t:get sites/Site {:where {:id (:uuid (:->> i-row "site_id"))}})]
    (return (pg/jsonb-build-object "id" (:-> i-row "id") "ownerId" (:-> i-row "owner_id")
      "beachId" (pg/coalesce (:->> i-row "site_id") "")
      "date" (pg/coalesce (:->> o-data "date") (#{"to_char"} (#{"to_timestamp"} (/ (:numeric (:->> i-row "time_created")) 1000000)) "YYYY-MM-DD"))
      "locationName" (pg/coalesce (:->> o-data "locationName") (:->> o-site "name") "Somewhere in the water")
      "point" (pg/coalesce (:-> o-data "point") (:jsonb "null"))
      "durationMinutes" (pg/coalesce (:-> o-data "durationMinutes") (:jsonb "null"))
      "maxDepthMetres" (pg/coalesce (:-> o-data "maxDepthMetres") (:jsonb "null"))
      "dives" (pg/coalesce (:-> o-data "dives") (:jsonb "[]")) "notes" (pg/coalesce (:->> o-data "notes") "") "visibility" (pg/coalesce (:->> o-data "visibility") "private")
      "photos" (pg/coalesce (:-> o-data "photos") (:jsonb "[]")) "linkedMedia" (pg/coalesce (:-> o-data "linkedMedia") (:jsonb "[]"))))))
(defn.pg ^{:- [:jsonb]} ret-private-session [:uuid i-user :uuid i-session]
  [:perform (account/ret-account i-user)]
  (let [o-session (pg/t:get book/DiveSession {:where {:id i-session :owner i-user} :returning #{:*/standard :detail}})]
    (when [o-session :is-null] (return nil))
    (return (-/private-session-row o-session))))
(defn.pg ^{:- [:jsonb]} save-private-session [:uuid i-user :uuid i-session :jsonb i-values]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  [:perform (account/ret-account i-user)]
  (let [o-data (-/private-session-values i-values)
        (:uuid v-site) nil
        (:uuid v-id) i-session
        o-op (system/op-fn "private-session-save" i-user (:jsonb "{}"))]
    (when (not= (:->> o-data "beachId") "") (:= v-site (:uuid (:->> o-data "beachId"))))
    (when [v-site :is-not-null]
      (let [(:boolean v-exists) (pg/t:exists sites/Site {:where {:id v-site}})]
        (when (not v-exists) [:raise :exception :using '[[errcode := "P0002"] [message := "Choose an existing dive site"]]])))
    (if [i-session :is-null]
      (let [o-created (sessions/insert-dive-session i-user v-site o-data o-op)] (:= v-id (pg/id o-created)))
      (let [o-old (pg/t:get book/DiveSession {:where {:id i-session :owner i-user} :returning #{:*/standard :detail} :for [:update]})]
        (when [o-old :is-null] [:raise :exception :using '[[errcode := "P0002"] [message := "Session unavailable"]]])
        (when (not= (pg/coalesce (:->> (:-> o-old "detail") "visibility") "private") "private")
          [:raise :exception :using '[[errcode := "42501"] [message := "Make the session private before editing"]]])
        (let [o-patch (pg/case (pg/jsonb-exists i-values "dives") o-data true (- o-data "dives"))
              o-next (|| (:-> o-old "detail") (- o-patch "beachId" "photos" "linkedMedia"))
              o-saved (pg/t:update book/DiveSession {:where {:id i-session :owner i-user} :set {:site v-site :detail o-next} :track o-op})
              o-rev (pg/t:get system/Rev {:where {:id (:uuid (:->> o-old "rev_id"))}})
              (:int v-version) (+ (:int (:->> o-rev "index")) 1)
              o-revised (pg/t:update system/Rev {:where {:id (:uuid (:->> o-old "rev_id"))} :set {:current o-next :index v-version} :track o-op})
              o-history (pg/t:insert system/RevLog {:class-table "DiveSession" :class-context "Global" :rev (:uuid (:->> o-old "rev_id")) :version v-version :deltas o-next} {:track o-op})
              o-audit (pg/t:insert system/AuditLog {:class-table "DiveSession" :class-context "Global" :audit (:uuid (:->> o-old "audit_id")) :entry (pg/jsonb-build-object "event" "save")} {:track o-op})])))
    (return (pg/jsonb-build-object "id" v-id))))
(defn.pg ^{:- [:jsonb]} delete-private-session [:uuid i-user :uuid i-session]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  [:perform (account/ret-account i-user)]
  (let [o-old (pg/t:get book/DiveSession {:where {:id i-session :owner i-user} :returning #{:*/standard :detail} :for [:update]})
        o-op (system/op-fn "private-session-delete" i-user (:jsonb "{}"))]
    (when [o-old :is-null] [:raise :exception :using '[[errcode := "P0002"] [message := "Session unavailable"]]])
    (when (or (> (pg/jsonb-array-length (pg/coalesce (:-> (:-> o-old "detail") "photos") (:jsonb "[]"))) 0)
              (> (pg/jsonb-array-length (pg/coalesce (:-> (:-> o-old "detail") "linkedMedia") (:jsonb "[]"))) 0))
      [:raise :exception :using '[[errcode := "42501"] [message := "Media cleanup is required before deleting this session"]]])
    (let [o-deleted (pg/t:delete book/DiveSession {:where {:id i-session :owner i-user} :track o-op})
          o-rev (pg/t:delete system/Rev {:where {:id (:uuid (:->> o-old "rev_id"))} :track o-op})
          o-audit (pg/t:delete system/Audit {:where {:id (:uuid (:->> o-old "audit_id"))} :track o-op})]
      (return (pg/jsonb-build-object "deleted" true)))))
(def PRIVATE-LIST-SQL
  "SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY time_created DESC,id DESC),'[]'::jsonb) FROM (SELECT * FROM finfolk.\"DiveSession\" WHERE coalesce(detail->'plan'->>'state','completed')='completed' AND owner_id=($1->>'actor')::uuid AND (time_created,id)<(($1->>'time')::bigint,($1->>'after')::uuid) AND (NOT ($1->>'public')::boolean OR detail->>'visibility'='public') ORDER BY time_created DESC,id DESC LIMIT 51) r")
(defn.pg ^{:- [:jsonb]} ret-private-sessions [:uuid i-user :jsonb i-query]
  [:perform (account/ret-account i-user)]
  (when (and [(:->> i-query "owner") :is-not-null] (not= (:uuid (:->> i-query "owner")) i-user))
    [:raise :exception :using '[[errcode := "42501"] [message := "Public session browsing has a separate access path"]]])
  (let [(:text v-cursor) (pg/coalesce (:->> i-query "cursor") "")
        (:bigint v-time) 9223372036854775807 (:text v-after) "ffffffff-ffff-ffff-ffff-ffffffffffff"
        (:text v-next) nil (:int v-index) 0 o-rows nil o-row nil o-result (:jsonb "[]")]
    (when (not= v-cursor "")
      (when (not (#{"regexp_like"} v-cursor "^[0-9]{1,19}:[0-9a-fA-F-]{36}$"))
        [:raise :exception :using '[[errcode := "22023"] [message := "Choose a valid session cursor"]]])
      (:= v-time (:bigint (#{"split_part"} v-cursor ":" 1)))
      (:= v-after (#{"split_part"} v-cursor ":" 2)))
    [:execute (@! PRIVATE-LIST-SQL) :into o-rows :using
     (pg/jsonb-build-object "actor" i-user "time" v-time "after" v-after "public" (pg/coalesce (:boolean (:->> i-query "publicOnly")) false))]
    [:for o-row :in :select (pg/jsonb-array-elements o-rows)
     (loop []
       (when (< v-index 50)
         (:= o-result (|| o-result (pg/jsonb-build-array (-/private-session-row o-row))))
         (when (== v-index 49) (:= v-next (|| (:->> o-row "time_created") ":" (:->> o-row "id")))))
       (:= v-index (+ v-index 1)))]
    (when (<= (pg/jsonb-array-length o-rows) 50) (:= v-next nil))
    (return (pg/jsonb-build-object "sessions" o-result "cursor" v-next "more" (> (pg/jsonb-array-length o-rows) 50)))))
(defn.pg ^{:- [:jsonb]} ret-private-profile [:uuid i-user :uuid i-target]
  (when (and [i-target :is-not-null] (not= i-user i-target))
    [:raise :exception :using '[[errcode := "42501"] [message := "Other member profiles require the public profile access path"]]])
  (let [o-user (account/ret-account i-user)]
    (return (|| (:-> o-user "profile") (pg/jsonb-build-object "id" i-user "uid" i-user)))))

(defn.pg ^{:- [:jsonb]} set-session-visibility [:uuid i-user :uuid i-session :text i-visibility :boolean i-verified]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  [:perform (account/ret-account i-user)]
  (when (not (pg/jsonb-exists (:jsonb "[\"private\",\"public\"]") i-visibility))
    [:raise :exception :using '[[errcode := "22023"] [message := "Choose private or public visibility"]]])
  (let [o-old (pg/t:get book/DiveSession {:where {:id i-session :owner i-user} :returning #{:*/standard :detail} :for [:update]})]
    (when [o-old :is-null] [:raise :exception :using '[[errcode := "P0002"] [message := "Session unavailable"]]])
    (when (and (== i-visibility "public") (not= (pg/coalesce (:->> (:-> (:-> o-old "detail") "plan") "state") "completed") "completed")) [:raise-exception "Finish the session before publishing"])
    (when (== i-visibility "public")
      (when (not (pg/coalesce i-verified false))
        [:raise :exception :using '[[errcode := "42501"] [message := "Verify your email before publishing"]]]))
    (when (not= (pg/coalesce (:->> (:-> o-old "detail") "visibility") "private") i-visibility)
      (let [o-op (system/op-fn "session-visibility" i-user (pg/jsonb-build-object "visibility" i-visibility))
            o-next (|| (:-> o-old "detail") (pg/jsonb-build-object "visibility" i-visibility))
            o-saved (pg/t:update book/DiveSession {:where {:id i-session :owner i-user} :set {:detail o-next} :track o-op})
            o-rev (pg/t:get system/Rev {:where {:id (:uuid (:->> o-old "rev_id"))}})
            (:int v-version) (+ (:int (:->> o-rev "index")) 1)
            o-revised (pg/t:update system/Rev {:where {:id (:uuid (:->> o-old "rev_id"))} :set {:current o-next :index v-version} :track o-op})
            o-history (pg/t:insert system/RevLog {:class-table "DiveSession" :class-context "Global" :rev (:uuid (:->> o-old "rev_id")) :version v-version :deltas o-next} {:track o-op})
            o-audit (pg/t:insert system/AuditLog {:class-table "DiveSession" :class-context "Global" :audit (:uuid (:->> o-old "audit_id")) :entry (pg/jsonb-build-object "event" "visibility" "visibility" i-visibility)} {:track o-op})]))
    (return (pg/jsonb-build-object "visibility" i-visibility))))
(defn.pg ^{:- [:jsonb]} public-session-detail [:jsonb i-session]
  ;; Publication consents to attached original post links, never inbox metadata,
  ;; provider credentials, individual dives or legacy private photo objects.
  (let [o-links (:jsonb "[]") o-link nil]
    [:for o-link :in :select (pg/jsonb-array-elements (pg/case (== (pg/jsonb-typeof (:-> i-session "linkedMedia")) "array") (:-> i-session "linkedMedia") true (:jsonb "[]")))
     (loop []
       (let [(:text v-url) (#{"split_part"} (#{"split_part"} (pg/coalesce (:->> o-link "url") "") "?" 1) "#" 1)
             (:text v-platform) (:->> o-link "platform")]
         (when (and (<= (pg/length v-url) 2048) (not (#{"regexp_like"} v-url "[[:space:][:cntrl:]]"))
                    (or (and (== v-platform "instagram") (#{"regexp_like"} v-url "^https://(www[.])?instagram[.]com/(p|reel|tv)/[A-Za-z0-9_-]+/?$"))
                        (and (== v-platform "tiktok") (#{"regexp_like"} v-url "^https://(www[.])?tiktok[.]com/@[A-Za-z0-9._]+/video/[0-9]+/?$"))))
           (:= o-links (|| o-links (pg/jsonb-build-array
             (pg/jsonb-build-object "id" (pg/coalesce (:->> o-link "id") v-url) "platform" v-platform "url" v-url
               "kind" (pg/case (or (== v-platform "tiktok") (#{"regexp_like"} v-url "/reel/")) "video" true "post"))))))))]
    (return (|| (- i-session "dives") (pg/jsonb-build-object "photos" (:jsonb "[]") "linkedMedia" o-links)))))
(defn.pg ^{:- [:jsonb]} public-session-row [:jsonb i-row]
  (when (or [i-row :is-null] (not= (pg/coalesce (:->> (:-> i-row "detail") "visibility") "private") "public")
            (not (access/is-user-active (:uuid (:->> i-row "owner_id"))))) (return nil))
  (return (-/public-session-detail (-/private-session-row i-row))))
(defn.pg ^{:- [:jsonb]} ret-visible-session [:uuid i-viewer :uuid i-session]
  (when [i-viewer :is-not-null] [:perform (account/ret-account i-viewer)])
  (let [o-row (pg/t:get book/DiveSession {:where {:id i-session} :returning #{:*/standard :detail}})]
    (when [o-row :is-null] (return nil))
    (when (== (:uuid (:->> o-row "owner_id")) i-viewer) (return (-/private-session-row o-row)))
    (when (and [i-viewer :is-not-null] (access/is-user-blocked i-viewer (:uuid (:->> o-row "owner_id")))) (return nil))
    (return (-/public-session-row o-row))))
(defn.pg ^{:- [:jsonb]} ret-visible-sessions [:uuid i-viewer :jsonb i-query]
  (when [i-viewer :is-not-null] [:perform (account/ret-account i-viewer)])
  (let [(:uuid v-owner) (pg/coalesce (:uuid (:->> i-query "owner")) i-viewer)
        o-result (:jsonb "[]") o-row nil]
    (when [v-owner :is-null] [:raise :exception :using '[[errcode := "22023"] [message := "Choose a session owner"]]])
    (when (or (not (access/is-user-active v-owner))
              (and [i-viewer :is-not-null] (access/is-user-blocked i-viewer v-owner)))
      (return (pg/jsonb-build-object "sessions" o-result "cursor" nil "more" false)))
    (when (== v-owner i-viewer) (return (-/ret-private-sessions i-viewer i-query)))
    (let [o-page (-/ret-private-sessions v-owner (|| i-query (pg/jsonb-build-object "owner" v-owner "publicOnly" true)))]
      [:for o-row :in :select (pg/jsonb-array-elements (:-> o-page "sessions"))
       (loop []
         (:= o-result (|| o-result (pg/jsonb-build-array (-/public-session-detail o-row)))))]
      (return (|| o-page (pg/jsonb-build-object "sessions" o-result))))))
(def PROFILE-POSTS-SQL
  "SELECT coalesce(jsonb_agg(row ORDER BY created DESC,id),'[]'::jsonb) FROM (SELECT p.id,p.time_created created,jsonb_build_object('id',p.id,'beach_id',p.site_id,'beach_name',s.name,'url',p.url,'platform',p.platform,'status',p.status,'public_consent',p.public_consent) row FROM finfolk.\"SocialPost\" p JOIN finfolk.\"Site\" s ON s.id=p.site_id JOIN finfolk.\"User\" u ON u.id=p.owner_id WHERE p.owner_id=($1->>'owner')::uuid AND NOT u.deleted AND (($1->>'private')::boolean OR (p.status='approved' AND p.public_consent AND coalesce(u.profile->'featuredPosts','[]'::jsonb)?p.id::text)) ORDER BY p.time_created DESC,p.id LIMIT 100) p")
(defn.pg ^{:- [:jsonb]} profile-post-links [:uuid i-owner :boolean i-private]
  (let [o-posts nil]
    [:execute (@! PROFILE-POSTS-SQL) :into o-posts :using (pg/jsonb-build-object "owner" i-owner "private" i-private)]
    (return o-posts)))
(defn.pg ^{:- [:jsonb]} ret-my-profile-posts [:uuid i-user]
  [:perform (account/ret-account i-user)]
  (return (-/profile-post-links i-user true)))

(defn.pg ^{:- [:jsonb]} ret-visible-profile [:uuid i-viewer :uuid i-target]
  (when [i-viewer :is-not-null] [:perform (account/ret-account i-viewer)])
  (let [(:uuid v-target) (pg/coalesce i-target i-viewer)
        o-user (pg/t:get users/User {:where {:id v-target :deleted false} :returning #{:id :profile :handle}})]
    (when [v-target :is-null] [:raise :exception :using '[[errcode := "22023"] [message := "Choose a profile"]]])
    (when (or [o-user :is-null] (and [i-viewer :is-not-null] (access/is-user-blocked i-viewer v-target)))
      [:raise :exception :using '[[errcode := "P0002"] [message := "Profile unavailable"]]])
    (when (== v-target i-viewer)
      (return (|| (:-> o-user "profile") (pg/jsonb-build-object "id" v-target "uid" v-target "handle" (pg/coalesce (:->> o-user "handle") (|| "diver-" (#{"replace"} (:text v-target) "-" "")))))))
    (let [o-profile (:-> o-user "profile")
          (:boolean v-open) (pg/coalesce (== (:-> o-profile "open") (:jsonb "true")) false)
          (:boolean v-details) v-open]
      (when [i-viewer :is-not-null]
        (let [(:boolean v-connected) (pg/t:exists users/UserConnection
                                      {:where {:user (least i-viewer v-target) :target (greatest i-viewer v-target) :status "accepted"}})]
          (when v-connected (:= v-details true))))
      (let [o-basic (pg/jsonb-build-object "id" v-target "uid" v-target "handle" (pg/coalesce (:->> o-user "handle") (|| "diver-" (#{"replace"} (:text v-target) "-" ""))) "displayName" (pg/coalesce (:->> o-profile "displayName") "Diver")
                                         "open" v-open "restricted" (not v-details))]
        (when (not v-details) (return o-basic))
        (when (pg/jsonb-exists o-profile "featuredLogs")
          (:= o-basic (|| o-basic (pg/jsonb-build-object "featuredLogs" (:-> o-profile "featuredLogs")))))
        (when (pg/jsonb-exists o-profile "featuredPosts")
          (:= o-basic (|| o-basic (pg/jsonb-build-object "featuredPosts" (:-> o-profile "featuredPosts")))))
        (return (|| o-basic (pg/jsonb-build-object
          "bio" (pg/coalesce (:->> o-profile "bio") "") "instagram" (pg/coalesce (:->> o-profile "instagram") "")
          "tiktok" (pg/coalesce (:->> o-profile "tiktok") "") "portrait" (pg/coalesce (:->> o-profile "portrait") "")
          "availability" (pg/coalesce (:-> o-profile "availability") (:jsonb "[]")) "experience" (pg/coalesce (:->> o-profile "experience") "")
          "beaches" (pg/coalesce (:-> o-profile "beaches") (:jsonb "[]"))
          "posts" (-/profile-post-links v-target false))))))))
;; Public entrypoints bind no viewer, even if an HTTP caller supplies a bearer.
(defn.pg ^{:- [:jsonb]} ret-public-session [:uuid i-session] (return (-/ret-visible-session nil i-session)))
(defn.pg ^{:- [:jsonb]} ret-public-sessions [:jsonb i-query] (return (-/ret-visible-sessions nil i-query)))
(defn.pg ^{:- [:jsonb]} ret-public-profile [:uuid i-target] (return (-/ret-visible-profile nil i-target)))
