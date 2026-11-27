(ns finfolk-web.groups.member
  "Browser bindings for member; HTTP permissions remain server-owned."
  (:require [finfolkdb.schema.account-contracts :as contracts]))

(def OPERATIONS
 (contracts/annotate
 {"buddyRead" {"name" "buddyRead" "auth" true "write" false "cache" false "transport" "action" "domain" "buddies"}
 "buddyAction" {"name" "buddyAction" "auth" true "write" true "cache" false "transport" "action" "domain" "buddies"}
 "deleteAccount" {"auth" true
 "domain" "member"
 "name" "deleteAccount"
 "transport" "action"
 "write" true}
 "me" {"native-rpc" (get-in contracts/OPERATIONS ["me" :rpc])
 "request-shape" (get-in contracts/OPERATIONS ["me" :request])
 "result-shape" (get-in contracts/OPERATIONS ["me" :result])
 "auth" true
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
 "write" false}}))
