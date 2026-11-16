(ns finfolkbuild.testing.mock-fixture
  "Real native records for the isolated mock provider; no JavaScript seeding."
  (:require [postgres.core :as pg]
            [finfolkdb.common.type-messaging-base :as messaging]
            [finfolkdb.fn.social.social-interop :as interop]
            [finfolkdb.fn.social.social-manage :as social]
            [finfolkbuild.testing.behavior :as fixture]))
(defn uuid [] (str (java.util.UUID/randomUUID)))
(defn create!
  []
  (let [application (uuid)
        inboxes [(uuid) (uuid)]
        members [(uuid) (uuid)]]
    (pg/t:insert messaging/MessagingApplication
      {:id application :key application :name "Native mock"})
    (doseq [member members] (fixture/member member))
    (doseq [inbox inboxes]
      (pg/t:insert messaging/MessagingAccount
        {:id inbox
         :application application
         :provider "mock"
         :account-id inbox
         :mode "live"
         :enabled-commands
         "[\"help\",\"ping\",\"site\",\"privacy\",\"connect\",\"disconnect\",\"status\",\"whoami\"]"})
      (let [scope (interop/ret-social-adapter-scope application inbox)
            brand (social/insert-social-account "mock"
                                                (:namespace scope)
                                                (str "brand-" inbox)
                                                "mock-brand" "Mock brand"
                                                "{}" (interop/new-social-operation nil))]
        (pg/t:update messaging/MessagingAccount {:where {:id inbox} :set {:social-account brand}})))
    {:application application :inboxes inboxes :members members}))
