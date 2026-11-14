(ns finfolkdb.fn.messaging.messaging-manage
  "Reusable trusted-adapter messaging transactions. No provider HTTP or AI calls."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as tmb]
             [finfolkdb.common.type-system-seed :as tss]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; Account Scope and Audit
;;

(defn.pg ret-messaging-account
  "Internal scope check. Never expose its credential fields to chat clients."
  [:uuid i-application :uuid i-account]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:share]})]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (return o-account)))

(defn.pg record-messaging-audit
  [:uuid i-application :uuid i-account :text i-event :uuid i-correlation]
  (let [o-audit
        (pg/t:insert tmb/MessagingAudit
          {:account i-account :actor i-application :event i-event :correlation-id i-correlation})]
    (return o-audit)))

(defn.pg ^{:- [:boolean]} is-messaging-participant-allowed
  [:jsonb o-account :uuid i-conversation]
  (let [o-conversation (pg/t:get tmb/MessagingConversation {:where {:id i-conversation}})
        o-identity (pg/t:get tmb/MessagingIdentity
                     {:where {:id (:uuid (:->> o-conversation "participant_id"))}})]
    (return (or (== (:->> o-account "mode") "live")
                (and (== (:->> o-account "mode") "pilot")
                     (pg/jsonb-exists (:-> o-account "pilot_sender_ids")
                                      (:->> o-identity "external_id")))))))

;;
;; Normalized Receipt Ingestion
;;

