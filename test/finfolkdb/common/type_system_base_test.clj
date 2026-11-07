(ns finfolkdb.common.type-system-base-test
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
             [finfolkdb.common.type-system-base :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-system-base/Op :added "0.1"}
(fact "Op persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/Op)
  => true)

^{:refer finfolkdb.common.type-system-base/Rev :added "0.1"}
(fact "Rev persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/Rev)
  => true)

^{:refer finfolkdb.common.type-system-base/RevLog :added "0.1"}
(fact "RevLog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/RevLog)
  => true)

^{:refer finfolkdb.common.type-system-base/Audit :added "0.1"}
(fact "Audit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/Audit)
  => true)

^{:refer finfolkdb.common.type-system-base/AuditLog :added "0.1"}
(fact "AuditLog persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/AuditLog)
  => true)

^{:refer finfolkdb.common.type-system-base/sel-rev-all :added "0.1"}
(fact "sel-rev-all executes directly on Neon"
  (let [reference (str (java.util.UUID/randomUUID))
        revision (pg/t:insert t/Rev {:class-table "User" :class-context "Post" :class-ref reference :current "{\"value\":7}"} {:track {}})]
    (t/sel-rev-all "User" "Post") => (contains [(:id revision)])
    (:current (t/ret-rev-default "User" "Post" reference)) => {:value 7}
    (t/ret-rev-default "User" "Global" reference) => nil))

^{:refer finfolkdb.common.type-system-base/ret-rev-default :added "0.1"}
(fact "ret-rev-default executes directly on Neon"
  (t/ret-rev-default "User" "Global" "missing") => nil)

^{:refer finfolkdb.common.type-system-base/Activity :added "0.1"}
(fact "Activity persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-base/Activity)
  => true)

^{:refer finfolkdb.common.type-system-base/op-fn :added "0.1"}
(fact "op-fn executes directly on Neon"
  (:tag (t/op-fn "runtime-test" "alice" {})) => "runtime-test")