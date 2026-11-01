(ns finfolkdb.common.fn-system-auth-test
  (:require [finfolkbuild.testing.jdbc :as jdbc]) (:use code.test))
^{:id actor-context}
(fact "actor identity is transaction-local and absent on another connection"
  [(jdbc/transaction "alice" #(jdbc/scalar % "SELECT finfolk_rpc.actor_id()"))
   (with-open [db (jdbc/connection)] (jdbc/scalar db "SELECT finfolk_rpc.actor_id()"))]
  => ["alice" ""])
^{:id verified-member}
(fact "verified operations reject an unverified or banned identity"
  (mapv #(jdbc/transaction % (fn [db] (jdbc/scalar db "SELECT finfolk_rpc.member_permitted(true)::text")))
        ["alice" "bob" "banned" "missing"])
  => ["true" "false" "false" "false"])
^{:id trusted-identity}
(fact "identity lookup returns the intended identity and hides banned accounts"
  [(jdbc/transaction "alice" #(jdbc/scalar % "SELECT finfolk_rpc.auth_identity('alice')->>'name'"))
   (jdbc/transaction "alice" #(jdbc/scalar % "SELECT finfolk_rpc.auth_identity('banned')"))]
  => ["Alice" nil])
