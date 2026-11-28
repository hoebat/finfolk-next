(ns finfolkdb.fn.social.social-delivery-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkdb.schema.social :as grants]
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
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.fn.social.social-events :as events]
             [finfolkdb.fn.social.social-actions :as actions]
             [finfolkdb.fn.social.social-connections :as connections]
             [finfolkdb.fn.social.social-interop :as interop]
             [finfolkdb.fn.social.social-delivery :as sends]
             [finfolkdb.fn.social.social-retention :as retention]
             [finfolkdb.fn.social.social-operator :as operator]
             [finfolkdb.fn.social.social-messaging :as legacy]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-posts :as post-api]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})
(defn op [] (system/op-fn "social-delivery-test" nil {}))
(defn uuid [] (str (java.util.UUID/randomUUID)))
(defn member!
  []
  (let [id (uuid)]
    (fixture/member id)
    id))
(defn inbox
  []
  (let [application (uuid)
        id (uuid)]
    (pg/t:insert messaging/MessagingApplication {:id application :name "Social delivery test"})
    (pg/t:insert messaging/MessagingAccount
      {:id id
       :application application
       :provider "mock"
       :account-id id
       :mode "live"
       :enabled-commands "[\"help\",\"ping\",\"connect\",\"disconnect\",\"status\",\"whoami\"]"})
    {:application application :inbox id}))
(defn queue!
  ([fx body] (queue! fx body "message" {}))
  ([fx body channel extra]
   (let [now (* (System/currentTimeMillis) 1000)
         accepted (events/receive-social-event (:application fx)
                                               (:inbox fx)
                                               (json/write (merge {:channel channel
                                                                   :senderId "sender"
                                                                   :conversationId "thread"
                                                                   :messageId (uuid)
                                                                   :body body
                                                                   :sentAt now
                                                                   :deadline (+ now 3600000000)}
                                                                  extra))
                                               (op))]
     (events/process-social-event (:application fx) (:inbox fx) (op))
     (:id accepted))))
(defn outbox [event] (pg/t:get delivery/MessagingOutbox {:where {:event event}}))
(defn claim [fx] (sends/claim-social-delivery (:application fx) (:inbox fx) (op)))
(defn complete
  ([fx work outcome] (complete fx work outcome nil nil))
  ([fx work outcome provider-id retry-after]
   (sends/complete-social-delivery (:application fx)
                                   (:inbox fx)
                                   (:id work)
                                   (:lease work)
                                   outcome
                                   provider-id
                                   retry-after
                                   (op))))
(defn reconcile [fx] (sends/reconcile-social-work (:application fx) (:inbox fx) (op)))
(defn action-binding
  [work]
  (let [binding (:binding work)]
    {:actionId (:action-id binding)
     :lease (:lease binding)
     :eventId (:event-id binding)
     :inboxId (:inbox-id binding)
     :generation (:generation binding)
     :accountGeneration (:account-generation binding)}))
(defn action-complete
  [fx work result]
  (actions/complete-social-action (:application fx)
                                  (:inbox fx)
                                  (:id work)
                                  (:lease work)
                                  "success"
                                  (json/write (assoc result :binding (action-binding work)))
                                  (op)))
(defn issue!
  [fx code]
  (let [event (queue! fx "/connect")
        verify (actions/claim-social-action (:application fx) (:inbox fx) (op))
        request (:request verify)]
    (action-complete fx
                     verify
                     {:provider (:provider request)
                      :namespace (:namespace request)
                      :externalId (:external-id request)
                      :eligible true})
    (let [prepare (actions/claim-social-action (:application fx) (:inbox fx) (op))
          hash (format "%064x"
                       (java.math.BigInteger. 1
                                              (.digest (java.security.MessageDigest/getInstance
                                                        "SHA-256")
                                                       (.getBytes code "UTF-8"))))]
      (action-complete fx
                       prepare
                       {:code code :tokenHash hash :ciphertext (apply str (repeat 100 "x"))}))
    event))
