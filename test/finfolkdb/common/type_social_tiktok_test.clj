(ns finfolkdb.common.type-social-tiktok-test
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
             [finfolkdb.common.type-social-tiktok :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-social-tiktok/TiktokConnection :added "0.1"}
(fact "TiktokConnection persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-social-tiktok/TiktokConnection)
  => true)