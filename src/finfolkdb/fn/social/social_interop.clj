(ns finfolkdb.fn.social.social-interop
  "Small typed entrypoints for trusted adapters; no domain SQL in JavaScript."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as messaging]
             [finfolkdb.common.type-system-base :as system]]
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
             "namespace"
             (:text (pg/jsonb-build-array (:->> o-inbox "provider") i-application i-inbox))))))
