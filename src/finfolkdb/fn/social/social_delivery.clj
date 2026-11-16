(ns finfolkdb.fn.social.social-delivery
  "Shared DM/comment delivery and bounded recovery. Sends happen after the claim commits."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.fn.social.social-policy :as policy]
             [finfolkdb.fn.social.social-actions :as actions]
             [finfolkdb.fn.social.social-manage :as social]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:props [:immutable :parallel-safe]}
  social-delivery-result
  [:jsonb o-delivery]
  (return (pg/jsonb-build-object "id" (pg/id o-delivery)
                                 "state" (:->> o-delivery "state")
                                 "attempts" (:-> o-delivery "attempts")
                                 "nextAttemptAt" (:-> o-delivery "next_attempt_at")
                                 "providerMessageId" (:->> o-delivery "provider_message_id"))))

(defn.pg record-social-delivery-audit
  [:uuid i-application :jsonb o-delivery :text i-event]
  (let [o-audit (pg/t:insert messaging/MessagingAudit
                  {:account (:uuid (:->> o-delivery "account_id"))
                   :actor (:text i-application)
                   :event i-event
                   :correlation-id (:uuid (:->> o-delivery "correlation_id"))})]
    (return (:jsonb "{}"))))

(defn.pg ^{:- [:text]}
  social-delivery-policy-error
  [:jsonb o-inbox :jsonb o-event :jsonb o-command :jsonb o-delivery]
  (let [(:text v-error) (policy/social-work-policy-error o-inbox o-event o-command)
        o-payload (:-> o-event "payload")]
    (when [v-error :is-not-null]
      (return v-error))
    (when (<= (:bigint (:->> o-delivery "deadline")) (pg/time-us))
      (return "deadline_expired"))
    (when
      (or (not= (:integer (:->> o-delivery "generation")) (:integer (:->> o-inbox "generation")))
          (not= (:->> o-delivery "channel") (:->> o-event "channel"))
          (not= (pg/coalesce (:->> o-delivery "recipient") "") (:->> o-payload "senderId"))
          (and (== (:->> o-delivery "channel") "message")
               (not= (pg/coalesce (:->> o-delivery "thread") "") (:->> o-payload "conversationId")))
          (and (not= (:->> o-delivery "channel") "message")
               (not= (pg/coalesce (:->> o-delivery "comment") "") (:->> o-payload "messageId"))))
      (return "destination_changed"))
    (when (== (:->> o-delivery "reply_kind") "connect_code")
      (let [o-proof (pg/t:get workflow/SocialConnectionProof
                      {:where {:id (:uuid (:->> (:-> o-command "result") "proofId"))}})
            o-account (pg/t:get accounts/SocialAccount
                        {:where {:id (:uuid (:->> o-event "account_id"))}})]
        (when (or [o-proof :is-null]
                  (not= (:->> o-proof "status") "verified")
                  (not= (:uuid (:->> o-proof "event_id")) (pg/id o-event))
                  (not= (:uuid (:->> o-proof "account_id")) (pg/id o-account))
                  (not= (:integer (:->> o-proof "generation"))
                        (:integer (:->> o-account "generation")))
                  (<= (:bigint (:->> o-proof "expires_at")) (pg/time-us))
                  [(:->> o-delivery "body_ciphertext") :is-null])
          (return "proof_invalid"))))
    (when (and (== (:->> o-delivery "state") "pending")
               (>= (:integer (:->> o-delivery "attempts")) 5))
      (return "attempts_exhausted"))
    (return nil)))

