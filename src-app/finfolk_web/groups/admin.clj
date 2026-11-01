(ns finfolk-web.groups.admin
  "Browser bindings for admin; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"messagingAuthorize" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "POST"
 "name" "messagingAuthorize"
 "path" "/v1/admin/messaging/instagram/authorization"
 "transport" "rest"
 "write" true}
 "messagingClaimReviews" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "GET"
 "name" "messagingClaimReviews"
 "path" "/v1/admin/messaging/claim-reviews"
 "transport" "rest"
 "write" false}
 "messagingEvent" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "GET"
 "name" "messagingEvent"
 "path" "/v1/admin/messaging/events/:id"
 "transport" "rest"
 "write" false}
 "messagingEventRetry" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "POST"
 "name" "messagingEventRetry"
 "path" "/v1/admin/messaging/events/:id/retry"
 "transport" "rest"
 "write" true}
 "messagingEvents" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "GET"
 "name" "messagingEvents"
 "path" "/v1/admin/messaging/events"
 "transport" "rest"
 "write" false}
 "messagingSettings" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "GET"
 "name" "messagingSettings"
 "path" "/v1/admin/messaging/instagram"
 "transport" "rest"
 "write" false}
 "messagingSettingsSave" {"admin" true
 "auth" true
 "domain" "admin"
 "method" "PUT"
 "name" "messagingSettingsSave"
 "path" "/v1/admin/messaging/instagram"
 "transport" "rest"
 "write" true}})
