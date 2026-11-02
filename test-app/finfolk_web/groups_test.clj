(ns finfolk-web.groups-test
  (:require [finfolk-web.lib.operations :as operations]
            [finfolkbuild.db.publication :as publication])
  (:use code.test))
^{:id browser-contracts}
(fact "member writes and public reads retain their ownership boundaries"
  [(get-in operations/DEFINITIONS ["preferences" "auth"])
   (get-in operations/DEFINITIONS ["preferences" "write"])
   (get-in operations/DEFINITIONS ["checkin" "domain"])
   (get-in operations/DEFINITIONS ["publicTrips" "auth"])
   (get-in operations/DEFINITIONS ["messagingSettingsSave" "admin"])]
  => [true true "community" false true])
^{:id api-coverage}
(fact "the extracted browser contract includes every deployed operation"
  (count operations/DEFINITIONS) => 137)
^{:id deployed-sql}
(fact "site transactions are published with the member backbone"
  (clojure.string/includes? (publication/sql) "FUNCTION finfolk_rpc.site_publish") => true)
