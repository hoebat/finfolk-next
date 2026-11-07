(ns finfolkdb.fn.messaging.messaging-authorization
  "Private account-scoped credential lifecycle and activation transactions."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as tmb]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.fn.messaging.messaging-manage :as messaging]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; Verified Grant Installation
;;

(defn.pg set-messaging-authorization
  "Provider verification occurs before this CAS; replacing a grant pauses delivery."
  [:text i-application :text i-account :integer i-generation
   :text i-ciphertext :timestamptz i-expires :jsonb i-proof]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})
        o-proof (tss/as-jsonb i-proof)]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (when (not= (:integer (:->> o-account "generation")) i-generation)
      (return nil))
    (when (or [i-generation :is-null]
              (== (pg/coalesce i-ciphertext "") "")
              (not= (pg/coalesce (:->> o-proof "provider") "") (:->> o-account "provider"))
              (not= (pg/coalesce (:->> o-proof "accountId") "") (:->> o-account "account_id"))
              (not= (pg/coalesce (:-> o-proof "authorized") (:jsonb "false")) (:jsonb "true"))
              (and [i-expires :is-not-null]
                   (or (not (#{"isfinite"} i-expires)) (<= i-expires (pg/now))))
              (and [i-expires :is-null]
                   (not= (pg/coalesce (:-> o-proof "nonExpiring") (:jsonb "false")) (:jsonb "true"))))
      [:raise-exception "Invalid verified messaging authorization"])
    (let [o-saved (pg/t:update tmb/MessagingAccount
                    {:set {:credential-ciphertext i-ciphertext :token-expires-at i-expires
                           :generation (+ i-generation 1) :mode "disabled"
                           :checks o-proof :credential-lease nil :credential-lease-until nil
                           :updated-at (pg/now)}
                     :single true :where {:id i-account}})
          o-reconciled (messaging/reconcile-messaging-work i-application i-account)
          o-audit (messaging/record-messaging-audit i-application i-account "authorization_replaced" (pg/uuid-generate-v4))]
      (return (pg/jsonb-build-object "generation" (:integer (:->> o-saved "generation")) "mode" "disabled")))))

;;
;; Explicit Pilot/Live Activation
;;

(defn.pg activate-messaging-account
  [:text i-application :text i-account :integer i-generation :text i-mode :jsonb i-senders]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})
        o-senders (tss/as-jsonb-array i-senders)]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (when (not= (:integer (:->> o-account "generation")) i-generation)
      (return nil))
    (when (or [i-generation :is-null] [i-mode :is-null]
              (not (or (== i-mode "pilot") (== i-mode "live"))))
      [:raise-exception "Invalid messaging activation mode"])
    (when (and (not= (:->> o-account "provider") "app")
               (or [(:->> o-account "credential_ciphertext") :is-null]
                   (not= (pg/coalesce (:->> (:-> o-account "checks") "provider") "") (:->> o-account "provider"))
                   (not= (pg/coalesce (:->> (:-> o-account "checks") "accountId") "") (:->> o-account "account_id"))
                   (not= (pg/coalesce (:-> (:-> o-account "checks") "authorized") (:jsonb "false")) (:jsonb "true"))
                   (not= (pg/coalesce (:-> (:-> o-account "checks") "subscribed") (:jsonb "false")) (:jsonb "true"))
                   (<= (:timestamptz (:->> o-account "token_expires_at")) (pg/now))
                   (and [(:->> o-account "token_expires_at") :is-null]
                        (not= (pg/coalesce (:-> (:-> o-account "checks") "nonExpiring") (:jsonb "false")) (:jsonb "true")))))
      [:raise-exception "Messaging authorization and subscription must be verified"])
    (let [o-sender nil]
      [:for o-sender :in :select (pg/jsonb-array-elements o-senders)
       (loop []
         (when (not= (pg/jsonb-typeof o-sender) "string")
           [:raise-exception "Pilot sender identifiers must be strings"]))])
    (when (and (== i-mode "pilot") (== (pg/jsonb-array-length o-senders) 0))
      [:raise-exception "Pilot activation requires allowed senders"])
    (let [o-active (pg/t:update tmb/MessagingAccount
                     {:set {:mode i-mode :pilot-sender-ids o-senders :updated-at (pg/now)}
                      :single true :where {:id i-account}})
          o-audit (messaging/record-messaging-audit i-application i-account "account_activated" (pg/uuid-generate-v4))]
      (return (pg/jsonb-build-object "generation" i-generation "mode" (:->> o-active "mode"))))))

