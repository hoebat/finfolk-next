(ns finfolkdb.fn.social.social-actions
  "Fenced external reads and crypto preparation. No provider HTTP runs in a transaction."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-system-seed :as seed]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.fn.social.social-manage :as social]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:uuid]}
  enqueue-social-action
  [:uuid i-command :text i-kind :jsonb o-op]
  (let [o-command (pg/t:get workflow/SocialCommand {:where {:id i-command}})
        o-event (pg/t:get workflow/SocialEvent {:where {:id (:uuid (:->> o-command "event_id"))}})
        o-account (pg/t:get accounts/SocialAccount
                    {:where {:id (:uuid (:->> o-command "account_id"))}})
        (:uuid v-id) (pg/uuid-generate-v4)]
    (when (or [o-command :is-null]
              [o-event :is-null]
              [o-account :is-null]
              (not= (:->> o-command "state") "waiting")
              (not (or (== i-kind "verify-account") (== i-kind "prepare-link"))))
      [:raise-exception "Invalid external social action"])
    (let [(:uuid v-audit) (social/create-social-audit "SocialAction" v-id o-op)
          o-action (pg/t:insert workflow/SocialAction
                     {:id v-id
                      :audit v-audit
                      :command i-command
                      :event (pg/id o-event)
                      :inbox (:uuid (:->> o-command "inbox_id"))
                      :account (pg/id o-account)
                      :generation (:integer (:->> o-event "generation"))
                      :account-generation (:integer (:->> o-account "generation"))
                      :source-id (:text i-command)
                      :kind (++ i-kind domain/EnumSocialActionKind)
                      :state "pending"
                      :deadline (least (:bigint (:->> o-event "deadline"))
                                       (+ (pg/time-us) 600000000))}
                     {:track o-op})
          (:uuid v-log) (social/record-social-audit "SocialAction" v-audit "queued" o-op)]
      (return v-id))))

(defn.pg finish-social-command-reply
  "Persist only public text or an encrypted sensitive payload; history contains a placeholder."
  [:uuid i-command :text i-body :text i-ciphertext :jsonb i-context :jsonb i-result :jsonb o-op]
  (let [o-command (pg/t:get workflow/SocialCommand {:where {:id i-command}})
        o-event (pg/t:get workflow/SocialEvent {:where {:id (:uuid (:->> o-command "event_id"))}})
        o-payload (:-> o-event "payload")
        (:uuid v-inbox) (:uuid (:->> o-command "inbox_id"))
        (:text v-body) (pg/case [i-ciphertext :is-not-null]
                         "[Private connection code]" true
                         i-body)
        (:uuid v-message) nil]
    (when (== (:->> o-event "channel") "message")
      (let [o-incoming (pg/t:get messaging/MessagingMessage
                         {:where {:id (:uuid (:->> o-event "message_id"))}})
            o-outgoing (pg/t:insert messaging/MessagingMessage
                         {:account v-inbox
                          :conversation (:uuid (:->> o-incoming "conversation_id"))
                          :direction "outbound"
                          :body v-body
                          :metadata (:jsonb "{}")})]
        (:= v-message (pg/id o-outgoing))))
    (let [o-delivery (pg/t:insert delivery/MessagingOutbox
                       {:account v-inbox
                        :event (pg/id o-event)
                        :command i-command
                        :channel (++ (:->> o-event "channel") domain/EnumSocialCommandContext)
                        :recipient (:->> o-payload "senderId")
                        :thread (pg/case (== (:->> o-event "channel") "message")
                                  (:->> o-payload "conversationId") true
                                  nil)
                        :comment (pg/case (== (:->> o-event "channel") "message")
                                   nil true
                                   (:->> o-payload "messageId"))
                        :message v-message
                        :body v-body
                        :body-ciphertext i-ciphertext
                        :cipher-context (pg/coalesce i-context (:jsonb "{}"))
                        :reply-kind (++ (pg/case [i-ciphertext :is-null]
                                          "text" true
                                          "connect_code")
                                        domain/EnumMessagingOutboxReplyKind)
                        :correlation-id (pg/uuid-generate-v4)
                        :generation (:integer (:->> o-event "generation"))
                        :deadline (least (:bigint (:->> o-event "deadline"))
                                         (pg/coalesce (:bigint (:->> i-result "expiresAt"))
                                                      (:bigint (:->> o-event "deadline"))))})
          o-finished (pg/t:update workflow/SocialCommand
                       {:where {:id i-command}
                        :set {:state "done" :result i-result :reply v-body}
                        :track o-op})
          o-finished-event (pg/t:update workflow/SocialEvent
                             {:where {:id (pg/id o-event)} :set {:status "completed"} :track o-op})]
      (return (pg/jsonb-build-object "commandId" i-command
                                     "status" "completed"
                                     "deliveryId" (pg/id o-delivery))))))

