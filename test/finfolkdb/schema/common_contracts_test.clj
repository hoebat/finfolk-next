(ns finfolkdb.schema.common-contracts-test
  (:use code.test)
  (:require [finfolkbuild.testing.common :as common]
            [finfolkdb.schema.namespaces :as namespaces]
            [finfolkdb.schema.entity-catalog :as catalog]))
(fact "every native table matches the installed local schema"
  (do (namespaces/load-all!)
      (every? common/check!
              (for [[table spec] (catalog/declarations)] (symbol (:module spec) table))))
  =>
  true)
