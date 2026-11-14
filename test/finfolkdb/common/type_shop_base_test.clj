(ns finfolkdb.common.type-shop-base-test
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
             [finfolkdb.common.type-shop-base :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-shop-base/EnumFinnieRedemptionStatus :added "0.1"}
(fact "EnumFinnieRedemptionStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-shop-base/EnumFinnieRedemptionStatus))
  =>
  true)

^{:refer finfolkdb.common.type-shop-base/FinnieAccount :added "0.1"}
(fact "FinnieAccount persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-shop-base/FinnieAccount) => true)

^{:refer finfolkdb.common.type-shop-base/FinnieItem :added "0.1"}
(fact "FinnieItem persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-shop-base/FinnieItem) => true)

^{:refer finfolkdb.common.type-shop-base/FinnieRedemption :added "0.1"}
(fact "FinnieRedemption persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-shop-base/FinnieRedemption) => true)

^{:refer finfolkdb.common.type-shop-base/FinnieEntry :added "0.1"}
(fact "FinnieEntry persists linked data and rejects missing parents atomically"
  (fixture/persisted! 'finfolkdb.common.type-shop-base/FinnieEntry) => true)