(defn.pg receive-message
  "Called only after the adapter has verified the provider signature and account."
  [:uuid i-application :uuid i-account :jsonb i-envelope]
  (let [o-envelope (tss/as-jsonb i-envelope)
        ;; Short per-account serialization makes identity/conversation creation
        ;; and duplicate checks atomic, including concurrent webhook retries.
        o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})
        (:text v-event) (:->> o-envelope "eventId")
        (:text v-message) (:->> o-envelope "messageId")
        (:text v-conversation) (:->> o-envelope "conversationId")
        (:text v-sender) (:->> o-envelope "senderId")
        (:text v-body) (:->> o-envelope "body")
        (:bigint v-sent) (:bigint (:->> o-envelope "sentAt"))
        (:bigint v-deadline) (:bigint (:->> o-envelope "deadline"))
        o-metadata (tss/as-jsonb (:-> o-envelope "metadata"))]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (when (or (not= (pg/jsonb-typeof (:-> o-envelope "eventId")) "string")
              (not= (pg/jsonb-typeof (:-> o-envelope "messageId")) "string")
              (not= (pg/jsonb-typeof (:-> o-envelope "conversationId")) "string")
              (not= (pg/jsonb-typeof (:-> o-envelope "senderId")) "string")
              (not= (pg/jsonb-typeof (:-> o-envelope "body")) "string")
              [v-sent :is-null]
              [v-deadline :is-null]
              (== (pg/coalesce v-event "") "")
              (> (pg/length v-event) 500)
              (== (pg/coalesce v-message "") "")
              (> (pg/length v-message) 500)
              (== (pg/coalesce v-conversation "") "")
              (> (pg/length v-conversation) 500)
              (== (pg/coalesce v-sender "") "")
              (> (pg/length v-sender) 500)
              [v-body :is-null]
              (> (pg/length v-body) 2000)
              [v-sent :is-null]
              [v-deadline :is-null]
              (<= v-deadline v-sent)
              (> v-sent (+ (pg/time-us) 300000000)))
      [:raise-exception "Invalid normalized messaging envelope"])
    (let [o-existing (pg/t:get tmb/MessagingReceipt
                       {:where {:account i-account :external-event-id v-event}})
          o-existing-message (pg/t:get tmb/MessagingMessage
                               {:where
                                {:account i-account :direction "inbound" :external-id v-message}})]
      (when (or [o-existing :is-not-null] [o-existing-message :is-not-null])
        (let [o-original (pg/t:get tmb/MessagingMessage
                           {:where {:id (pg/coalesce (:uuid (:->> o-existing "message_id"))
                                                     (:uuid (:->> o-existing-message "id")))}})
              o-thread (pg/t:get tmb/MessagingConversation
                         {:where {:id (:uuid (:->> o-original "conversation_id"))}})
              o-sender (pg/t:get tmb/MessagingIdentity
                         {:where {:id (:uuid (:->> o-thread "participant_id"))}})]
          (when (or (not= (:->> o-original "external_id") v-message)
                    (not= (:->> o-original "body") v-body)
                    (not= (:-> o-original "metadata") o-metadata)
                    (not= (:bigint (:->> o-original "sent_at")) v-sent)
                    (not= (:->> o-thread "external_id") v-conversation)
                    (not= (:->> o-sender "external_id") v-sender))
            [:raise-exception "Conflicting duplicate messaging event"])
          (when [o-existing :is-null]
            (let [o-found (pg/t:get tmb/MessagingReceipt
                            {:where {:message (:uuid (:->> o-original "id"))}})]
              (:= o-existing o-found)))
          (return (pg/jsonb-build-object "duplicate" true "receipt" o-existing))))
      (let [o-identity (pg/t:get tmb/MessagingIdentity
                         {:where {:account i-account :external-id v-sender}})]
        (when [o-identity :is-null]
          (let [o-new (pg/t:insert tmb/MessagingIdentity
                        {:account i-account :external-id v-sender})]
            (:= o-identity o-new)))
        (let [o-conversation (pg/t:get tmb/MessagingConversation
                               {:where {:account i-account :external-id v-conversation}})]
          (when [o-conversation :is-null]
            (let [o-new (pg/t:insert tmb/MessagingConversation
                          {:account i-account
                           :external-id v-conversation
                           :participant (:uuid (:->> o-identity "id"))})]
              (:= o-conversation o-new)))
          (when (not= (:uuid (:->> o-conversation "participant_id")) (:uuid (:->> o-identity "id")))
            [:raise-exception "Conversation participant mismatch"])
          (let [o-message (pg/t:insert tmb/MessagingMessage
                            {:account i-account
                             :conversation (:uuid (:->> o-conversation "id"))
                             :direction "inbound"
                             :external-id v-message
                             :body v-body
                             :metadata o-metadata
                             :sent-at v-sent})
                o-receipt (pg/t:insert tmb/MessagingReceipt
                            {:account i-account
                             :external-event-id v-event
                             :message (:uuid (:->> o-message "id"))
                             :generation (:integer (:->> o-account "generation"))
                             :deadline v-deadline})
                o-audit (-/record-messaging-audit i-application
                                                  i-account
                                                  "message_received"
                                                  (:uuid (:->> o-receipt "correlation_id")))]
            (return (pg/jsonb-build-object "duplicate" false "receipt" o-receipt))))))))

;;
;; Work Claims and Atomic Completion
;;

(defn.pg reconcile-messaging-work
  "Terminalize stale work. Sending leases become uncertain, never retryable."
  [:uuid i-application :uuid i-account]
  (let [o-account (-/ret-messaging-account i-application i-account)
        (:integer v-generation) (:integer (:->> o-account "generation"))
        o-expired (pg/t:update tmb/MessagingReceipt
                    {:set {:status "expired" :lease nil :lease-until nil}
                     :single true
                     :where #{[:account i-account :status [:neq "completed"] :status
                               [:neq "expired"] :deadline [:lte (pg/time-us)] :or :account i-account
                               :status [:neq "completed"] :status [:neq "expired"] :generation
                               [:neq v-generation]]}})
        o-exhausted (pg/t:update tmb/MessagingReceipt
                      {:set {:status "failed" :lease nil :lease-until nil}
                       :single true
                       :where {:account i-account
                               :status "processing"
                               :attempts [:gte 5]
                               :lease-until [:lte (pg/time-us)]}})
        o-uncertain
        (pg/t:update tmb/MessagingOutbox
          {:set
           {:state "uncertain" :error-code "delivery_lease_expired" :lease nil :lease-until nil}
           :single true
           :where {:account i-account :state "sending" :lease-until [:lte (pg/time-us)]}})
        o-cancelled (pg/t:update tmb/MessagingOutbox
                      {:set {:state "cancelled" :error-code "account_generation_changed"}
                       :single true
                       :where
                       {:account i-account :state "pending" :generation [:neq v-generation]}})
        o-deadline (pg/t:update tmb/MessagingOutbox
                     {:set {:state "expired"}
                      :single true
                      :where {:account i-account :state "pending" :deadline [:lte (pg/time-us)]}})]
    (return (pg/jsonb-build-object "ok" true))))

