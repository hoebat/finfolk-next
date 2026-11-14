(ns finfolkdb.fn.messaging.messaging-chat
  "Authenticated subject-scoped app chat; authorization remains in the gateway."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as tmb]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg receive-chat-message
  [:uuid i-application :uuid i-account :text i-subject :text i-key :text i-body :integer i-window]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})]
    (when (or [o-account :is-null] (not= (:->> o-account "provider") "app"))
      [:raise-exception "App chat account is outside application scope"])
    (when (or (== (pg/coalesce i-subject "") "")
              (> (pg/length i-subject) 500)
              (== (pg/coalesce i-key "") "")
              (> (pg/length i-key) 128)
              [i-window :is-null]
              (< i-window 1)
              (> i-window 604800))
      [:raise-exception "Invalid app chat message"])
    (let [(:text v-key)
          (#{"encode"} (#{"digest"} (:text (pg/jsonb-build-array i-subject i-key)) "sha256") "hex")
          o-receipt (pg/t:get tmb/MessagingReceipt
                      {:where {:account i-account :external-event-id v-key}})
          o-message (pg/t:get tmb/MessagingMessage
                      {:where {:id (:uuid (:->> o-receipt "message_id"))}})
          (:bigint v-sent) (pg/coalesce (:bigint (:->> o-message "sent_at")) (pg/time-us))
          (:bigint v-deadline) (pg/coalesce (:bigint (:->> o-receipt "deadline"))
                                            (+ v-sent (* i-window 1000000)))]
      (return (messaging/receive-message i-application
                                         i-account
                                         (pg/jsonb-build-object "eventId" v-key
                                                                "messageId" v-key
                                                                "conversationId" i-subject
                                                                "senderId" i-subject
                                                                "body" i-body
                                                                "sentAt" v-sent
                                                                "deadline" v-deadline
                                                                "metadata" (:jsonb "{}")))))))

(defn.pg ret-chat-history
  [:uuid i-application :uuid i-account :text i-subject]
  (let [o-account (messaging/ret-messaging-account i-application i-account)]
    (when (not= (:->> o-account "provider") "app")
      [:raise-exception "History is available only on an app chat account"])
    (let [o-conversation (pg/t:get tmb/MessagingConversation
                           {:where {:account i-account :external-id i-subject}})
          o-participant (pg/t:get tmb/MessagingIdentity
                          {:where {:id (:uuid (:->> o-conversation "participant_id"))
                                   :account i-account
                                   :external-id i-subject}})]
      (when [o-participant :is-null]
        (return (:jsonb "[]")))
      (return (messaging/ret-messaging-history i-application
                                               i-account
                                               (:uuid (:->> o-conversation "id")))))))