(defn linked!
  [fx]
  (let [member (member!)
        code (str/upper-case (subs (uuid) 0 8))
        event (issue! fx code)
        connection
        (connections/redeem-social-connection (:application fx) (:inbox fx) member code (op))]
    {:member member :event event :connection connection}))

(fact
  "DM delivery commits a single fenced lease and records acceptance without exposing credentials"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)]
    (:id work) => (:id (outbox event))
    (:provider work) => "mock"
    (:account-id work) => (:inbox fx)
    (:destination work)
    =>
    {:channel "message" :recipient-id "sender" :conversation-id "thread" :comment-id nil}
    (get-in work [:payload :body]) => "Pong."
    (contains? work :credential-ciphertext) => false
    (claim fx) => nil
    (:state (complete fx work "accepted" "provider:1" nil)) => "provider_accepted"
    (:attempts (outbox event)) => 1
    (:external-id (pg/t:get messaging/MessagingMessage {:where {:id (:message-id (outbox event))}}))
    =>
    "provider:1"
    (complete fx work "accepted" "provider:1" nil) => nil
    (claim fx) => nil))

(fact "mentioned and owned comments use the same outbox without private messages"
  (doseq [channel ["mention" "owned"]]
    (let
      [fx (inbox)
       event (queue! fx "/ping @finfolk.com.au" channel {})
       work (claim fx)
       source (pg/t:get workflow/SocialEvent {:where {:id event}})]
      (get-in work [:destination :channel]) => channel
      (get-in work [:destination :comment-id]) => (get-in source [:payload :message-id])
      (get-in work [:destination :conversation-id]) => nil
      (:message-id (outbox event)) => nil
      (:state (complete fx work "accepted" (str "reply:" channel) nil)) => "provider_accepted"
      (pg/t:count messaging/MessagingMessage {:where {:account (:inbox fx)}}) => 0)))

(fact "known rejections use database delays and exhaust a bounded send budget"
  (let
    [fx (inbox)
     event (queue! fx "/ping")]
    (dotimes [attempt 5]
      (let
        [work (claim fx)
         result (complete fx work "retry")]
        (:attempts result) => (inc attempt)
        (:state result) => (if (= attempt 4) "failed" "pending")
        (fixture/expect! (str "send budget at attempt " (inc attempt))
                         (if (= attempt 4) "failed" "pending")
                         (:state result))
        (when (< attempt 4)
          (fixture/expect! (str "backoff at attempt " (inc attempt))
                           (* 30000000 (long (Math/pow 2 attempt)))
                           (- (:next-attempt-at result) (:time-updated (outbox event))))
          (== (- (:next-attempt-at result) (:time-updated (outbox event)))
              (* 30000000 (long (Math/pow 2 attempt))))
          =>
          true
          (claim fx) => nil
          (pg/t:update delivery/MessagingOutbox
            {:where {:id (:id work)} :set {:next-attempt-at 0}}))))
    (:state (outbox event)) => "failed"
    (claim fx) => nil))

(fact "provider retry-after can lengthen but cannot shorten the database delay"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)
     result (complete fx work "retry" nil 120)]
    (== (- (:next-attempt-at result) (:time-updated (outbox event))) 120000000) => true
    (:state result) => "pending"))

(fact "timeouts and abandoned send leases become uncertain and cannot be resent"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)]
    (:state (complete fx work "uncertain")) => "uncertain"
    (reconcile fx)
    (:state (outbox event)) => "uncertain"
    (claim fx) => nil)
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)]
    (pg/t:update delivery/MessagingOutbox {:where {:id (:id work)} :set {:lease-until 1}})
    (complete fx work "accepted" "late:1" nil) => nil
    (:deliveries (reconcile fx)) => 1
    (:state (outbox event)) => "uncertain"
    (:error-code (outbox event)) => "lease_expired"
    (complete fx work "retry") => nil
    (claim fx) => nil))

(fact "invalid and stale acknowledgements leave the active send unchanged"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)
     other (inbox)]
    (complete fx (assoc work :lease (uuid)) "accepted" "wrong" nil) => nil
    (complete other work "accepted" "wrong" nil) => nil
    (complete fx work "accepted" nil nil) => (throws)
    (complete fx work "retry" nil 0) => (throws)
    (complete fx work "unknown") => (throws)
    (:state (outbox event)) => "sending"
    (:attempts (outbox event)) => 1
    (:state (complete fx work "failed")) => "failed"))

