(ns finfolkdb.schema.rpc-catalog
  "Generated trusted-server call signatures for native RPC functions."
  (:require [clojure.string :as str]
            [finfolkdb.schema.account-contracts :as contracts]
            [finfolkdb.schema.namespaces :as namespaces]
            [finfolkdb.main.scaffold-001-entity]
            [lang.core.impl :as impl]
            [lang.core.library :as library]
            [lang.core.library-snapshot :as snapshot]))

(defn declarations
  []
  (namespaces/load-all!)
  (let [book (snapshot/get-book (library/get-snapshot (impl/runtime-library)) :postgres)]
    (assoc (into (sorted-map)
          (for [module (vals (:modules book))
                entry (vals (:code module))
                :when (and (= :function (:static/dbtype entry))
                           (= "finfolk_rpc" (:static/schema entry)))]
            [(str/replace (str (:id entry)) "-" "_")
             {:module (str (:module entry))
              :schema "finfolk_rpc"
              :arguments (mapv (fn [[type argument]] {:name (str argument) :type (name type)})
                               (partition 2 (nth (:form entry) 2)))
              :returns (mapv str (:static/return entry))
              :contract (get contracts/RPCS (str/replace (str (:id entry)) "-" "_"))}])) "buddy_call" {:module "finfolkdb.schema.buddies" :schema "finfolk_rpc" :arguments [{:name "actor" :type "uuid"} {:name "values" :type "jsonb"}] :returns ["jsonb"]})))
