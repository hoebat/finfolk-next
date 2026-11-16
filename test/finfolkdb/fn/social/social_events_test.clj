(ns finfolkdb.fn.social.social-events-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]
            [std.json :as json]
            [clojure.string :as str]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-messaging-delivery :as delivery]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.fn.social.social-events :as events]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})
(defn op [] (system/op-fn "social-event-test" nil {}))
(defn inbox
  []
  (let [application (str (java.util.UUID/randomUUID))
        id (str (java.util.UUID/randomUUID))]
    (pg/t:insert messaging/MessagingApplication {:id application :name "Social test"})
    (pg/t:insert messaging/MessagingAccount
      {:id id
       :application application
       :provider "mock"
       :account-id id
       :mode "live"
       :enabled-commands
       "[\"help\",\"ping\",\"site\",\"privacy\",\"connect\",\"status\",\"whoami\"]"})
    {:application application :inbox id}))
(defn envelope
  [body channel]
  (let [id (str (java.util.UUID/randomUUID))
        now (* (System/currentTimeMillis) 1000)]
    {:channel channel
     :senderId "sender"
     :messageId id
     :conversationId "thread"
     :body body
     :sentAt now
     :deadline (+ now 3600000000)}))
(defn receive
  [fx payload]
  (events/receive-social-event (:application fx) (:inbox fx) (json/write payload) (op)))
(defn process [fx] (events/process-social-event (:application fx) (:inbox fx) (op)))

(fact "a public DM creates a canonical event, command and delivery without a member"
  (let
    [fx (inbox)
     accepted (receive fx (envelope "/ping" "message"))
     result (process fx)
     event (pg/t:get workflow/SocialEvent {:where {:id (:id accepted)}})
     command (pg/t:get workflow/SocialCommand {:where {:event (:id accepted)}})
     reply (pg/t:get delivery/MessagingOutbox {:where {:command (:id command)}})]
    (:duplicate accepted) => false
    (:status result) => "completed"
    (:status event) => "completed"
    (some? (:message-id event)) => true
    (:owner-id command) => nil
    (:command command) => "ping"
    (:result command) => {}
    (:body reply) => "Pong."
    (:channel reply) => "message"
    (:recipient reply) => "sender"
    (:receipt-id reply) => nil
    (process fx) => nil))

(fact "webhook retries reuse events and cannot change their accepted contents"
  (let
    [fx (inbox)
     payload (envelope "/help" "message")
     first (receive fx payload)
     again (receive fx payload)]
    (:id again) => (:id first)
    (:duplicate again) => true
    (receive fx (assoc payload :body "/ping")) => (throws)
    (process fx)
    (pg/t:count workflow/SocialCommand {:where {:event (:id first)}}) => 1
    (pg/t:count messaging/MessagingMessage {:where {:account (:inbox fx) :direction "inbound"}})
    =>
    1))

(fact "comments share command processing but create no private conversation"
  (let
    [fx (inbox)
     accepted (receive fx (envelope "/connect SECRET @finfolk.com.au" "mention"))
     _ (process fx)
     event (pg/t:get workflow/SocialEvent {:where {:id (:id accepted)}})
     command (pg/t:get workflow/SocialCommand {:where {:event (:id accepted)}})
     reply (pg/t:get delivery/MessagingOutbox {:where {:command (:id command)}})]
    (:message-id event) => nil
    (str/includes? (json/write (:payload event)) "SECRET") => false
    (:args command) => {:command "connect"}
    (:channel reply) => "mention"
    (some? (:comment reply)) => true
    (str/includes? (:body reply) "SECRET") => false
    (pg/t:count messaging/MessagingConversation {:where {:account (:inbox fx)}}) => 0))

(fact "ordinary mentions are not executed as commands and private comments need no member lookup"
  (let
    [fx (inbox)
     accepted (receive fx (envelope "Nice dive @finfolk.com.au" "mention"))]
    (:status (process fx)) => "ignored"
    (pg/t:count workflow/SocialCommand {:where {:event (:id accepted)}}) => 0
    (pg/t:count delivery/MessagingOutbox {:where {:account (:inbox fx)}}) => 0))

