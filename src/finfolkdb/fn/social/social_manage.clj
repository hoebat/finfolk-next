(ns finfolkdb.fn.social.social-manage
  "Trusted adapter transactions. Provider HTTP, signature checks and encryption stay outside PostgreSQL."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-social-account :as social]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-social-post :as post]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-seed :as seed]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.fn.helper.helper-access :as access]
             [finfolkdb.fn.user.user-manage-posts :as posts]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:uuid]}
  create-social-audit
  [:text i-table :uuid i-id :jsonb o-op]
  (let [o-audit (pg/t:insert system/Audit
                  {:class-table i-table :class-context "Global" :class-ref i-id}
                  {:track o-op})]
    (return (pg/id o-audit))))

(defn.pg ^{:- [:uuid]}
  record-social-audit
  [:text i-table :uuid i-audit :text i-event :jsonb o-op]
  (let [o-log (pg/t:insert system/AuditLog
                {:class-table i-table
                 :class-context "Global"
                 :audit i-audit
                 :entry (pg/jsonb-build-object "event" i-event)}
                {:track o-op})]
    (return (pg/id o-log))))

(defn.pg ^{:- [:uuid]}
  insert-social-account
  [:text i-provider :text i-namespace :text i-external-id :text i-handle :text i-display-name :jsonb
   i-provider-data :jsonb o-op]
  (let [o-data (seed/as-jsonb i-provider-data)]
    (when (or (not (or (== i-provider "instagram") (== i-provider "tiktok") (== i-provider "mock")))
              (== (pg/coalesce (pg/btrim i-namespace) "") "")
              (== (pg/coalesce (pg/btrim i-external-id) "") ""))
      [:raise-exception "Provider, namespace and external account identity are required"])
    [:perform
     (#{"pg_advisory_xact_lock"}
      (#{"hashtextextended"}
       (:text (pg/jsonb-build-array i-provider i-namespace i-external-id))
       0))]
    (let [o-existing (pg/t:get social/SocialAccount
                       {:where {:provider (++ i-provider domain/EnumSocialProvider)
                                :namespace i-namespace
                                :external-id i-external-id}})]
      (when [o-existing :is-not-null]
        (return (:uuid (:->> o-existing "id"))))
      (let [(:uuid v-id) (pg/uuid-generate-v4)
            (:uuid v-audit) (-/create-social-audit "SocialAccount" v-id o-op)
            o-account (pg/t:insert social/SocialAccount
                        {:id v-id
                         :audit v-audit
                         :provider (++ i-provider domain/EnumSocialProvider)
                         :namespace i-namespace
                         :external-id i-external-id
                         :handle (pg/coalesce i-handle "")
                         :display-name (pg/coalesce i-display-name "")
                         :provider-data o-data}
                        {:track o-op})
            (:uuid v-log) (-/record-social-audit "SocialAccount" v-audit "created" o-op)]
        (return v-id)))))

