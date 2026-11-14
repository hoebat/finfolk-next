(ns finfolkdb.common.type-user-reward-test
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
             [finfolkdb.common.type-user-reward :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-user-reward/UserInvitation :added "0.1"}
(fact "UserInvitation persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-reward/UserInvitation) => true)

^{:refer finfolkdb.common.type-user-reward/UserInvitationJoin :added "0.1"}
(fact "UserInvitationJoin persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-reward/UserInvitationJoin) => true)

^{:refer finfolkdb.common.type-user-reward/UserPointsEntry :added "0.1"}
(fact "UserPointsEntry persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-reward/UserPointsEntry) => true)

^{:refer finfolkdb.common.type-user-reward/UserRequestLimit :added "0.1"}
(fact "UserRequestLimit persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-reward/UserRequestLimit) => true)