(fact "pause and backoff retain pending work; audience and generation changes cancel it"
  (let
    [fx (inbox)
     event (queue! fx "/ping")]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:mode "disabled"}})
    (claim fx) => nil
    (:state (outbox event)) => "pending"
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:mode "live" :backoff-until 4070908800000000}})
    (claim fx) => nil
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:backoff-until nil :mode "pilot" :pilot-sender-ids "[]"}})
    (claim fx) => nil
    (:state (outbox event)) => "cancelled")
  (let
    [fx (inbox)
     event (queue! fx "/ping")]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (claim fx) => nil
    (:error-code (outbox event)) => "generation_changed"))

(fact "invalid head work is skipped so an enabled reply behind it can be claimed"
  (let
    [fx (inbox)
     first (queue! fx "/ping")
     second (queue! fx "/help")]
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:enabled-commands "[\"help\"]"}})
    (:id (claim fx)) => (:id (outbox second))
    (:state (outbox first)) => "cancelled"))

(fact "acceptance records external truth after a policy change; rejected sends cannot retry it"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (:state (complete fx work "accepted" "accepted:old-generation" nil)) => "provider_accepted")
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     work (claim fx)]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (:state (complete fx work "retry")) => "cancelled"
    (claim fx) => nil))

(fact
  "sensitive replies return ciphertext only to a claimed worker and erase it on terminal delivery"
  (let
    [fx (inbox)
     event (issue! fx "SECRET12")
     work (claim fx)]
    (get-in work [:payload :body]) => "[Private connection code]"
    (get-in work [:payload :ciphertext]) => (apply str (repeat 100 "x"))
    (some? (get-in work [:payload :cipher-context :action-id])) => true
    (:state (complete fx work "accepted" "code:sent" nil)) => "provider_accepted"
    (:body-ciphertext (outbox event)) => nil
    (:cipher-context (outbox event)) => {}))

(fact "expired proofs and changed member identity versions invalidate unsent private replies"
  (let
    [fx (inbox)
     event (issue! fx "EXPIRED1")]
    (pg/t:update workflow/SocialConnectionProof
      {:where {:event event} :set {:expires-at 1} :track (op)})
    (claim fx) => nil
    (:error-code (outbox event)) => "proof_invalid")
  (let
    [fx (inbox)
     {:keys [connection]} (linked! fx)
     event (queue! fx "/status")]
    (pg/t:update accounts/SocialConnection
      {:where {:id (:id connection)} :set {:identity-version (uuid)} :track (op)})
    (claim fx) => nil
    (:error-code (outbox event)) => "member_restricted"))

(fact "member deletion and blocking are rechecked immediately before private delivery"
  (let
    [fx (inbox)
     {:keys [member]} (linked! fx)
     event (queue! fx "/whoami")]
    (pg/t:update users/User {:where {:id member} :set {:deleted true} :track (op)})
    (claim fx) => nil
    (:error-code (outbox event)) => "member_restricted")
  (let [fx (inbox)
        {:keys [member]} (linked! fx)
        brand (member!)
        account (social/insert-social-account "mock" "operated" (uuid) "" "" "{}" (op))
        id (uuid)
        audit (social/create-social-audit "SocialConnection" id (op))]
    (pg/t:insert accounts/SocialConnection
      {:id id :audit audit :account account :user brand :status "active"}
      {:track (op)})
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:social-account account}})
    (let [event (queue! fx "/status")]
      (pg/t:insert users/UserBlock {:owner member :target brand} {:track (op)})
      (claim fx) => nil
      (:error-code (outbox event)) => "member_restricted")))

