(ns finfolkdb.fn.social.social-interop
  "Small typed entrypoints for trusted adapters; no domain SQL in JavaScript."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-social-workflow :as workflow]
             [finfolkdb.common.type-social-account :as accounts]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.fn.social.social-events :as events]
             [finfolkdb.fn.social.social-connections :as connections]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg new-social-operation
  [:uuid i-actor]
  (return (system/op-fn "social-adapter" i-actor (:jsonb "{}"))))

(defn.pg ret-social-adapter-scope
  [:uuid i-application :uuid i-inbox]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application}})]
    (when [o-inbox :is-null]
      [:raise-exception "Social inbox outside application scope"])
    (return (pg/jsonb-build-object
             "applicationId" i-application
             "inboxId" i-inbox
             "provider" (:->> o-inbox "provider")
             "accountId" (:->> o-inbox "account_id")
             "capability" (:->> o-inbox "provider_scope")
             "namespace"
             (:text (pg/jsonb-build-array (:->> o-inbox "provider") i-application i-inbox))))))


(defn.pg ret-social-member-connection
  [:uuid i-application :uuid i-inbox :uuid i-user]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application}})
        o-user (pg/t:get users/User {:where {:id i-user :deleted false}})
        o-connections (pg/t:select accounts/SocialConnection {:where {:user i-user :status "active"}})
        o-connection nil]
    (when (or [o-inbox :is-null] [o-user :is-null]) [:raise-exception "Social account unavailable"])
    [:for o-connection :in :select (pg/jsonb-array-elements (pg/coalesce o-connections (:jsonb "[]")))
     (loop []
       (let [o-identity (pg/t:get messaging/MessagingIdentity
                          {:where {:account i-inbox :social-account (:uuid (:->> o-connection "account_id"))}})
             o-account (pg/t:get accounts/SocialAccount {:where {:id (:uuid (:->> o-connection "account_id"))}})]
         (when [o-identity :is-not-null]
           (return (pg/jsonb-build-object "connected" true "connectionId" (pg/id o-connection)
                    "identityVersion" (:-> o-connection "identity_version") "handle" (:-> o-account "handle"))))))]
    (return (pg/jsonb-build-object "connected" false))))


