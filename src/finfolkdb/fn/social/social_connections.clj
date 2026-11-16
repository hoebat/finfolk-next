(ns finfolkdb.fn.social.social-connections
  "Scoped member redemption and revocation, with no provider SQL in adapters."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.fn.social.social-policy :as policy]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg invalidate-social-personal-work
  [:uuid i-account :uuid i-exclude-command :jsonb o-op]
  (let [o-proofs (pg/t:update workflow/SocialConnectionProof
                   {:where {:account i-account :status [:in '("pending" "verified")]}
                    :set {:status "revoked"}
                    :track o-op})
        o-actions (pg/t:update workflow/SocialAction
                    {:where {:account i-account :state [:in '("pending" "running")]}
                     :set
                     {:state "expired" :lease nil :lease-until nil :error-code "identity_changed"}
                     :track o-op})
        o-commands (pg/t:select workflow/SocialCommand
                     {:where {:account i-account
                              :command [:in '("connect" "disconnect" "status" "whoami")]}})
        o-command nil]
    [:for o-command :in :select (pg/jsonb-array-elements (pg/coalesce o-commands (:jsonb "[]")))
     (loop []
       (when (or [i-exclude-command :is-null] (not= (pg/id o-command) i-exclude-command))
         (let [o-cancelled (pg/t:update delivery/MessagingOutbox
                             {:where {:command (pg/id o-command) :state "pending"}
                              :set {:state "cancelled"
                                    :body-ciphertext nil
                                    :cipher-context (:jsonb "{}")
                                    :error-code "identity_changed"}})
               o-uncertain (pg/t:update delivery/MessagingOutbox
                             {:where {:command (pg/id o-command) :state "sending"}
                              :set {:state "uncertain"
                                    :lease nil
                                    :lease-until nil
                                    :body-ciphertext nil
                                    :cipher-context (:jsonb "{}")
                                    :error-code "identity_changed"}})]
           nil)
         (when (or (== (:->> o-command "state") "new") (== (:->> o-command "state") "waiting"))
           (let [o-expired (pg/t:update workflow/SocialCommand
                             {:where {:id (pg/id o-command)} :set {:state "expired"} :track o-op})
                 o-event (pg/t:update workflow/SocialEvent
                           {:where {:id (:uuid (:->> o-command "event_id"))}
                            :set {:status "expired"}
                            :track o-op})]
             nil))))]
    (return (pg/jsonb-build-object "invalidated" true))))

(defn.pg redeem-social-connection
  "The server supplies the authenticated member. Raw code exists only in this call."
  [:uuid i-application :uuid i-inbox :uuid i-user :text i-code :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        (:text v-code) (pg/upper (pg/regexp-replace (pg/coalesce i-code "") "[[:space:]-]" "" "g"))]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or (== (:->> o-inbox "mode") "disabled")
              (not (policy/social-member-allowed o-inbox i-user))
              (> (pg/length (pg/coalesce i-code "")) 100)
              (not (#{"regexp_like"} v-code "^[A-Z0-9]{8}$")))
      (return nil))
    (let [(:text v-hash) (#{"encode"} (#{"digest"} v-code "sha256") "hex")
          o-proof (pg/t:get workflow/SocialConnectionProof
                    {:where {:token-hash v-hash :kind "message"}})
          o-event (pg/t:get workflow/SocialEvent {:where {:id (:uuid (:->> o-proof "event_id"))}})]
      (when (or [o-proof :is-null]
                [o-event :is-null]
                (not= (:uuid (:->> o-event "inbox_id")) i-inbox)
                (not= (:integer (:->> o-event "generation")) (:integer (:->> o-inbox "generation")))
                (not= (:->> o-proof "status") "verified")
                (and (== (:->> o-inbox "mode") "pilot")
                     (not (pg/jsonb-exists (:-> o-inbox "pilot_sender_ids")
                                           (:->> (:-> o-event "payload") "senderId")))))
        (return nil))
      (let [o-connected (social/connect-social-account i-user
                                                       (pg/id o-proof)
                                                       v-hash
                                                       nil
                                                       nil
                                                       nil
                                                       nil
                                                       nil
                                                       (:jsonb "[]")
                                                       (:jsonb "[]")
                                                       o-op)]
        (when [o-connected :is-not-null]
          [:perform
           (-/invalidate-social-personal-work (:uuid (:->> o-proof "account_id")) nil o-op)])
        (return o-connected)))))

(defn.pg ^{:- [:boolean]}
  disconnect-social-connection
  [:uuid i-application :uuid i-inbox :uuid i-user :uuid i-connection :uuid i-version :uuid i-command
   :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        o-connection (pg/t:get accounts/SocialConnection {:where {:id i-connection}})
        o-account (pg/t:get accounts/SocialAccount
                    {:where {:id (:uuid (:->> o-connection "account_id"))}})
        o-identity (pg/t:get messaging/MessagingIdentity
                     {:where {:account i-inbox :social-account (pg/id o-account)}})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or [o-identity :is-null] [o-connection :is-null] (not (access/is-user-active i-user)))
      (return false))
    (when (not (social/disconnect-social-account i-user i-connection i-version o-op))
      (return false))
    [:perform (-/invalidate-social-personal-work (pg/id o-account) i-command o-op)]
    (return true)))