(fact "public comment status rechecks moderation and publication consent before sending"
  (let [fx (inbox)
        owner (member!)
        site (uuid)
        _ (fixture/beach site)
        post
        (post-api/insert-social-post owner site "https://example.test/public" "mock" "" true (op))]
    (pg/t:update posts/SocialPost {:where {:id (:id post)} :set {:status "approved"} :track (op)})
    (let
      [event (queue! fx "/status @finfolk.com.au" "mention" {:url "https://example.test/public"})]
      (str/includes? (:body (outbox event)) "Published on FinFolk") => true
      (pg/t:update posts/SocialPost
        {:where {:id (:id post)} :set {:public-consent false} :track (op)})
      (claim fx) => nil
      (:error-code (outbox event)) => "publication_withdrawn")))

(fact "reconciliation recovers idempotent action claims with fresh leases and fences old callbacks"
  (let
    [fx (inbox)
     event (queue! fx "/connect")
     work (actions/claim-social-action (:application fx) (:inbox fx) (op))]
    (pg/t:update workflow/SocialAction {:where {:id (:id work)} :set {:lease-until 1} :track (op)})
    (:actions (reconcile fx)) => 1
    (:state (pg/t:get workflow/SocialAction {:where {:id (:id work)}})) => "pending"
    (actions/claim-social-action (:application fx) (:inbox fx) (op)) => nil
    (pg/t:update workflow/SocialAction
      {:where {:id (:id work)} :set {:next-attempt-at 0} :track (op)})
    (let [next (actions/claim-social-action (:application fx) (:inbox fx) (op))]
      (not= (:lease next) (:lease work)) => true
      (actions/complete-social-action (:application fx)
                                      (:inbox fx)
                                      (:id work)
                                      (:lease work)
                                      "retry"
                                      "{}"
                                      (op))
      =>
      nil
      (:attempts (pg/t:get workflow/SocialAction {:where {:id (:id work)}})) => 2)))

(fact "action recovery stops after three attempts and expires stale events and proofs"
  (let
    [fx (inbox)
     event (queue! fx "/connect")
     work (actions/claim-social-action (:application fx) (:inbox fx) (op))]
    (pg/t:update workflow/SocialAction
      {:where {:id (:id work)} :set {:lease-until 1 :attempts 3} :track (op)})
    (reconcile fx)
    (:state (pg/t:get workflow/SocialAction {:where {:id (:id work)}})) => "failed"
    (:status (pg/t:get workflow/SocialEvent {:where {:id event}})) => "completed"
    (some? (outbox event)) => true)
  (let
    [fx (inbox)
     event (queue! fx "/connect")]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (reconcile fx)
    (:status (pg/t:get workflow/SocialEvent {:where {:id event}})) => "expired"
    (:state (pg/t:get workflow/SocialAction {:where {:event event}})) => "expired"))

(fact "concurrent delivery claims return one send lease"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     operations [(json/write (op)) (json/write (op))]
     workers (mapv (fn [operation]
                     (future (with-open [db (local/connection)]
                               (jdbc/scalar
                                db
                                "SELECT finfolk_rpc.claim_social_delivery(?::uuid,?::uuid,?::jsonb)"
                                (:application fx)
                                (:inbox fx)
                                operation))))
                   operations)
     results (mapv #(deref % 10000 ::timeout) workers)]
    (some #{::timeout} results) => nil
    (count (filter some? results)) => 1
    (:attempts (outbox event)) => 1))

(fact "the last permitted send stays active until its acknowledgement or lease expiry"
  (let [fx (inbox)
        event (queue! fx "/ping")]
    (pg/t:update delivery/MessagingOutbox {:where {:event event} :set {:attempts 4}})
    (let [work (claim fx)]
      (:deliveries (reconcile fx)) => 0
      (:state (outbox event)) => "sending"
      (:state (complete fx work "accepted" "fifth:accepted" nil)) => "provider_accepted")))

(fact "reconciliation expires inbox-bound proofs and never modifies another inbox"
  (let
    [fx (inbox)
     other (inbox)
     event (issue! fx "EXPIRES2")
     other-event (issue! other "OTHER123")]
    (pg/t:update workflow/SocialConnectionProof
      {:where {:event event} :set {:expires-at 1} :track (op)})
    (:proofs (reconcile fx)) => 1
    (:status (pg/t:get workflow/SocialConnectionProof {:where {:event event}})) => "expired"
    (:status (pg/t:get workflow/SocialConnectionProof {:where {:event other-event}})) => "verified"
    (:state (outbox event)) => "cancelled"
    (fixture/sqlstate #(pg/t:update workflow/SocialConnectionProof
                         {:where {:event other-event} :set {:inbox (:inbox fx)} :track (op)}))
    =>
    "23503"))

