(ns finfolkdb.fn.social.social-actions-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]
            [finfolkbuild.testing.jdbc :as jdbc]
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
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.fn.social.social-events :as events]
             [finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.social.social-connections :as connections]
             [finfolkdb.fn.social.social-actions :as actions]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})
(defn op [] (system/op-fn "social-action-test" nil {}))
(defn inbox
  []
  (let [application (str (java.util.UUID/randomUUID))
        id (str (java.util.UUID/randomUUID))]
    (pg/t:insert messaging/MessagingApplication {:id application :name "Social action test"})
    (pg/t:insert messaging/MessagingAccount
      {:id id
       :application application
       :provider "mock"
       :account-id id
       :mode "live"
       :enabled-commands "[\"help\",\"connect\",\"disconnect\",\"status\",\"whoami\"]"})
    {:application application :inbox id}))
(defn command!
  [fx body]
  (let [now (* (System/currentTimeMillis) 1000)
        accepted (events/receive-social-event (:application fx)
                                              (:inbox fx)
                                              (json/write {:channel "message"
                                                           :senderId "sender"
                                                           :conversationId "thread"
                                                           :messageId (str
                                                                       (java.util.UUID/randomUUID))
                                                           :body body
                                                           :sentAt now
                                                           :deadline (+ now 3600000000)})
                                              (op))]
    (events/process-social-event (:application fx) (:inbox fx) (op))
    (:id accepted)))
(defn connect! [fx] (command! fx "/connect"))
(defn claim [fx] (actions/claim-social-action (:application fx) (:inbox fx) (op)))
(defn binding-of
  [claim]
  (let [binding (:binding claim)]
    {:actionId (:action-id binding)
     :lease (:lease binding)
     :inboxId (:inbox-id binding)
     :eventId (:event-id binding)
     :generation (:generation binding)
     :accountGeneration (:account-generation binding)}))
(defn complete
  [fx work outcome result]
  (actions/complete-social-action (:application fx)
                                  (:inbox fx)
                                  (:id work)
                                  (:lease work)
                                  outcome
                                  (json/write (assoc result :binding (binding-of work)))
                                  (op)))
(defn evidence
  [work eligible]
  (let [request (:request work)]
    {:provider (:provider request)
     :namespace (:namespace request)
     :externalId (:external-id request)
     :eligible eligible}))
(defn prepare!
  [fx]
  (let [work (claim fx)]
    (complete fx work "success" (evidence work true))
    (claim fx)))
(defn token-hash
  [code]
  (format "%064x"
          (java.math.BigInteger. 1
                                 (.digest (java.security.MessageDigest/getInstance "SHA-256")
                                          (.getBytes code "UTF-8")))))
(defn material
  [code]
  {:code code
   :tokenHash (token-hash code)
   :ciphertext (str "sealed:" (apply str (repeat 100 "x")))})
(defn member!
  []
  (let [id (str (java.util.UUID/randomUUID))]
    (fixture/member id)
    id))
(defn issued!
  [fx code]
  (let [event (connect! fx)
        work (prepare! fx)]
    (complete fx work "success" (material code))
    (pg/t:get workflow/SocialConnectionProof {:where {:event event}})))
(defn redeem
  [fx member code]
  (connections/redeem-social-connection (:application fx) (:inbox fx) member code (op)))

(fact "external identity verification is scoped, fenced and committed before crypto preparation"
  (let
    [fx (inbox)
     event (connect! fx)
     work (claim fx)]
    (:kind work) => "verify-account"
    (get-in work [:request :external-id]) => "sender"
    (:event-id (:binding work)) => event
    (claim fx) => nil
    (actions/claim-social-action (str (java.util.UUID/randomUUID)) (:inbox fx) (op)) => (throws)
    (actions/complete-social-action (:application fx)
                                    (:inbox fx)
                                    (:id work)
                                    (str (java.util.UUID/randomUUID))
                                    "success"
                                    "{}"
                                    (op))
    =>
    nil
    (actions/complete-social-action (:application fx)
                                    (:inbox fx)
                                    (:id work)
                                    (:lease work)
                                    "success"
                                    "{}"
                                    (op))
    =>
    (throws)
    (complete fx work "success" (assoc (evidence work true) :externalId "other")) => (throws)
    (:state (pg/t:get workflow/SocialAction {:where {:id (:id work)}})) => "running"
    (:status (complete fx work "success" (evidence work true))) => "completed"
    (complete fx work "success" (evidence work true)) => nil
    (:kind (claim fx)) => "prepare-link"))

