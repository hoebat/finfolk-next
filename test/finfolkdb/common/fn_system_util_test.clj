(ns finfolkdb.common.fn-system-util-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.common.fn-system-util :as t] [postgres.core :as pg]]})

(fact:global {:setup [(local/setup!)]
              :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.fn-system-util/auth-uid :added "0.1"}
(fact "auth-uid executes directly on local PostgreSQL"
  (t/auth-uid) => "")

^{:refer finfolkdb.common.fn-system-util/as-iso-time :added "0.1"}
(fact "as-iso-time executes directly on local PostgreSQL"
  (t/as-iso-time "2026-11-05T01:02:03.456+11") => "2026-11-04T14:02:03.456Z")