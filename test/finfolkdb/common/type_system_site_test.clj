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
   :require [[finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [finfolkdb.common.type-system-site :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-system-site/Site :added "0.1"}
(fact "Site persists a linked entity and returns its created values"
  (fixture/persisted! 'finfolkdb.common.type-system-site/Site) => true)
^{:refer finfolkdb.common.type-system-site/Site :id beach-roundtrip}
(fact "typed Site insertion, projection, uniqueness and required fields on local PostgreSQL"
  (pg/t:insert t/Site
    {:id "c8be008a-9ad0-5b57-9706-4b62d8d5922e" :name "Runtime Site" :timezone "Australia/Sydney"})
  =>
  (contains {:id "c8be008a-9ad0-5b57-9706-4b62d8d5922e" :name "Runtime Site"})
  (pg/t:get t/Site {:where {:id "c8be008a-9ad0-5b57-9706-4b62d8d5922e"}})
  =>
  (contains {:timezone "Australia/Sydney"})
  (pg/t:insert t/Site
    {:id "c8be008a-9ad0-5b57-9706-4b62d8d5922e" :name "Duplicate" :timezone "UTC"})
  =>
  (throws)
  (pg/t:insert t/Site {:id "ddcd2910-cf6c-55ca-9821-ab44e9db8ea2" :timezone "UTC"}) => (throws))
