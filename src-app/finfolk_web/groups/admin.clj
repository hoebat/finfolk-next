(ns finfolk-web.groups.admin
  "Browser bindings for admin; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"socialOperatorEvent" {"admin" true "auth" true "domain" "admin" "method" "GET" "name" "socialOperatorEvent" "path" "/v1/messaging/connections/finfolk-instagram/events/:id" "transport" "rest" "write" false}
 "socialOperatorStatus" {"admin" true "auth" true "domain" "admin" "method" "GET" "name" "socialOperatorStatus" "path" "/v1/messaging/connections/finfolk-instagram/status" "transport" "rest" "write" false}
 "socialOperatorAuthorize" {"admin" true "auth" true "domain" "admin" "method" "POST" "name" "socialOperatorAuthorize" "path" "/v1/messaging/connections/finfolk-instagram/authorization" "transport" "rest" "write" true}
 "socialOperatorActivate" {"admin" true "auth" true "domain" "admin" "method" "POST" "name" "socialOperatorActivate" "path" "/v1/messaging/connections/finfolk-instagram/activation" "transport" "rest" "write" true}
 "socialOperatorPause" {"admin" true "auth" true "domain" "admin" "method" "POST" "name" "socialOperatorPause" "path" "/v1/messaging/connections/finfolk-instagram/pause" "transport" "rest" "write" true}
 "socialOperatorDisconnect" {"admin" true "auth" true "domain" "admin" "method" "POST" "name" "socialOperatorDisconnect" "path" "/v1/messaging/connections/finfolk-instagram/disconnect" "transport" "rest" "write" true}
 "socialOperatorAcceptance" {"admin" true "auth" true "domain" "admin" "method" "POST" "name" "socialOperatorAcceptance" "path" "/v1/messaging/connections/finfolk-instagram/acceptance" "transport" "rest" "write" true}
 "messagingAuthorizationDiagnostics" {"admin" true "auth" true "domain" "admin" "method" "GET" "name" "messagingAuthorizationDiagnostics" "path" "/v1/admin/messaging/instagram/authorization/diagnostics" "transport" "rest" "write" false}
 "messagingAuthorize" {"admin" true
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
