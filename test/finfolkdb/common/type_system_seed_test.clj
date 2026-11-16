(ns finfolkdb.common.type-system-seed-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.jdbc :as jdbc]
            [finfolkbuild.testing.common :as common]))

(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.common.type-system-seed :as t]
             [postgres.core :as pg]]})

(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

^{:refer finfolkdb.common.type-system-seed/EnumClassType :added "0.1"}
(fact "EnumClassType labels on local PostgreSQL"
  (binding [jdbc/*connection-fn* local/contract-connection]
    (common/check! 'finfolkdb.common.type-system-seed/EnumClassType))
  =>
  true)

^{:refer finfolkdb.common.type-system-seed/as-jsonb :added "0.1"}
(fact "as-jsonb executes directly on local PostgreSQL"
  (t/as-jsonb nil) => {}
  (t/as-jsonb "[]") => (throws))

^{:refer finfolkdb.common.type-system-seed/as-jsonb-array :added "0.1"}
(fact "as-jsonb-array executes directly on local PostgreSQL"
  (t/as-jsonb-array nil) => []
  (t/as-jsonb-array "{}") => (throws))

^{:refer finfolkdb.common.type-system-seed/as-jsonb :id object-preserved}
(fact "JSON object contents survive coercion"
  (t/as-jsonb "{\"a\":1}") => {:a 1})
^{:refer finfolkdb.common.type-system-seed/as-jsonb-array :id array-preserved}
(fact "JSON array contents survive coercion"
  (t/as-jsonb-array "[1,true]") => [1 true])

^{:refer finfolkdb.common.type-system-seed/as-bounded-text :added "0.1"}
(fact "bounded text rejects short, whitespace-only and oversized values"
  (t/as-bounded-text "valid text" 10 10) => "valid text"
  (t/as-bounded-text "short" 10 1000) => (throws)
  (t/as-bounded-text "          " 10 1000) => (throws)
  (t/as-bounded-text "oversized" 1 3) => (throws))

^{:refer finfolkdb.common.type-system-seed/as-finite-date :added "0.1"}
(fact "finite dates reject PostgreSQL infinity and retain optional dates"
  (t/as-finite-date nil) => nil
  (t/as-finite-date "infinity") => (throws))

^{:refer finfolkdb.common.type-system-seed/as-bounded-integer :added "0.1"}
(fact "bounded integers preserve boundary values and reject values outside the column range"
  (t/as-bounded-integer 0 0 3) => 0
  (t/as-bounded-integer 3 0 3) => 3
  (t/as-bounded-integer -1 0 3) => (throws)
  (t/as-bounded-integer 4 0 3) => (throws))
