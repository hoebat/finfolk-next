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
  (count operations/DEFINITIONS) => 95)
^{:id deployed-sql}
(fact "the extraction preserves the existing database release"
  (format "%064x" (java.math.BigInteger. 1 (.digest (java.security.MessageDigest/getInstance "SHA-256")
                                                   (.getBytes (publication/sql) "UTF-8"))))
  => "3e5358d7d01aad17b2eaa95344a9a6fa8701550e7c88ee83fe0db13887f32a0a")