(defn.pg claim-social-delivery
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or (== (:->> o-inbox "mode") "disabled")
              (> (:bigint (:->> o-inbox "backoff_until")) (pg/time-us)))
      (return nil))
    (let [o-ready (pg/t:select delivery/MessagingOutbox
                    {:where {:account i-inbox :state "pending" :next-attempt-at [:lte (pg/time-us)]}
                     :order-by [:time-created :id]
                     :order-sort :asc
                     :limit 100
                     :for [:update :skip-locked]})
          o-delivery nil]
      [:for o-delivery :in :select (pg/jsonb-array-elements (pg/coalesce o-ready (:jsonb "[]")))
       (loop []
         ;; Until native receipt retirement, old rows belong exclusively to the old protocol.
         (when [(:->> o-delivery "command_id") :is-not-null]
           (let [o-command (pg/t:get workflow/SocialCommand
                             {:where {:id (:uuid (:->> o-delivery "command_id"))}})
                 o-event (pg/t:get workflow/SocialEvent
                           {:where {:id (:uuid (:->> o-delivery "event_id"))}})
                 (:text v-error)
                 (-/social-delivery-policy-error o-inbox o-event o-command o-delivery)]
             (if [v-error :is-not-null]
               (let [o-expired (pg/t:update delivery/MessagingOutbox
                                 {:where {:id (pg/id o-delivery)}
                                  :single true
                                  :set {:state (++ (pg/case (== v-error "deadline_expired")
                                                     "expired" (== v-error "attempts_exhausted")
                                                     "failed" true
                                                     "cancelled")
                                                   domain/EnumMessagingOutboxStatus)
                                        :error-code v-error
                                        :body-ciphertext nil
                                        :cipher-context (:jsonb "{}")
                                        :time-updated (pg/time-us)}})]
                 nil)
               (let [(:uuid v-lease) (pg/uuid-generate-v4)
                     o-claimed (pg/t:update delivery/MessagingOutbox
                                 {:where {:id (pg/id o-delivery)}
                                  :single true
                                  :set {:state "sending"
                                        :lease v-lease
                                        :lease-until (+ (pg/time-us) 60000000)
                                        :attempts (+ (:integer (:->> o-delivery "attempts")) 1)
                                        :time-updated (pg/time-us)}})]
                 [:perform
                  (-/record-social-delivery-audit i-application o-claimed "delivery_claimed")]
                 (return
                  (pg/jsonb-build-object
                   "id" (pg/id o-claimed)
                   "lease" v-lease
                   "deadline" (:-> o-claimed "deadline")
                   "provider" (:->> o-inbox "provider")
                   "accountId" (:->> o-inbox "account_id")
                   "destination" (pg/jsonb-build-object "channel" (:->> o-claimed "channel")
                                                        "recipientId" (:->> o-claimed "recipient")
                                                        "conversationId"
                                                        (pg/case (== (:->> o-claimed "channel")
                                                                     "message")
                                                          (:->> o-claimed "thread") true
                                                          nil)
                                                        "commentId" (:->> o-claimed "comment"))
                   "payload" (pg/jsonb-build-object "body" (:->> o-claimed "body")
                                                    "ciphertext" (:->> o-claimed "body_ciphertext")
                                                    "cipherContext" (:-> o-claimed "cipher_context")
                                                    "replyKind" (:->> o-claimed
                                                                      "reply_kind")))))))))]
      (return nil))))