(fact "ineligible identities get a native reply and cannot obtain a connection proof"
  (let
    [fx (inbox)
     event (connect! fx)
     work (claim fx)]
    (:status (complete fx work "success" (evidence work false))) => "completed"
    (claim fx) => nil
    (pg/t:count workflow/SocialConnectionProof {:where {:event event}}) => 0
    (:body (pg/t:get delivery/MessagingOutbox {:where {:event event}}))
    =>
    "This social account is not eligible to connect."
    (:status (pg/t:get workflow/SocialEvent {:where {:id event}})) => "completed"))

(fact "crypto completion validates its material atomically and never stores the plaintext code"
  (let
    [fx (inbox)
     event (connect! fx)
     work (prepare! fx)
     code "AB12CD34"]
    (complete fx work "success" (assoc (material code) :tokenHash (apply str (repeat 64 "a"))))
    =>
    (throws)
    (complete fx work "success" (material "short")) => (throws)
    (complete fx work "success" (assoc (material code) :ciphertext "short")) => (throws)
    (pg/t:count workflow/SocialConnectionProof {:where {:event event}}) => 0
    (:status (complete fx work "success" (material code))) => "completed"
    (let
      [proof (pg/t:get workflow/SocialConnectionProof {:where {:event event}})
       outbox (pg/t:get delivery/MessagingOutbox {:where {:event event}})
       command (pg/t:get workflow/SocialCommand {:where {:event event}})
       action (pg/t:get workflow/SocialAction {:where {:id (:id work)}})
       messages (pg/t:select messaging/MessagingMessage {:where {:account (:inbox fx)}})]
      (:status proof) => "verified"
      (:token-hash proof) => (token-hash code)
      (<= 599000000 (- (:expires-at proof) (:verified-at proof)) 600000000) => true
      (:reply-kind outbox) => "connect_code"
      (:body outbox) => "[Private connection code]"
      (:body-ciphertext outbox) => (:ciphertext (material code))
      (:state command) => "done"
      (some #(str/includes? (json/write %) code) [proof outbox command action messages]) => nil)))

(fact "a fresh code revokes earlier proofs only after successful preparation"
  (let [fx (inbox)
        first (connect! fx)
        work (prepare! fx)]
    (complete fx work "success" (material "FIRST123"))
    (let
      [second (connect! fx)
       next (prepare! fx)]
      (:status (pg/t:get workflow/SocialConnectionProof {:where {:event first}})) => "verified"
      (complete fx next "success" (material "SECOND12"))
      (:status (pg/t:get workflow/SocialConnectionProof {:where {:event first}})) => "revoked"
      (:state (pg/t:get delivery/MessagingOutbox {:where {:event first}})) => "cancelled"
      (:body-ciphertext (pg/t:get delivery/MessagingOutbox {:where {:event first}})) => nil
      (:status (pg/t:get workflow/SocialConnectionProof {:where {:event second}})) => "verified")))

(fact "external retries are delayed and bounded by the database"
  (let [fx (inbox)
        event (connect! fx)]
    (dotimes [_ 2]
      (let [work (claim fx)]
        (:status (complete fx work "retry" {})) => "pending"
        (claim fx) => nil
        (pg/t:update workflow/SocialAction
          {:where {:id (:id work)} :set {:next-attempt-at 0} :track (op)})))
    (let [work (claim fx)]
      (:status (complete fx work "retry" {})) => "failed"
      (:attempts (pg/t:get workflow/SocialAction {:where {:id (:id work)}})) => 3
      (claim fx) => nil
      (some? (pg/t:get delivery/MessagingOutbox {:where {:event event}})) => true)))

(fact "expired leases and changed account generations cannot commit evidence"
  (let
    [fx (inbox)
     event (connect! fx)
     work (claim fx)
     action (pg/t:get workflow/SocialAction {:where {:id (:id work)}})]
    (pg/t:update workflow/SocialAction {:where {:id (:id work)} :set {:lease-until 1} :track (op)})
    (complete fx work "success" (evidence work true)) => nil
    (pg/t:update workflow/SocialAction
      {:where {:id (:id work)} :set {:lease-until 4070908800000000} :track (op)})
    (pg/t:update accounts/SocialAccount
      {:where {:id (:account-id action)} :set {:generation 2} :track (op)})
    (complete fx work "success" (evidence work true)) => nil
    (pg/t:count workflow/SocialConnectionProof {:where {:event event}}) => 0))

(fact "member redemption consumes a scoped proof once and leaves all sharing disabled"
  (let
    [fx (inbox)
     member (member!)
     other (member!)
     proof (issued! fx "MEMBER12")
     result (redeem fx member "member-12")
     connection (pg/t:get accounts/SocialConnection {:where {:id (:id result)}})
     identity (pg/t:get messaging/MessagingIdentity {:where {:account (:inbox fx)}})]
    (:status result) => "active"
    (:user-id connection) => member
    (:share-posts connection) => false
    (:public-points connection) => false
    (:credential-ciphertext connection) => nil
    (:social-account-id identity) => (:account-id proof)
    (:user-id identity) => nil
    (:status (pg/t:get workflow/SocialConnectionProof {:where {:id (:id proof)}})) => "consumed"
    (redeem fx member "MEMBER12") => nil
    (redeem fx other "MEMBER12") => nil
    (:state (pg/t:get delivery/MessagingOutbox {:where {:event (:event-id proof)}}))
    =>
    "cancelled"))

(fact "redemption rejects wrong inboxes, expired proofs and inactive members"
  (let
    [fx (inbox)
     other (inbox)
     member (member!)
     proof (issued! fx "SCOPED12")]
    (redeem other member "SCOPED12") => nil
    (redeem fx (str (java.util.UUID/randomUUID)) "SCOPED12") => nil
    (pg/t:update workflow/SocialConnectionProof
      {:where {:id (:id proof)} :set {:expires-at 1} :track (op)})
    (redeem fx member "SCOPED12") => nil
    (:status (pg/t:get workflow/SocialConnectionProof {:where {:id (:id proof)}})) => "verified"
    (pg/t:count accounts/SocialConnection {:where {:account (:account-id proof)}}) => 0))

(fact
  "disconnect fences outstanding actions, cancels private delivery and permits a verified relink"
  (let
    [fx (inbox)
     member (member!)
     proof (issued! fx "BEFORE12")
     waiting (connect! fx)
     old-claim (claim fx)
     connected (redeem fx member "BEFORE12")
     connection (pg/t:get accounts/SocialConnection {:where {:id (:id connected)}})]
    (:state (pg/t:get workflow/SocialAction {:where {:id (:id old-claim)}})) => "expired"
    (complete fx old-claim "success" (evidence old-claim true)) => nil
    (:status (pg/t:get workflow/SocialEvent {:where {:id waiting}})) => "expired"
    (connections/disconnect-social-connection (:application fx)
                                              (:inbox fx)
                                              member
                                              (:id connected)
                                              (:identity-version connected)
                                              nil
                                              (op))
    =>
    true
    (let [revoked (pg/t:get accounts/SocialConnection {:where {:id (:id connected)}})]
      (:status revoked) => "revoked"
      (not= (:identity-version revoked) (:identity-version connection)) => true
      (:share-posts revoked) => false
      (:public-points revoked) => false)
    (connections/disconnect-social-connection (:application fx)
                                              (:inbox fx)
                                              member
                                              (:id connected)
                                              (:identity-version connected)
                                              nil
                                              (op))
    =>
    false
    (let
      [new-proof (issued! fx "AFTER123")
       other (member!)
       linked (redeem fx other "AFTER123")]
      (:status linked) => "active"
      (not= (:id linked) (:id connected)) => true
      (:user-id (pg/t:get accounts/SocialConnection {:where {:id (:id linked)}})) => other)))

(fact "concurrent redemption permits exactly one authenticated member to consume a code"
  (let
    [fx (inbox)
     proof (issued! fx "RACING12")
     members [(member!) (member!)]
     operations [(json/write (op)) (json/write (op))]
     workers
     (mapv (fn [member operation]
             (future
              (with-open [db (local/connection)]
                (jdbc/scalar
                 db
                 "SELECT finfolk_rpc.redeem_social_connection(?::uuid,?::uuid,?::uuid,?,?::jsonb)"
                 (:application fx)
                 (:inbox fx)
                 member
                 "RACING12"
                 operation))))
           members
           operations)
     results (mapv #(deref % 10000 ::timeout) workers)]
    (some #{::timeout} results) => nil
    (count (filter some? results)) => 1
    (pg/t:count accounts/SocialConnection {:where {:account (:account-id proof) :status "active"}})
    =>
    1))

(fact "native disconnect commands revoke the connection without an external action"
  (let
    [fx (inbox)
     member (member!)
     proof (issued! fx "COMMAND1")
     linked (redeem fx member "COMMAND1")
     event (command! fx "/disconnect")]
    (:status (pg/t:get workflow/SocialEvent {:where {:id event}})) => "completed"
    (:body (pg/t:get delivery/MessagingOutbox {:where {:event event}}))
    =>
    "Your social account is disconnected from FinFolk."
    (:status (pg/t:get accounts/SocialConnection {:where {:id (:id linked)}})) => "revoked"
    (pg/t:count workflow/SocialAction {:where {:event event}}) => 0))

(fact "code issuance admission has its own hourly limit"
  (let
    [fx (inbox)
     events (mapv (fn [_] (connect! fx)) (range 4))]
    (pg/t:count workflow/SocialAction {:where {:inbox (:inbox fx)}}) => 3
    (:result (pg/t:get workflow/SocialCommand {:where {:event (last events)}}))
    =>
    {:error "connect_rate_limited"}
    (:state (pg/t:get workflow/SocialCommand {:where {:event (last events)}})) => "limited"))

(fact "policy withdrawal invalidates outstanding preparation at completion"
  (let
    [fx (inbox)
     event (connect! fx)
     work (prepare! fx)]
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:enabled-commands "[]"}})
    (complete fx work "success" (material "POLICY12")) => nil
    (pg/t:count workflow/SocialConnectionProof {:where {:event event}}) => 0
    (pg/t:count delivery/MessagingOutbox {:where {:event event}}) => 0))

(fact "action foreign keys preserve command, event, account and inbox scope under direct SQL"
  (let
    [fx (inbox)
     event (connect! fx)
     other (inbox)
     other-event (connect! other)
     action (pg/t:get workflow/SocialAction {:where {:event event}})
     foreign-event (pg/t:get workflow/SocialEvent {:where {:id other-event}})]
    (fixture/sqlstate #(pg/t:update workflow/SocialAction
                         {:where {:id (:id action)} :set {:inbox (:inbox other)} :track (op)}))
    =>
    "23503"
    (fixture/sqlstate #(pg/t:update workflow/SocialAction
                         {:where {:id (:id action)} :set {:event other-event} :track (op)}))
    =>
    "23503"
    (fixture/sqlstate
     #(pg/t:update workflow/SocialAction
        {:where {:id (:id action)} :set {:account (:account-id foreign-event)} :track (op)}))
    =>
    "23503"))