(defn.pg retire-social-code-deliveries
  [:uuid i-account]
  (let [o-proofs (pg/t:select workflow/SocialConnectionProof
                   {:where {:account i-account :status [:in '("pending" "verified")]}})
        o-proof nil]
    [:for o-proof :in :select (pg/jsonb-array-elements (pg/coalesce o-proofs (:jsonb "[]")))
     (loop []
       (let [o-cancelled (pg/t:update delivery/MessagingOutbox
                           {:where {:event (:uuid (:->> o-proof "event_id"))
                                    :state "pending"
                                    :reply-kind "connect_code"}
                            :set {:state "cancelled"
                                  :body-ciphertext nil
                                  :cipher-context (:jsonb "{}")
                                  :error-code "proof_replaced"}})
             o-uncertain (pg/t:update delivery/MessagingOutbox
                           {:where {:event (:uuid (:->> o-proof "event_id"))
                                    :state "sending"
                                    :reply-kind "connect_code"}
                            :set {:state "uncertain"
                                  :lease nil
                                  :lease-until nil
                                  :body-ciphertext nil
                                  :cipher-context (:jsonb "{}")
                                  :error-code "proof_replaced"}})]
         nil))]
    (return (:jsonb "{}"))))

(defn.pg expire-social-action
  [:jsonb o-action :text i-error :jsonb o-op]
  (let [o-expired (pg/t:update workflow/SocialAction
                    {:where {:id (pg/id o-action)}
                     :set {:state "expired" :lease nil :lease-until nil :error-code i-error}
                     :track o-op})
        o-command (pg/t:update workflow/SocialCommand
                    {:where {:id (:uuid (:->> o-action "command_id"))}
                     :set {:state "expired" :result (pg/jsonb-build-object "error" i-error)}
                     :track o-op})
        o-event (pg/t:update workflow/SocialEvent
                  {:where {:id (:uuid (:->> o-action "event_id"))}
                   :set {:status "expired" :error i-error}
                   :track o-op})
        (:uuid v-log) (social/record-social-audit "SocialAction" (:uuid (:->> o-action "audit_id"))
                                                  "expired" o-op)]
    (return (:jsonb "{}"))))

(defn.pg claim-social-action
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or (== (:->> o-inbox "mode") "disabled")
              (> (:bigint (:->> o-inbox "backoff_until")) (pg/time-us)))
      (return nil))
    (let [o-action (pg/t:get workflow/SocialAction
                     {:where {:inbox i-inbox :state "pending" :next-attempt-at [:lte (pg/time-us)]}
                      :order-by [:time-created :id]
                      :order-sort :asc
                      :for [:update :skip-locked]})]
      (when [o-action :is-null]
        (return nil))
      (let [o-account (pg/t:get accounts/SocialAccount
                        {:where {:id (:uuid (:->> o-action "account_id"))}})
            o-event (pg/t:get workflow/SocialEvent
                      {:where {:id (:uuid (:->> o-action "event_id"))}})
            o-purpose-command (pg/t:get workflow/SocialCommand {:where {:id (:uuid (:->> o-action "command_id"))}})
            (:uuid v-lease) (pg/uuid-generate-v4)]
        (when (or (not (pg/jsonb-exists (:-> o-inbox "enabled_commands") (:->> o-purpose-command "command")))
                  (<= (:bigint (:->> o-action "deadline")) (pg/time-us))
                  (not= (:integer (:->> o-action "generation"))
                        (:integer (:->> o-inbox "generation")))
                  (not= (:integer (:->> o-action "account_generation"))
                        (:integer (:->> o-account "generation")))
                  (and (== (:->> o-inbox "mode") "pilot")
                       (not (pg/jsonb-exists (:-> o-inbox "pilot_sender_ids")
                                             (:->> (:-> o-event "payload") "senderId")))))
          [:perform (-/expire-social-action o-action "action_expired" o-op)]
          (return nil))
        (let [o-claimed (pg/t:update workflow/SocialAction
                          {:where {:id (pg/id o-action)}
                           :set {:state "running"
                                 :lease v-lease
                                 :lease-until (+ (pg/time-us) 30000000)
                                 :attempts (+ (:integer (:->> o-action "attempts")) 1)}
                           :track o-op})
              (:uuid v-log) (social/record-social-audit "SocialAction" (:uuid (:->> o-action
                                                                                    "audit_id"))
                                                        "claimed" o-op)]
          (return
           (pg/jsonb-build-object
            "id" (pg/id o-action)
            "lease" v-lease
            "kind" (:->> o-action "kind")
            "deadline" (:-> o-action "deadline")
            "binding" (pg/jsonb-build-object "actionId" (pg/id o-action)
                                             "lease" v-lease
                                             "inboxId" i-inbox
                                             "eventId" (:-> o-action "event_id")
                                             "generation" (:-> o-action "generation")
                                             "accountGeneration" (:-> o-action
                                                                      "account_generation"))
            "request" (pg/jsonb-build-object
                       "provider" (:->> o-account "provider")
                       "namespace" (:->> o-account "namespace")
                       "externalId" (:->> o-account "external_id")
                       "conversationId" (:->> (:-> o-event "payload") "conversationId")
                       "codeLength" 8
                       "alphabet" "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
                       "prefix" (pg/case (== (:->> o-purpose-command "command") "claim") "Your FinFolk business claim code: " true "Your FinFolk connection code: ")
                       "suffix" (pg/case (== (:->> o-purpose-command "command") "claim") ". Sign in at finfolk.com.au/directory, open your business page and enter this claim code within 10 minutes." true ". Enter it in your FinFolk account within 10 minutes.")))))))))

(defn.pg complete-social-action
  [:uuid i-application :uuid i-inbox :uuid i-action :uuid i-lease :text i-outcome :jsonb i-result
   :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        o-initial (pg/t:get workflow/SocialAction {:where {:id i-action :inbox i-inbox}})
        o-account (pg/t:get accounts/SocialAccount
                    {:where {:id (:uuid (:->> o-initial "account_id"))} :for [:update]})
        o-action (pg/t:get workflow/SocialAction
                   {:where {:id i-action :inbox i-inbox} :for [:update]})
        o-purpose-command (pg/t:get workflow/SocialCommand {:where {:id (:uuid (:->> o-initial "command_id"))}})
        o-result (seed/as-jsonb i-result)]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or [o-action :is-null]
              [i-lease :is-null]
              (not= (:->> o-action "state") "running")
              (not= (:uuid (:->> o-action "lease")) i-lease)
              (<= (:bigint (:->> o-action "lease_until")) (pg/time-us))
              (<= (:bigint (:->> o-action "deadline")) (pg/time-us))
              (== (:->> o-inbox "mode") "disabled")
              (not (pg/jsonb-exists (:-> o-inbox "enabled_commands") (:->> o-purpose-command "command")))
              (not= (:integer (:->> o-action "generation")) (:integer (:->> o-inbox "generation")))
              (not= (:integer (:->> o-action "account_generation"))
                    (:integer (:->> o-account "generation"))))
      (return nil))
    (let [o-event (pg/t:get workflow/SocialEvent {:where {:id (:uuid (:->> o-action "event_id"))}})
          (:uuid v-command) (:uuid (:->> o-action "command_id"))
          o-binding (pg/jsonb-build-object "actionId" i-action
                                           "lease" i-lease
                                           "inboxId" i-inbox
                                           "eventId" (:-> o-action "event_id")
                                           "generation" (:-> o-action "generation")
                                           "accountGeneration" (:-> o-action "account_generation"))]
      (when (and (== (:->> o-inbox "mode") "pilot")
                 (not (pg/jsonb-exists (:-> o-inbox "pilot_sender_ids")
                                       (:->> (:-> o-event "payload") "senderId"))))
        (return nil))
      (when (or [i-outcome :is-null]
                (not (or (== i-outcome "success") (== i-outcome "retry") (== i-outcome "failed")))
                (not= (pg/coalesce (:-> o-result "binding") (:jsonb "{}")) o-binding))
        [:raise-exception "External action result does not match its claim"])
      (when (not= i-outcome "success")
        (let [(:boolean v-retry) (and (== i-outcome "retry")
                                      (< (:integer (:->> o-action "attempts")) 3))
              o-failed (pg/t:update workflow/SocialAction
                         {:where {:id i-action}
                          :set {:state (pg/case v-retry
                                         "pending" true
                                         "failed")
                                :lease nil
                                :lease-until nil
                                :error-code "external_effect_failed"
                                :next-attempt-at
                                (+ (pg/time-us) (* (:integer (:->> o-action "attempts")) 30000000))}
                          :track o-op})
              (:uuid v-log) (social/record-social-audit "SocialAction"
                                                        (:uuid (:->> o-action "audit_id"))
                                                        (pg/case v-retry
                                                          "retry" true
                                                          "failed")
                                                        o-op)]
          (when (not v-retry)
            [:perform
             (-/finish-social-command-reply
              v-command
              (pg/case (== (:->> o-purpose-command "command") "claim") "Unable to verify your Instagram account. Try /claim again later." true "Unable to verify your social account. Try /connect again later.")
              nil
              nil
              (:jsonb "{\"error\":\"external_effect_failed\"}")
              o-op)])
          (return (pg/jsonb-build-object "id" i-action
                                         "status" (pg/case v-retry
                                                    "pending" true
                                                    "failed")))))
      (cond
        (== (:->> o-action "kind") "verify-account")
        (do (when
              (or (not= (- (- (- (- (- o-result "binding") "provider") "namespace") "externalId")
                           "eligible")
                        (:jsonb "{}"))
                  (not= (pg/coalesce (:->> o-result "provider") "") (:->> o-account "provider"))
                  (not= (pg/coalesce (:->> o-result "namespace") "") (:->> o-account "namespace"))
                  (not= (pg/coalesce (:->> o-result "externalId") "")
                        (:->> o-account "external_id"))
                  (not= (pg/coalesce (pg/jsonb-typeof (:-> o-result "eligible")) "null") "boolean"))
              [:raise-exception "Provider evidence does not match the requested identity"])
            (if (:boolean (:->> o-result "eligible"))
              (let [(:uuid v-next) (-/enqueue-social-action v-command "prepare-link" o-op)] nil)
              [:perform
               (-/finish-social-command-reply v-command
                                              (pg/case (== (:->> o-inbox "provider") "instagram")
                                                (pg/case (== (:->> o-purpose-command "command") "claim") "Follow @finfolk.com.au, then send /claim again to receive your business claim code." true "Follow @finfolk.com.au, then send /connect again to receive your connection code.")
                                                true "This social account is not eligible to connect.")
                                              nil
                                              nil
                                              (:jsonb "{\"error\":\"account_ineligible\"}")
                                              o-op)]))
        (== (:->> o-action "kind") "prepare-link")
        (let [(:text v-code) (:->> o-result "code")
              (:text v-hash) (:->> o-result "tokenHash")
              (:text v-ciphertext) (:->> o-result "ciphertext")]
          (when (or (not= (- (- (- (- o-result "binding") "code") "tokenHash") "ciphertext")
                          (:jsonb "{}"))
                    [v-code :is-null]
                    (not= (pg/jsonb-typeof (:-> o-result "code")) "string")
                    (not (#{"regexp_like"} v-code "^[A-Z0-9]{8}$"))
                    [v-hash :is-null]
                    (not= (pg/jsonb-typeof (:-> o-result "tokenHash")) "string")
                    (not= v-hash (#{"encode"} (#{"digest"} v-code "sha256") "hex"))
                    [v-ciphertext :is-null]
                    (not= (pg/jsonb-typeof (:-> o-result "ciphertext")) "string")
                    (< (pg/length v-ciphertext) 40)
                    (> (pg/length v-ciphertext) 8192))
            [:raise-exception "Invalid connection code preparation"])
          [:perform (-/retire-social-code-deliveries (pg/id o-account))]
          (let [o-old (pg/t:update workflow/SocialConnectionProof
                        {:where {:account (pg/id o-account) :status [:in '("pending" "verified")]}
                         :set {:status "revoked"}
                         :track o-op})
                o-proof (pg/t:insert workflow/SocialConnectionProof
                          {:account (pg/id o-account)
                           :event (pg/id o-event)
                           :inbox i-inbox
                           :kind "message"
                           :provider-data (pg/jsonb-build-object "purpose" (:->> o-purpose-command "command"))
                           :token-hash v-hash
                           :generation (:integer (:->> o-account "generation"))
                           :status "verified"
                           :verified-at (pg/time-us)
                           :expires-at (+ (pg/time-us) 600000000)}
                          {:track o-op})]
            [:perform
             (-/finish-social-command-reply v-command
                                            nil
                                            v-ciphertext
                                            o-binding
                                            (pg/jsonb-build-object "proofId" (pg/id o-proof)
                                                                   "expiresAt" (:-> o-proof
                                                                                    "expires_at"))
                                            o-op)]))
        :else [:raise-exception "Unsupported external action kind"])
      (let [o-finished (pg/t:update workflow/SocialAction
                         {:where {:id i-action}
                          :set {:state "completed"
                                :lease nil
                                :lease-until nil
                                :result (:jsonb "{\"ok\":true}")
                                :error-code nil}
                          :track o-op})
            (:uuid v-log) (social/record-social-audit "SocialAction" (:uuid (:->> o-action
                                                                                  "audit_id"))
                                                      "completed" o-op)]
        (return (pg/jsonb-build-object "id" i-action "status" "completed"))))))
