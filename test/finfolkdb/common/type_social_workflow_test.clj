(ns finfolkdb.common.type-social-workflow-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]
            [std.json :as json]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [finfolkdb.common.type-social-workflow :as t]
             [postgres.core :as pg]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.common.type-social-account :as account]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.common.type-system-site :as site]
             [finfolkdb.fn.user.user-manage-posts :as post-api]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

(defn workflow-fixture
  [tag]
  (let [owner (fixture/id (str tag "-owner"))
        _ (fixture/member owner)
        account-id (social/insert-social-account "instagram"
                                                 tag
                                                 "opaque-author"
                                                 "ocean" ""
                                                 "{}" (fixture/op "account" owner))]
    {:owner owner :account-id (str account-id)}))

^{:refer finfolkdb.common.type-social-workflow/SocialConnectionProof :added "0.1"}
(fact "manual proofs persist their account and expiry without inventing verification"
  (let [{:keys [owner account-id]} (workflow-fixture "proof-fixture")
        proof (social/begin-social-proof account-id
                                         owner
                                         "manual"
                                         (apply str (repeat 64 "a"))
                                         nil
                                         nil
                                         600
                                         (fixture/op "proof" owner))]
    (try
      (select-keys (pg/t:get t/SocialConnectionProof {:where {:id (:id proof)}})
                   [:account-id :user-id :status :verified-at :consumed-at])
      =>
      {:account-id account-id :user-id owner :status "pending" :verified-at nil :consumed-at nil}
      (finally (pg/t:delete t/SocialConnectionProof {:where {:id (:id proof)}})
               (pg/t:delete account/SocialAccount {:where {:id account-id}})))))

^{:refer finfolkdb.common.type-social-workflow/SocialSource
  :covers [finfolkdb.common.type-social-workflow/SocialEvent]
  :added "0.1"}
(fact "collection sources retain account relationships and events deduplicate provider deliveries"
  (let [{:keys [owner account-id]} (workflow-fixture "source-fixture")
        source (pg/t:insert t/SocialSource
                 {:provider "instagram"
                  :namespace "source-fixture"
                  :key "account:opaque-author"
                  :account account-id
                  :kind "account"}
                 {:track (fixture/op "source" owner)})
        event (pg/t:insert t/SocialEvent
                {:provider "instagram"
                 :namespace "source-fixture"
                 :key "opaque-event"
                 :account account-id
                 :payload "{\"type\":\"mention\"}"}
                {:track {}})]
    (try
      (:account-id (pg/t:get t/SocialSource {:where {:id (:id source)}})) => account-id
      (select-keys (pg/t:get t/SocialEvent {:where {:id (:id event)}}) [:status :attempts :payload])
      =>
      {:status "queued" :attempts 0 :payload {:type "mention"}}
      (fixture/sqlstate
       #(pg/t:insert t/SocialEvent
          {:provider "instagram" :namespace "source-fixture" :key "opaque-event" :payload "{}"}
          {:track {}}))
      =>
      "23505"
      (fixture/sqlstate
       #(pg/t:update t/SocialSource
          {:where {:id (:id source)} :set {:lease (str (java.util.UUID/randomUUID))} :track {}}))
      =>
      "23514"
      (:lease (pg/t:get t/SocialSource {:where {:id (:id source)}})) => nil
      (pg/t:update t/SocialEvent
        {:where {:id (:id event)} :set {:attempts 1 :status "retry"} :track {}})
      (:attempts (pg/t:get t/SocialEvent {:where {:id (:id event)}})) => 1
      (finally (pg/t:delete t/SocialEvent {:where {:id (:id event)}})
               (pg/t:delete t/SocialSource {:where {:id (:id source)}})
               (pg/t:delete account/SocialAccount {:where {:id account-id}})))))

^{:refer finfolkdb.common.type-social-workflow/SocialSuppressedSource
  :covers [finfolkdb.common.type-social-workflow/SocialRateLimit]
  :added "0.1"}
(fact "suppression and rate limits retain provider scope and reject negative counters"
  (let [suppression (pg/t:insert t/SocialSuppressedSource
                      {:provider "tiktok"
                       :namespace "limits-app"
                       :external-author-id "opaque-author"
                       :reason "member request"}
                      {:track {}})
        limit (pg/t:insert t/SocialRateLimit
                {:provider "tiktok"
                 :namespace "limits-app"
                 :purpose "connect"
                 :bucket "opaque-author"
                 :resets-at 4070908800000000}
                {:track {}})]
    (try
      (:reason (pg/t:get t/SocialSuppressedSource {:where {:id (:id suppression)}}))
      =>
      "member request"
      (:count (pg/t:get t/SocialRateLimit {:where {:id (:id limit)}})) => 0
      (fixture/sqlstate #(pg/t:update t/SocialRateLimit
                           {:where {:id (:id limit)} :set {:count -1} :track {}}))
      =>
      "23514"
      (:count (pg/t:get t/SocialRateLimit {:where {:id (:id limit)}})) => 0
      (finally (pg/t:delete t/SocialRateLimit {:where {:id (:id limit)}})
               (pg/t:delete t/SocialSuppressedSource {:where {:id (:id suppression)}})))))

