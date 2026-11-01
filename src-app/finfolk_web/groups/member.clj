(ns finfolk-web.groups.member
  "Browser bindings for member; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"deleteAccount" {"auth" true
 "domain" "member"
 "name" "deleteAccount"
 "transport" "action"
 "write" true}
 "me" {"auth" true
 "domain" "member"
 "name" "me"
 "transport" "action"
 "write" false}
 "myCheckins" {"auth" true
 "domain" "member"
 "name" "myCheckins"
 "transport" "action"
 "write" false}
 "preferences" {"auth" true
 "domain" "member"
 "name" "preferences"
 "transport" "action"
 "write" true}
 "profile" {"auth" true
 "domain" "member"
 "name" "profile"
 "transport" "action"
 "write" false}})
