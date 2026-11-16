(ns finfolkdb.build-test
  (:require [finfolkdb.build :as build]
            [finfolkdb.shop :as shop]
            [clojure.string :as str])
  (:use code.test))

^{:refer finfolkdb.build/sql-artifacts :added "0.1"}
(fact "SQL is generated from finfolkdb sources without reading SQL files"
  (let [read-text slurp
        artifacts (with-redefs [clojure.core/slurp
                                (fn [source & options]
                                  (when (str/ends-with? (str source) ".sql")
                                    (throw (ex-info "SQL files are outputs, never inputs" {:source (str source)})))
                                  (apply read-text source options))]
                    (build/sql-artifacts))]
    [(set (keys artifacts))
     (boolean (re-find #"DiveSession" (get artifacts "resources/finfolkdb/entity-schema.sql")))
     (contains? artifacts "resources/finfolkdb/pilot.sql")])
  => [(set build/SQL-OUTPUTS) true false]
  (with-redefs [shop/SQL "SELECT 'authored-source';"]
    (get (build/sql-artifacts) "resources/finfolkdb/shop.sql"))
  => "-- Generated from finfolkdb.shop/SQL.\nSELECT 'authored-source';")

^{:refer finfolkdb.build/json-artifacts :added "0.1"}
(fact "metadata publication emits JSON independently of SQL compilation"
  (let [artifacts (build/json-artifacts)]
    [(set (keys artifacts)) (every? #(str/ends-with? % ".json") (keys artifacts))])
  => [(set build/JSON-OUTPUTS) true])
