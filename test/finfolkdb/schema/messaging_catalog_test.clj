(ns finfolkdb.schema.messaging-catalog-test
  (:require [finfolkdb.schema.entity-catalog :as catalog])
  (:use code.test))

^{:id shared-provider-contract}
(fact "provider delivery is linked to generic receipts and messages"
  (let [tables (catalog/declarations)
        fields (fn [table] (into {} (map (juxt :name identity) (:columns (get tables table)))))]
    [(get-in (fields "MessagingAccount") ["application" :reference :table])
     (get-in (fields "MessagingOutbox") ["receipt" :reference :table])
     (get-in (fields "MessagingOutbox") ["message" :reference :table])
     (contains? (fields "MessagingOutbox") "event")
     (get-in (fields "MessagingReceipt") ["account" :spec :foreign :message-scope :column])])
  => ["MessagingApplication" "MessagingReceipt" "MessagingMessage" false :account-id])

^{:id conversation-scope}
(fact "conversation membership and history references enforce account ownership"
  (let [tables (catalog/declarations)
        field (fn [table name] (first (filter #(= name (:name %)) (:columns (get tables table)))))]
    [(get-in (field "MessagingConversation" "participant") [:reference :table])
     (get-in (field "MessagingConversation" "account") [:spec :foreign :participant-scope :column])
     (get-in (field "MessagingMessage" "account") [:spec :foreign :conversation-scope :column])])
  => ["MessagingIdentity" :account-id :account-id])
