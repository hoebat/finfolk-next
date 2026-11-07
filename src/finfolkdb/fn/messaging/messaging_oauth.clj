(ns finfolkdb.fn.messaging.messaging-oauth
  "Single-use connection/operator/browser-bound OAuth intents."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as tmb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]]
   :static {:application ["finfolk-entity"]
            :all {:schema ["finfolk_rpc"]}}})

(defn.pg begin-messaging-oauth
  [:text i-application :text i-account :text i-user :text i-state :text i-nonce :text i-flow]
  (let [o-account (messaging/ret-messaging-account i-application i-account)
        o-user (pg/t:get tu/User {:where {:id i-user :deleted false} :returning #{:id}})]
    (when (or [o-user :is-null] (== (:->> o-account "provider") "app")
              [i-state :is-null] [i-nonce :is-null] [i-flow :is-null]
              (not (#{"regexp_like"} i-state "^[a-f0-9]{64}$"))
              (not (#{"regexp_like"} i-nonce "^[a-f0-9]{64}$"))
              (not (#{"regexp_like"} i-flow "^[a-f0-9]{64}$")))
      [:raise-exception "Invalid messaging authorization intent"])
    (let [o-intent (pg/t:insert tmb/MessagingOauthState
                     {:application i-application :account i-account :user i-user
                      :state-hash i-state :nonce-hash i-nonce :flow-key i-flow
                      :generation (:integer (:->> o-account "generation"))
                      :expires-at (+ (pg/now) (:interval "10 minutes"))})]
      (return (pg/jsonb-build-object "generation" (:integer (:->> o-intent "generation"))
                                    "expiresAt" (:->> o-intent "expires_at"))))))

(defn.pg ret-messaging-oauth-intent
  "Internal lookup for operator reauthorization; never returned to a browser."
  [:text i-application :text i-account :text i-state]
  (let [o-account (messaging/ret-messaging-account i-application i-account)
        o-intent (pg/t:get tmb/MessagingOauthState
                   {:where {:application i-application :account i-account :state-hash i-state
                            :consumed-at nil :expires-at [:gt (pg/now)]
                            :generation (:integer (:->> o-account "generation"))}
                    :returning #{:user :generation :expires-at}})]
    (return o-intent)))

(defn.pg consume-messaging-oauth
  [:text i-application :text i-account :text i-user :text i-state :text i-nonce :text i-flow]
  (let [o-account (messaging/ret-messaging-account i-application i-account)
        o-user (pg/t:get tu/User {:where {:id i-user :deleted false} :returning #{:id}})
        o-intent (pg/t:get tmb/MessagingOauthState
                   {:where {:application i-application :account i-account :user i-user
                            :state-hash i-state :nonce-hash i-nonce :flow-key i-flow
                            :consumed-at nil :expires-at [:gt (pg/now)]
                            :generation (:integer (:->> o-account "generation"))}
                    :for [:update]})]
    (when (or [o-user :is-null] [o-intent :is-null]) (return nil))
    (let [o-consumed (pg/t:update tmb/MessagingOauthState
                       {:set {:consumed-at (pg/now)} :single true
                        :where {:application i-application :state-hash i-state}})]
      (return (pg/jsonb-build-object "userId" i-user "generation" (:integer (:->> o-consumed "generation")))))))
