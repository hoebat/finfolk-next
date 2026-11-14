(ns finfolkdb.fn.member.member-profile-test
  (:require [finfolkbuild.testing.jdbc :as jdbc])
  (:use code.test))
^{:id profile-ownership}
(fact "profile reads resolve through the active actor"
  (mapv #(jdbc/transaction
          %
          (fn [db] (jdbc/scalar db "SELECT finfolk_rpc.member_profile()->>'displayName'")))
        ["alice" "bob" "banned"])
  =>
  ["Alice" "Bob" nil])
^{:id profile-validation}
(fact "non-object profile writes are rejected without replacing the stored profile"
  (jdbc/transaction "alice"
                    #(vector (jdbc/scalar % "SELECT finfolk_rpc.profile_save('[]'::jsonb)")
                             (jdbc/scalar % "SELECT finfolk_rpc.member_profile()->>'displayName'")))
  =>
  [nil "Alice"])
^{:id profile-update}
(fact "a valid profile write returns the new value inside the same transaction"
  (jdbc/transaction
   "alice"
   #(jdbc/scalar
     %
     "SELECT finfolk_rpc.profile_save('{\"displayName\":\"Updated\",\"open\":true}'::jsonb)->>'displayName'"))
  =>
  "Updated")
^{:id checkin-idempotency}
(fact "duplicate check-ins create one beach/day record"
  (jdbc/transaction
   "alice"
   (fn [db]
     (jdbc/scalar db "SELECT finfolk_rpc.checkin_record('bondi')")
     (jdbc/scalar db "SELECT finfolk_rpc.checkin_record('bondi')")
     (jdbc/scalar
      db
      "SELECT count(*) FROM finfolk.checkins WHERE user_id='alice' AND beach_id='bondi'")))
  =>
  "1")