(fact
  "reconciliation advances a bounded cursor past valid work instead of starving later stale rows"
  (let [fx (inbox)]
    (dotimes [n 101]
      (queue! fx
              "/connect"
              "message"
              {:senderId (str "sender" n) :conversationId (str "thread" n)}))
    (let
      [last-action (pg/t:get workflow/SocialAction
                     {:where {:inbox (:inbox fx)} :order-by [:id] :order-sort :desc})]
      (pg/t:update workflow/SocialAction
        {:where {:id (:id last-action)} :set {:deadline 1} :track (op)})
      (:more (reconcile fx)) => true
      (:state (pg/t:get workflow/SocialAction {:where {:id (:id last-action)}})) => "pending"
      (:more (reconcile fx)) => false
      (:state (pg/t:get workflow/SocialAction {:where {:id (:id last-action)}})) => "expired"
      (:action-checkpoint (pg/t:get messaging/MessagingAccount {:where {:id (:inbox fx)}}))
      =>
      nil)))

(fact "an expired action claim also terminates its waiting command and event"
  (let
    [fx (inbox)
     event (queue! fx "/connect")]
    (pg/t:update workflow/SocialAction {:where {:event event} :set {:deadline 1} :track (op)})
    (actions/claim-social-action (:application fx) (:inbox fx) (op)) => nil
    (:status (pg/t:get workflow/SocialEvent {:where {:id event}})) => "expired"
    (:state (pg/t:get workflow/SocialCommand {:where {:event event}})) => "expired"))

(fact "trusted worker grants execute delivery while browser roles cannot claim work"
  (let
    [fx (inbox)
     event (queue! fx "/ping")
     row (outbox event)
     operation (json/write (op))
     next-operation (json/write (op))]
    (local/execute! "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC")
    (local/execute! (grants/grants-sql))
    (with-open [db (local/connection)]
      (.setAutoCommit db false)
      (try
        (with-open [s (.createStatement db)]
          (.execute s "GRANT finfolk_social TO CURRENT_USER WITH SET TRUE")
          (.execute s "SET LOCAL ROLE finfolk_social"))
        (let
          [lease (jdbc/scalar
                  db
                  "SELECT finfolk_rpc.claim_social_delivery(?::uuid,?::uuid,?::jsonb)->>'lease'"
                  (:application fx)
                  (:inbox fx)
                  operation)]
          (some? lease) => true
          (jdbc/scalar
           db
           "SELECT finfolk_rpc.complete_social_delivery(?::uuid,?::uuid,?::uuid,?::uuid,'accepted','role:accepted',NULL,?::jsonb)->>'state'"
           (:application fx)
           (:inbox fx)
           (:id row)
           lease
           next-operation)
          =>
          "provider_accepted")
        (with-open [s (.createStatement db)]
          (.execute s "RESET ROLE")
          (.execute s "SET LOCAL ROLE anon"))
        (fixture/sqlstate #(jdbc/scalar
                            db
                            "SELECT finfolk_rpc.claim_social_delivery(?::uuid,?::uuid,'{}'::jsonb)"
                            (:application fx)
                            (:inbox fx)))
        =>
        "42501"
        (finally (.rollback db))))
    (:state (outbox event)) => "pending"))

(fact "a code collision rolls back proof replacement and cancellation of the preceding reply"
  (let
    [fx (inbox)
     _ (issue! fx "COLLIDE1")
     other (inbox)
     previous (issue! other "KEEPCODE")]
    (issue! other "COLLIDE1") => (throws)
    (:status (pg/t:get workflow/SocialConnectionProof {:where {:event previous}})) => "verified"
    (:state (outbox previous)) => "pending"
    (some? (:body-ciphertext (outbox previous))) => true
    (pg/t:count workflow/SocialConnectionProof {:where {:inbox (:inbox other)}}) => 1))


