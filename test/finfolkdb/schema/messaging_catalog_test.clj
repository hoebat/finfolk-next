(ns finfolkdb.schema.messaging-catalog-test
  (:require [finfolkdb.schema.entity-catalog :as catalog])
  (:use code.test))

^{:id shared-provider-contract}
(fact "delivery links canonical commands and events to optional private messages"
  (let [tables (catalog/declarations)
        fields (fn [table] (into {} (map (juxt :name identity) (:columns (get tables table)))))]
    [(get-in (fields "MessagingAccount") ["application" :reference :table])
     (get-in (fields "MessagingOutbox") ["event" :reference :table])
     (get-in (fields "MessagingOutbox") ["command" :reference :table])
     (get-in (fields "MessagingOutbox") ["message" :reference :table])
     (boolean (get-in (fields "MessagingOutbox") ["message" :spec :required]))
     (get-in (fields "MessagingOutbox") ["account" :spec :foreign :command-inbox :column])
     (get-in (fields "MessagingOutbox") ["event" :spec :foreign :command-event :column])])
  =>
  ["MessagingApplication" "SocialEvent" "SocialCommand" "MessagingMessage" false :inbox-id :event-id])

^{:id conversation-scope}
(fact "conversation membership and history references enforce account ownership"
  (let [tables (catalog/declarations)
        field (fn [table name] (first (filter #(= name (:name %)) (:columns (get tables table)))))]
    [(get-in (field "MessagingConversation" "participant") [:reference :table])
     (get-in (field "MessagingConversation" "account") [:spec :foreign :participant-scope :column])
     (get-in (field "MessagingMessage" "account") [:spec :foreign :conversation-scope :column])])
  =>
  ["MessagingIdentity" :account-id :account-id])
