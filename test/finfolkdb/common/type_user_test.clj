(ns finfolkdb.common.type-user-test
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
             [finfolkdb.common.type-user :as t]
             [finfolkdb.fn.user.user-manage :as user]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-site :as site]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-user/User :added "0.1"}
(fact "User persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/User) => true)

^{:refer finfolkdb.common.type-user/UserBlock :added "0.1"}
(fact "UserBlock persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserBlock) => true)

^{:refer finfolkdb.common.type-user/UserCheckin :added "0.1"}
(fact "UserCheckin persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserCheckin) => true)

^{:refer finfolkdb.common.type-user/UserConnection :added "0.1"}
(fact "UserConnection persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-user/UserConnection) => true)

^{:refer finfolkdb.common.type-user/User :id user-linked-writes}
(fact "typed users initialize addons and relationships enforce identity on local PostgreSQL"
  (:id (user/insert-user "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"
                         {:displayName "Alice"}
                         (system/op-fn "create-user" "868fc9b0-9cdb-5c9f-8685-971e4f54af7e" {})))
  =>
  "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"
  (:id (user/insert-user "af1af8ae-2a5f-570e-a618-29b7a61e54ba"
                         {:displayName "Bob"}
                         (system/op-fn "create-user" "af1af8ae-2a5f-570e-a618-29b7a61e54ba" {})))
  =>
  "af1af8ae-2a5f-570e-a618-29b7a61e54ba"
  (mapv :id
        [(pg/t:get t/User {:where {:id "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"}})
         (pg/t:get t/User {:where {:id "af1af8ae-2a5f-570e-a618-29b7a61e54ba"}})])
  =>
  ["868fc9b0-9cdb-5c9f-8685-971e4f54af7e" "af1af8ae-2a5f-570e-a618-29b7a61e54ba"]
  (pg/t:insert t/UserBlock
    {:owner "868fc9b0-9cdb-5c9f-8685-971e4f54af7e" :target "af1af8ae-2a5f-570e-a618-29b7a61e54ba"})
  (pg/t:count t/UserBlock {:where {:owner "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"}}) => 1
  (pg/t:insert t/UserBlock
    {:owner "868fc9b0-9cdb-5c9f-8685-971e4f54af7e" :target "af1af8ae-2a5f-570e-a618-29b7a61e54ba"})
  =>
  (throws)
  (pg/t:insert t/UserBlock
    {:owner "868fc9b0-9cdb-5c9f-8685-971e4f54af7e" :target "215b60fc-cda3-55bd-a254-f56b5416b78e"})
  =>
  (throws)
  (pg/t:insert t/UserBlock
    {:owner "868fc9b0-9cdb-5c9f-8685-971e4f54af7e" :target "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"})
  =>
  (throws)
  (pg/t:insert site/Beach
    {:id "6eff7c94-0076-5c57-b23f-bf00bd7984d6" :name "Bondi" :timezone "Australia/Sydney"})
  (pg/t:insert t/UserCheckin
    {:user "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"
     :beach "6eff7c94-0076-5c57-b23f-bf00bd7984d6"
     :visit-day "2026-11-05"})
  (pg/t:count t/UserCheckin {:where {:user "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"}}) => 1
  (pg/t:insert t/UserCheckin
    {:user "868fc9b0-9cdb-5c9f-8685-971e4f54af7e"
     :beach "6eff7c94-0076-5c57-b23f-bf00bd7984d6"
     :visit-day "2026-11-05"})
  =>
  (throws))