(defn.pg claim-message
  [:uuid i-application :uuid i-account]
  (let [o-account (-/ret-messaging-account i-application i-account)
        o-reconciled (-/reconcile-messaging-work i-application i-account)
        (:integer v-generation) (:integer (:->> o-account "generation"))]
    (when (or (== (:->> o-account "mode") "disabled")
              (> (:bigint (:->> o-account "backoff_until")) (pg/time-us)))
      (return nil))
    (let [o-receipt
          (pg/t:get tmb/MessagingReceipt
            {:where #{[:account i-account :generation v-generation :status "received" :deadline
                       [:gt (pg/time-us)] :next-attempt-at [:lte (pg/time-us)] :attempts [:lt 5] :or
                       :account i-account :generation v-generation :status "failed" :deadline
                       [:gt (pg/time-us)] :next-attempt-at [:lte (pg/time-us)] :attempts [:lt 5] :or
                       :account i-account :generation v-generation :status "processing" :deadline
                       [:gt (pg/time-us)] :lease-until [:lte (pg/time-us)] :attempts [:lt 5]]}
             :order-by [:time-created :id]
             :order-sort :asc
             :for [:update :skip-locked]})]
      (when [o-receipt :is-null]
        (return nil))
      (let [o-message (pg/t:get tmb/MessagingMessage
                        {:where {:id (:uuid (:->> o-receipt "message_id"))}})
            o-conversation (pg/t:get tmb/MessagingConversation
                             {:where {:id (:uuid (:->> o-message "conversation_id"))
                                      :account i-account}})
            o-participant (pg/t:get tmb/MessagingIdentity
                            {:where {:id (:uuid (:->> o-conversation "participant_id"))
                                     :account i-account}})]
        (when (not (-/is-messaging-participant-allowed o-account
                                                       (:uuid (:->> o-message "conversation_id"))))
          (let [o-expired (pg/t:update tmb/MessagingReceipt
                            {:set {:status "expired" :lease nil :lease-until nil}
                             :single true
                             :where {:id (:uuid (:->> o-receipt "id"))}})]
            (return nil)))
        (let [o-claim (pg/t:update tmb/MessagingReceipt
                        {:set {:status "processing"
                               :lease (pg/uuid-generate-v4)
                               :lease-until (+ (pg/time-us) 60000000)
                               :attempts (+ (:integer (:->> o-receipt "attempts")) 1)}
                         :single true
                         :where {:id (:uuid (:->> o-receipt "id"))}})]
          (return (pg/jsonb-build-object "receipt" o-claim
                                         "message" o-message
                                         "provider" (:->> o-account "provider")
                                         "senderId" (:->> o-participant "external_id")
                                         "userId" (:uuid (:->> o-participant "user_id")))))))))

