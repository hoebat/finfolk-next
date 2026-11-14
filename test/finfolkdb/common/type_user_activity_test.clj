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
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [finfolkdb.common.type-user-activity :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-user-activity/EnumActionType :added "0.1"}
(fact "EnumActionType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-activity/EnumActionType))
  =>
  true)

^{:refer finfolkdb.common.type-user-activity/ActivityLog :added "0.1"}
(fact "ActivityLog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-activity/ActivityLog) => true)
