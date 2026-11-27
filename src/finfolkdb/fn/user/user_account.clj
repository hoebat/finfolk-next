(ns finfolkdb.fn.user.user-account
  "Native account identity. Actor UUIDs are supplied only by the authenticated server."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-site-base :as site-history]
             [finfolkdb.common.type-event :as event-deliveries]
             [finfolkdb.common.type-user-activity :as activity]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-domain-enum :as enums]
             [finfolkdb.common.type-logbook-base :as book]
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.fn.helper.helper-access :as access]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.fn.user.user-manage :as manage]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:jsonb]} ret-account [:uuid i-user]
  (let [o-user (pg/t:get users/User {:where {:id i-user :deleted false} :returning #{:id :profile}})]
    (when [o-user :is-null] [:raise-exception "Account unavailable"])
    (return (pg/jsonb-build-object "id" i-user "profile" (:-> o-user "profile")))))

(defn.pg ^{:- [:jsonb]} ensure-account [:uuid i-user]
  (when [i-user :is-null] [:raise-exception "Authenticated identity required"])
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  (let [(:boolean v-exists) (pg/t:exists users/User {:where {:id i-user}})]
    (when (not v-exists)
      [:perform (manage/insert-user i-user (pg/jsonb-build-object "displayName" "Diver")
                        (system/op-fn "account-create" i-user (:jsonb "{}")))]))
  (return (-/ret-account i-user)))

;; Trusted Auth transport synchronizes this flag from getUser, never user metadata.
(defn.pg ^{:- [:jsonb]} sync-account-identity [:uuid i-user :boolean i-verified]
  [:perform (-/ensure-account i-user)]
  (let [o-updated (pg/t:update users/User
                   {:where {:id i-user :deleted false}
                    :set {:email-verified (pg/coalesce i-verified false)}})])
  (return (pg/jsonb-build-object "ok" true)))

(defn.pg ^{:- [:jsonb]} account-list
  [:jsonb i-value :jsonb i-allowed :integer i-limit]
  (let [o-value (pg/coalesce i-value (:jsonb "[]"))
        o-result (:jsonb "[]") o-item nil (:text v-text) nil]
    (when (or (not= (pg/jsonb-typeof o-value) "array") (> (pg/jsonb-array-length o-value) i-limit))
      [:raise :exception :using '[[errcode := "22023"] [message := "Invalid profile list"]]])
    [:for o-item :in :select (pg/jsonb-array-elements o-value)
     (loop []
       (when (not= (pg/jsonb-typeof o-item) "string")
         [:raise :exception :using '[[errcode := "22023"] [message := "Invalid profile list value"]]])
       (:= v-text (:->> (pg/jsonb-build-array o-item) 0))
       (when (and [i-allowed :is-not-null] (not (pg/jsonb-exists i-allowed v-text)))
         [:raise :exception :using '[[errcode := "22023"] [message := "Choose a listed profile value"]]])
       (when (not (pg/jsonb-exists o-result v-text))
         (:= o-result (|| o-result (pg/jsonb-build-array v-text)))))]
    (return o-result)))

(defn.pg ^{:- [:text]} account-link [:text i-value :text i-platform]
  (let [(:text v-value) (pg/coalesce i-value "")]
    (when (== v-value "") (return ""))
    (when (or (> (pg/length v-value) 200)
              (and (== i-platform "instagram")
                   (not (#{"regexp_like"} v-value "^https://(www[.])?instagram[.]com/[A-Za-z0-9._]{1,30}/?$")))
              (and (== i-platform "tiktok")
                   (not (#{"regexp_like"} v-value "^https://(www[.])?tiktok[.]com/@[A-Za-z0-9._]{1,30}/?$"))))
      [:raise :exception :using '[[errcode := "22023"] [message := "Enter a full provider profile URL"]]])
    (return (|| (#{"regexp_replace"} (#{"regexp_replace"} v-value "^https://(www[.])?" "https://www.") "/$" "") "/"))))

(defn.pg ^{:- [:text]} account-portrait [:text i-value]
  (when (== i-value "") (return ""))
  (when (or [i-value :is-null] (> (pg/length i-value) 65558)
            (not (#{"regexp_like"} i-value "^data:image/(webp|jpeg);base64,[A-Za-z0-9+/]+={0,2}$")))
    [:raise :exception :using '[[errcode := "22023"] [message := "Choose a valid JPEG or WebP portrait"]]])
  (let [(:bytea v-bytes) (#{"decode"} (#{"split_part"} i-value "," 2) "base64")
        (:int v-size) (#{"octet_length"} v-bytes)
        (:boolean v-valid) false]
    (when (and (>= v-size 20) (<= v-size 49152))
      (if (#{"regexp_like"} i-value "^data:image/webp;")
        (:= v-valid (and (== (#{"encode"} (#{"substr"} v-bytes 1 4) "hex") "52494646")
                        (== (#{"encode"} (#{"substr"} v-bytes 9 4) "hex") "57454250")
                        (pg/jsonb-exists (:jsonb "[\"56503820\",\"5650384c\",\"56503858\"]") (#{"encode"} (#{"substr"} v-bytes 13 4) "hex"))
                        (== (+ (#{"get_byte"} v-bytes 4) (* 256 (#{"get_byte"} v-bytes 5))
                               (* 65536 (#{"get_byte"} v-bytes 6)) (* 16777216 (#{"get_byte"} v-bytes 7))) (- v-size 8))))
        (:= v-valid (and (== (#{"get_byte"} v-bytes 0) 255) (== (#{"get_byte"} v-bytes 1) 216)
                        (== (#{"get_byte"} v-bytes 2) 255) (== (#{"get_byte"} v-bytes (- v-size 2)) 255)
                        (== (#{"get_byte"} v-bytes (- v-size 1)) 217)))))
    (when (not v-valid)
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose a valid JPEG or WebP portrait"]]])
    (return i-value)))

(defn.pg ^{:- [:jsonb]} account-featured [:uuid i-user :text i-kind :jsonb i-values]
  (let [o-values (-/account-list i-values nil 12) o-item nil (:uuid v-id) nil (:boolean v-owned) false]
    [:for o-item :in :select (pg/jsonb-array-elements o-values)
     (loop []
       (:= v-id (:uuid (:->> (pg/jsonb-build-array o-item) 0)))
       (if (== i-kind "featuredLogs")
         (let [o-session (pg/t:get book/DiveSession {:where {:id v-id :owner i-user} :returning #{:detail}})]
           (:= v-owned (pg/coalesce (== (:->> (:-> o-session "detail") "visibility") "public") false)))
         (let [(:boolean v-post) (pg/t:exists posts/SocialPost {:where {:id v-id :owner i-user :status "approved" :public-consent true}})]
           (:= v-owned v-post)))
       (when (not v-owned)
         [:raise :exception :using '[[errcode := "22023"] [message := "Feature only your currently published items"]]]))]
    (return o-values)))

(defn.pg ^{:- [:jsonb]} save-account-preferences [:uuid i-user :jsonb i-profile :boolean i-verified]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  (let [o-account (-/ret-account i-user)
        o-old (:-> o-account "profile")
        o-input nil o-sharing nil o-result nil
        (:text v-key) nil (:text v-name) nil (:text v-bio) nil
        (:jsonb o-depth) nil (:jsonb o-beaches) nil
        o-user (pg/t:get users/User {:where {:id i-user}})]
    (when (or [i-profile :is-null] (not= (pg/jsonb-typeof i-profile) "object"))
      [:raise :exception :using '[[errcode := "22023"] [message := "Invalid profile"]]])
    [:for v-key :in :select (pg/jsonb-object-keys i-profile)
     (loop []
       (when (not (pg/jsonb-exists (:jsonb "[\"displayName\",\"bio\",\"instagram\",\"tiktok\",\"open\",\"sharing\",\"beaches\",\"activities\",\"availability\",\"experience\",\"depthGoal\",\"portrait\",\"featuredLogs\",\"featuredPosts\"]") v-key))
         [:raise :exception :using '[[errcode := "22023"] [message := "Unknown profile field"]]]))]
    (:= o-input (|| o-old i-profile))
    (:= v-name (pg/btrim (pg/coalesce (:->> o-input "displayName") "Diver")))
    (when (== v-name "") (:= v-name "Diver"))
    (:= v-bio (pg/btrim (pg/coalesce (:->> o-input "bio") "")))
    (when (or (> (pg/length v-name) 80) (> (pg/length v-bio) 500)
              (and (pg/jsonb-exists o-input "open") (not= (pg/jsonb-typeof (:-> o-input "open")) "boolean")))
      [:raise :exception :using '[[errcode := "22023"] [message := "Invalid profile text or visibility"]]])
    (when (and (== (:-> o-input "open") (:jsonb "true")) (not (pg/coalesce i-verified false)))
      [:raise :exception :using '[[errcode := "42501"] [message := "Verify your email before appearing in discovery"]]])
    (:= o-sharing (pg/coalesce (:-> o-input "sharing") (:jsonb "{}")))
    (when (not= (pg/jsonb-typeof o-sharing) "object")
      [:raise :exception :using '[[errcode := "22023"] [message := "Invalid sharing preferences"]]])
    (:= o-depth (pg/coalesce (:-> o-input "depthGoal") (:jsonb "null")))
    (when (and (not= o-depth (:jsonb "null"))
               (or (not= (pg/jsonb-typeof o-depth) "number")
                   (<= (:numeric (:text o-depth)) 0) (> (:numeric (:text o-depth)) 100)))
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose a depth between 0 and 100 metres"]]])
    (:= o-beaches (-/account-list (:-> o-input "beaches") nil 20))
    (let [o-site nil (:uuid v-site) nil]
      [:for o-site :in :select (pg/jsonb-array-elements o-beaches)
       (loop []
         (:= v-site (:uuid (:->> (pg/jsonb-build-array o-site) 0)))
         (let [(:boolean v-exists) (pg/t:exists sites/Site {:where {:id v-site}})]
           (when (not v-exists)
             [:raise :exception :using '[[errcode := "22023"] [message := "Choose an existing dive site"]]])))])
    (when (and (pg/jsonb-exists o-input "experience")
               (not (pg/jsonb-exists (:jsonb "[\"\",\"new\",\"comfortable\",\"experienced\"]") (:->> o-input "experience"))))
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose a listed experience level"]]])
    (:= o-result (pg/jsonb-build-object
      "displayName" v-name "bio" v-bio
      "instagram" (-/account-link (:->> o-input "instagram") "instagram")
      "tiktok" (-/account-link (:->> o-input "tiktok") "tiktok")
      "open" (pg/coalesce (== (:-> o-input "open") (:jsonb "true")) false)
      "sharing" (pg/jsonb-build-object
        "visits" (pg/coalesce (== (:-> o-sharing "visits") (:jsonb "true")) false)
        "months" (pg/coalesce (== (:-> o-sharing "months") (:jsonb "true")) false)
        "dives" (pg/coalesce (== (:-> o-sharing "dives") (:jsonb "true")) false)
        "time" (pg/coalesce (== (:-> o-sharing "time") (:jsonb "true")) false)
        "depth" (pg/coalesce (== (:-> o-sharing "depth") (:jsonb "true")) false))
      "beaches" o-beaches
      "activities" (-/account-list (:-> o-input "activities") (:jsonb "[\"freediving\",\"ocean-swimming\",\"spearfishing\"]") 3)
      "availability" (-/account-list (:-> o-input "availability") (:jsonb "[\"weekday mornings\",\"weekday afternoons\",\"weekend mornings\",\"weekend afternoons\"]") 4)
      "experience" (pg/coalesce (:->> o-input "experience") "") "depthGoal" o-depth))
    ;; Preserve private/server fields; explicit featured selections are checked below.
    (:= o-result (|| (- o-old "displayName" "bio" "instagram" "tiktok" "open" "sharing" "beaches" "activities" "availability" "experience" "depthGoal") o-result))
    (when (pg/jsonb-exists i-profile "portrait")
      (:= o-result (|| o-result (pg/jsonb-build-object "portrait" (-/account-portrait (:->> i-profile "portrait"))))))
    (when (pg/jsonb-exists i-profile "featuredLogs")
      (:= o-result (|| o-result (pg/jsonb-build-object "featuredLogs" (-/account-featured i-user "featuredLogs" (:-> i-profile "featuredLogs"))))))
    (when (pg/jsonb-exists i-profile "featuredPosts")
      (:= o-result (|| o-result (pg/jsonb-build-object "featuredPosts" (-/account-featured i-user "featuredPosts" (:-> i-profile "featuredPosts"))))))
    (let [o-op (system/op-fn "account-preferences" i-user (:jsonb "{}"))
          o-updated (pg/t:update users/User {:where {:id i-user :deleted false}
                       :set {:profile o-result :time-updated (pg/time-us)}})
          o-rev (pg/t:update system/Rev {:where {:id (:uuid (:->> o-user "rev_id"))}
                       :set {:current o-result :index (+ 1 #{"index"})} :track o-op})
          o-history (pg/t:insert system/RevLog
                      {:class-table "User" :class-context "Global"
                       :rev (:uuid (:->> o-user "rev_id"))
                       :version (:int (:->> (:-> o-rev 0) "index")) :deltas o-result} {:track o-op})
          o-log (pg/t:insert system/AuditLog
                  {:class-table "User" :class-context "Global" :audit (:uuid (:->> o-user "audit_id"))
                   :entry (pg/jsonb-build-object "event" "preferences")} {:track o-op})]
      (return o-result))))

(defn.pg ^{:- [:boolean]} lock-account-pair [:uuid i-user :uuid i-target]
  (when (or [i-target :is-null] (== i-user i-target))
    [:raise :exception :using '[[errcode := "22023"] [message := "Choose another diver"]]])
  [:perform (#{"pg_advisory_xact_lock"}
    (#{"hashtextextended"} (|| "account-pair:" (:text (least i-user i-target)) ":" (:text (greatest i-user i-target))) 0))]
  ;; Hold shared row locks through the mutation. Erasure must finish before
  ;; another actor can create a relationship with its tombstone.
  [:execute "SELECT id FROM finfolk.\"User\" WHERE id=$1 FOR SHARE" :using (least i-user i-target)]
  [:execute "SELECT id FROM finfolk.\"User\" WHERE id=$1 FOR SHARE" :using (greatest i-user i-target)]
  [:perform (-/ret-account i-user)]
  (when (not (access/is-user-active i-target))
    [:raise :exception :using '[[errcode := "P0002"] [message := "Profile unavailable"]]])
  (return true))

(defn.pg ^{:- [:jsonb]} set-account-connection [:uuid i-user :uuid i-target :text i-mode :boolean i-verified]
  [:perform (-/lock-account-pair i-user i-target)]
  (when (not (pg/coalesce i-verified false))
    [:raise :exception :using '[[errcode := "42501"] [message := "Verify your email before connecting"]]])
  (when (access/is-user-blocked i-user i-target)
    [:raise :exception :using '[[errcode := "P0002"] [message := "Profile unavailable"]]])
  (let [(:uuid v-first) (least i-user i-target) (:uuid v-second) (greatest i-user i-target)
        o-existing (pg/t:get users/UserConnection {:where {:user v-first :target v-second}})]
    (cond
      (== i-mode "request")
      (do
        (when (== (:->> o-existing "status") "declined")
          [:raise :exception :using '[[errcode := "42501"] [message := "This connection is unavailable"]]])
        (if [o-existing :is-null]
          (let [o-created (pg/t:insert users/UserConnection
                           {:user v-first :target v-second :requested-by i-user :status "pending"})])
          (when (== (:->> o-existing "status") "removed")
            (let [o-updated (pg/t:update users/UserConnection
                             {:where {:id (pg/id o-existing)}
                              :set {:requested-by i-user :status "pending" :time-updated (pg/time-us)}})]))))
      (or (== i-mode "accept") (== i-mode "decline"))
      (do
        (when (or [o-existing :is-null] (not= (:->> o-existing "status") "pending")
                  (== (:uuid (:->> o-existing "requested_by_id")) i-user))
          [:raise :exception :using '[[errcode := "42501"] [message := "Only the recipient can respond"]]])
        (let [o-updated (pg/t:update users/UserConnection
                         {:where {:id (pg/id o-existing)}
                          :set {:status (++ (pg/case (== i-mode "accept") "accepted" true "declined") enums/EnumUserConnectionStatus)
                                :time-updated (pg/time-us)}})]))
      (== i-mode "remove")
      (let [o-removed (pg/t:update users/UserConnection
                       {:where {:user v-first :target v-second}
                        :set {:status "removed" :time-updated (pg/time-us)}})])
      :else [:raise :exception :using '[[errcode := "22023"] [message := "Unknown connection action"]]])
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg ^{:- [:jsonb]} set-account-block [:uuid i-user :uuid i-target :boolean i-block]
  [:perform (-/lock-account-pair i-user i-target)]
  (let [(:uuid v-first) (least i-user i-target) (:uuid v-second) (greatest i-user i-target)
        (:boolean v-existing) (pg/t:exists users/UserBlock {:where {:owner i-user :target i-target}})]
    (if i-block
      (do
        (when (not v-existing)
          (let [o-created (pg/t:insert users/UserBlock {:owner i-user :target i-target})]))
        (let [o-removed (pg/t:update users/UserConnection
                         {:where {:user v-first :target v-second}
                          :set {:status "removed" :time-updated (pg/time-us)}})]))
      (let [o-removed (pg/t:delete users/UserBlock {:where {:owner i-user :target i-target}})]))
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg ^{:- [:jsonb]} ret-account-connections [:uuid i-user]
  [:perform (-/ret-account i-user)]
  (let [o-relations (pg/t:select users/UserConnection
                     {:where #{[:user i-user :status [:in '("pending" "accepted")]
                                :or :target i-user :status [:in '("pending" "accepted")]]}
                      :order-by [:time-updated :id] :order-sort :desc :limit 50})
        o-result (:jsonb "[]") o-rel nil]
    [:for o-rel :in :select (pg/jsonb-array-elements (pg/coalesce o-relations (:jsonb "[]")))
     (loop []
       (let [(:uuid v-target) (pg/case (== (:uuid (:->> o-rel "user_id")) i-user)
                                         (:uuid (:->> o-rel "target_id")) true (:uuid (:->> o-rel "user_id")))
             o-target (pg/t:get users/User {:where {:id v-target :deleted false}})]
         (when (and [o-target :is-not-null] (not (access/is-user-blocked i-user v-target)))
           (:= o-result (|| o-result (pg/jsonb-build-array
             (pg/jsonb-build-object "id" v-target "name" (pg/coalesce (:->> (:-> o-target "profile") "displayName") "Diver")
               "status" (:->> o-rel "status") "requested_by" (:->> o-rel "requested_by_id")
               "instagram" (pg/case (== (:->> o-rel "status") "accepted") (:->> (:-> o-target "profile") "instagram") true "")
               "tiktok" (pg/case (== (:->> o-rel "status") "accepted") (:->> (:-> o-target "profile") "tiktok") true ""))))))))]
    (return o-result)))

(defn.pg ^{:- [:jsonb]} ret-account-blocks [:uuid i-user]
  [:perform (-/ret-account i-user)]
  (let [o-blocks (pg/t:select users/UserBlock {:where {:owner i-user} :order-by [:id]})
        o-result (:jsonb "[]") o-block nil]
    [:for o-block :in :select (pg/jsonb-array-elements (pg/coalesce o-blocks (:jsonb "[]")))
     (loop []
       (let [(:uuid v-target) (:uuid (:->> o-block "target_id"))
             o-target (pg/t:get users/User {:where {:id v-target :deleted false}})]
         (when [o-target :is-not-null]
           (:= o-result (|| o-result (pg/jsonb-build-array
             (pg/jsonb-build-object "id" v-target "name" (pg/coalesce (:->> (:-> o-target "profile") "displayName") "Diver"))))))))]
    (return o-result)))

(defn.pg ^{:- [:jsonb]} ret-account-status [:uuid i-user]
  [:perform (-/ret-account i-user)]
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}})
        o-posts (pg/t:get users/ApplicationFeature {:where {:key "community-posts"}})]
    (return (pg/jsonb-build-object "admin" v-admin "enabled" (pg/coalesce (:boolean (:->> o-posts "enabled")) false)
                                   "tag" "finfolk.com.au" "pilotBeaches" (:jsonb "[]")))))

(defn.pg ^{:- [:jsonb]} ret-account-sites []
  (let [o-sites (pg/t:select sites/Site
                  {:returning #{:id :name :area-name :state :timezone}
                   :order-by [:name :id]})]
    (return (pg/jsonb-build-object "beaches" (pg/coalesce o-sites (:jsonb "[]"))))))

(def ACCOUNT-REFERENCES-SQL
  "SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'cascade',k.confdeltype='c','nullable',NOT a.attnotnull) ORDER BY c.relname,a.attname),'[]'::jsonb) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1] WHERE k.contype='f' AND k.confrelid='finfolk.\"User\"'::regclass AND n.nspname='finfolk' AND cardinality(k.conkey)=1")

(defn.pg ^{:- [:jsonb]} erase-account [:uuid i-user]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  (let [o-user (pg/t:get users/User {:where {:id i-user}})
        o-op nil o-refs nil o-ref nil o-streams (:jsonb "[]") o-found nil o-stream nil
        (:boolean v-present) false]
    (when [o-user :is-null]
      [:perform (-/ensure-account i-user)]
      (let [o-provisioned (pg/t:get users/User {:where {:id i-user}})] (:= o-user o-provisioned)))
    (when (pg/jsonb-exists (:jsonb "[\"pending_auth\",\"complete\"]") (:->> o-user "deletion_state"))
      (return (pg/jsonb-build-object "ok" true)))
    [:execute "SELECT id FROM finfolk.\"User\" WHERE id=$1 FOR UPDATE" :using i-user]
    (:= o-op (system/op-fn "account-delete" i-user (:jsonb "{}")))
    [:execute (@! ACCOUNT-REFERENCES-SQL) :into o-refs]
    ;; Snapshot all directly owned addon streams before cascading any base rows.
    [:for o-ref :in :select (pg/jsonb-array-elements o-refs)
     (loop []
       (when (== (:-> o-ref "cascade") (:jsonb "true"))
         [:execute
          (#{"format"} "SELECT coalesce(jsonb_agg(jsonb_build_object('rev',to_jsonb(t)->>'rev_id','audit',to_jsonb(t)->>'audit_id','activity',to_jsonb(t)->>'activity_id')),'[]'::jsonb) FROM finfolk.%I t WHERE %I=$1"
            (:->> o-ref "table") (:->> o-ref "column")) :into o-found :using i-user]
         (:= o-streams (|| o-streams o-found))))]
    (let [o-marked (pg/t:update users/User {:where {:id i-user}
                        :set {:deleted true :time-updated (pg/time-us) :deletion-state "pending_auth" :email-verified false :profile (:jsonb "{}") :invite-eligible false}})])
    ;; Delivery always locks event -> invitation -> outbox. Keep that order
    ;; while deleting an organiser or a requester so in-flight workers can finish.
    [:execute "SELECT e.id FROM finfolk.\"Event\" e WHERE e.id IN(SELECT d.event_id FROM finfolk.\"EventInviteDelivery\" d WHERE d.requester_id=$1) OR e.listing_id IN(SELECT p.id FROM finfolk.\"DirectoryListing\" p JOIN finfolk.\"AccessRole\" a ON a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level='owner' AND a.is_active) ORDER BY e.id FOR UPDATE" :using i-user]
    [:execute "SELECT i.id FROM finfolk.\"AccessInviteEmail\" i WHERE i.class_table='Event' AND i.class_context='Global' AND i.access_id IN(SELECT e.access_id FROM finfolk.\"Event\" e WHERE e.id IN(SELECT d.event_id FROM finfolk.\"EventInviteDelivery\" d WHERE d.requester_id=$1) OR e.listing_id IN(SELECT p.id FROM finfolk.\"DirectoryListing\" p JOIN finfolk.\"AccessRole\" a ON a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level='owner' AND a.is_active)) ORDER BY i.access_id,i.id FOR UPDATE" :using i-user]
    [:execute "UPDATE finfolk.\"EventInviteDelivery\" SET state='cancelled',sealed_token='',lease=NULL,lease_until=0,error='' WHERE state<>'sent' AND event_id IN(SELECT e.id FROM finfolk.\"Event\" e JOIN finfolk.\"DirectoryListing\" p ON p.id=e.listing_id JOIN finfolk.\"AccessRole\" a ON a.class_table='DirectoryListing' AND a.class_context='Global' AND a.access_id=p.access_id WHERE a.member_id=$1 AND a.level='owner' AND a.is_active)" :using i-user]
    ;; Drafts are private actor-owned work. Published review history is shared
    ;; and follows the nullable identity cleanup below.
    [:execute "DELETE FROM finfolk.\"SiteRevision\" WHERE owner_id=$1 AND status<>'published'" :using i-user]
    [:execute "DELETE FROM finfolk.\"SiteImport\" WHERE owner_id=$1 AND status<>'published'" :using i-user]
    ;; Follow declared ownership semantics: cascade-owned data is removed; shared
    ;; contributions with nullable references are retained without the identity.
    [:for o-ref :in :select (pg/jsonb-array-elements o-refs)
     (loop []
       (cond
         (== (:-> o-ref "cascade") (:jsonb "true"))
         [:execute (#{"format"} "DELETE FROM finfolk.%I WHERE %I=$1" (:->> o-ref "table") (:->> o-ref "column")) :using i-user]
         (== (:-> o-ref "nullable") (:jsonb "true"))
         [:execute (#{"format"} "UPDATE finfolk.%I SET %I=NULL WHERE %I=$1" (:->> o-ref "table") (:->> o-ref "column") (:->> o-ref "column")) :using i-user]
         :else
         (do
           [:execute (#{"format"} "SELECT EXISTS(SELECT 1 FROM finfolk.%I WHERE %I=$1)" (:->> o-ref "table") (:->> o-ref "column")) :into v-present :using i-user]
           (when v-present [:raise-exception "Account deletion has an unsupported required reference"]))))]
    [:for o-stream :in :select (pg/jsonb-array-elements o-streams)
     (loop []
       (when [(:->> o-stream "rev") :is-not-null]
         (let [o-deleted (pg/t:delete system/Rev {:where {:id (:uuid (:->> o-stream "rev"))} :track o-op})]))
       (when [(:->> o-stream "audit") :is-not-null]
         (let [o-deleted (pg/t:delete system/Audit {:where {:id (:uuid (:->> o-stream "audit"))} :track o-op})]))
       (when [(:->> o-stream "activity") :is-not-null]
         (let [o-deleted (pg/t:delete system/Activity {:where {:id (:uuid (:->> o-stream "activity"))} :track o-op})])))]
    ;; Keep a minimal UUID tombstone so valid-but-old JWTs cannot reprovision it.
    (let [o-rev (pg/t:update system/Rev {:where {:id (:uuid (:->> o-user "rev_id"))} :set {:current (:jsonb "{}")} :track o-op})
          o-revisions (pg/t:update system/RevLog {:where {:rev (:uuid (:->> o-user "rev_id"))} :set {:deltas (:jsonb "{}")} :track o-op})
          o-audit (pg/t:update system/AuditLog {:where {:audit (:uuid (:->> o-user "audit_id"))}
                       :set {:entry (pg/jsonb-build-object "event" "account-deleted")} :track o-op})
          o-activity (pg/t:update activity/ActivityLog {:where {:activity (:uuid (:->> o-user "activity_id"))} :set {:detail (:jsonb "{}")} :track o-op})
          o-ops (pg/t:update system/Op {:where {:user-id i-user} :set {:user-id nil :data (:jsonb "{}")}})])
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg ^{:- [:jsonb]} complete-account-deletion [:uuid i-user]
  (let [o-user (pg/t:get users/User {:where {:id i-user :deleted true}})]
    (when [o-user :is-null] [:raise-exception "Account deletion was not requested"])
    (let [o-complete (pg/t:update users/User {:where {:id i-user :deleted true} :set {:deletion-state "complete"}})])
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg ^{:- [:jsonb]} pending-account-deletions []
  (let [o-users (pg/t:select users/User {:where {:deleted true :deletion-state "pending_auth"} :returning #{:id} :order-by [:time-updated :id] :order-sort :asc :limit 100})]
    (return (pg/coalesce o-users (:jsonb "[]")))))

(defn.pg ^{:- [:jsonb]} record-account-deletion-failure [:uuid i-user]
  (let [o-retry (pg/t:update users/User {:where {:id i-user :deleted true :deletion-state "pending_auth"}
                      :set {:time-updated (pg/time-us)}})]
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg ^{:- [:jsonb]} ret-platform-status [:uuid i-user :boolean i-verified]
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}})
        (:boolean v-active) (pg/t:exists users/User {:where {:id i-user :deleted false}})
        o-result nil]
    (when (or (not (pg/coalesce i-verified false)) (not v-admin) (not v-active))
      [:raise :exception :using '[[errcode := "42501"] [message := "Administrator access required"]]])
    [:execute "SELECT jsonb_build_object('checkedAt',clock_timestamp(),'release',(SELECT key FROM finfolk.\"DatabaseRelease\" WHERE manifest->>'schema_sha'=key ORDER BY time_created DESC LIMIT 1),'queues',(SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT 'Messaging' AS name,count(*) FILTER(WHERE status='received') AS pending,count(*) FILTER(WHERE status='processing') AS processing,count(*) FILTER(WHERE status='failed') AS failed,count(*) FILTER(WHERE status='processing' AND lease_until<extract(epoch from now())*1000000) AS overdue,min(time_created) FILTER(WHERE status='received') AS oldest FROM finfolk.\"MessagingReceipt\" UNION ALL SELECT 'Environment' AS name,count(*) FILTER(WHERE lease_token IS NULL AND next_attempt_at<=extract(epoch from now())*1000000) AS pending,count(*) FILTER(WHERE lease_token IS NOT NULL) AS processing,count(*) FILTER(WHERE error_code IS NOT NULL) AS failed,count(*) FILTER(WHERE lease_until<extract(epoch from now())*1000000) AS overdue,min(next_attempt_at) FILTER(WHERE lease_token IS NULL AND next_attempt_at<=extract(epoch from now())*1000000) AS oldest FROM finfolk.\"EnvironmentJob\" UNION ALL SELECT 'Invitation email' AS name,count(*) FILTER(WHERE state='queued') AS pending,count(*) FILTER(WHERE state='sending') AS processing,count(*) FILTER(WHERE state='failed') AS failed,count(*) FILTER(WHERE state='sending' AND lease_until<extract(epoch from now())*1000000) AS overdue,min(time_created) FILTER(WHERE state='queued') AS oldest FROM finfolk.\"EventInviteDelivery\") q),'failures',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) FROM (SELECT id,'Invitation email' AS source,'delivery_failed' AS code,time_updated AS observed FROM finfolk.\"EventInviteDelivery\" WHERE state='failed' AND time_updated>extract(epoch from now()-interval '24 hours')*1000000 ORDER BY time_updated DESC LIMIT 10) f),'cleanupPending',(SELECT count(*) FROM finfolk.\"User\" WHERE deleted AND deletion_state='pending_auth'))" :into o-result]
    (return o-result)))
