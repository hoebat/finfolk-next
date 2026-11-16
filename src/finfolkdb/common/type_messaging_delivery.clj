(ns finfolkdb.common.type-messaging-delivery
  "Shared DM and comment delivery records."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-seed]
            [finfolkdb.common.type-messaging-base]
            [finfolkdb.common.type-social-workflow]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as seed]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-domain-enum :as domain]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(deftype.pg ^{:finfolk/legacy-tables ["messaging_outbox"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  MessagingOutbox
  "Durable DM or comment replies. A lost send acknowledgement becomes uncertain."
  [:account             {:type :ref :required true
                         :ref {:ns finfolkdb.common.type-messaging-base/MessagingAccount}
                         :foreign {:event-inbox {:ns finfolkdb.common.type-social-workflow/SocialEvent
                                        :column :inbox-id}
                          :command-inbox {:ns finfolkdb.common.type-social-workflow/SocialCommand
                                          :column :inbox-id}
                          :receipt-scope {:ns finfolkdb.common.type-messaging-base/MessagingReceipt
                                          :column :account-id}
                          :message-scope {:ns finfolkdb.common.type-messaging-base/MessagingMessage
                                          :column :account-id}} :sql {:index true}}
   :event               {:type :ref
                         :ref {:ns finfolkdb.common.type-social-workflow/SocialEvent}
                         :foreign {:event-inbox {:ns finfolkdb.common.type-social-workflow/SocialEvent
                                        :column :id}
                          :command-event {:ns finfolkdb.common.type-social-workflow/SocialCommand
                                          :column :event-id}}}
   :command             {:type :ref
                         :ref {:ns finfolkdb.common.type-social-workflow/SocialCommand}
                         :foreign {:command-inbox {:ns finfolkdb.common.type-social-workflow/SocialCommand
                                          :column :id}
                          :command-event {:ns finfolkdb.common.type-social-workflow/SocialCommand
                                          :column :id}} :sql {:unique ["command"]}}
   :channel             {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialCommandContext}
                         :sql {:default "message"}}
   :recipient           {:type :text}
   :thread              {:type :text}
   :comment             {:type :text}
   :receipt             {:type :ref
                         :ref {:ns finfolkdb.common.type-messaging-base/MessagingReceipt}
                         :foreign {:receipt-scope
                                   {:ns finfolkdb.common.type-messaging-base/MessagingReceipt
                                    :column :id}} :sql {:unique ["receipt"]}}
   :message             {:type :ref
                         :ref {:ns finfolkdb.common.type-messaging-base/MessagingMessage}
                         :foreign {:message-scope
                                   {:ns finfolkdb.common.type-messaging-base/MessagingMessage
                                    :column :id}} :sql {:unique ["message"]}}
   :body                {:type :text :required true
                         :sql {:process [[finfolkdb.common.type-system-seed/as-bounded-text 0 2000]]
                               :constraint (== #{"body"}
                                               (finfolkdb.common.type-system-seed/as-bounded-text
                                                #{"body"}
                                                0
                                                2000))}}
   :correlation-id      {:type :uuid :required true}
   :generation          {:type :integer :required true}
   :state               {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumMessagingOutboxStatus}
                         :sql {:default "pending"}}
   :attempts            {:type :integer :required true
                         :sql {:default 0
                               :process [[finfolkdb.common.type-system-seed/as-bounded-integer 0
                                          2147483647]]
                               :constraint (== #{"attempts"}
                                               (finfolkdb.common.type-system-seed/as-bounded-integer
                                                #{"attempts"}
                                                0
                                                2147483647))}}
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
   :cipher-context      {:type :jsonb :required true
                         :sql {:default "{}"
                               :process [[finfolkdb.common.type-system-seed/as-jsonb]]
                               :constraint (== #{"cipher_context"}
                                               (finfolkdb.common.type-system-seed/as-jsonb
                                                #{"cipher_context"}))}}
   :reply-kind          {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumMessagingOutboxReplyKind}
                         :sql {:default "text"}}]
  {:constraints {:sending-lease (or (and (== #{"state"} "sending") [#{"lease"} :is-not-null])
                                    (and (not= #{"state"} "sending") [#{"lease"} :is-null]))
                 :lease-pair (or (and [#{"lease"} :is-null] [#{"lease_until"} :is-null])
                                 (and [#{"lease"} :is-not-null] [#{"lease_until"} :is-not-null]))}})


(defrun.pg __delivery_indexes__
  [:create-index :if-not-exists #{"MessagingOutbox_ready"} :on -/MessagingOutbox
   (>-< [#{"account_id"} #{"state"} #{"next_attempt_at"}])])
