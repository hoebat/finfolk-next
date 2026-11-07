(ns finfolkdb.common.fn-system-util-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (neon/config)
   :require [[finfolkdb.common.fn-system-util :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.fn-system-util/auth-uid :added "0.1"}
(fact "auth-uid executes directly on Neon"
  (t/auth-uid) => "")

^{:refer finfolkdb.common.fn-system-util/as-iso-time :added "0.1"}
(fact "as-iso-time executes directly on Neon"
  (t/as-iso-time "2026-11-05T01:02:03.456+11") => "2026-11-04T14:02:03.456Z")