(defn.pg complete-message
  "A handler's domain mutations and this call may share one transaction."
  [:uuid i-application :uuid i-account :uuid i-receipt :uuid i-lease :jsonb i-result :text i-reply]
  (let [o-account (-/ret-messaging-account i-application i-account)
        o-result (tss/as-jsonb i-result)
        o-receipt (pg/t:get tmb/MessagingReceipt
                    {:where {:id i-receipt
                             :account i-account
                             :status "processing"
                             :lease i-lease
                             :lease-until [:gt (pg/time-us)]
                             :deadline [:gt (pg/time-us)]
                             :generation (:integer (:->> o-account "generation"))}
                     :for [:update]})]
    (when (or [o-receipt :is-null] (== (:->> o-account "mode") "disabled"))
      (return nil))
    (when (or [i-lease :is-null] (> (pg/length i-reply) 2000))
      [:raise-exception "Invalid messaging completion"])
    (let [o-incoming (pg/t:get tmb/MessagingMessage
                       {:where {:id (:uuid (:->> o-receipt "message_id"))}})]
      (when (not (-/is-messaging-participant-allowed o-account
                                                     (:uuid (:->> o-incoming "conversation_id"))))
        (return nil))
      (when [i-reply :is-not-null]
        (let [o-message (pg/t:insert tmb/MessagingMessage
                          {:account i-account
                           :conversation (:uuid (:->> o-incoming "conversation_id"))
                           :direction "outbound"
                           :body i-reply})
              o-outbox (pg/t:insert tmb/MessagingOutbox
                         {:account i-account
                          :receipt i-receipt
                          :message (:uuid (:->> o-message "id"))
                          :body i-reply
                          :generation (:integer (:->> o-receipt "generation"))
                          :correlation-id (:uuid (:->> o-receipt "correlation_id"))
                          :deadline (:bigint (:->> o-receipt "deadline"))})]
          nil))
      (let [o-complete (pg/t:update tmb/MessagingReceipt
                         {:set {:status "completed" :result o-result :lease nil :lease-until nil}
                          :single true
                          :where {:id i-receipt}})
            o-audit (-/record-messaging-audit i-application
                                              i-account
                                              "message_completed"
                                              (:uuid (:->> o-receipt "correlation_id")))]
        (return o-complete)))))

(defn.pg retry-message
  "Bounded retry; terminal or stale claims cannot mutate the receipt."
  [:uuid i-application :uuid i-account :uuid i-receipt :uuid i-lease :integer i-delay]
  (let [o-account (-/ret-messaging-account i-application i-account)]
    (when (or [i-lease :is-null] [i-delay :is-null] (< i-delay 1) (> i-delay 3600))
      [:raise-exception "Invalid messaging retry"])
    (let [o-retry (pg/t:update tmb/MessagingReceipt
                    {:set {:status "failed"
                           :lease nil
                           :lease-until nil
                           :next-attempt-at (+ (pg/time-us) (* i-delay 1000000))}
                     :single true
                     :where {:id i-receipt
                             :account i-account
                             :status "processing"
                             :lease i-lease
                             :lease-until [:gt (pg/time-us)]
                             :deadline [:gt (pg/time-us)]
                             :generation (:integer (:->> o-account "generation"))}})]
      (return o-retry))))

;;
;; Delivery Claims and Outcomes
;;

(defn.pg claim-delivery
  [:uuid i-application :uuid i-account]
  (let [o-account (-/ret-messaging-account i-application i-account)
        (:integer v-generation) (:integer (:->> o-account "generation"))
        o-reconciled (-/reconcile-messaging-work i-application i-account)]
    (when (or (== (:->> o-account "mode") "disabled")
              (> (:bigint (:->> o-account "backoff_until")) (pg/time-us)))
      (return nil))
    (let [o-outbox (pg/t:get tmb/MessagingOutbox
                     {:where {:account i-account
                              :state "pending"
                              :generation v-generation
                              :deadline [:gt (pg/time-us)]
                              :next-attempt-at [:lte (pg/time-us)]
                              :attempts [:lt 5]}
                      :order-by [:time-created :id]
                      :order-sort :asc
                      :for [:update :skip-locked]})]
      (when [o-outbox :is-null]
        (return nil))
      (let [o-message (pg/t:get tmb/MessagingMessage
                        {:where {:id (:uuid (:->> o-outbox "message_id"))}})
            o-conversation (pg/t:get tmb/MessagingConversation
                             {:where {:id (:uuid (:->> o-message "conversation_id"))}})
            o-identity (pg/t:get tmb/MessagingIdentity
                         {:where {:id (:uuid (:->> o-conversation "participant_id"))}})]
        (when (not (-/is-messaging-participant-allowed o-account
                                                       (:uuid (:->> o-conversation "id"))))
          (let [o-cancelled (pg/t:update tmb/MessagingOutbox
                              {:set {:state "cancelled" :error-code "participant_restricted"}
                               :single true
                               :where {:id (:uuid (:->> o-outbox "id"))}})]
            (return nil)))
        (let [o-claim (pg/t:update tmb/MessagingOutbox
                        {:set {:state "sending"
                               :lease (pg/uuid-generate-v4)
                               :lease-until (+ (pg/time-us) 60000000)
                               :attempts (+ (:integer (:->> o-outbox "attempts")) 1)
                               :time-updated (pg/time-us)}
                         :single true
                         :where {:id (:uuid (:->> o-outbox "id"))}})]
          (return (pg/jsonb-build-object "delivery" o-claim
                                         "provider" (:->> o-account "provider")
                                         "accountId" (:->> o-account "account_id")
                                         "recipientId" (:->> o-identity "external_id")
                                         "conversationId" (:->> o-conversation "external_id"))))))))

