(ns finfolkdb.common.type-messaging-delivery-test
 (:use code.test)
 (:require [lang.core :as l] [finfolkbuild.testing.local :as local]
           [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
 {:runtime :jdbc.client :config (local/config)
  :require [[finfolkdb.fn.user.user-manage :as user]
            [finfolkdb.fn.user.user-manage-logbook :as logbook]
            [finfolkdb.fn.social.social-manage :as social]
            [finfolkdb.common.type-messaging-delivery :as delivery]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres) (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})
^{:refer finfolkdb.common.type-messaging-delivery/MessagingOutbox :added "0.1"}
(fact "delivery records persist and enforce their account references"
 (fixture/persisted! 'finfolkdb.common.type-messaging-delivery/MessagingOutbox) => true)
