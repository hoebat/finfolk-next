(ns finfolkdb.common.type-messaging-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [std.json :as json]
            [clojure.string :as str]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]
            [finfolkbuild.testing.behavior :as fixture]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [finfolkdb.common.type-messaging-base :as t]
             [postgres.core :as pg]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]
             [finfolkdb.fn.messaging.messaging-oauth :as oauth]
             [finfolkdb.fn.messaging.messaging-authorization :as authorization]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-messaging-base/EnumMessagingProvider :added "0.1"}
(fact "EnumMessagingProvider labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-messaging-base/EnumMessagingProvider))
  =>
  true)

^{:refer finfolkdb.common.type-messaging-base/EnumMessagingDirection :added "0.1"}
(fact "EnumMessagingDirection labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-messaging-base/EnumMessagingDirection))
  =>
  true)

^{:refer finfolkdb.common.type-messaging-base/EnumMessagingReceiptStatus :added "0.1"}
(fact "EnumMessagingReceiptStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-messaging-base/EnumMessagingReceiptStatus))
  =>
  true)

^{:refer finfolkdb.common.type-messaging-base/MessagingApplication :added "0.1"}
(fact "MessagingApplication persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingApplication) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingAccount :added "0.1"}
(fact "MessagingAccount persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingAccount) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingAudit :added "0.1"}
(fact "MessagingAudit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingAudit) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingIdempotency :added "0.1"}
(fact "MessagingIdempotency persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingIdempotency) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingOauthState :added "0.1"}
(fact "MessagingOauthState persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingOauthState) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingIdentity :added "0.1"}
(fact "MessagingIdentity persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingIdentity) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingConversation :added "0.1"}
(fact "MessagingConversation persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingConversation) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingMessage :added "0.1"}
(fact "MessagingMessage persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingMessage) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingReceipt :added "0.1"}
(fact "MessagingReceipt persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingReceipt) => true)

^{:refer finfolkdb.common.type-messaging-base/MessagingOutbox :added "0.1"}
(fact "MessagingOutbox persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-messaging-base/MessagingOutbox) => true)

(defn receive-message
  [application account envelope]
  (messaging/receive-message application account envelope))
(defn claim-message [application account] (messaging/claim-message application account))
(defn complete-message
  [application account receipt lease result reply]
  (messaging/complete-message application account receipt lease result reply))
(defn claim-delivery [application account] (messaging/claim-delivery application account))
(defn record-delivery-result
  [application account delivery lease outcome provider-id delay]
  (messaging/record-delivery-result application account delivery lease outcome provider-id delay))
(defn ret-messaging-history
  [application account conversation]
  (messaging/ret-messaging-history application account conversation))

(defn create-application!
  []
  (pg/t:insert t/MessagingApplication
    {:id "3a6616a5-928c-56d7-9a4c-6f01183b63a1" :name "Application"}))
(defn create-account!
  [account provider]
  (pg/t:insert t/MessagingAccount
    {:id account
     :application "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
     :provider provider
     :account-id "business"
     :mode "live"
     :credential-ciphertext "SECRET_CREDENTIAL"}))

(defn messaging-protocol!
  []
  (create-application!)
  (doseq [provider ["instagram" "tiktok"]]
    (let [account (fixture/id (str "workflow-" provider))
          _ (create-account! account provider)
          envelope (json/write {:eventId "event"
                                :messageId "message"
                                :conversationId "conversation"
                                :senderId "sender"
                                :body "hello"
                                :metadata {}
                                :sentAt (* (System/currentTimeMillis) 1000)
                                :deadline (* (+ (System/currentTimeMillis) 3600000) 1000)})
          received (receive-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1" account envelope)
          duplicate (receive-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1" account envelope)
          work (claim-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1" account)
          receipt (:receipt work)]
      (fixture/expect! "messaging protocol result" false (:duplicate received))
      (fixture/expect! "messaging protocol result" true (:duplicate duplicate))
      (fixture/expect! "messaging protocol result"
                       (:id (:receipt received))
                       (:id (:receipt duplicate)))
      (fixture/expect! "messaging protocol result" "hello" (:body (:message work)))
      (fixture/expect! "messaging protocol result"
                       false
                       (str/includes? (pr-str work) "SECRET_CREDENTIAL"))
      (fixture/expect! "messaging protocol result"
                       nil
                       (complete-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                         account
                                         (:id receipt)
                                         (str (java.util.UUID/randomUUID))
                                         "{}"
                                         "hello back"))
      (fixture/expect! "messaging protocol result"
                       "completed"
                       (:status (complete-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                                  account
                                                  (:id receipt)
                                                  (:lease receipt)
                                                  "{}"
                                                  "hello back")))
      (fixture/expect! "messaging protocol result"
                       nil
                       (complete-message "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                         account
                                         (:id receipt)
                                         (:lease receipt)
                                         "{}"
                                         "duplicate reply"))
      (let [send (claim-delivery "3a6616a5-928c-56d7-9a4c-6f01183b63a1" account)
            delivery (:delivery send)]
        (fixture/expect! "messaging protocol result" "hello back" (:body delivery))
        (fixture/expect! "messaging protocol result"
                         false
                         (str/includes? (pr-str send) "SECRET_CREDENTIAL"))
        (fixture/expect! "messaging protocol result"
                         "provider_accepted"
                         (:state (record-delivery-result "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                                         account
                                                         (:id delivery)
                                                         (:lease delivery)
                                                         "accepted"
                                                         "provider-reply"
                                                         1)))
        (fixture/expect! "messaging protocol result"
                         nil
                         (record-delivery-result "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                                 account
                                                 (:id delivery)
                                                 (:lease delivery)
                                                 "accepted"
                                                 "stale-ack"
                                                 1)))
      (fixture/expect! "messaging protocol result"
                       2
                       (count (ret-messaging-history "3a6616a5-928c-56d7-9a4c-6f01183b63a1"
                                                     account
                                                     (:conversation-id (:message work)))))))
  true)

^{:refer finfolkdb.common.type-messaging-base/MessagingReceipt :id receive-deliver-history}
(fact
  "both providers deduplicate inbound work, fence completion and acknowledge exactly one private-safe reply"
  (messaging-protocol!) => true)

(defn race-envelope
  [id]
  (json/write {:eventId id
               :messageId id
               :conversationId id
               :senderId id
               :body "race"
               :metadata {}
               :sentAt (* (System/currentTimeMillis) 1000)
               :deadline (* (+ (System/currentTimeMillis) 3600000) 1000)}))
^{:refer finfolkdb.common.type-messaging-base/MessagingReceipt :id concurrent-claims-and-rollback}
(fact "independent workers claim distinct receipts and a rolled-back claim can be recovered"
  (pg/t:insert t/MessagingApplication
    {:id "bc7df185-7750-58be-97bc-3822af2fd5e0" :name "Race application"})
  (pg/t:insert t/MessagingAccount
    {:id "c4194538-230e-5740-9e9c-ea7f2f43ee92"
     :application "bc7df185-7750-58be-97bc-3822af2fd5e0"
     :provider "instagram"
     :account-id "race-business"
     :mode "live"
     :credential-ciphertext "SECRET"})
  (receive-message "bc7df185-7750-58be-97bc-3822af2fd5e0"
                   "c4194538-230e-5740-9e9c-ea7f2f43ee92"
                   (race-envelope "first"))
  (receive-message "bc7df185-7750-58be-97bc-3822af2fd5e0"
                   "c4194538-230e-5740-9e9c-ea7f2f43ee92"
                   (race-envelope "second"))
  (fixture/concurrent-claims! "bc7df185-7750-58be-97bc-3822af2fd5e0"
                              "c4194538-230e-5740-9e9c-ea7f2f43ee92")
  =>
  true)

(defn begin-oauth
  [app account user state nonce flow]
  (oauth/begin-messaging-oauth app account user state nonce flow))
(defn consume-oauth
  [app account user state nonce flow]
  (oauth/consume-messaging-oauth app account user state nonce flow))
(defn oauth-fixture!
  []
  (fixture/member "08c72f6d-fcc9-5ba6-8f28-d67369e30658")
  (fixture/member "a844ee37-5c94-5609-af5b-3849fe706dfd")
  (pg/t:insert t/MessagingApplication
    {:id "03c2f3e2-b4b3-5592-b60e-caec0ab3c740" :name "OAuth application"})
  (pg/t:insert t/MessagingAccount
    {:id "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
     :application "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
     :provider "instagram"
     :account-id "business"}))
(defn oauth-behavior!
  []
  (oauth-fixture!)
  (let [state (apply str (repeat 64 "a"))
        nonce (apply str (repeat 64 "b"))
        flow (apply str (repeat 64 "c"))]
    (fixture/expect! "OAuth intent captures generation"
                     1
                     (:generation (begin-oauth "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
                                               "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
                                               "08c72f6d-fcc9-5ba6-8f28-d67369e30658"
                                               state
                                               nonce
                                               flow)))
    (fixture/expect! "Another user cannot consume the intent"
                     nil
                     (consume-oauth "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
                                    "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
                                    "a844ee37-5c94-5609-af5b-3849fe706dfd"
                                    state
                                    nonce
                                    flow))
    (fixture/expect! "Another browser cannot consume the intent"
                     nil
                     (consume-oauth "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
                                    "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
                                    "08c72f6d-fcc9-5ba6-8f28-d67369e30658"
                                    state
                                    flow
                                    flow))
    (fixture/expect! "Correct operator and browser consume the intent"
                     "08c72f6d-fcc9-5ba6-8f28-d67369e30658"
                     (:user-id (consume-oauth "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
                                              "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
                                              "08c72f6d-fcc9-5ba6-8f28-d67369e30658"
                                              state
                                              nonce
                                              flow)))
    (fixture/expect! "OAuth consumption is single-use"
                     nil
                     (consume-oauth "03c2f3e2-b4b3-5592-b60e-caec0ab3c740"
                                    "4f96ac5b-1a3d-50c8-97e3-4856d6a891c1"
                                    "08c72f6d-fcc9-5ba6-8f28-d67369e30658"
                                    state
                                    nonce
                                    flow)))
  true)
^{:refer finfolkdb.common.type-messaging-base/MessagingOauthState :id bound-single-use-oauth}
(fact "OAuth intents are operator/browser-bound and single-use"
  (oauth-behavior!) => true)

(defn install-grant
  [app account generation proof]
  (authorization/set-messaging-authorization app
                                             account
                                             generation
                                             "ENCRYPTED_GRANT"
                                             4070908800000000
                                             proof))
(defn activate-grant
  [app account generation mode senders]
  (authorization/activate-messaging-account app account generation mode senders))
(defn disable-grant
  [app account generation disconnect]
  (authorization/disable-messaging-account app account generation disconnect))
(defn grant-fixture!
  []
  (pg/t:insert t/MessagingApplication
    {:id "6b338796-eb6f-5889-825d-9bc9af90d05d" :name "Grant application"})
  (pg/t:insert t/MessagingAccount
    {:id "c889effa-4209-5f13-aa78-178e9b2a40fd"
     :application "6b338796-eb6f-5889-825d-9bc9af90d05d"
     :provider "instagram"
     :account-id "business"}))
(defn grant-behavior!
  []
  (grant-fixture!)
  (let [proof (json/write
               {:provider "instagram" :accountId "business" :authorized true :subscribed true})]
    (fixture/expect! "Verified grant installation increments generation and remains paused"
                     {:generation 2 :mode "disabled"}
                     (install-grant "6b338796-eb6f-5889-825d-9bc9af90d05d"
                                    "c889effa-4209-5f13-aa78-178e9b2a40fd"
                                    1 proof))
    (fixture/expect! "Stale grant replacement is rejected"
                     nil
                     (install-grant "6b338796-eb6f-5889-825d-9bc9af90d05d"
                                    "c889effa-4209-5f13-aa78-178e9b2a40fd"
                                    1 proof))
    (fixture/expect! "Stale activation is rejected"
                     nil
                     (activate-grant "6b338796-eb6f-5889-825d-9bc9af90d05d"
                                     "c889effa-4209-5f13-aa78-178e9b2a40fd" 1
                                     "pilot" "[]"))
    (fixture/expect! "Activation is explicit"
                     "pilot"
                     (:mode (activate-grant "6b338796-eb6f-5889-825d-9bc9af90d05d"
                                            "c889effa-4209-5f13-aa78-178e9b2a40fd" 2
                                            "pilot" "[\"sender\"]")))
    (fixture/expect! "Disconnect pauses delivery"
                     "disabled"
                     (:mode (disable-grant "6b338796-eb6f-5889-825d-9bc9af90d05d"
                                           "c889effa-4209-5f13-aa78-178e9b2a40fd"
                                           2 true))))
  true)
^{:refer finfolkdb.common.type-messaging-base/MessagingAccount :id grant-generation-fencing}
(fact "grant installation, activation and disconnect respect account generation"
  (grant-behavior!) => true)
