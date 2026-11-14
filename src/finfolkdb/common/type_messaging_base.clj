(ns finfolkdb.common.type-messaging-base
  "Messaging configuration, expiring request state and outbound delivery records."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Shared Messaging Scope
;;

(defenum.pg EnumMessagingProvider [:instagram :tiktok :app])

(defenum.pg EnumMessagingDirection [:inbound :outbound])

(defenum.pg EnumMessagingReceiptStatus [:received :processing :completed :failed :expired])

(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  MessagingApplication
  "A trusted integrating system; adapters authorize its callers."
  [:key  {:type :text
          :sql {:unique ["key"]}}
   :name {:type :text :required true}])

;;
;; MessagingAccount
;;

(deftype.pg ^{:finfolk/legacy-tables ["messaging_accounts"]
              :final true
              :! (et/E {:class   :0d/entry
                        :columns {:id {:sql {:unique ["application_scope"]}}}
                        :track   :track/none
                        :access  :none})}
  MessagingAccount
  [:key                    {:type :text
                            :sql {:unique ["key"]}}
   :application            {:type :ref :required true
                            :ref {:ns -/MessagingApplication}
                            :sql {:unique ["provider_account" "application_scope"] :index true}}
   :provider               {:type :enum :required true
                            :enum {:ns -/EnumMessagingProvider}
                            :sql {:unique ["provider_account"]}}
   :account-id             {:type :text :required true
                            :sql {:unique ["provider_account"]}}
   :username               {:type :text}
   :credential-ciphertext  {:type :text}
   :token-expires-at       {:type :long}
   :credential-lease       {:type :uuid}
   :credential-lease-until {:type :long}
   :mode                   {:type :enum :required true
                            :enum {:ns finfolkdb.common.type-domain-enum/EnumMessagingAccountMode}
                            :sql {:default "disabled"}}
   :enabled-commands       {:type :jsonb :required true
                            :sql {:default "[\"ping\", \"help\"]"}}
   :pilot-sender-ids       {:type :jsonb :required true
                            :sql {:default "[]"}}
   :generation             {:type :integer :required true
                            :sql {:default 1}}
   :checks                 {:type :jsonb :required true
                            :sql {:default "{}"}}
   :last-webhook-at        {:type :long}
   :last-command-at        {:type :long}
   :last-reply-at          {:type :long}
   :time-updated           {:type :long :required true
                            :sql {:default (pg/time-us)}}
   :backoff-until          {:type :long}
   :provider-scope         {:type :text}]
  {:constraints {:credential-lease-pair (or (and [#{"credential_lease"} :is-null]
                                                 [#{"credential_lease_until"} :is-null])
                                            (and [#{"credential_lease"} :is-not-null]
                                                 [#{"credential_lease_until"} :is-not-null]))
                 :positive-generation (> #{"generation"} 0)
                 :commands-array (== (pg/jsonb-typeof #{"enabled_commands"}) "array")
                 :pilot-array (== (pg/jsonb-typeof #{"pilot_sender_ids"}) "array")}})

;;
;; MessagingAudit
;;

(deftype.pg ^{:finfolk/legacy-tables ["messaging_audit"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  MessagingAudit
  [:account        {:type :ref :required true
                    :ref {:ns -/MessagingAccount} :sql {:index true}}
   :actor          {:type :text :required true}
   :event          {:type :text :required true}
   :correlation-id {:type :uuid :required true}
   :time-created   {:type :long :required true
                    :sql {:default (pg/time-us)}}])

;;
;; MessagingIdempotency
;;

(deftype.pg ^{:finfolk/legacy-tables ["messaging_idempotency"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  MessagingIdempotency
  [:application         {:type :ref :required true
                         :ref {:ns -/MessagingApplication} :sql {:unique ["entity_key"]}}
   :user                {:type :ref :required true
                         :ref {:ns finfolkdb.common.type-user/User}
                         :sql {:cascade true :unique ["entity_key"]}}
   :key-hash            {:type :text :required true
                         :sql {:unique ["entity_key"]}}
   :request-hash        {:type :text :required true}
   :response-ciphertext {:type :text}
   :response-status     {:type :integer :required true}
   :expires-at          {:type :long :required true}
   :time-created        {:type :long :required true
                         :sql {:default (pg/time-us)}}])

;;
;; MessagingOauthState
;;

(deftype.pg ^{:finfolk/legacy-tables ["messaging_oauth_states"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  MessagingOauthState
  [:application  {:type :ref :required true
                  :ref {:ns -/MessagingApplication}
                  :foreign {:account-scope {:ns -/MessagingAccount :column :application-id}}
                  :sql {:unique ["entity_key"]}}
   :account      {:type :ref :required true
                  :ref {:ns -/MessagingAccount}
                  :foreign {:account-scope {:ns -/MessagingAccount :column :id}}
                  :sql {:index true}}
   :state-hash   {:type :text :required true
                  :sql {:unique ["entity_key"]}}
   :nonce-hash   {:type :text :required true}
   :generation   {:type :integer :required true}
   :user         {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :expires-at   {:type :long :required true}
   :consumed-at  {:type :long}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}
   :flow-key     {:type :text :required true}])

;;
;; Identities and Conversations
;;

(deftype.pg ^{:final true
              :! (et/E {:class   :0d/entry
                        :track   :track/none
                        :access  :none
                        :columns {:id {:sql {:unique ["account_scope"]}}}})}
  MessagingIdentity
  "Provider identity within one connected account; linking to a User is explicit."
  [:account     {:type :ref :required true
                 :ref {:ns -/MessagingAccount}
                 :sql {:unique ["external_identity" "account_scope"] :index true}}
   :external-id {:type :text :required true
                 :sql {:unique ["external_identity"]}}
   :user        {:type :ref
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}])

;; Composite keys below enforce that participants, conversations, messages and
;; receipts belong to the same account, including writes outside the helpers.
(deftype.pg ^{:final true
              :! (et/E {:class   :0d/entry
                        :track   :track/none
                        :access  :none
                        :columns {:id {:sql {:unique ["account_scope"]}}}})}
  MessagingConversation
  "A direct conversation. Group membership can be added separately."
  [:account     {:type :ref :required true
                 :ref {:ns -/MessagingAccount}
                 :foreign {:participant-scope {:ns -/MessagingIdentity :column :account-id}}
                 :sql {:unique ["external_conversation" "account_scope"] :index true}}
   :participant {:type :ref :required true
                 :ref {:ns -/MessagingIdentity}
                 :foreign {:participant-scope {:ns -/MessagingIdentity :column :id}}}
   :external-id {:type :text :required true
                 :sql {:unique ["external_conversation"]}}])

;;
;; Messages and Durable Receipts
;;

(deftype.pg ^{:final true
              :! (et/E {:class   :0d/entry
                        :track   :track/none
                        :access  :none
                        :columns {:id {:sql {:unique ["account_scope"]}}}})}
  MessagingMessage
  [:account      {:type :ref :required true
                  :ref {:ns -/MessagingAccount}
                  :foreign {:conversation-scope {:ns -/MessagingConversation :column :account-id}}
                  :sql {:unique ["external_message" "account_scope"] :index true}}
   :conversation {:type :ref :required true
                  :ref {:ns -/MessagingConversation}
                  :foreign {:conversation-scope {:ns -/MessagingConversation :column :id}}}
   :direction    {:type :enum :required true
                  :enum {:ns -/EnumMessagingDirection} :sql {:unique ["external_message"]}}
   :external-id  {:type :text
                  :sql {:unique ["external_message"]}}
   :body         {:type :text :required true}
   :metadata     {:type :jsonb :required true
                  :sql {:default "{}"}}
   :sent-at      {:type :long}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}]
  {:constraints {:body-limit (<= (pg/length #{"body"}) 2000)
                 :incoming-identity (or (not= #{"direction"} "inbound")
                                        (and [#{"external_id"} :is-not-null]
                                             [#{"sent_at"} :is-not-null]))
                 :metadata-object (== (pg/jsonb-typeof #{"metadata"}) "object")}})

(deftype.pg ^{:finfolk/legacy-tables ["instagram_dm_events"]
              :final true
              :! (et/E {:class   :0d/entry
                        :track   :track/none
                        :access  :none
                        :columns {:id {:sql {:unique ["account_scope"]}}}})}
  MessagingReceipt
  "Verified adapter input; leases fence competing processing workers."
  [:account           {:type :ref :required true
                       :ref {:ns -/MessagingAccount}
                       :foreign {:message-scope {:ns -/MessagingMessage :column :account-id}}
                       :sql {:unique ["external_event" "account_scope"] :index true}}
   :external-event-id {:type :text :required true
                       :sql {:unique ["external_event"]}}
   :message           {:type :ref :required true
                       :ref {:ns -/MessagingMessage}
                       :foreign {:message-scope {:ns -/MessagingMessage :column :id}}
                       :sql {:unique ["message"]}}
   :status            {:type :enum :required true
                       :enum {:ns -/EnumMessagingReceiptStatus} :sql {:default "received"}}
   :generation        {:type :integer :required true}
   :attempts          {:type :integer :required true
                       :sql {:default 0}}
   :lease             {:type :uuid}
   :lease-until       {:type :long}
   :next-attempt-at   {:type :long :required true
                       :sql {:default (pg/time-us)}}
   :deadline          {:type :long :required true}
   :result            {:type :jsonb :required true
                       :sql {:default "{}"}}
   :correlation-id    {:type :uuid :required true
                       :sql {:default (pg/gen-random-uuid)}}
   :time-created      {:type :long :required true
                       :sql {:default (pg/time-us)}}]
  {:constraints {:attempts (>= #{"attempts"} 0)
                 :lease-pair (or (and [#{"lease"} :is-null] [#{"lease_until"} :is-null])
                                 (and [#{"lease"} :is-not-null] [#{"lease_until"} :is-not-null]))
                 :processing-lease (or (and (== #{"status"} "processing") [#{"lease"} :is-not-null])
                                       (and (not= #{"status"} "processing") [#{"lease"} :is-null]))
                 :result-object (== (pg/jsonb-typeof #{"result"}) "object")}})

;;
;; Provider-independent Delivery
;;

(deftype.pg ^{:finfolk/legacy-tables ["messaging_outbox"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  MessagingOutbox
  "One durable reply per receipt. A lost send acknowledgement becomes uncertain."
  [:account             {:type :ref :required true
                         :ref {:ns -/MessagingAccount}
                         :foreign {:receipt-scope {:ns -/MessagingReceipt :column :account-id}
                                   :message-scope {:ns -/MessagingMessage :column :account-id}}
                         :sql {:index true}}
   :receipt             {:type :ref :required true
                         :ref {:ns -/MessagingReceipt}
                         :foreign {:receipt-scope {:ns -/MessagingReceipt :column :id}}
                         :sql {:unique ["receipt"]}}
   :message             {:type :ref :required true
                         :ref {:ns -/MessagingMessage}
                         :foreign {:message-scope {:ns -/MessagingMessage :column :id}}
                         :sql {:unique ["message"]}}
   :body                {:type :text :required true}
   :correlation-id      {:type :uuid :required true}
   :generation          {:type :integer :required true}
   :state               {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus}
                         :sql {:default "pending"}}
   :attempts            {:type :integer :required true
                         :sql {:default 0}}
   :lease               {:type :uuid}
   :lease-until         {:type :long}
   :next-attempt-at     {:type :long :required true
                         :sql {:default (pg/time-us)}}
   :deadline            {:type :long :required true}
   :provider-message-id {:type :text}
   :error-code          {:type :text}
   :time-created        {:type :long :required true
                         :sql {:default (pg/time-us)}}
   :time-updated        {:type :long :required true
                         :sql {:default (pg/time-us)}}
   :body-ciphertext     {:type :text}
   :reply-kind          {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind}
                         :sql {:default "text"}}]
  {:constraints {:body-limit (<= (pg/length #{"body"}) 2000)
                 :sending-lease (or (and (== #{"state"} "sending") [#{"lease"} :is-not-null])
                                    (and (not= #{"state"} "sending") [#{"lease"} :is-null]))
                 :attempts (>= #{"attempts"} 0)
                 :lease-pair (or (and [#{"lease"} :is-null] [#{"lease_until"} :is-null])
                                 (and [#{"lease"} :is-not-null] [#{"lease_until"} :is-not-null]))}})

(defrun.pg __work_indexes__
  [:create-index :if-not-exists #{"MessagingReceipt_ready"} :on -/MessagingReceipt
   (>-< [#{"account_id"} #{"status"} #{"next_attempt_at"}])]
  [:create-index :if-not-exists #{"MessagingOutbox_ready"} :on -/MessagingOutbox
   (>-< [#{"account_id"} #{"state"} #{"next_attempt_at"}])]
  [:create-index :if-not-exists #{"MessagingMessage_history"} :on -/MessagingMessage
   (>-< [#{"conversation_id"} #{"time_created"} #{"id"}])])
