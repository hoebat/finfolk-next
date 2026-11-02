(ns finfolk-web.groups.logbook
  "Browser bindings for logbook; HTTP permissions remain server-owned.")

(def OPERATIONS
 { "mediaInbox" {"auth" true "domain" "logbook" "name" "mediaInbox" "transport" "action" "write" false}
 "updateImportedMedia" {"auth" true "domain" "logbook" "name" "updateImportedMedia" "transport" "action" "write" true}
 "assignImportedMedia" {"auth" true "domain" "logbook" "name" "assignImportedMedia" "transport" "action" "write" true}
 "hideImportedMedia" {"auth" true "domain" "logbook" "name" "hideImportedMedia" "transport" "action" "write" true}
 "tiktokStatus" {"auth" true "domain" "logbook" "name" "tiktokStatus" "transport" "action" "write" false}
 "tiktokConnect" {"auth" true "domain" "logbook" "name" "tiktokConnect" "transport" "action" "write" true}
 "tiktokDisconnect" {"auth" true "domain" "logbook" "name" "tiktokDisconnect" "transport" "action" "write" true}
 "tiktokSync" {"auth" true "domain" "logbook" "name" "tiktokSync" "transport" "action" "write" true}
 "deleteSession" {"auth" true
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
