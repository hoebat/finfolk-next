(ns finfolk-web.groups.logbook
  "Browser bindings for logbook; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"deleteSession" {"auth" true
 "domain" "logbook"
 "name" "deleteSession"
 "transport" "action"
 "write" true}
 "saveSession" {"auth" true
 "domain" "logbook"
 "name" "saveSession"
 "transport" "action"
 "write" true}
 "session" {"auth" true
 "domain" "logbook"
 "name" "session"
 "transport" "action"
 "write" false}
 "sessions" {"auth" true
 "domain" "logbook"
 "name" "sessions"
 "transport" "action"
 "write" false}
 "visibility" {"auth" true
 "domain" "logbook"
 "name" "visibility"
 "transport" "action"
 "write" true}})
