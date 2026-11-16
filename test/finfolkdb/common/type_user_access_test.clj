(ns finfolkdb.common.type-user-access-test
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
             [finfolkdb.common.type-user-access :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-user-access/EnumAccessSetting :added "0.1"}
(fact "EnumAccessSetting labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-access/EnumAccessSetting))
  =>
  true)

^{:refer finfolkdb.common.type-user-access/Access :added "0.1"}
(fact "Access persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/Access) => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessRoleLevel :added "0.1"}
(fact "EnumAccessRoleLevel labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-access/EnumAccessRoleLevel))
  =>
  true)

^{:refer finfolkdb.common.type-user-access/AccessRole :added "0.1"}
(fact "AccessRole persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessRole) => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessRequestStatus :added "0.1"}
(fact "EnumAccessRequestStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-access/EnumAccessRequestStatus))
  =>
  true)

^{:refer finfolkdb.common.type-user-access/AccessRequest :added "0.1"}
(fact "AccessRequest persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessRequest) => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus :added "0.1"}
(fact "EnumAccessInviteExternalStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-access/EnumAccessInviteExternalStatus))
  =>
  true)

^{:refer finfolkdb.common.type-user-access/AccessInviteExternal :added "0.1"}
(fact "AccessInviteExternal persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessInviteExternal) => true)

^{:refer finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus :added "0.1"}
(fact "EnumAccessInviteEmailStatus labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-user-access/EnumAccessInviteEmailStatus))
  =>
  true)

^{:refer finfolkdb.common.type-user-access/AccessInviteEmail :added "0.1"}
(fact "AccessInviteEmail persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user-access/AccessInviteEmail) => true)
