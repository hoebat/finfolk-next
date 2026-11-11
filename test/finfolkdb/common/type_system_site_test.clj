(ns finfolkdb.common.type-system-site-test
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
             [finfolkdb.common.type-system-site :as t] [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)]
              :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-system-site/Beach :added "0.1"}
(fact "Beach persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-site/Beach)
  => true)
^{:refer finfolkdb.common.type-system-site/Beach :id beach-roundtrip}
(fact "typed Beach insertion, projection, uniqueness and required fields on local PostgreSQL"
  (pg/t:insert t/Beach {:id "runtime-beach" :name "Runtime Beach" :timezone "Australia/Sydney"})
  => (contains {:id "runtime-beach" :name "Runtime Beach"})
  (pg/t:get t/Beach {:where {:id "runtime-beach"}})
  => (contains {:timezone "Australia/Sydney"})
  (pg/t:insert t/Beach {:id "runtime-beach" :name "Duplicate" :timezone "UTC"})
  => (throws)
  (pg/t:insert t/Beach {:id "missing-name" :timezone "UTC"})
  => (throws))
