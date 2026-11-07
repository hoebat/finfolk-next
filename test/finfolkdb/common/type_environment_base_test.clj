(ns finfolkdb.common.type-environment-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]
            [finfolkbuild.testing.behavior :as fixture]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [finfolkdb.common.type-environment-base :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-environment-base/DataSource :added "0.1"}
(fact "DataSource persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/DataSource)
  => true)

^{:refer finfolkdb.common.type-environment-base/DepthDataset :added "0.1"}
(fact "DepthDataset persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/DepthDataset)
  => true)

^{:refer finfolkdb.common.type-environment-base/TideStation :added "0.1"}
(fact "TideStation persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/TideStation)
  => true)

^{:refer finfolkdb.common.type-environment-base/EnvironmentTarget :added "0.1"}
(fact "EnvironmentTarget persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/EnvironmentTarget)
  => true)

^{:refer finfolkdb.common.type-environment-base/EnvironmentSnapshot :added "0.1"}
(fact "EnvironmentSnapshot persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/EnvironmentSnapshot)
  => true)

^{:refer finfolkdb.common.type-environment-base/EnvironmentJob :added "0.1"}
(fact "EnvironmentJob persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-environment-base/EnvironmentJob)
  => true)