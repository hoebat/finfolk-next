(ns finfolkdb.common.fn-system-util-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.common.fn-system-util :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.fn-system-util/auth-uid :added "0.1"}
(fact "auth-uid executes directly on local PostgreSQL"
  (t/auth-uid) => nil
  (jdbc/transaction "26755e9c-346a-42f7-a7bf-029ea3b39862"
                    #(jdbc/scalar % "SELECT finfolk.auth_uid()"))
  =>
  "26755e9c-346a-42f7-a7bf-029ea3b39862"
  (t/auth-uid) => nil)

^{:refer finfolkdb.common.fn-system-util/as-iso-time :added "0.1"}
(fact "as-iso-time executes directly on local PostgreSQL"
  (t/as-iso-time 1793800923456000) => "2026-11-04T14:02:03.456Z")
