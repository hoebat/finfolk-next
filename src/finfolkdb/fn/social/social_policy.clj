(ns finfolkdb.fn.social.social-policy
  "Current database policy shared by command execution and external work."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:boolean]}
  social-member-allowed
  [:jsonb o-inbox :uuid i-user]
  (when (not (access/is-user-active i-user))
    (return false))
  (when (not= (:->> o-inbox "provider") "mock")
    (let [(:boolean v-verified) (pg/t:exists users/User {:where {:id i-user :deleted false :email-verified true}})]
      (when (not v-verified) (return false))))
  (let [o-operated (pg/t:get accounts/SocialConnection
                     {:where {:account (:uuid (:->> o-inbox "social_account_id"))
                              :status "active"}})]
    (return (not (access/is-user-blocked i-user (:uuid (:->> o-operated "user_id")))))))

(defn.pg ^{:- [:text]} social-rollout-error
  "Shared intake/execution/delivery fence for current audience and activation time."
  [:jsonb o-inbox :jsonb o-event]
    (when (or [o-event :is-null]
              (not= (:integer (:->> o-event "generation")) (:integer (:->> o-inbox "generation"))))
      (return "generation_changed"))
    (when (<= (:bigint (:->> o-event "deadline")) (pg/time-us))
      (return "deadline_expired"))
    (let [(:bigint v-started) (:bigint (:->> (:-> (:-> o-inbox "checks") "socialActivation") "activatedAt"))]
      ;; Meta timestamps have millisecond precision. A one-second tolerance
      ;; handles boundary rounding without accepting older provider retries.
      (when (and [v-started :is-not-null]
                 (< (:bigint (:->> o-event "sent_at")) (- v-started 1000000)))
        (return "predates_rollout")))
    (when (and (== (:->> o-inbox "mode") "pilot")
               (not (pg/jsonb-exists (:-> o-inbox "pilot_sender_ids")
                                     (:->> (:-> o-event "payload") "senderId"))))
      (return "audience_changed"))
  (return nil))

(defn.pg ^{:- [:text]}
  social-work-policy-error
  "Paused receipts remain inspectable. New rollout generations fence their execution."
  [:jsonb o-inbox :jsonb o-event :jsonb o-command]
  (let [(:text v-name) (pg/coalesce (:->> o-command "command")
                                    (:->> (:-> (:-> o-event "payload") "parsed") "command"))]
    (let [(:text v-rollout) (-/social-rollout-error o-inbox o-event)]
      (when [v-rollout :is-not-null] (return v-rollout)))
    (when (and (not= v-name "none") (not (pg/jsonb-exists (:-> o-inbox "enabled_commands") v-name)))
      (return "command_disabled"))
    (when (and (== v-name "whoami") (not= (:->> o-inbox "provider") "mock"))
      (return "mock_only"))
    (when (and (== (:->> o-event "channel") "message")
               (or (== v-name "claim") (== v-name "connect") (== v-name "status") (== v-name "whoami")))
      (let [o-account (pg/t:get accounts/SocialAccount
                        {:where {:id (:uuid (:->> o-event "account_id"))}})]
        (when (not= (:integer (:->> o-event "account_generation"))
                    (:integer (:->> o-account "generation")))
          (return "identity_changed"))))
    (when (and [(:->> o-command "owner_id") :is-not-null]
               (or (== v-name "status") (== v-name "whoami")))
      (let [o-connection (pg/t:get accounts/SocialConnection
                           {:where {:id (:uuid (:->> o-command "connection_id")) :status "active"}
                            :for [:share]})]
        (when (or [o-connection :is-null]
                  [(:->> o-command "identity_version") :is-null]
                  (not= (:uuid (:->> o-connection "account_id"))
                        (:uuid (:->> o-event "account_id")))
                  (not= (:uuid (:->> o-connection "user_id")) (:uuid (:->> o-command "owner_id")))
                  (not= (:uuid (:->> o-connection "identity_version"))
                        (:uuid (:->> o-command "identity_version")))
                  (not (-/social-member-allowed o-inbox (:uuid (:->> o-command "owner_id")))))
          (return "member_restricted"))))
    (when [(:->> (:-> o-command "result") "postId") :is-not-null]
      ;; Repeated at claim and final confirmation. The delivery login has
      ;; read-only publication access; FOR SHARE would require UPDATE rights.
      (let [o-post (pg/t:get posts/SocialPost
                     {:where {:id (:uuid (:->> (:-> o-command "result") "postId"))}})
            o-viewer (pg/t:get accounts/SocialConnection
                       {:where {:account (:uuid (:->> o-event "account_id")) :status "active"}})]
        (when (or [o-post :is-null]
                  (not= (:->> o-post "status") "approved")
                  (not (:boolean (:->> o-post "public_consent")))
                  (not= (:->> o-post "url") (:->> o-command "source_url"))
                  (not (access/is-user-active (:uuid (:->> o-post "owner_id"))))
                  (access/is-user-blocked (:uuid (:->> o-viewer "user_id"))
                                          (:uuid (:->> o-post "owner_id"))))
          (return "publication_withdrawn"))))
    (return nil)))
