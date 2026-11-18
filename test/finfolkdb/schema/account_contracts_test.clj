(ns finfolkdb.schema.account-contracts-test
  (:require [finfolkdb.schema.account-contracts :as contracts])
  (:use code.test))
^{:refer finfolkdb.schema.account-contracts/typescript :added "0.1"}
(fact "published types follow the RPC shapes instead of a separate handwritten interface"
  [(boolean (re-find #"\"verified\":boolean" (contracts/typescript)))
   (contracts/schema-type {:type "array" :items {:type "string"}})
   (contracts/schema-type {:type "object" :properties {:name {:type "string"}}})
   (try (contracts/schema-type {:type "imaginary"}) :accepted (catch clojure.lang.ExceptionInfo _ :rejected))]
  => [true "Array<string>" "{\"name\"?:string}" :rejected])
