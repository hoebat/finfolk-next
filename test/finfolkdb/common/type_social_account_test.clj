(ns finfolkdb.common.type-social-account-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.behavior :as fixture]
            [finfolkdb.schema.social :as grants]
            [std.json :as json]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.social.social-messaging :as social-messaging]
             [finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [finfolkdb.common.type-social-account :as t]
             [postgres.core :as pg]
             [finfolkdb.fn.social.social-manage :as social]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-social-post :as posts]
             [finfolkdb.common.type-system-site :as site]
             [finfolkdb.common.type-media-import :as media]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-social-account/SocialAccount :added "0.1"}
(fact "SocialAccount retains opaque provider identity and rejects empty namespaces"
  (let [owner (fixture/id "account-fixture-owner")
        _ (fixture/member owner)
        id (social/insert-social-account "instagram"
                                         "fixture-app" "opaque+/="
                                         "ocean" "Ocean"
                                         "{}" (fixture/op "account" owner))]
    (try
      (select-keys (pg/t:get t/SocialAccount {:where {:id id}})
                   [:provider :namespace :external-id :handle :generation])
      =>
      {:provider "instagram"
       :namespace "fixture-app"
       :external-id "opaque+/="
       :handle "ocean"
       :generation 1}
      (fixture/sqlstate #(pg/t:update t/SocialAccount
                           {:where {:id id} :set {:namespace " "} :track {}}))
      =>
      "23514"
      (:namespace (pg/t:get t/SocialAccount {:where {:id id}})) => "fixture-app"
      (finally (pg/t:delete t/SocialAccount {:where {:id id}})))))

^{:refer finfolkdb.common.type-social-account/SocialConnection :added "0.1"}
(fact "SocialConnection starts private and rejects missing account relationships"
  (let [owner (fixture/id "connection-fixture-owner")
        _ (fixture/member owner)
        account (social/insert-social-account "tiktok"
                                              "fixture-app" "connection-account"
                                              "ocean" ""
                                              "{}" (fixture/op "account" owner))
        id (str (java.util.UUID/randomUUID))
        audit (social/create-social-audit "SocialConnection" id (fixture/op "audit" owner))]
    (try
      (pg/t:insert t/SocialConnection
        {:id id :audit audit :user owner :account account}
        {:track (fixture/op "connection" owner)})
      (select-keys (pg/t:get t/SocialConnection {:where {:id id}})
                   [:user-id :account-id :status :share-posts :public-points])
      =>
      {:user-id owner
       :account-id (str account)
       :status "pending"
       :share-posts false
       :public-points false}
      (fixture/sqlstate
       #(pg/t:update t/SocialConnection
          {:where {:id id} :set {:account (str (java.util.UUID/randomUUID))} :track {}}))
      =>
      "23503"
      (:account-id (pg/t:get t/SocialConnection {:where {:id id}})) => (str account)
      (finally (pg/t:delete t/SocialConnection {:where {:id id}})
               (pg/t:delete t/SocialAccount {:where {:id account}})))))

(defn digest
  [value]
  (format "%064x"
          (java.math.BigInteger. 1
                                 (.digest (java.security.MessageDigest/getInstance "SHA-256")
                                          (.getBytes value "UTF-8")))))

