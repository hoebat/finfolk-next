(ns finfolkdb.common.type-system-seed-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (neon/config)
   :require [[finfolkdb.common.type-system-seed :as t] [postgres.core :as pg]]})

(fact:global {:setup [(neon/setup!)]
              :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-system-seed/EnumClassType :added "0.1"}
(fact "EnumClassType labels on Neon"
  (binding [jdbc/*connection-fn* neon/contract-connection] (common/check! 'finfolkdb.common.type-system-seed/EnumClassType))
  => true)

^{:refer finfolkdb.common.type-system-seed/as-jsonb :added "0.1"}
(fact "as-jsonb executes directly on Neon"
  (t/as-jsonb nil) => {} (t/as-jsonb "[]") => (throws))

^{:refer finfolkdb.common.type-system-seed/as-jsonb-array :added "0.1"}
(fact "as-jsonb-array executes directly on Neon"
  (t/as-jsonb-array nil) => [] (t/as-jsonb-array "{}") => (throws))

^{:refer finfolkdb.common.type-system-seed/as-jsonb :id object-preserved}
(fact "JSON object contents survive coercion" (t/as-jsonb "{\"a\":1}") => {:a 1})
^{:refer finfolkdb.common.type-system-seed/as-jsonb-array :id array-preserved}
(fact "JSON array contents survive coercion" (t/as-jsonb-array "[1,true]") => [1 true])
