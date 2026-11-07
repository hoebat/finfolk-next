(ns finfolkdb.common.type-user-test
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
             [finfolkdb.common.type-user :as t]
             [finfolkdb.fn.user.user-manage :as user]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-site :as site]
             [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-user/User :added "0.1"}
(fact "User persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/User)
  => true)

^{:refer finfolkdb.common.type-user/UserBlock :added "0.1"}
(fact "UserBlock persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserBlock)
  => true)

^{:refer finfolkdb.common.type-user/UserCheckin :added "0.1"}
(fact "UserCheckin persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserCheckin)
  => true)

^{:refer finfolkdb.common.type-user/UserConnection :added "0.1"}
(fact "UserConnection persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserConnection)
  => true)

^{:refer finfolkdb.common.type-user/User :id user-linked-writes}
(fact "typed users initialize addons and relationships enforce identity on Neon"
  (:id (user/insert-user "runtime-alice" {:displayName "Alice"}
                        (system/op-fn "create-user" "runtime-alice" {})))
  => "runtime-alice"
  (:id (user/insert-user "runtime-bob" {:displayName "Bob"}
                        (system/op-fn "create-user" "runtime-bob" {})))
  => "runtime-bob"
  (mapv :id [(pg/t:get t/User {:where {:id "runtime-alice"}}) (pg/t:get t/User {:where {:id "runtime-bob"}})]) => ["runtime-alice" "runtime-bob"]
  (pg/t:insert t/UserBlock {:owner "runtime-alice" :target "runtime-bob"})
  (pg/t:count t/UserBlock {:where {:owner "runtime-alice"}}) => 1
  (pg/t:insert t/UserBlock {:owner "runtime-alice" :target "runtime-bob"}) => (throws)
  (pg/t:insert t/UserBlock {:owner "runtime-alice" :target "missing"}) => (throws)
  (pg/t:insert t/UserBlock {:owner "runtime-alice" :target "runtime-alice"}) => (throws)
  (pg/t:insert site/Beach {:id "runtime-bondi" :name "Bondi" :timezone "Australia/Sydney"})
  (pg/t:insert t/UserCheckin {:user "runtime-alice" :beach "runtime-bondi" :visit-day "2026-11-05"})
  (pg/t:count t/UserCheckin {:where {:user "runtime-alice"}}) => 1
  (pg/t:insert t/UserCheckin {:user "runtime-alice" :beach "runtime-bondi" :visit-day "2026-11-05"}) => (throws))