(fact "DMs and comments from the same external participant share a stable social account"
  (let
    [fx (inbox)
     dm (receive fx (envelope "/ping" "message"))
     comment (receive fx (envelope "/ping @finfolk.com.au" "mention"))
     dm-event (pg/t:get workflow/SocialEvent {:where {:id (:id dm)}})
     comment-event (pg/t:get workflow/SocialEvent {:where {:id (:id comment)}})]
    (:account-id dm-event) => (:account-id comment-event)
    (not= (:namespace dm-event) (:namespace comment-event)) => true))

(fact "scope and envelope validation fail before identity creation"
  (let
    [fx (inbox)
     payload (envelope "/ping" "message")]
    (events/receive-social-event (str (java.util.UUID/randomUUID))
                                 (:inbox fx)
                                 (json/write payload)
                                 (op))
    =>
    (throws)
    (receive fx (assoc payload :application (:application fx))) => (throws)
    (receive fx (assoc payload :deadline (:sentAt payload))) => (throws)
    (pg/t:count workflow/SocialEvent {:where {:inbox (:inbox fx)}}) => 0))

(fact "pause, pilot audience and generation changes are enforced in PostgreSQL"
  (let
    [fx (inbox)
     first (receive fx (envelope "/ping" "message"))]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:mode "disabled"}})
    (process fx) => nil
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:mode "pilot" :pilot-sender-ids "[\"other\"]"}})
    (:status (process fx)) => "expired"
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:mode "live"}})
    (receive fx (envelope "/ping" "message"))
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (:status (process fx)) => "expired"
    (pg/t:count delivery/MessagingOutbox {:where {:account (:inbox fx)}}) => 0))

(fact "command limits count accepted executions and reject excess requests without replies"
  (let [fx (inbox)]
    (dotimes [_ 31]
      (receive fx (envelope "/ping" "message"))
      (process fx))
    (pg/t:count delivery/MessagingOutbox {:where {:account (:inbox fx)}}) => 30
    (pg/t:count workflow/SocialCommand {:where {:inbox (:inbox fx) :state "limited"}}) => 1))

(fact "commands needing provider evidence persist a waiting state for resumption"
  (let
    [fx (inbox)
     accepted (receive fx (envelope "/connect" "message"))]
    (:status (process fx)) => "waiting"
    (:result (pg/t:get workflow/SocialCommand {:where {:event (:id accepted)}}))
    =>
    {:effect "connect"}
    (pg/t:count delivery/MessagingOutbox {:where {:account (:inbox fx)}}) => 0))


(fact "composite foreign keys reject cross-inbox and wrong-event command attachments"
  (let
    [fx (inbox)
     other (inbox)
     first (receive fx (envelope "/ping" "message"))
     _ (process fx)
     second (receive fx (envelope "/help" "message"))
     _ (process fx)
     foreign (receive other (envelope "/ping" "message"))
     _ (process other)
     first-command (pg/t:get workflow/SocialCommand {:where {:event (:id first)}})
     second-command (pg/t:get workflow/SocialCommand {:where {:event (:id second)}})
     foreign-command (pg/t:get workflow/SocialCommand {:where {:event (:id foreign)}})
     first-delivery (pg/t:get delivery/MessagingOutbox {:where {:command (:id first-command)}})]
    ;; Free the unique command slots so these writes exercise scope foreign keys.
    (pg/t:delete delivery/MessagingOutbox {:where {:command (:id second-command)}})
    (pg/t:delete delivery/MessagingOutbox {:where {:command (:id foreign-command)}})
    (fixture/sqlstate
     #(pg/t:update workflow/SocialCommand
        {:where {:id (:id first-command)} :set {:inbox (:inbox other)} :track (op)}))
    =>
    "23503"
    (fixture/sqlstate #(pg/t:update delivery/MessagingOutbox
                         {:where {:id (:id first-delivery)} :set {:command (:id second-command)}}))
    =>
    "23503"
    (fixture/sqlstate #(pg/t:update delivery/MessagingOutbox
                         {:where {:id (:id first-delivery)} :set {:command (:id foreign-command)}}))
    =>
    "23503"
    (:command-id (pg/t:get delivery/MessagingOutbox {:where {:id (:id first-delivery)}}))
    =>
    (:id first-command)))