(fact "retention-001: command text clears without destroying a pending reply or deduplication fingerprint"
  (let [fx (inbox) event (queue! fx "/ping")
        original (pg/t:get workflow/SocialEvent {:where {:id event}})
        message (:message-id original)]
    (:body (pg/t:get messaging/MessagingMessage {:where {:id message}})) => "/ping"
    (retention/scrub-social-content (:application fx) (:inbox fx) (op))
    (:body (pg/t:get messaging/MessagingMessage {:where {:id message}})) => ""
    (:fingerprint (pg/t:get workflow/SocialEvent {:where {:id event}})) => (:fingerprint original)
    (:body (outbox event)) => "Pong."
    (let [work (claim fx)]
      (complete fx work "accepted" "retention-reply" nil)
      (retention/scrub-social-content (:application fx) (:inbox fx) (op))
      (:body (outbox event)) => ""
      (:provider-message-id (outbox event)) => "retention-reply")))

(fact "retention-002: thirty-day cleanup is scoped and removes old terminal work only"
  (let [fx (inbox) other (inbox) event (queue! fx "/ping") kept (queue! other "/ping") work (claim fx)]
    (complete fx work "accepted" "old-reply" nil)
    (pg/t:update workflow/SocialEvent {:where {:id event} :set {:time-created 1} :track (op)})
    (:purged (retention/purge-social-diagnostics (:application fx) (:inbox fx) (op))) => 1
    (pg/t:get workflow/SocialEvent {:where {:id event}}) => nil
    (some? (pg/t:get workflow/SocialEvent {:where {:id kept}})) => true))


(fact "operator-001: public activation requires real current-generation acceptance"
  (let [fx (inbox)]
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:mode "disabled"}})
    (operator/activate-social-inbox (:application fx) (:inbox fx) 1 "live" "[]") => (throws)
    (:mode (pg/t:get messaging/MessagingAccount {:where {:id (:inbox fx)}})) => "disabled"
    (:generation (operator/ret-social-operator-health (:application fx) (:inbox fx))) => 1
    (operator/record-social-acceptance (:application fx) (:inbox fx) 1 (uuid) (uuid) (uuid) (uuid) (uuid) "{}" (op)) => (throws)))

(fact "dispatch-001: a code needs fresh scoped eligibility and current authority after lookup"
  (let [fx (inbox) event (issue! fx "FRESH456") work (claim fx)
        proof (:verification work)
        evidence {:provider (:provider proof) :namespace (:namespace proof) :externalId (:external-id proof) :eligible true}]
    (:provider proof) => "mock"
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) "{}") => false
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) (json/write (assoc evidence :eligible false))) => false
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) (json/write evidence)) => true
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) (json/write (assoc evidence :externalId "another"))) => false
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:generation 2}})
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) (json/write evidence)) => false))

(fact "dispatch-002: public help skips identity lookup but still checks pause and send lease"
  (let [fx (inbox) event (queue! fx "/help") work (claim fx)]
    (:verification work) => nil
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) "{}") => true
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (uuid) "{}") => false
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:mode "disabled"}})
    (sends/confirm-social-delivery (:application fx) (:inbox fx) (:id work) (:lease work) "{}") => false))


(fact "bootstrap-001: privileged brand setup is idempotent and starts paused"
  (let [application (uuid) inbox-id (uuid) owner (member!)]
    (operator/bootstrap-social-inbox application inbox-id owner (op)) => (throws)
    (pg/t:update users/User {:where {:id owner} :set {:email-verified true}})
    (:inbox-id (operator/bootstrap-social-inbox application inbox-id owner (op))) => inbox-id
    (:inbox-id (operator/bootstrap-social-inbox application inbox-id owner (op))) => inbox-id
    (:mode (pg/t:get messaging/MessagingAccount {:where {:id inbox-id}})) => "disabled"))