(defn.pg begin-social-proof
  [:uuid i-account :uuid i-user :text i-kind :text i-token-hash :text i-nonce-hash :text i-flow-key
   :integer i-ttl :jsonb o-op]
  (let [o-account (pg/t:get social/SocialAccount {:where {:id i-account} :for [:update]})]
    (when (or [o-account :is-null]
              (and [i-user :is-not-null] (not (access/is-user-active i-user)))
              [i-token-hash :is-null]
              (not (#{"regexp_like"} i-token-hash "^[a-f0-9]{64}$"))
              (and (== i-kind "oauth")
                   (or (not (pg/coalesce (#{"regexp_like"} i-nonce-hash "^[a-f0-9]{64}$") false))
                       (not (pg/coalesce (#{"regexp_like"} i-flow-key "^[a-f0-9]{64}$") false))))
              [i-ttl :is-null]
              (< i-ttl 30)
              (> i-ttl 900))
      [:raise-exception "Invalid social proof intent"])
    (let [o-proof (pg/t:insert workflow/SocialConnectionProof
                    {:account i-account
                     :user i-user
                     :kind (++ i-kind domain/EnumSocialProofKind)
                     :token-hash i-token-hash
                     :nonce-hash i-nonce-hash
                     :flow-key i-flow-key
                     :generation (:integer (:->> o-account "generation"))
                     :expires-at (+ (pg/time-us) (* (:bigint i-ttl) 1000000))}
                    {:track o-op})]
      (return (pg/jsonb-build-object "id" (pg/id o-proof)
                                     "expiresAt" (:-> o-proof "expires_at"))))))

(defn.pg ^{:- [:boolean]}
  verify-social-proof
  "Called only with evidence already verified by a trusted provider adapter."
  [:uuid i-proof :jsonb i-evidence :jsonb o-op]
  (let [o-initial (pg/t:get workflow/SocialConnectionProof {:where {:id i-proof}})
        o-account (pg/t:get social/SocialAccount
                    {:where {:id (:uuid (:->> o-initial "account_id"))} :for [:update]})
        o-proof (pg/t:get workflow/SocialConnectionProof {:where {:id i-proof} :for [:update]})
        o-evidence (seed/as-jsonb i-evidence)]
    (when (or [o-proof :is-null]
              [o-account :is-null]
              (not= (:->> o-proof "status") "pending")
              (<= (:bigint (:->> o-proof "expires_at")) (pg/time-us))
              (not= (:integer (:->> o-proof "generation"))
                    (:integer (:->> o-account "generation"))))
      (return false))
    (when (or (not= (pg/jsonb-typeof (:-> o-evidence "verified")) "boolean")
              (not (pg/coalesce (:boolean (:->> o-evidence "verified")) false))
              (not= (pg/coalesce (:->> o-evidence "provider") "") (:->> o-account "provider"))
              (not= (pg/coalesce (:->> o-evidence "namespace") "") (:->> o-account "namespace"))
              (not= (pg/coalesce (:->> o-evidence "externalId") "") (:->> o-account "external_id")))
      [:raise-exception "Verified social evidence does not match its provider account"])
    (let [o-verified (pg/t:update workflow/SocialConnectionProof
                       {:where {:id i-proof}
                        :set
                        {:status "verified" :verified-at (pg/time-us) :provider-data o-evidence}
                        :track o-op})]
      (return true))))

(defn.pg connect-social-account
  "Consume a verified proof once. Connecting never opts a member into public sharing."
  [:uuid i-user :uuid i-proof :text i-token-hash :text i-nonce-hash :text i-flow-key :text
   i-ciphertext :bigint i-access-expires :bigint i-refresh-expires :jsonb i-capabilities :jsonb
   i-scopes :jsonb o-op]
  (let [o-initial (pg/t:get workflow/SocialConnectionProof {:where {:id i-proof}})
        (:uuid v-account) (:uuid (:->> o-initial "account_id"))
        o-account (pg/t:get social/SocialAccount {:where {:id v-account} :for [:update]})
        o-proof (pg/t:get workflow/SocialConnectionProof {:where {:id i-proof} :for [:update]})
        (:uuid v-version) (pg/uuid-generate-v4)]
    (when (or (not (access/is-user-active i-user))
              [o-account :is-null]
              [o-proof :is-null]
              (not= (:->> o-proof "status") "verified")
              (not= (pg/coalesce (:->> (:-> o-proof "provider_data") "purpose") "connect") "connect")
              [i-token-hash :is-null]
              (not= (:->> o-proof "token_hash") i-token-hash)
              (not= (pg/coalesce (:->> o-proof "nonce_hash") "") (pg/coalesce i-nonce-hash ""))
              (not= (pg/coalesce (:->> o-proof "flow_key") "") (pg/coalesce i-flow-key ""))
              (<= (:bigint (:->> o-proof "expires_at")) (pg/time-us))
              (not= (:integer (:->> o-proof "generation")) (:integer (:->> o-account "generation")))
              (and [(:->> o-proof "user_id") :is-not-null]
                   (not= (:uuid (:->> o-proof "user_id")) i-user)))
      (return nil))
    (when (or (not= (pg/jsonb-typeof i-capabilities) "array")
              (not= (pg/jsonb-typeof i-scopes) "array")
              (and [i-access-expires :is-not-null] (<= i-access-expires (pg/time-us)))
              (and [i-refresh-expires :is-not-null] (<= i-refresh-expires (pg/time-us))))
      [:raise-exception "Invalid social authorization scope or expiry"])
    (let [o-current (pg/t:get social/SocialConnection
                      {:where {:account v-account :status [:neq "revoked"]} :for [:update]})
          (:uuid v-id) (pg/coalesce (:uuid (:->> o-current "id")) (pg/uuid-generate-v4))
          (:uuid v-audit) (pg/coalesce (:uuid (:->> o-current "audit_id"))
                                       (-/create-social-audit "SocialConnection" v-id o-op))]
      (when (and [o-current :is-not-null] (not= (:uuid (:->> o-current "user_id")) i-user))
        [:raise-exception "Social account already has another member connection"])
      (when [o-current :is-null]
        (let [o-new (pg/t:insert social/SocialConnection
                      {:id v-id :audit v-audit :user i-user :account v-account}
                      {:track o-op})]
          nil))
      (let [o-saved (pg/t:update social/SocialConnection
                      {:where {:id v-id}
                       :set {:status "active"
                             :identity-version v-version
                             :generation (+ (pg/coalesce (:integer (:->> o-current "generation")) 0)
                                            1)
                             :credential-ciphertext i-ciphertext
                             :access-expires-at i-access-expires
                             :refresh-expires-at i-refresh-expires
                             :credential-lease nil
                             :lease-until nil
                             :capabilities i-capabilities
                             :granted-scopes i-scopes
                             :share-posts false
                             :public-points false}
                       :track o-op})
            o-consumed (pg/t:update workflow/SocialConnectionProof
                         {:where {:id i-proof}
                          :set {:status "consumed"
                                :user i-user
                                :connection v-id
                                :consumed-at (pg/time-us)
                                :consumed-version v-version}
                          :track o-op})
            o-generation (pg/t:update social/SocialAccount
                           {:where {:id v-account}
                            :set {:generation (+ (:integer (:->> o-account "generation")) 1)}
                            :track o-op})
            (:uuid v-log) (-/record-social-audit "SocialConnection" v-audit "connected" o-op)]
        (return (pg/jsonb-build-object "id" v-id
                                       "accountId" v-account
                                       "identityVersion" v-version
                                       "status" "active"
                                       "sharePosts" false
                                       "publicPoints" false))))))

(defn.pg ^{:- [:boolean]}
  set-social-sharing
  [:uuid i-user :uuid i-connection :uuid i-version :boolean i-share :boolean i-points :jsonb o-op]
  (let [o-row (pg/t:get social/SocialConnection {:where {:id i-connection} :for [:update]})]
    (when (or (not (access/is-user-active i-user))
              [o-row :is-null]
              (not= (:uuid (:->> o-row "user_id")) i-user)
              (not= (:uuid (:->> o-row "identity_version")) i-version)
              (not= (:->> o-row "status") "active")
              [i-share :is-null]
              [i-points :is-null])
      (return false))
    (let [o-saved (pg/t:update social/SocialConnection
                    {:where {:id i-connection}
                     :set {:share-posts i-share :public-points i-points}
                     :track o-op})
          (:uuid v-log) (-/record-social-audit "SocialConnection" (:uuid (:->> o-row "audit_id"))
                                               "sharing-updated" o-op)]
      (return true))))

(defn.pg ^{:- [:boolean]}
  disconnect-social-account
  [:uuid i-user :uuid i-connection :uuid i-version :jsonb o-op]
  (let [o-initial (pg/t:get social/SocialConnection {:where {:id i-connection}})
        (:uuid v-account) (:uuid (:->> o-initial "account_id"))
        o-account (pg/t:get social/SocialAccount {:where {:id v-account} :for [:update]})
        o-row (pg/t:get social/SocialConnection {:where {:id i-connection} :for [:update]})]
    (when (or [o-row :is-null]
              (not= (:uuid (:->> o-row "user_id")) i-user)
              (not= (:uuid (:->> o-row "identity_version")) i-version)
              (== (:->> o-row "status") "revoked"))
      (return false))
    (let [o-revoked (pg/t:update social/SocialConnection
                      {:where {:id i-connection}
                       :set {:status "revoked"
                             :identity-version (pg/uuid-generate-v4)
                             :credential-ciphertext nil
                             :access-expires-at nil
                             :refresh-expires-at nil
                             :credential-lease nil
                             :lease-until nil
                             :capabilities (:jsonb "[]")
                             :granted-scopes (:jsonb "[]")
                             :share-posts false
                             :public-points false
                             :generation (+ (:integer (:->> o-row "generation")) 1)}
                       :track o-op})
          o-generation (pg/t:update social/SocialAccount
                         {:where {:id v-account}
                          :set {:generation (+ (:integer (:->> o-account "generation")) 1)}
                          :track o-op})
          o-proofs (pg/t:update workflow/SocialConnectionProof
                     {:where {:account v-account :status [:in '("pending" "verified")]}
                      :set {:status "revoked"}
                      :track o-op})
          (:uuid v-log) (-/record-social-audit "SocialConnection" (:uuid (:->> o-row "audit_id"))
                                               "disconnected" o-op)]
      (return true))))

(defn.pg ^{:- [:uuid]}
  insert-social-discovery
  [:uuid i-account :uuid i-source :text i-external-id :text i-url :uuid i-owner :uuid i-beach :text
   i-caption :jsonb i-candidates :jsonb i-provider-data :jsonb o-op]
  (let [o-account (pg/t:get social/SocialAccount {:where {:id i-account} :for [:update]})
        o-source (pg/t:get workflow/SocialSource {:where {:id i-source}})
        o-data (seed/as-jsonb i-provider-data)]
    (when (or [o-account :is-null]
              (== (pg/coalesce i-external-id "") "")
              (not (pg/coalesce (#{"starts_with"} i-url "https://") false))
              (not= (pg/jsonb-typeof i-candidates) "array")
              (and [i-source :is-not-null]
                   (or [o-source :is-null]
                       (not= (:->> o-source "provider") (:->> o-account "provider"))
                       (not= (:->> o-source "namespace") (:->> o-account "namespace"))
                       (and [(:->> o-source "account_id") :is-not-null]
                            (not= (:uuid (:->> o-source "account_id")) i-account)))))
      [:raise-exception "Discovery does not match its source and provider account"])
    (let [o-existing (pg/t:get workflow/SocialDiscovery
                       {:where {:account i-account :external-id i-external-id}})]
      (when [o-existing :is-not-null]
        (return (:uuid (:->> o-existing "id"))))
      (let [(:uuid v-id) (pg/uuid-generate-v4)
            (:uuid v-audit) (-/create-social-audit "SocialDiscovery" v-id o-op)
            o-discovery (pg/t:insert workflow/SocialDiscovery
                          {:id v-id
                           :audit v-audit
                           :account i-account
                           :source i-source
                           :external-id i-external-id
                           :url i-url
                           :owner i-owner
                           :site i-beach
                           :caption (pg/coalesce i-caption "")
                           :candidates i-candidates
                           :provider-data o-data}
                          {:track o-op})
            (:uuid v-log) (-/record-social-audit "SocialDiscovery" v-audit "discovered" o-op)]
        (return v-id)))))

(defn.pg ^{:- [:boolean]}
  publish-social-discovery
  [:uuid i-discovery :uuid i-post :jsonb o-op]
  (let [o-row (pg/t:get workflow/SocialDiscovery {:where {:id i-discovery} :for [:update]})
        o-account (pg/t:get social/SocialAccount {:where {:id (:uuid (:->> o-row "account_id"))}})
        o-post (pg/t:get post/SocialPost {:where {:id i-post} :for [:share]})]
    (when (or [o-row :is-null]
              [o-post :is-null]
              [(:->> o-row "owner_id") :is-null]
              [(:->> o-row "site_id") :is-null]
              (not (access/is-user-active (:uuid (:->> o-post "owner_id"))))
              (not= (:uuid (:->> o-row "owner_id")) (:uuid (:->> o-post "owner_id")))
              (not= (:uuid (:->> o-row "site_id")) (:uuid (:->> o-post "site_id")))
              (not= (:->> o-account "provider") (:->> o-post "platform"))
              (not= (:->> o-row "url") (:->> o-post "url"))
              (not= (:->> o-post "status") "approved")
              (not (pg/coalesce (:boolean (:->> o-post "public_consent")) false)))
      (return false))
    (let [o-saved (pg/t:update workflow/SocialDiscovery
                    {:where {:id i-discovery} :set {:post i-post :state "published"} :track o-op})
          (:uuid v-log) (-/record-social-audit "SocialDiscovery" (:uuid (:->> o-row "audit_id"))
                                               "published" o-op)]
      (return true))))

(defn.pg ret-social-discovery-public
  [:uuid i-discovery :uuid i-viewer]
  (let [o-row (pg/t:get workflow/SocialDiscovery {:where {:id i-discovery :state "published"}})]
    (when [o-row :is-null]
      (return nil))
    (return (posts/ret-social-post-public (:uuid (:->> o-row "post_id")) i-viewer))))