(defn.pg ^{:- [:boolean] :props [:security :definer :set :search_path :to #{"pg_catalog"}]}
  lock-social-member
  "Lock a verified active member without granting adapters identity-write access."
  [:uuid i-user]
  (let [o-member (pg/t:get users/User
                   {:where {:id i-user :deleted false :email-verified true}
                    :returning #{:id} :for [:share]})]
    (return [o-member :is-not-null])))

(defn.pg ret-social-redemption-proof
  "Trusted preflight snapshot, never returned by a browser endpoint."
  [:uuid i-application :uuid i-inbox :uuid i-user :text i-code]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application}})
        (:boolean v-user) (-/lock-social-member i-user)
        (:text v-code) (pg/upper (pg/regexp-replace (pg/coalesce i-code "") "[[:space:]-]" "" "g"))
        (:text v-hash) (#{"encode"} (#{"digest"} v-code "sha256") "hex")
        o-proof (pg/t:get workflow/SocialConnectionProof
                  {:where {:token-hash v-hash :kind "message" :status "verified" :inbox i-inbox}})
        o-event (pg/t:get workflow/SocialEvent {:where {:id (:uuid (:->> o-proof "event_id"))}})
        o-account (pg/t:get accounts/SocialAccount {:where {:id (:uuid (:->> o-proof "account_id"))}})]
    (when (or [o-inbox :is-null] (not v-user) [o-proof :is-null] [o-event :is-null]
              (== (:->> o-inbox "mode") "disabled")
              (> (pg/length (pg/coalesce i-code "")) 100)
              (<= (:bigint (:->> o-proof "expires_at")) (pg/time-us))
              (not= (:integer (:->> o-event "generation")) (:integer (:->> o-inbox "generation")))
              (not= (:integer (:->> o-proof "generation")) (:integer (:->> o-account "generation"))))
      (return nil))
    (return (pg/jsonb-build-object "proofId" (pg/id o-proof) "provider" (:->> o-inbox "provider")
             "namespace" (:->> o-account "namespace") "externalId" (:->> o-account "external_id")
             "conversationId" (:->> (:-> o-event "payload") "conversationId")
             "generation" (:-> o-inbox "generation") "accountGeneration" (:-> o-account "generation")))))

(defn.pg ret-social-redemption-replay
  "A consumed code can only acknowledge its still-current member connection."
  [:uuid i-application :uuid i-inbox :uuid i-user :text i-code]
  (let [o-inbox (pg/t:get messaging/MessagingAccount {:where {:id i-inbox :application i-application}})
        (:boolean v-user) (-/lock-social-member i-user)
        (:text v-code) (pg/upper (pg/regexp-replace (pg/coalesce i-code "") "[[:space:]-]" "" "g"))
        (:text v-hash) (#{"encode"} (#{"digest"} v-code "sha256") "hex")
        o-proof (pg/t:get workflow/SocialConnectionProof {:where {:token-hash v-hash :kind "message" :inbox i-inbox :user i-user :status "consumed"}})
        o-connection (pg/t:get accounts/SocialConnection {:where {:id (:uuid (:->> o-proof "connection_id")) :user i-user :status "active"}})]
    (when (or [o-inbox :is-null] (not v-user) [o-proof :is-null] [o-connection :is-null]
              (== (:->> o-inbox "mode") "disabled")
              (not= (:uuid (:->> o-proof "consumed_version")) (:uuid (:->> o-connection "identity_version"))))
      (return nil))
    (return (pg/jsonb-build-object "replayed" true "proofId" (pg/id o-proof) "connectionId" (pg/id o-connection)))))

(defn.pg prepare-social-redemption
  [:uuid i-application :uuid i-inbox :uuid i-user :text i-code :text i-ip-hash :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        (:text v-namespace) (:text (pg/jsonb-build-array i-application i-inbox))
        (:boolean v-member) false
        (:boolean v-ip) false]
    (when [o-inbox :is-null] [:raise-exception "Social inbox outside application scope"])
    (:= v-member (events/reserve-social-rate (:->> o-inbox "provider") v-namespace (:text i-user) "redeem-member" 900 10 o-op))
    (when (or [i-ip-hash :is-null] (not (#{"regexp_like"} i-ip-hash "^[a-f0-9]{64}$")))
      [:raise-exception "Trusted client IP hash required"])
    (:= v-ip (events/reserve-social-rate (:->> o-inbox "provider") v-namespace i-ip-hash "redeem-ip" 900 10 o-op))
    (when (or (not v-member) (not v-ip))
      (return (pg/jsonb-build-object "error" "rate_limited")))
    (let [o-replay (-/ret-social-redemption-replay i-application i-inbox i-user i-code)]
      (when [o-replay :is-not-null] (return o-replay)))
    (let [o-proof (-/ret-social-redemption-proof i-application i-inbox i-user i-code)]
      (when [o-proof :is-null] (return nil))
      (return (|| o-proof (pg/jsonb-build-object "checkedAt" (pg/time-us)))))))

(defn.pg complete-social-redemption
  [:uuid i-application :uuid i-inbox :uuid i-user :text i-code :jsonb i-snapshot :jsonb i-evidence :jsonb o-op]
  (let [o-inbox (pg/t:get messaging/MessagingAccount
                  {:where {:id i-inbox :application i-application} :for [:update]})
        o-current (-/ret-social-redemption-proof i-application i-inbox i-user i-code)
        o-replay (-/ret-social-redemption-replay i-application i-inbox i-user i-code)
        (:bigint v-checked) (:bigint (:->> i-snapshot "checkedAt"))]
    (when (and [o-replay :is-not-null]
               (== (:->> o-replay "proofId") (:->> i-snapshot "proofId")))
      (return o-replay))
    (when (or [o-inbox :is-null] [o-current :is-null] [v-checked :is-null]
              (> v-checked (pg/time-us)) (< v-checked (- (pg/time-us) 30000000))
              (not= o-current (- i-snapshot "checkedAt"))
              (not= (pg/coalesce (:-> i-evidence "eligible") (:jsonb "false")) (:jsonb "true"))
              (not= (:->> i-evidence "provider") (:->> o-current "provider"))
              (not= (:->> i-evidence "namespace") (:->> o-current "namespace"))
              (not= (:->> i-evidence "externalId") (:->> o-current "externalId")))
      (return nil))
    (let [o-existing (-/ret-social-member-connection i-application i-inbox i-user)]
      (when (:boolean (:->> o-existing "connected")) (return nil)))
    (when (== (:->> o-current "provider") "instagram")
      (when (or [(:->> i-evidence "handle") :is-null]
                (not (#{"regexp_like"} (:->> i-evidence "handle") "^[a-z0-9._]{1,30}$")))
        (return nil))
      (let [o-proof (pg/t:get workflow/SocialConnectionProof {:where {:id (:uuid (:->> o-current "proofId"))}})
            o-profile (pg/t:update accounts/SocialAccount
                         {:where {:id (:uuid (:->> o-proof "account_id"))}
                          :set {:handle (:->> i-evidence "handle")} :track o-op})] nil))
    (return (connections/redeem-social-connection i-application i-inbox i-user i-code o-op))))
