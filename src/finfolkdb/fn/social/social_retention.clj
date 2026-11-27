(ns finfolkdb.fn.social.social-retention
  "Bounded retention for command-bot inboxes. Never run against app chat history."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.common.type-social-workflow :as workflow]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})

(defn.pg scrub-social-content
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        (:integer v-cleared) 0]
    (when (or [o-inbox :is-null] (== (:->> o-inbox "provider") "app"))
      [:raise-exception "Command-bot inbox required"])
    (let [o-events (pg/t:select workflow/SocialEvent
                     {:where {:inbox i-inbox :status [:in '("completed" "expired")] :content-cleared false}
                      :order-by [:id] :limit 100 :for [:update :skip-locked]})
          o-event nil]
      [:for o-event :in :select (pg/jsonb-array-elements (pg/coalesce o-events (:jsonb "[]")))
       (loop []
         (let [o-message (pg/t:update messaging/MessagingMessage
                            {:where {:id (:uuid (:->> o-event "message_id")) :account i-inbox}
                             :set {:body "" :metadata (:jsonb "{}")}})
               o-command (pg/t:update workflow/SocialCommand
                            {:where {:event (pg/id o-event) :state [:in '("done" "rejected" "expired")]}
                             :set {:args (:jsonb "{}") :reply nil} :track o-op})
               o-scrubbed (pg/t:update workflow/SocialEvent
                             {:where {:id (pg/id o-event)}
                              :set {:content-cleared true :payload (|| (- (:-> o-event "payload") "body")
                                                 (pg/jsonb-build-object "contentCleared" true
                                                   "parsed" (- (:-> (:-> o-event "payload") "parsed") "args")))}
                              :track o-op})]
           (:= v-cleared (+ v-cleared 1))))])
    (let [o-deliveries (pg/t:select delivery/MessagingOutbox
                         {:where {:account i-inbox :command [:is-not-null] :body [:neq ""]
                                  :state [:in '("provider_accepted" "failed" "uncertain" "cancelled" "expired")]}
                          :order-by [:id] :limit 100 :for [:update :skip-locked]})
          o-delivery nil]
      [:for o-delivery :in :select (pg/jsonb-array-elements (pg/coalesce o-deliveries (:jsonb "[]")))
       (loop []
         (let [o-message (pg/t:update messaging/MessagingMessage
                            {:where {:id (:uuid (:->> o-delivery "message_id")) :account i-inbox}
                             :set {:body "" :metadata (:jsonb "{}")}})
               o-cleared (pg/t:update delivery/MessagingOutbox
                            {:where {:id (pg/id o-delivery)}
                             :set {:body "" :body-ciphertext nil :cipher-context (:jsonb "{}")}})]
           (:= v-cleared (+ v-cleared 1))))])
    (return (pg/jsonb-build-object "cleared" v-cleared))))

(defn.pg purge-social-diagnostics
  [:uuid i-application :uuid i-inbox :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        (:bigint v-cutoff) (- (pg/time-us) 2592000000000)
        (:integer v-purged) 0]
    (when (or [o-inbox :is-null] (== (:->> o-inbox "provider") "app"))
      [:raise-exception "Command-bot inbox required"])
    (let [o-events (pg/t:select workflow/SocialEvent
                     {:where {:inbox i-inbox :status [:in '("completed" "expired")] :time-created [:lt v-cutoff]}
                      :order-by [:id] :limit 100 :for [:update :skip-locked]})
          o-event nil]
      [:for o-event :in :select (pg/jsonb-array-elements (pg/coalesce o-events (:jsonb "[]")))
       (loop []
         (let [(:boolean v-delivering) (pg/t:exists delivery/MessagingOutbox {:where {:event (pg/id o-event) :state [:in '("pending" "sending")]}})
               (:boolean v-acting) (pg/t:exists workflow/SocialAction {:where {:event (pg/id o-event) :state [:in '("pending" "running")]}})]
           (when (and (not v-delivering) (not v-acting))
             (let [o-messages (pg/t:select delivery/MessagingOutbox {:where {:event (pg/id o-event)}})
                   o-outbox (pg/t:delete delivery/MessagingOutbox {:where {:event (pg/id o-event)}})
                   o-audited-actions (pg/t:select workflow/SocialAction {:where {:event (pg/id o-event)}})
                   o-actions (pg/t:delete workflow/SocialAction {:where {:event (pg/id o-event)}})
                   o-proofs (pg/t:delete workflow/SocialConnectionProof {:where {:event (pg/id o-event)}})
                   o-commands (pg/t:delete workflow/SocialCommand {:where {:event (pg/id o-event)}})
                   o-deleted (pg/t:delete workflow/SocialEvent {:where {:id (pg/id o-event)}})
                   o-message (pg/t:delete messaging/MessagingMessage {:where {:id (:uuid (:->> o-event "message_id")) :account i-inbox}})]
               (let [o-action nil]
                 [:for o-action :in :select (pg/jsonb-array-elements (pg/coalesce o-audited-actions (:jsonb "[]")))
                  (loop []
                    (let [o-audit (pg/t:delete system/Audit {:where {:id (:uuid (:->> o-action "audit_id"))}})] nil))])
               (let [o-outgoing nil]
                 [:for o-outgoing :in :select (pg/jsonb-array-elements (pg/coalesce o-messages (:jsonb "[]")))
                  (loop []
                    (let [o-removed (pg/t:delete messaging/MessagingMessage {:where {:id (:uuid (:->> o-outgoing "message_id")) :account i-inbox}})] nil))])
               (:= v-purged (+ v-purged 1))))))])
    (let [o-proofs (pg/t:select workflow/SocialConnectionProof
                     {:where {:inbox i-inbox :expires-at [:lt (- (pg/time-us) 86400000000)]}
                      :limit 100 :for [:update :skip-locked]})
          o-proof nil]
      [:for o-proof :in :select (pg/jsonb-array-elements (pg/coalesce o-proofs (:jsonb "[]")))
       (loop [] (let [o-deleted (pg/t:delete workflow/SocialConnectionProof {:where {:id (pg/id o-proof)}})] nil))])
    (let [o-audits (pg/t:select messaging/MessagingAudit
                     {:where {:account i-inbox :time-created [:lt v-cutoff]} :limit 100 :for [:update :skip-locked]})
          o-audit nil]
      [:for o-audit :in :select (pg/jsonb-array-elements (pg/coalesce o-audits (:jsonb "[]")))
       (loop [] (let [o-deleted (pg/t:delete messaging/MessagingAudit {:where {:id (pg/id o-audit)}})] nil))])
    (let [(:text v-member-namespace) (:text (pg/jsonb-build-array i-application i-inbox))
          (:text v-message-namespace) (:text (pg/jsonb-build-array (:->> o-inbox "provider") i-application i-inbox "message"))
          (:text v-comment-namespace) (:text (pg/jsonb-build-array (:->> o-inbox "provider") i-application i-inbox "comment"))
          o-rates (pg/t:select workflow/SocialRateLimit
                    {:where #{[:namespace v-member-namespace :resets-at [:lt v-cutoff] :or
                               :namespace v-message-namespace :resets-at [:lt v-cutoff] :or
                               :namespace v-comment-namespace :resets-at [:lt v-cutoff]]}
                     :limit 100 :for [:update :skip-locked]})
          o-rate nil]
      [:for o-rate :in :select (pg/jsonb-array-elements (pg/coalesce o-rates (:jsonb "[]")))
       (loop [] (let [o-deleted (pg/t:delete workflow/SocialRateLimit {:where {:id (pg/id o-rate)}})] nil))])
    (return (pg/jsonb-build-object "purged" v-purged))))
