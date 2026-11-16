(ns finfolkdb.common.type-user-activity-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]
            [finfolkbuild.testing.behavior :as fixture]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [finfolkdb.common.type-user-activity :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-user-activity/EnumActionType :added "0.1"}
(fact "EnumActionType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-activity/EnumActionType))
  =>
  true)

^{:refer finfolkdb.common.type-user-activity/ActivityLog :added "0.1"}
(fact "ActivityLog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-activity/ActivityLog) => true)
