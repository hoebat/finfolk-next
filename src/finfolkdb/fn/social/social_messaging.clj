(ns finfolkdb.fn.social.social-messaging
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]
             [finfolkdb.common.type-messaging-base :as messages]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg receive-social-message
  [:uuid i-application :uuid i-inbox :text i-namespace :jsonb i-envelope :jsonb o-op]
  (let [o-inbox (pg/t:get messages/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})]
    (when [o-inbox :is-null] [:raise-exception "Messaging account outside application scope"])
    (when (== (:->> o-inbox "provider") "app")
      [:raise-exception "External provider required"])
    (let [(:uuid v-account) (social/insert-social-account (:->> o-inbox "provider")
                                                          i-namespace
                                                          (:->> i-envelope "senderId")
                                                          ""
                                                          ""
                                                          (:jsonb "{}")
                                                          o-op)
          o-received (messaging/receive-message i-application i-inbox i-envelope)
          o-identity (pg/t:get messages/MessagingIdentity
                       {:where {:account i-inbox :external-id (:->> i-envelope "senderId")}
                        :for [:update]})]
      (when (and [(:->> o-identity "social_account_id") :is-not-null]
                 (not= (:uuid (:->> o-identity "social_account_id")) v-account))
        [:raise-exception "Conflicting social identity binding"])
      (let [o-bound (pg/t:update messages/MessagingIdentity
                      {:where {:id (:uuid (:->> o-identity "id"))}
                       :set {:social-account v-account :user nil}})]
        (return o-received)))))

(defn.pg resolve-social-member
  [:uuid i-inbox :text i-sender]
  (let [o-identity (pg/t:get messages/MessagingIdentity
                     {:where {:account i-inbox :external-id i-sender}})
        o-connection (pg/t:get accounts/SocialConnection
                       {:where {:account (:uuid (:->> o-identity "social_account_id"))
                                :status "active"}
                        :for [:share]})]
    (when (or [o-connection :is-null]
              (not (access/is-user-active (:uuid (:->> o-connection "user_id")))))
      (return nil))
    (return (pg/jsonb-build-object "userId" (:-> o-connection "user_id")
                                   "identityVersion" (:-> o-connection "identity_version")
                                   "connectionId" (:-> o-connection "id")))))

(defn.pg begin-social-message-proof
  [:uuid i-inbox :text i-sender :uuid i-receipt :text i-hash :jsonb o-op]
  (let [o-identity (pg/t:get messages/MessagingIdentity
                     {:where {:account i-inbox :external-id i-sender}})
        (:uuid v-account) (:uuid (:->> o-identity "social_account_id"))
        o-account (pg/t:get accounts/SocialAccount {:where {:id v-account} :for [:update]})
        o-receipt (pg/t:get messages/MessagingReceipt {:where {:id i-receipt :account i-inbox}})
        o-message (pg/t:get messages/MessagingMessage
                    {:where {:id (:uuid (:->> o-receipt "message_id"))}})
        o-thread (pg/t:get messages/MessagingConversation
                   {:where {:id (:uuid (:->> o-message "conversation_id"))}})]
    (when (or [o-account :is-null]
              [o-receipt :is-null]
              (not= (:uuid (:->> o-thread "participant_id")) (:uuid (:->> o-identity "id"))))
      [:raise-exception "Proof receipt does not match sender"])
    (let [o-old (pg/t:update workflow/SocialConnectionProof
                  {:where {:account v-account :status [:in '("pending" "verified")]}
                   :set {:status "revoked"}
                   :track o-op})
          o-proof (social/begin-social-proof v-account nil "message" i-hash nil nil 600 o-op)
          o-bound
          (pg/t:update workflow/SocialConnectionProof
            {:where {:id (:uuid (:->> o-proof "id"))} :set {:receipt i-receipt} :track o-op})
          (:boolean v-ok) (social/verify-social-proof (:uuid (:->> o-proof "id"))
                                                      (pg/jsonb-build-object
                                                       "verified" true
                                                       "provider" (:-> o-account "provider")
                                                       "namespace" (:-> o-account "namespace")
                                                       "externalId" (:-> o-account "external_id"))
                                                      o-op)]
      (return o-proof))))
