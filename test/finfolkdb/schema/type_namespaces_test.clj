(ns finfolkdb.schema.type-namespaces-test
  (:require [finfolkdb.schema.namespaces :as namespaces]
            [finfolkdb.schema.entity-catalog :as catalog]
            [finfolkdb.schema.entity-coverage :as coverage])
  (:use code.test))

;;
;; Every Authored Type Namespace
;;

^{:id require-every-type}
(fact "every type file can be required independently of the frontend"
  (do (namespaces/load-all!) (every? find-ns (keys (namespaces/declarations)))) => true)

^{:id no-orphan-types}
(fact "every type module contributes live tables or the shared enum/coercion seed"
  (let [modules (set (map (comp symbol :module) (vals (catalog/declarations))))
        enum-modules '#{finfolkdb.common.type-domain-enum finfolkdb.common.type-system-seed}]
    (every? #(or (modules %) (enum-modules %)) (keys (namespaces/declarations))))
  =>
  true)

^{:id complete-domain-coverage}
(fact "every historical responsibility has one active entity declaration"
  (let [report (coverage/current)]
    [(:historical-total report) (:mapped-total report) (:remaining report)])
  =>
  [69 69 []])

^{:id capitalized-types}
(fact "active tables have singular capitalized entity names and no legacy constraints metadata"
  (let [tables (catalog/declarations)]
    (and (every? #(re-matches #"[A-Z][A-Za-z0-9]*" %) (keys tables))
         (every? #(not (.contains (slurp %) ":finfolk/constraints"))
                 (vals (namespaces/declarations)))))
  =>
  true)
