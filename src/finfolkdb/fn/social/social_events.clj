(ns finfolkdb.fn.social.social-events
  "Canonical normalized event ingestion and transactional command execution."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-system-seed :as seed]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.fn.social.social-actions :as actions]
             [finfolkdb.fn.social.social-connections :as connections]
             [finfolkdb.fn.social.social-policy :as policy]
             [finfolkdb.fn.social.social-commands :as commands]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg receive-social-event
  [:uuid i-application :uuid i-inbox :jsonb i-envelope :jsonb o-op]
  (let [o-input (seed/as-jsonb i-envelope)
        o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        (:text v-provider) (:->> o-inbox "provider")
        (:text v-channel) (:->> o-input "channel")
        (:text v-sender) (:->> o-input "senderId")
        (:text v-message) (:->> o-input "messageId")
        (:text v-thread) (:->> o-input "conversationId")
        (:text v-body) (:->> o-input "body")
        (:bigint v-sent) (:bigint (:->> o-input "sentAt"))
        (:bigint v-deadline) (:bigint (:->> o-input "deadline"))
        (:text v-namespace) nil
        (:text v-key) nil
        (:text v-fingerprint) nil]
    (when (or [o-inbox :is-null] (== v-provider "app"))
      [:raise-exception "External social inbox is outside application scope"])
    (when (and (== (:->> o-inbox "provider_scope") "tiktok-comments")
               (or (not= v-provider "tiktok") (not= v-channel "mention")
                   (not (pg/coalesce (pg/jsonb-exists (:jsonb "[\"owned\",\"mention\"]") (:->> o-input "commentOrigin")) false))
                   (not (pg/coalesce (#{"regexp_like"} (:->> o-input "mediaId") "^[0-9]{1,40}$") false))
                   (not (pg/coalesce (#{"regexp_like"} v-message "^[0-9]{1,40}$") false))))
      [:raise-exception "TikTok comments require a verified comment and media target"])
    (when (or (pg/jsonb-exists o-input "application")
              (pg/jsonb-exists o-input "inbox")
              (pg/jsonb-exists o-input "namespace")
              (pg/jsonb-exists o-input "userId")
              (pg/jsonb-exists o-input "ownerId")
              (pg/jsonb-exists o-input "handler")
              [v-channel :is-null]
              (not (or (== v-channel "message") (== v-channel "mention") (== v-channel "owned")))
              (not= (pg/jsonb-typeof (:-> o-input "senderId")) "string")
              (== (pg/coalesce v-sender "") "")
              (> (pg/length v-sender) 500)
              (not= (pg/jsonb-typeof (:-> o-input "messageId")) "string")
              (== (pg/coalesce v-message "") "")
              (> (pg/length v-message) 500)
              (not= (pg/jsonb-typeof (:-> o-input "body")) "string")
              (> (pg/length v-body) 2000)
              (and (== v-channel "message")
                   (or (not= (pg/jsonb-typeof (:-> o-input "conversationId")) "string")
                       (== (pg/coalesce v-thread "") "")
                       (> (pg/length v-thread) 500)))
              [v-sent :is-null]
              [v-deadline :is-null]
              (<= v-sent 0)
              (> v-sent (+ (pg/time-us) 300000000))
              (<= v-deadline v-sent)
              (> v-deadline (+ v-sent 604800000000)))
      [:raise-exception "Invalid normalized social event"])
    (:= v-namespace
        (:text (pg/jsonb-build-array v-provider
                                     i-application
                                     i-inbox
                                     (pg/case (== v-channel "message")
                                       "message" true
                                       "comment"))))
    (:= v-key
        (#{"concat"}
         (pg/case (== v-channel "message")
           "message:" true
           "comment:")
         v-message))
    (:= v-fingerprint (#{"encode"} (#{"digest"} (:text (- o-input "eventId")) "sha256") "hex"))
    (let [o-existing (pg/t:get workflow/SocialEvent
                       {:where {:provider (++ v-provider domain/EnumSocialProvider)
                                :namespace v-namespace
                                :key v-key}})]
      (when [o-existing :is-not-null]
        (when (not= (:->> o-existing "fingerprint") v-fingerprint)
          [:raise-exception "Conflicting duplicate social event"])
        (return (pg/jsonb-build-object "id" (pg/id o-existing) "duplicate" true)))
      (let [(:uuid v-account) (social/insert-social-account
                               v-provider
                               (:text (pg/jsonb-build-array v-provider i-application i-inbox))
                               v-sender
                               ""
                               ""
                               (:jsonb "{}")
                               o-op)
            o-account (pg/t:get accounts/SocialAccount {:where {:id v-account}})
            o-parsed (commands/parse-social-command v-channel v-body)
            o-payload (|| (- (- o-input "body") "eventId")
                          (pg/jsonb-build-object "parsed" o-parsed
                            "bodyHash" (#{"encode"} (#{"digest"} v-body "sha256") "hex")))
            (:uuid v-message-id) nil]
        (when (== (:->> o-parsed "command") "none")
          (:= o-payload (|| o-payload (pg/jsonb-build-object "body" v-body))))
        (when (== v-channel "message")
          (let [o-identity (pg/t:get messaging/MessagingIdentity
                             {:where {:account i-inbox :external-id v-sender}})]
            (when [o-identity :is-null]
              (let [o-new (pg/t:insert messaging/MessagingIdentity
                            {:account i-inbox :external-id v-sender :social-account v-account})]
                (:= o-identity o-new)))
            (when (or [(:->> o-identity "social_account_id") :is-null]
                      (not= (:uuid (:->> o-identity "social_account_id")) v-account))
              [:raise-exception "Conflicting social participant binding"])
            (let [o-thread (pg/t:get messaging/MessagingConversation
                             {:where {:account i-inbox :external-id v-thread}})]
              (when [o-thread :is-null]
                (let [o-new
                      (pg/t:insert messaging/MessagingConversation
                        {:account i-inbox :participant (pg/id o-identity) :external-id v-thread})]
                  (:= o-thread o-new)))
              (when (not= (:uuid (:->> o-thread "participant_id")) (pg/id o-identity))
                [:raise-exception "Conversation participant mismatch"])
              (let [o-message (pg/t:insert messaging/MessagingMessage
                                {:account i-inbox
                                 :conversation (pg/id o-thread)
                                 :direction "inbound"
                                 :external-id v-message
                                 :body v-body
                                 :metadata (:jsonb "{}")
                                 :sent-at v-sent})]
                (:= v-message-id (pg/id o-message))))))
        (let [o-event (pg/t:insert workflow/SocialEvent
                        {:provider (++ v-provider domain/EnumSocialProvider)
                         :namespace v-namespace
                         :key v-key
                         :account v-account
                         :inbox i-inbox
                         :message v-message-id
                         :channel (++ v-channel domain/EnumSocialCommandContext)
                         :generation (:integer (:->> o-inbox "generation"))
                         :account-generation (:integer (:->> o-account "generation"))
                         :fingerprint v-fingerprint
                         :sent-at v-sent
                         :deadline v-deadline
                         :payload o-payload}
                        {:track o-op})]
          (return (pg/jsonb-build-object "id" (pg/id o-event) "duplicate" false)))))))

(defn.pg ^{:- [:boolean]}
  reserve-social-rate
  [:text i-provider :text i-namespace :text i-sender :text i-purpose :integer i-window :integer
   i-limit :jsonb o-op]
  (let [o-rate (pg/t:get workflow/SocialRateLimit
                 {:where {:provider (++ i-provider domain/EnumSocialProvider)
                          :namespace i-namespace
                          :purpose i-purpose
                          :bucket i-sender}
                  :for [:update]})]
    (when [o-rate :is-null]
      (let [o-new (pg/t:insert workflow/SocialRateLimit
                    {:provider (++ i-provider domain/EnumSocialProvider)
                     :namespace i-namespace
                     :purpose i-purpose
                     :bucket i-sender
                     :count 1
                     :resets-at (+ (pg/time-us) (* (:bigint i-window) 1000000))}
                    {:track o-op})]
        (return true)))
    (let [(:integer v-count) (+ (:integer (:->> o-rate "count")) 1)
          (:bigint v-reset) (:bigint (:->> o-rate "resets_at"))]
      (when (<= v-reset (pg/time-us))
        (:= v-count 1)
        (:= v-reset (+ (pg/time-us) (* (:bigint i-window) 1000000))))
      (let [o-saved
            (pg/t:update workflow/SocialRateLimit
              {:where {:id (pg/id o-rate)} :set {:count v-count :resets-at v-reset} :track o-op})]
        (return (<= v-count i-limit))))))

(defn.pg ^{:- [:boolean]}
  reserve-social-command-rate
  [:text i-provider :text i-namespace :text i-sender :jsonb o-op]
  (return (-/reserve-social-rate i-provider i-namespace i-sender "command" 60 30 o-op)))

(defn.pg process-social-event
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (when (or (== (:->> o-inbox "mode") "disabled")
              (> (:bigint (:->> o-inbox "backoff_until")) (pg/time-us)))
      (return nil))
    (let [o-event (pg/t:get workflow/SocialEvent
                    {:where {:inbox i-inbox :status "queued"}
                     :order-by [:time-created :id]
                     :order-sort :asc
                     :for [:update :skip-locked]})]
      (when [o-event :is-null]
        (return nil))
      (let [(:uuid v-event) (pg/id o-event)
            (:text v-identity-namespace)
            (:text (pg/jsonb-build-array (:->> o-inbox "provider") i-application i-inbox))
            o-payload (:-> o-event "payload")
            o-parsed (:-> (:-> o-event "payload") "parsed")
            (:text v-channel) (:->> o-event "channel")
            (:text v-name) (:->> (:-> o-payload "parsed") "command")
            (:text v-status) "completed"
            (:text v-state) "done"
            (:text v-reply) nil
            o-result (:jsonb "{}")
            o-connection nil
            (:uuid v-owner) nil
            o-command nil]
        (let [(:text v-rollout) (policy/social-rollout-error o-inbox o-event)]
          (when [v-rollout :is-not-null]
            (let [o-expired (pg/t:update workflow/SocialEvent
                              {:where {:id v-event} :set {:status "expired" :error v-rollout} :track o-op})]
              (return (pg/jsonb-build-object "id" v-event "status" "expired")))))
        (when (== v-name "none")
          (let [o-ignored (pg/t:update workflow/SocialEvent
                            {:where {:id v-event} :set {:status "completed"} :track o-op})]
            (return (pg/jsonb-build-object "id" v-event "status" "ignored"))))
        (when (or (== v-name "claim") (== v-name "connect")
                  (and (== v-name "status") (== v-channel "message"))
                  (== v-name "whoami")
                  (== v-name "disconnect"))
          (let [o-account (pg/t:get accounts/SocialAccount
                            {:where {:id (:uuid (:->> o-event "account_id"))} :for [:update]})
                o-current (pg/t:get accounts/SocialConnection
                            {:where {:account (:uuid (:->> o-event "account_id")) :status "active"}
                             :for [:share]})]
            (when (not= (:integer (:->> o-event "account_generation"))
                        (:integer (:->> o-account "generation")))
              (let [o-expired (pg/t:update workflow/SocialEvent
                                {:where {:id v-event} :set {:status "expired"} :track o-op})]
                (return (pg/jsonb-build-object "id" v-event "status" "expired"))))
            (:= o-connection o-current)
            (:= v-owner (:uuid (:->> o-current "user_id")))
            (when (or (and (== v-name "disconnect") (not (access/is-user-active v-owner)))
                      (and (not= v-name "disconnect")
                           (not (policy/social-member-allowed o-inbox v-owner))))
              (:= v-owner nil))))
        (if (not (-/reserve-social-command-rate (:->> o-inbox "provider")
                                                v-identity-namespace
                                                (:->> o-payload "senderId")
                                                o-op))
          (do (:= v-status "rejected")
              (:= v-state "limited")
              (:= o-result (pg/jsonb-build-object "error" "rate_limited")))
          (let [o-public (commands/social-public-reply o-parsed
                                                       v-channel
                                                       (:->> o-inbox "provider")
                                                       (:-> o-inbox "enabled_commands"))]
            (:= v-reply (:->> o-public "reply"))
            (when [v-reply :is-null]
              (cond (and (== v-name "claim") (not (or (== (:->> o-inbox "provider") "instagram") (== (:->> o-inbox "provider") "mock"))))
                    (do (:= v-status "rejected") (:= v-state "rejected") (:= o-result (pg/jsonb-build-object "error" "instagram_only")))
                    (not (pg/jsonb-exists (:-> o-inbox "enabled_commands") v-name))
                    (do (:= v-status "rejected")
                        (:= v-state "rejected")
                        (:= o-result (pg/jsonb-build-object "error" "command_disabled")))
                    (and (== v-name "whoami") (not= (:->> o-inbox "provider") "mock"))
                    (do (:= v-status "rejected")
                        (:= v-state "rejected")
                        (:= o-result (pg/jsonb-build-object "error" "mock_only")))
                    (and (== v-name "connect") [o-connection :is-not-null])
                    (:= v-reply "This social account is already connected to FinFolk.")
                    (and (or (== v-name "connect") (== v-name "claim"))
                         (not (-/reserve-social-rate (:->> o-inbox "provider")
                                                     v-identity-namespace
                                                     (:->> o-payload "senderId")
                                                     v-name 3600
                                                     3 o-op)))
                    (do (:= v-state "limited")
                        (:= v-status "rejected")
                        (:= o-result (pg/jsonb-build-object "error" "connect_rate_limited")))
                    (== v-name "disconnect")
                    (if (and [v-owner :is-not-null]
                             (connections/disconnect-social-connection
                              i-application
                              i-inbox
                              v-owner
                              (pg/id o-connection)
                              (:uuid (:->> o-connection "identity_version"))
                              nil
                              o-op))
                      (do (:= v-reply "Your social account is disconnected from FinFolk.")
                          (:= o-result (pg/jsonb-build-object "disconnected" true)))
                      (:= v-reply "Connect your account first."))
                    (and (== v-name "status") (not= v-channel "message"))
                    (let [o-post (pg/t:get posts/SocialPost
                                   {:where {:url (:->> o-payload "url")
                                            :status "approved"
                                            :public-consent true}})]
                      (:= v-reply "This post has not been published on FinFolk.")
                      (when (and [o-post :is-not-null]
                                 (access/is-user-active (:uuid (:->> o-post "owner_id"))))
                        (:= o-result (pg/jsonb-build-object "postId" (pg/id o-post)))
                        (:= v-reply
                            (#{"concat"}
                             "Published on FinFolk: https://finfolk.com.au/?view=maps&site="
                             (:->> o-post "site_id")))))
                    (or (== v-name "whoami") (== v-name "status"))
                    (do (:= o-result (pg/jsonb-build-object "member" v-owner))
                        (:= v-reply
                            (pg/case [v-owner :is-null]
                              "Connect your account first." true
                              "Your account is connected to FinFolk.")))
                    :else (do (:= v-status "waiting")
                              (:= v-state "waiting")
                              (:= o-result (pg/jsonb-build-object "effect" v-name)))))))
        (let [o-new-command (pg/t:insert workflow/SocialCommand
                              {:event v-event
                               :inbox i-inbox
                               :generation (:integer (:->> o-inbox "generation"))
                               :account (:uuid (:->> o-event "account_id"))
                               :key (:->> o-event "key")
                               :context (++ v-channel domain/EnumSocialCommandContext)
                               :external-actor-id (:->> o-payload "senderId")
                               :external-media-id (:->> o-payload "mediaId")
                               :owner v-owner
                               :connection (pg/case [v-owner :is-null]
                                             nil true
                                             (pg/id o-connection))
                               :identity-version (pg/case [v-owner :is-null]
                                                   nil true
                                                   (:uuid (:->> o-connection "identity_version")))
                               :command v-name
                               :args (:-> o-parsed "args")
                               :source-url (:->> o-payload "url")
                               :state (++ v-state domain/EnumSocialCommandStatus)
                               :result o-result
                               :reply v-reply}
                              {:track o-op})]
          (:= o-command o-new-command))
        (when (and (== v-state "waiting") (or (== v-name "connect") (== v-name "claim")))
          (let [(:uuid v-action)
                (actions/enqueue-social-action (pg/id o-command) "verify-account" o-op)]
            nil))
        (when [v-reply :is-not-null]
          (let [(:uuid v-outgoing) nil]
            (when (== v-channel "message")
              (let [o-incoming (pg/t:get messaging/MessagingMessage
                                 {:where {:id (:uuid (:->> o-event "message_id"))}})
                    o-outgoing (pg/t:insert messaging/MessagingMessage
                                 {:account i-inbox
                                  :conversation (:uuid (:->> o-incoming "conversation_id"))
                                  :direction "outbound"
                                  :body v-reply
                                  :metadata (:jsonb "{}")})]
                (:= v-outgoing (pg/id o-outgoing))))
            (let [o-delivery (pg/t:insert delivery/MessagingOutbox
                               {:account i-inbox
                                :event v-event
                                :command (pg/id o-command)
                                :channel (++ v-channel domain/EnumSocialCommandContext)
                                :recipient (:->> o-payload "senderId")
                                :thread (pg/case (== v-channel "message")
                                          (:->> o-payload "conversationId") true
                                          nil)
                                :comment (pg/case (== v-channel "message")
                                           nil true
                                           (:->> o-payload "messageId"))
                                :message v-outgoing
                                :body v-reply
                                :correlation-id (pg/uuid-generate-v4)
                                :generation (:integer (:->> o-event "generation"))
                                :deadline (:bigint (:->> o-event "deadline"))})]
              nil)))
        (let [o-finished (pg/t:update workflow/SocialEvent
                           {:where {:id v-event}
                            :set {:status v-status
                                  :attempts (+ (:integer (:->> o-event "attempts")) 1)}
                            :track o-op})]
          (return (pg/jsonb-build-object "id" v-event
                                         "commandId" (pg/id o-command)
                                         "status" v-status)))))))