^{:refer finfolkdb.common.type-social-workflow/SocialAction
  :covers [finfolkdb.common.type-social-workflow/SocialCommand]
  :added "0.1"}
(fact "actions and commands retain member identity and require explicit confirmation"
  (let [{:keys [owner account-id]} (workflow-fixture "action-fixture")
        action-id (str (java.util.UUID/randomUUID))
        audit (social/create-social-audit "SocialAction" action-id (fixture/op "audit" owner))
        action (pg/t:insert t/SocialAction
                 {:id action-id
                  :audit audit
                  :account account-id
                  :source-id "opaque-comment"
                  :kind "dive"
                  :owner owner}
                 {:track {}})
        command (pg/t:insert t/SocialCommand
                  {:account account-id
                   :key "opaque-command"
                   :context "mention"
                   :external-actor-id "opaque-actor"
                   :command "dive"}
                  {:track {}})]
    (try
      (select-keys (pg/t:get t/SocialAction {:where {:id action-id}})
                   [:account-id :owner-id :state :member-confirmed])
      =>
      {:account-id account-id :owner-id owner :state "review" :member-confirmed false}
      (select-keys (pg/t:get t/SocialCommand {:where {:id (:id command)}}) [:state :send-state])
      =>
      {:state "new" :send-state "pending"}
      (finally (pg/t:delete t/SocialAction {:where {:id action-id}})
               (pg/t:delete t/SocialCommand {:where {:id (:id command)}})
               (pg/t:delete account/SocialAccount {:where {:id account-id}})))))

^{:refer finfolkdb.common.type-social-workflow/SocialDiscoveryReport
  :covers [finfolkdb.common.type-social-workflow/SocialDiscovery]
  :added "0.1"}
(fact "deleting a discovery removes its moderation reports"
  (let [{:keys [owner account-id]} (workflow-fixture "report-fixture")
        discovery-id (social/insert-social-discovery account-id
                                                     nil
                                                     "opaque-media"
                                                     "https://example.test/media"
                                                     owner
                                                     nil
                                                     "Caption" "[]"
                                                     "{}" (fixture/op "discovery" owner))
        report (pg/t:insert t/SocialDiscoveryReport
                 {:discovery discovery-id :reason "wrong_location" :day "2026-11-15"}
                 {:track {}})]
    (try
      (:discovery-id (pg/t:get t/SocialDiscoveryReport {:where {:id (:id report)}}))
      =>
      (str discovery-id)
      (pg/t:delete t/SocialDiscovery {:where {:id discovery-id}})
      (pg/t:get t/SocialDiscoveryReport {:where {:id (:id report)}}) => nil
      (finally (pg/t:delete t/SocialDiscovery {:where {:id discovery-id}})
               (pg/t:delete account/SocialAccount {:where {:id account-id}})))))

(fact "discoveries from either provider require moderation and current public consent"
  (doseq [provider ["instagram" "tiktok"]]
    (let [owner (fixture/id (str "discovery-owner-" provider))
          beach (fixture/id (str "discovery-beach-" provider))
          _ (fixture/member owner)
          _ (fixture/beach beach)
          op #(fixture/op % owner)
          account-id (social/insert-social-account provider
                                                   "discovery-app" "external-author"
                                                   "handle" ""
                                                   "{}" (op "account"))
          url (str "https://example.test/" provider "/media")
          discovery (social/insert-social-discovery account-id
                                                    nil
                                                    "opaque-media+/="
                                                    url
                                                    owner
                                                    beach
                                                    "Private caption" "[]"
                                                    "{}" (op "discover"))
          repeated (social/insert-social-discovery account-id
                                                   nil
                                                   "opaque-media+/="
                                                   url
                                                   owner
                                                   beach
                                                   "Duplicate" "[]"
                                                   "{}" (op "repeat"))
          post (post-api/insert-social-post owner beach url provider "handle" false (op "post"))]
      (fixture/expect! "provider media is idempotent" discovery repeated)
      (fixture/expect! "unreviewed content is not public"
                       nil
                       (social/ret-social-discovery-public discovery owner))
      (fixture/expect! "pending post cannot publish discovery"
                       false
                       (social/publish-social-discovery discovery (:id post) (op "pending")))
      (pg/t:update posts/SocialPost
        {:where {:id (:id post)} :set {:status "approved"} :track (op "approve")})
      (fixture/expect! "approval alone does not supply consent"
                       false
                       (social/publish-social-discovery discovery (:id post) (op "no-consent")))
      (pg/t:update posts/SocialPost
        {:where {:id (:id post)} :set {:public-consent true} :track (op "consent")})
      (fixture/expect! "approved consented post publishes discovery"
                       true
                       (social/publish-social-discovery discovery (:id post) (op "publish")))
      (fixture/expect! "public projection returns only the linked post"
                       (:id post)
                       (:id (social/ret-social-discovery-public discovery owner)))
      (pg/t:update posts/SocialPost
        {:where {:id (:id post)} :set {:public-consent false} :track (op "withdraw")})
      (fixture/expect! "withdrawing consent immediately hides published discovery"
                       nil
                       (social/ret-social-discovery-public discovery owner))))
  =>
  nil)