(fact "both providers preserve namespace isolation, proof binding, consent and revocation"
  (doseq [provider ["instagram" "tiktok"]]
    (let [owner (fixture/id (str "social-owner-" provider))
          other (fixture/id (str "social-other-" provider))
          _ (fixture/member owner)
          _ (fixture/member other)
          op #(fixture/op % owner)
          account-id (social/insert-social-account provider
                                                   "app-one" "opaque-account+/="
                                                   "handle" "Name"
                                                   "{}" (op "account"))
          _ (pg/t:update t/SocialAccount
              {:where {:id account-id} :set {:handle "renamed"} :track (op "rename")})
          same (social/insert-social-account provider
                                             "app-one" "opaque-account+/="
                                             "renamed" "Name"
                                             "{}" (op "repeat"))
          different (social/insert-social-account provider
                                                  "app-two" "opaque-account+/="
                                                  "handle" "Name"
                                                  "{}" (op "namespace"))
          token (digest (str provider "token"))
          nonce (digest (str provider "nonce"))
          flow (digest (str provider "flow"))
          proof
          (social/begin-social-proof account-id owner "oauth" token nonce flow 600 (op "proof"))
          evidence (json/write {:verified true
                                :provider provider
                                :namespace "app-one"
                                :externalId "opaque-account+/="})]
      (fixture/expect! "account identity is stable across handle changes" account-id same)
      (fixture/expect! "application namespaces isolate external IDs" false (= account-id different))
      (fixture/expect! "wrong provider evidence is rejected"
                       "P0001"
                       (fixture/sqlstate #(social/verify-social-proof
                                           (:id proof)
                                           (json/write {:verified true
                                                        :provider "other"
                                                        :namespace "app-one"
                                                        :externalId "opaque-account+/="})
                                           (op "bad-proof"))))
      (fixture/expect! "provider evidence verifies proof"
                       true
                       (social/verify-social-proof (:id proof) evidence (op "verified")))
      (fixture/expect! "callback nonce cannot be omitted"
                       nil
                       (social/connect-social-account owner
                                                      (:id proof)
                                                      token
                                                      nil
                                                      flow
                                                      "ENCRYPTED"
                                                      nil
                                                      nil
                                                      "[]"
                                                      "[]"
                                                      (op "wrong-nonce")))
      (let [connection (social/connect-social-account owner
                                                      (:id proof)
                                                      token
                                                      nonce
                                                      flow
                                                      "ENCRYPTED"
                                                      nil
                                                      nil
                                                      "[]"
                                                      "[]"
                                                      (op "connected"))
            id (:id connection)
            row (pg/t:get t/SocialConnection {:where {:id id}})
            version (:identity-version row)
            second-token (digest (str provider "second"))
            second-proof (social/begin-social-proof account-id
                                                    other
                                                    "message"
                                                    second-token
                                                    nil
                                                    nil
                                                    600
                                                    (op "other-proof"))]
        (fixture/expect! "connection is active" "active" (:status row))
        (fixture/expect! "private imports cannot use another member's connection"
                         "23503"
                         (fixture/sqlstate #(pg/t:insert media/MediaImport
                                              {:owner other
                                               :connection id
                                               :platform provider
                                               :provider-namespace "app-one"
                                               :provider-id "private-media"
                                               :url "https://example.test/private"}
                                              {:track (op "cross-owner-import")})))
        (fixture/expect! "connection never implies sharing consent" false (:share-posts row))
        (fixture/expect! "credentials are excluded from RPC response"
                         false
                         (contains? connection :credential-ciphertext))
        (fixture/expect! "proof is single use"
                         nil
                         (social/connect-social-account owner
                                                        (:id proof)
                                                        token
                                                        nonce
                                                        flow
                                                        nil
                                                        nil
                                                        nil
                                                        "[]"
                                                        "[]"
                                                        (op "replay")))
        (social/verify-social-proof (:id second-proof) evidence (op "other-verified"))
        (fixture/expect! "another user cannot take an active connection"
                         "P0001"
                         (fixture/sqlstate #(social/connect-social-account other
                                                                           (:id second-proof)
                                                                           second-token
                                                                           nil
                                                                           nil
                                                                           nil
                                                                           nil
                                                                           nil
                                                                           "[]"
                                                                           "[]"
                                                                           (op "takeover"))))
        (fixture/expect!
         "stale identity versions cannot disconnect"
         false
         (social/disconnect-social-account owner id (str (java.util.UUID/randomUUID)) (op "stale")))
        (fixture/expect! "sharing is explicit"
                         true
                         (social/set-social-sharing owner id version true true (op "sharing")))
        (fixture/expect! "disconnect succeeds"
                         true
                         (social/disconnect-social-account owner id version (op "disconnect")))
        (let [revoked (pg/t:get t/SocialConnection {:where {:id id}})]
          (fixture/expect! "revocation clears ciphertext and consent"
                           ["revoked" nil false false]
                           [(:status revoked) (:credential-ciphertext revoked)
                            (:share-posts revoked) (:public-points revoked)]))
        (fixture/expect! "disconnect invalidates outstanding proofs"
                         nil
                         (social/connect-social-account other
                                                        (:id second-proof)
                                                        second-token
                                                        nil
                                                        nil
                                                        nil
                                                        nil
                                                        nil
                                                        "[]"
                                                        "[]"
                                                        (op "revoked-proof"))))))
  =>
  nil)

(fact "expired proofs and retired account generations cannot connect"
  (let
    [owner (fixture/id "expired-social-owner")
     _ (fixture/member owner)
     op #(fixture/op % owner)
     account-id
     (social/insert-social-account "instagram" "expiry-app" "opaque" "" "" "{}" (op "account"))
     proof (social/begin-social-proof account-id
                                      owner
                                      "manual"
                                      (digest "expired")
                                      nil
                                      nil
                                      30
                                      (op "proof"))]
    (pg/t:update workflow/SocialConnectionProof
      {:where {:id (:id proof)} :set {:expires-at 1} :track (op "expire")})
    (social/verify-social-proof
     (:id proof)
     "{\"verified\":true,\"provider\":\"instagram\",\"namespace\":\"expiry-app\",\"externalId\":\"opaque\"}"
     (op "verify"))
    =>
    false))

(fact "trusted social grants support account writes while browser roles cannot execute them"
  ;; Runtime setup emits declarations; apply the same privilege boundary as the native
  ;; installer.
  (local/execute! "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finfolk,finfolk_rpc FROM PUBLIC")
  (local/execute! (grants/grants-sql))
  (with-open [db (local/connection)]
    (.setAutoCommit db false)
    (try
      ;; Supabase's postgres login is not a superuser. Grant SET only inside
      ;; this transaction, then roll back both the membership and fixture row.
      (with-open [s (.createStatement db)]
        (.execute s "GRANT finfolk_social TO CURRENT_USER WITH SET TRUE")
        (.execute s "SET LOCAL ROLE finfolk_social"))
      (let
        [id
         (jdbc/scalar
          db
          "SELECT finfolk_rpc.insert_social_account('instagram','role-fixture','opaque-role-account','ocean','','{}'::jsonb,finfolk.op_fn('role-fixture',NULL,'{}'::jsonb))")]
        (jdbc/scalar db "SELECT namespace FROM finfolk.\"SocialAccount\" WHERE id=?::uuid" id)
        =>
        "role-fixture")
      (with-open [s (.createStatement db)]
        (.execute s "RESET ROLE")
        (.execute s "SET LOCAL ROLE anon"))
      (fixture/sqlstate
       #(jdbc/scalar
         db
         "SELECT finfolk_rpc.insert_social_account('instagram','browser-fixture','opaque-browser-account','','','{}'::jsonb,'{}'::jsonb)"))
      =>
      "42501"
      (finally (.rollback db))))
  (pg/t:count t/SocialAccount {:where {:namespace "browser-fixture"}}) => 0
  (pg/t:count t/SocialAccount {:where {:namespace "role-fixture"}}) => 0)
