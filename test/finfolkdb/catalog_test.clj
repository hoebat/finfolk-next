(ns finfolkdb.catalog-test
  (:require [finfolkdb.testing.catalog :as catalog]
            [finfolkdb.rpc.api-group-member :as member])
  (:use code.test))
^{:id all-tables}
(fact "all domain declarations are discoverable, with unambiguous columns and physical constraints"
  (let [tables (catalog/declarations)]
    [(count tables)
     (every? (fn [[_ {:keys [columns constraints]}]]
               (and (seq columns) (seq constraints)
                    (= (count columns) (count (set (map :name columns)))))) tables)])
  => [63 true])
^{:id rpc-input-contract}
(fact "member RPC input and output contracts remain explicit"
  (mapv #(select-keys (get member/OPERATIONS %) [:input :return])
        [:member-profile :profile-save :checkin-record])
  => [{:input [] :return :jsonb} {:input [:jsonb] :return :jsonb} {:input [:text] :return :jsonb}])