;;
;; Pause or Disconnect
;;

(defn.pg disable-messaging-account
  [:text i-application :text i-account :integer i-generation :boolean i-disconnect]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (when (or [i-generation :is-null] [i-disconnect :is-null])
      [:raise-exception "Invalid messaging account transition"])
    (when (not= (:integer (:->> o-account "generation")) i-generation)
      (return nil))
    (let [o-disabled (pg/t:update tmb/MessagingAccount
                       {:set {:mode "disabled" :generation (+ i-generation 1)
                              :credential-lease nil :credential-lease-until nil :updated-at (pg/now)}
                        :single true :where {:id i-account}})]
      (when i-disconnect
        (let [o-cleared (pg/t:update tmb/MessagingAccount
                          {:set {:credential-ciphertext nil :token-expires-at nil :checks (:jsonb "{}")}
                           :single true :where {:id i-account}})]
          nil))
      (let [o-reconciled (messaging/reconcile-messaging-work i-application i-account)
            o-audit (messaging/record-messaging-audit i-application i-account "account_disabled" (pg/uuid-generate-v4))]
        (return (pg/jsonb-build-object "generation" (+ i-generation 1) "mode" "disabled"))))))

;;
;; Refresh Claim and Conditional Save
;;

(defn.pg claim-messaging-refresh
  "Claims token refresh without holding an open transaction during provider I/O."
  [:text i-application :text i-account :integer i-generation]
  (let [o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application} :for [:update]})]
    (when [o-account :is-null]
      [:raise-exception "Messaging account is outside application scope"])
    (when (or [i-generation :is-null]
              (not= (:integer (:->> o-account "generation")) i-generation)
              [(:->> o-account "credential_ciphertext") :is-null]
              (> (:timestamptz (:->> o-account "credential_lease_until")) (pg/now)))
      (return nil))
    (let [o-claim (pg/t:update tmb/MessagingAccount
                    {:set {:credential-lease (pg/uuid-generate-v4)
                           :credential-lease-until (+ (pg/now) (:interval "2 minutes"))}
                     :single true :where {:id i-account}})]
      (return o-claim))))

(defn.pg release-messaging-refresh
  [:text i-application :text i-account :integer i-generation :uuid i-lease]
  (when [i-lease :is-null] (return nil))
  (let [o-release (pg/t:update tmb/MessagingAccount
                      {:set {:credential-lease nil :credential-lease-until nil}
                       :single true
                       :where {:id i-account :application i-application :generation i-generation
                               :credential-lease i-lease}})]
    (return (pg/jsonb-build-object "released" [o-release :is-not-null]))))

(defn.pg save-messaging-refresh
  [:text i-application :text i-account :integer i-generation :uuid i-lease
   :text i-ciphertext :timestamptz i-expires :jsonb i-proof]
  (let [o-proof (tss/as-jsonb i-proof)
        o-account (pg/t:get tmb/MessagingAccount
                    {:where {:id i-account :application i-application :generation i-generation
                             :credential-lease i-lease :credential-lease-until [:gt (pg/now)]}
                     :for [:update]})]
    (when (or [o-account :is-null] [i-lease :is-null]) (return nil))
    (when (or (== (pg/coalesce i-ciphertext "") "")
              (not= (pg/coalesce (:->> o-proof "provider") "") (:->> o-account "provider"))
              (not= (pg/coalesce (:->> o-proof "accountId") "") (:->> o-account "account_id"))
              (not= (pg/coalesce (:-> o-proof "authorized") (:jsonb "false")) (:jsonb "true"))
              (not= (pg/coalesce (:-> o-proof "subscribed") (:jsonb "false")) (:jsonb "true"))
              (and [i-expires :is-not-null]
                   (or (not (#{"isfinite"} i-expires)) (<= i-expires (pg/now))))
              (and [i-expires :is-null]
                   (not= (pg/coalesce (:-> o-proof "nonExpiring") (:jsonb "false")) (:jsonb "true"))))
      [:raise-exception "Invalid refreshed messaging authorization"])
    (let [o-saved (pg/t:update tmb/MessagingAccount
                    {:set {:credential-ciphertext i-ciphertext :token-expires-at i-expires
                           :credential-lease nil :credential-lease-until nil
                           :checks o-proof :updated-at (pg/now)}
                     :single true :where {:id i-account}})
          o-audit (messaging/record-messaging-audit i-application i-account "authorization_refreshed" (pg/uuid-generate-v4))]
      (return (pg/jsonb-build-object "generation" i-generation "mode" (:->> o-saved "mode"))))))
