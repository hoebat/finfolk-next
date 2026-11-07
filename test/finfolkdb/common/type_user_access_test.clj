(ns finfolkdb.common.type-user-access-test
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
             [finfolkdb.common.type-user-access :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-user-access/EnumAccessSetting :added "0.1"}
(fact "EnumAccessSetting labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-user-access/EnumAccessSetting))
  => true)

^{:refer finfolkdb.common.type-user-access/Access :added "0.1"}
(fact "Access persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/Access)
  => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessRoleLevel :added "0.1"}
(fact "EnumAccessRoleLevel labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-user-access/EnumAccessRoleLevel))
  => true)

^{:refer finfolkdb.common.type-user-access/AccessRole :added "0.1"}
(fact "AccessRole persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessRole)
  => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessRequestStatus :added "0.1"}
(fact "EnumAccessRequestStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-user-access/EnumAccessRequestStatus))
  => true)

^{:refer finfolkdb.common.type-user-access/AccessRequest :added "0.1"}
(fact "AccessRequest persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessRequest)
  => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus :added "0.1"}
(fact "EnumAccessInviteExternalStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus))
  => true)

^{:refer finfolkdb.common.type-user-access/AccessInviteExternal :added "0.1"}
(fact "AccessInviteExternal persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessInviteExternal)
  => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus :added "0.1"}
(fact "EnumAccessInviteEmailStatus labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus))
  => true)

^{:refer finfolkdb.common.type-user-access/AccessInviteEmail :added "0.1"}
(fact "AccessInviteEmail persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessInviteEmail)
  => true)