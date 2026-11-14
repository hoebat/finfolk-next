(ns finfolkdb.common.type-user-report-test
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
             [finfolkdb.common.type-user-report :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-user-report/UserReport :added "0.1"}
(fact "UserReport persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-report/UserReport) => true)