(fact "rollout-001: pilot and public activation fence queued receipts while retaining tested acceptance"
  (let [fx (inbox) owner (member!)]
    (pg/t:update messaging/MessagingAccount
      {:where {:id (:inbox fx)} :set {:mode "disabled" :credential-ciphertext "mock-credential"
        :checks (json/write {:provider "mock" :accountId (:inbox fx) :authorized true :subscribed true :nonExpiring true})}})
    (let [paused (queue! fx "/ping")]
      (:generation (operator/activate-social-inbox (:application fx) (:inbox fx) 1 "pilot" "[\"sender\",\"nonfollower\",\"denied\"]")) => 2
      (:status (events/process-social-event (:application fx) (:inbox fx) (op))) => "expired"
      (outbox paused) => nil)
    (let [ping (queue! fx "/ping") help (queue! fx "/help")
          nonfollower (queue! fx "/help" "message" {:senderId "nonfollower" :conversationId "nonfollower"})
          linked (issue! fx "ROLLOUT1")
          denied (queue! fx "/connect" "message" {:senderId "denied" :conversationId "denied"})
          work (actions/claim-social-action (:application fx) (:inbox fx) (op))
          request (:request work)]
      (action-complete fx work {:provider (:provider request) :namespace (:namespace request) :externalId (:external-id request) :eligible false})
      (loop [] (when-let [reply (claim fx)] (complete fx reply "accepted" (str "mock-" (uuid)) nil) (recur)))
      (connections/redeem-social-connection (:application fx) (:inbox fx) owner "ROLLOUT1" (op))
      (:accepted (operator/record-social-acceptance (:application fx) (:inbox fx) 2 ping help nonfollower linked denied
                    "{\"visibleReplies\":true,\"nonFollowerHelp\":true,\"nonFollowerLinkDenied\":true,\"linkUnlinkRelink\":true}" (op))) => true
      (let [now (* (System/currentTimeMillis) 1000)
            queued (events/receive-social-event (:application fx) (:inbox fx)
                     (json/write {:channel "message" :senderId "outside-pilot" :conversationId "outside-pilot" :messageId (uuid) :body "/help" :sentAt now :deadline (+ now 3600000000)}) (op))]
        (:generation (operator/activate-social-inbox (:application fx) (:inbox fx) 2 "live" "[]")) => 3
        (:status (events/process-social-event (:application fx) (:inbox fx) (op))) => "expired"
        (outbox (:id queued)) => nil
        (:generation (operator/activate-social-inbox (:application fx) (:inbox fx) 3 "live" "[]")) => 3
        (let [old (events/receive-social-event (:application fx) (:inbox fx)
                    (json/write {:channel "message" :senderId "late-retry" :conversationId "late-retry" :messageId (uuid) :body "/ping" :sentAt (- now 60000000) :deadline (+ now 3600000000)}) (op))]
          (:status (events/process-social-event (:application fx) (:inbox fx) (op))) => "expired"
          (outbox (:id old)) => nil)))))


(fact "handle-001: Instagram linking records only the scoped provider-verified handle"
  (let [fx (inbox) owner (member!)]
    (pg/t:update users/User {:where {:id owner} :set {:email-verified true}})
    (pg/t:update messaging/MessagingAccount {:where {:id (:inbox fx)} :set {:provider "instagram"}})
    (issue! fx "HANDLE12")
    (let [snapshot (interop/prepare-social-redemption (:application fx) (:inbox fx) owner "HANDLE12" (apply str (repeat 64 "a")) (op))
          wire {:proofId (:proof-id snapshot) :provider (:provider snapshot) :namespace (:namespace snapshot)
                :externalId (:external-id snapshot) :conversationId (:conversation-id snapshot) :generation (:generation snapshot) :accountGeneration (:account-generation snapshot) :checkedAt (:checked-at snapshot)}
          proof {:provider (:provider snapshot) :namespace (:namespace snapshot) :externalId (:external-id snapshot) :eligible true :handle "reef.diver"}]
      (some? (interop/complete-social-redemption (:application fx) (:inbox fx) owner "HANDLE12" (json/write wire) (json/write proof) (op))) => true
      (:handle (interop/ret-social-member-connection (:application fx) (:inbox fx) owner)) => "reef.diver")))
