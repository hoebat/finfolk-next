(ns finfolkdb.catalog-test
  (:require [finfolkbuild.db.legacy :as catalog]
            [std.json :as json])
  (:use code.test))
^{:id all-tables}
(fact "all domain declarations are discoverable, with unambiguous columns and physical constraints"
  (let [tables (catalog/declarations)]
    [(count tables)
     (every?
      (fn [[_ {:keys [columns constraints]}]]
        (and (seq columns) (seq constraints) (= (count columns) (count (set (map :name columns))))))
      tables)])
  =>
  [69 true])
^{:id rpc-input-contract}
(fact "member RPC input and output contracts remain explicit"
  (let [ops (json/read (catalog/contracts))]
    (mapv (fn [k]
            {:input (mapv keyword (get-in ops [k "input"]))
             :return (keyword (get-in ops [k "return"]))})
          ["member-profile" "profile-save" "checkin-record"]))
  =>
  [{:input [] :return :jsonb} {:input [:jsonb] :return :jsonb} {:input [:text] :return :jsonb}])
