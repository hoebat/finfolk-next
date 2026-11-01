(ns finfolk-web.groups.community
  "Browser bindings for community; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"block" {"auth" true
 "domain" "community"
 "name" "block"
 "transport" "action"
 "write" true}
 "blocks" {"auth" true
 "domain" "community"
 "name" "blocks"
 "transport" "action"
 "write" false}
 "checkin" {"auth" true
 "domain" "community"
 "name" "checkin"
 "transport" "action"
 "write" true}
 "community" {"auth" true
 "domain" "community"
 "name" "community"
 "transport" "action"
 "write" false}
 "connection" {"auth" true
 "domain" "community"
 "name" "connection"
 "transport" "action"
 "write" true}
 "connections" {"auth" true
 "domain" "community"
 "name" "connections"
 "transport" "action"
 "write" false}
 "removeCheckin" {"auth" true
 "domain" "community"
 "name" "removeCheckin"
 "transport" "action"
 "write" true}
 "report" {"auth" true
 "domain" "community"
 "name" "report"
 "transport" "action"
 "write" true}
 "stats" {"auth" true
 "domain" "community"
 "name" "stats"
 "transport" "action"
 "write" false}
 "unblock" {"auth" true
 "domain" "community"
 "name" "unblock"
 "transport" "action"
 "write" true}})