(defn.pg complete-social-delivery
  "Only a known rejection can retry. Transport ambiguity and abandoned sends stay uncertain."
  [:uuid i-application :uuid i-inbox :uuid i-delivery :uuid i-lease :text i-outcome :text
   i-provider-id :integer i-retry-after :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        o-delivery (pg/t:get delivery/MessagingOutbox
                     {:where {:id i-delivery :account i-inbox} :for [:update]})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or [o-delivery :is-null]
              [(:->> o-delivery "command_id") :is-null]
              [i-lease :is-null]
              (not= (:->> o-delivery "state") "sending")
              (not= (:uuid (:->> o-delivery "lease")) i-lease)
              (<= (:bigint (:->> o-delivery "lease_until")) (pg/time-us)))
      (return nil))
    (when (or [i-outcome :is-null]
              (not (or (== i-outcome "accepted")
                       (== i-outcome "retry")
                       (== i-outcome "failed")
                       (== i-outcome "uncertain")))
              (and (== i-outcome "accepted")
                   (or (== (pg/coalesce i-provider-id "") "") (> (pg/length i-provider-id) 500)))
              (and (== i-outcome "retry")
                   [i-retry-after :is-not-null]
                   (or (< i-retry-after 1) (> i-retry-after 3600))))
      [:raise-exception "Invalid social delivery outcome"])
    (let [(:text v-state) (pg/case (== i-outcome "accepted")
                            "provider_accepted" true
                            i-outcome)
          (:text v-error) nil
          (:bigint v-next) (:bigint (:->> o-delivery "next_attempt_at"))]
      (when (== i-outcome "retry")
        (let [o-command (pg/t:get workflow/SocialCommand
                          {:where {:id (:uuid (:->> o-delivery "command_id"))}})
              o-event (pg/t:get workflow/SocialEvent
                        {:where {:id (:uuid (:->> o-delivery "event_id"))}})]
          (:= v-error (-/social-delivery-policy-error o-inbox o-event o-command o-delivery))
          (when (and [v-error :is-null] (>= (:integer (:->> o-delivery "attempts")) 5))
            (:= v-error "attempts_exhausted"))
          (:= v-state
              (pg/case (== v-error "deadline_expired")
                "expired" (== v-error "attempts_exhausted")
                "failed" [v-error :is-not-null]
                "cancelled" true
                "pending"))
          (:= v-next
              (+ (pg/time-us)
                 (* 1000000
                    (greatest (pg/coalesce i-retry-after 1)
                              (* 30
                                 (:integer (#{"power"}
                                            2
                                            (- (:integer (:->> o-delivery "attempts")) 1))))))))))
      (let [o-finished (pg/t:update delivery/MessagingOutbox
                         {:where {:id i-delivery}
                          :single true
                          :set {:state (++ v-state domain/EnumMessagingOutboxStatus)
                                :lease nil
                                :lease-until nil
                                :provider-message-id (pg/case (== i-outcome "accepted")
                                                       i-provider-id true
                                                       nil)
                                :error-code v-error
                                :time-updated (pg/time-us)
                                :next-attempt-at v-next
                                :body-ciphertext (pg/case (== v-state "pending")
                                                   (:->> o-delivery "body_ciphertext") true
                                                   nil)
                                :cipher-context (pg/case (== v-state "pending")
                                                  (:-> o-delivery "cipher_context") true
                                                  (:jsonb "{}"))}})]
        (when (and (== i-outcome "accepted") [(:->> o-delivery "message_id") :is-not-null])
          (let [o-message (pg/t:update messaging/MessagingMessage
                            {:where {:id (:uuid (:->> o-delivery "message_id")) :account i-inbox}
                             :set {:external-id i-provider-id :sent-at (pg/time-us)}})]
            nil))
        [:perform
         (-/record-social-delivery-audit i-application
                                         o-finished
                                         (#{"concat"} "delivery_" v-state))]
        (return (-/social-delivery-result o-finished))))))

(defn.pg reconcile-social-work
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (let [o-actions (pg/t:select workflow/SocialAction
                      {:where {:inbox i-inbox
                               :state [:in '("pending" "running")]
                               :id [:gt
                                    (pg/coalesce (:uuid (:->> o-inbox "action_checkpoint"))
                                                 (:uuid "00000000-0000-0000-0000-000000000000"))]}
                       :order-by [:id]
                       :order-sort :asc
                       :limit 100
                       :for [:update :skip-locked]})
          o-action nil
          (:uuid v-action-cursor) nil
          (:uuid v-delivery-cursor) nil
          (:uuid v-event-cursor) nil
          (:uuid v-proof-cursor) nil
          (:integer v-action-read) (pg/jsonb-array-length (pg/coalesce o-actions (:jsonb "[]")))
          (:integer v-delivery-read) 0
          (:integer v-event-read) 0
          (:integer v-proof-read) 0
          (:integer v-actions) 0
          (:integer v-proofs) 0
          (:integer v-deliveries) 0
          (:integer v-events) 0]
      [:for o-action :in :select (pg/jsonb-array-elements (pg/coalesce o-actions (:jsonb "[]")))
       (loop []
         (when (== v-action-read 100)
           (:= v-action-cursor (pg/id o-action)))
         (let [o-command (pg/t:get workflow/SocialCommand
                           {:where {:id (:uuid (:->> o-action "command_id"))}})
               o-event (pg/t:get workflow/SocialEvent
                         {:where {:id (:uuid (:->> o-action "event_id"))}})
               (:text v-error) (policy/social-work-policy-error o-inbox o-event o-command)]
           (when (<= (:bigint (:->> o-action "deadline")) (pg/time-us))
             (:= v-error "deadline_expired"))
           (when (or (not= (:integer (:->> o-action "generation"))
                           (:integer (:->> o-event "generation")))
                     (not= (:integer (:->> o-action "account_generation"))
                           (:integer (:->> o-event "account_generation"))))
             (:= v-error "identity_changed"))
           (cond [v-error :is-not-null] (do [:perform
                                             (actions/expire-social-action o-action v-error o-op)]
                                            (:= v-actions (+ v-actions 1)))
                 (and (== (:->> o-action "state") "running")
                      (<= (:bigint (:->> o-action "lease_until")) (pg/time-us)))
                 (let [(:boolean v-retry) (< (:integer (:->> o-action "attempts")) 3)
                       o-recovered (pg/t:update workflow/SocialAction
                                     {:where {:id (pg/id o-action)}
                                      :set {:state (pg/case v-retry
                                                     "pending" true
                                                     "failed")
                                            :lease nil
                                            :lease-until nil
                                            :error-code "lease_expired"
                                            :next-attempt-at
                                            (+ (pg/time-us)
                                               (* 30000000 (:integer (:->> o-action "attempts"))))}
                                      :track o-op})
                       (:uuid v-log) (social/record-social-audit "SocialAction"
                                                                 (:uuid (:->> o-action "audit_id"))
                                                                 "lease_expired" o-op)]
                   (when (not v-retry)
                     [:perform
                      (actions/finish-social-command-reply
                       (pg/id o-command)
                       "Unable to verify your social account. Try /connect again later."
                       nil
                       nil
                       (:jsonb "{\"error\":\"external_effect_failed\"}")
                       o-op)])
                   (:= v-actions (+ v-actions 1))))))]
      (let [o-pending (pg/t:select delivery/MessagingOutbox
                        {:where {:account i-inbox
                                 :state [:in '("pending" "sending")]
                                 :id [:gt
                                      (pg/coalesce (:uuid (:->> o-inbox "delivery_checkpoint"))
                                                   (:uuid "00000000-0000-0000-0000-000000000000"))]}
                         :order-by [:id]
                         :order-sort :asc
                         :limit 100
                         :for [:update :skip-locked]})
            o-delivery nil]
        (:= v-delivery-read (pg/jsonb-array-length (pg/coalesce o-pending (:jsonb "[]"))))
        [:for o-delivery :in :select (pg/jsonb-array-elements (pg/coalesce o-pending (:jsonb "[]")))
         (loop []
           (when (== v-delivery-read 100)
             (:= v-delivery-cursor (pg/id o-delivery)))
           (when [(:->> o-delivery "command_id") :is-not-null]
             (let [o-command (pg/t:get workflow/SocialCommand
                               {:where {:id (:uuid (:->> o-delivery "command_id"))}})
                   o-event (pg/t:get workflow/SocialEvent
                             {:where {:id (:uuid (:->> o-delivery "event_id"))}})
                   (:text v-error)
                   (-/social-delivery-policy-error o-inbox o-event o-command o-delivery)]
               (when (and (== (:->> o-delivery "state") "sending")
                          (<= (:bigint (:->> o-delivery "lease_until")) (pg/time-us)))
                 (:= v-error "lease_expired"))
               (when [v-error :is-not-null]
                 (let [(:text v-state) (pg/case (== (:->> o-delivery "state") "sending")
                                         "uncertain" (== v-error "deadline_expired")
                                         "expired" (== v-error "attempts_exhausted")
                                         "failed" true
                                         "cancelled")
                       o-expired (pg/t:update delivery/MessagingOutbox
                                   {:where {:id (pg/id o-delivery)}
                                    :single true
                                    :set {:state (++ v-state domain/EnumMessagingOutboxStatus)
                                          :lease nil
                                          :lease-until nil
                                          :error-code v-error
                                          :body-ciphertext nil
                                          :cipher-context (:jsonb "{}")
                                          :time-updated (pg/time-us)}})]
                   [:perform
                    (-/record-social-delivery-audit i-application
                                                    o-expired
                                                    (#{"concat"} "delivery_" v-state))]
                   (:= v-deliveries (+ v-deliveries 1)))))))])
      (let [o-pending (pg/t:select workflow/SocialEvent
                        {:where {:inbox i-inbox
                                 :status [:in '("queued" "waiting")]
                                 :id [:gt
                                      (pg/coalesce (:uuid (:->> o-inbox "event_checkpoint"))
                                                   (:uuid "00000000-0000-0000-0000-000000000000"))]}
                         :order-by [:id]
                         :order-sort :asc
                         :limit 100
                         :for [:update :skip-locked]})
            o-event nil]
        (:= v-event-read (pg/jsonb-array-length (pg/coalesce o-pending (:jsonb "[]"))))
        [:for o-event :in :select (pg/jsonb-array-elements (pg/coalesce o-pending (:jsonb "[]")))
         (loop []
           (when (== v-event-read 100)
             (:= v-event-cursor (pg/id o-event)))
           (let [o-command (pg/t:get workflow/SocialCommand {:where {:event (pg/id o-event)}})
                 (:text v-error) (policy/social-work-policy-error o-inbox o-event o-command)]
             (when [v-error :is-not-null]
               (let [o-expired (pg/t:update workflow/SocialEvent
                                 {:where {:id (pg/id o-event)}
                                  :set {:status "expired" :error v-error}
                                  :track o-op})
                     o-expired-command (pg/t:update workflow/SocialCommand
                                         {:where {:event (pg/id o-event)}
                                          :set {:state "expired"
                                                :result (pg/jsonb-build-object "error" v-error)}
                                          :track o-op})]
                 (:= v-events (+ v-events 1))))))])
      (let [o-proofs (pg/t:select workflow/SocialConnectionProof
                       {:where {:inbox i-inbox
                                :status [:in '("pending" "verified")]
                                :id [:gt
                                     (pg/coalesce (:uuid (:->> o-inbox "proof_checkpoint"))
                                                  (:uuid "00000000-0000-0000-0000-000000000000"))]}
                        :order-by [:id]
                        :order-sort :asc
                        :limit 100
                        :for [:update :skip-locked]})
            o-proof nil]
        (:= v-proof-read (pg/jsonb-array-length (pg/coalesce o-proofs (:jsonb "[]"))))
        [:for o-proof :in :select (pg/jsonb-array-elements (pg/coalesce o-proofs (:jsonb "[]")))
         (loop []
           (when (== v-proof-read 100)
             (:= v-proof-cursor (pg/id o-proof)))
           (let [o-event (pg/t:get workflow/SocialEvent
                           {:where {:id (:uuid (:->> o-proof "event_id"))}})
                 o-account (pg/t:get accounts/SocialAccount
                             {:where {:id (:uuid (:->> o-proof "account_id"))}})
                 (:text v-status) nil]
             (when (<= (:bigint (:->> o-proof "expires_at")) (pg/time-us))
               (:= v-status "expired"))
             (when (or (not= (:integer (:->> o-event "generation"))
                             (:integer (:->> o-inbox "generation")))
                       (not= (:integer (:->> o-proof "generation"))
                             (:integer (:->> o-account "generation"))))
               (:= v-status "revoked"))
             (when [v-status :is-not-null]
               (let [o-expired (pg/t:update workflow/SocialConnectionProof
                                 {:where {:id (pg/id o-proof)}
                                  :set {:status (++ v-status domain/EnumSocialProofStatus)}
                                  :track o-op})]
                 (:= v-proofs (+ v-proofs 1))))))])
      (let [o-checkpoint (pg/t:update messaging/MessagingAccount
                           {:where {:id i-inbox}
                            :set {:action-checkpoint v-action-cursor
                                  :delivery-checkpoint v-delivery-cursor
                                  :event-checkpoint v-event-cursor
                                  :proof-checkpoint v-proof-cursor}
                            :track o-op})]
        (return (pg/jsonb-build-object "actions" v-actions
                                       "deliveries" v-deliveries
                                       "events" v-events
                                       "proofs" v-proofs
                                       "scanned"
                                       (+ v-action-read v-delivery-read v-event-read v-proof-read)
                                       "more" (or (== v-action-read 100)
                                                  (== v-delivery-read 100)
                                                  (== v-event-read 100)
                                                  (== v-proof-read 100))))))))