(defn.pg record-delivery-result
  "retry is valid only when the adapter knows the provider did not accept it."
  [:uuid i-application :uuid i-account :uuid i-delivery :uuid i-lease :text i-outcome :text
   i-provider-message :integer i-delay]
  (let [o-account (-/ret-messaging-account i-application i-account)
        o-outbox (pg/t:get tmb/MessagingOutbox
                   {:where {:id i-delivery
                            :account i-account
                            :state "sending"
                            :lease i-lease
                            :lease-until [:gt (pg/time-us)]}
                    :for [:update]})]
    (when [o-outbox :is-null]
      (return nil))
    (when (or [i-lease :is-null]
              [i-outcome :is-null]
              (not (or (== i-outcome "accepted")
                       (== i-outcome "retry")
                       (== i-outcome "failed")
                       (== i-outcome "uncertain")))
              (and (== i-outcome "accepted") (== (pg/coalesce i-provider-message "") ""))
              (and (== i-outcome "retry") (or [i-delay :is-null] (< i-delay 1) (> i-delay 3600))))
      [:raise-exception "Invalid messaging delivery outcome"])
    (let [(:text v-state) i-outcome]
      (when (== i-outcome "accepted")
        (:= v-state "provider_accepted"))
      (when (== i-outcome "retry")
        (:= v-state "pending")
        (when (>= (:integer (:->> o-outbox "attempts")) 5)
          (:= v-state "failed"))
        (when (or (not= (:integer (:->> o-outbox "generation"))
                        (:integer (:->> o-account "generation")))
                  (== (:->> o-account "mode") "disabled"))
          (:= v-state "cancelled"))
        (when (<= (:bigint (:->> o-outbox "deadline")) (pg/time-us))
          (:= v-state "expired")))
      (let [o-finished (pg/t:update tmb/MessagingOutbox
                         {:set {:state v-state
                                :provider-message-id i-provider-message
                                :lease nil
                                :lease-until nil
                                :time-updated (pg/time-us)
                                :next-attempt-at (+ (pg/time-us)
                                                    (* (pg/coalesce i-delay 1) 1000000))}
                          :single true
                          :where {:id i-delivery}})
            o-audit (-/record-messaging-audit i-application
                                              i-account
                                              (|| "delivery_" v-state)
                                              (:uuid (:->> o-outbox "correlation_id")))]
        (when (== i-outcome "accepted")
          (let [o-message (pg/t:update tmb/MessagingMessage
                            {:set {:external-id i-provider-message :sent-at (pg/time-us)}
                             :single true
                             :where {:id (:uuid (:->> o-outbox "message_id"))}})]
            nil))
        (return o-finished)))))

;;
;; Chat Handler Context
;;

(defn.pg ret-messaging-history
  "Trusted adapters authorize the chat participant before calling this helper."
  [:uuid i-application :uuid i-account :uuid i-conversation]
  (let [o-account (-/ret-messaging-account i-application i-account)
        o-history (pg/t:select tmb/MessagingMessage
                    {:where {:account i-account :conversation i-conversation}
                     :order-by [:time-created :id]
                     :order-sort :desc
                     :limit 50})]
    (return (pg/coalesce o-history (:jsonb "[]")))))
