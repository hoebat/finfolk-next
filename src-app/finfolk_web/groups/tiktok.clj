(ns finfolk-web.groups.tiktok)
(def OPERATIONS
 {"tiktokAccount" {"auth" true "domain" "tiktok" "method" "GET" "name" "tiktokAccount" "path" "/v1/me/tiktok" "transport" "rest" "write" false}
"tiktokCodeConnect" {"auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCodeConnect" "path" "/v1/me/tiktok/connect" "transport" "rest" "write" true}
"tiktokMemberDisconnect" {"auth" true "domain" "tiktok" "method" "POST" "name" "tiktokMemberDisconnect" "path" "/v1/me/tiktok/disconnect" "transport" "rest" "write" true}
"tiktokOperatorStatus" {"admin" true "auth" true "domain" "tiktok" "method" "GET" "name" "tiktokOperatorStatus" "path" "/v1/messaging/connections/finfolk-tiktok/status" "transport" "rest" "write" false}
"tiktokOperatorEvent" {"admin" true "auth" true "domain" "tiktok" "method" "GET" "name" "tiktokOperatorEvent" "path" "/v1/messaging/connections/finfolk-tiktok/events/:id" "transport" "rest" "write" false}
"tiktokOperatorAuthorize" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokOperatorAuthorize" "path" "/v1/messaging/connections/finfolk-tiktok/authorization" "transport" "rest" "write" true}
"tiktokOperatorActivate" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokOperatorActivate" "path" "/v1/messaging/connections/finfolk-tiktok/activation" "transport" "rest" "write" true}
"tiktokOperatorPause" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokOperatorPause" "path" "/v1/messaging/connections/finfolk-tiktok/pause" "transport" "rest" "write" true}
"tiktokOperatorDisconnect" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokOperatorDisconnect" "path" "/v1/messaging/connections/finfolk-tiktok/disconnect" "transport" "rest" "write" true}
"tiktokOperatorAcceptance" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokOperatorAcceptance" "path" "/v1/messaging/connections/finfolk-tiktok/acceptance" "transport" "rest" "write" true}
"tiktokCommentsStatus" {"admin" true "auth" true "domain" "tiktok" "method" "GET" "name" "tiktokCommentsStatus" "path" "/v1/messaging/connections/finfolk-tiktok-comments/status" "transport" "rest" "write" false}
"tiktokCommentsEvent" {"admin" true "auth" true "domain" "tiktok" "method" "GET" "name" "tiktokCommentsEvent" "path" "/v1/messaging/connections/finfolk-tiktok-comments/events/:id" "transport" "rest" "write" false}
"tiktokCommentsAuthorize" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCommentsAuthorize" "path" "/v1/messaging/connections/finfolk-tiktok-comments/authorization" "transport" "rest" "write" true}
"tiktokCommentsActivate" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCommentsActivate" "path" "/v1/messaging/connections/finfolk-tiktok-comments/activation" "transport" "rest" "write" true}
"tiktokCommentsPause" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCommentsPause" "path" "/v1/messaging/connections/finfolk-tiktok-comments/pause" "transport" "rest" "write" true}
"tiktokCommentsDisconnect" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCommentsDisconnect" "path" "/v1/messaging/connections/finfolk-tiktok-comments/disconnect" "transport" "rest" "write" true}
"tiktokCommentsAcceptance" {"admin" true "auth" true "domain" "tiktok" "method" "POST" "name" "tiktokCommentsAcceptance" "path" "/v1/messaging/connections/finfolk-tiktok-comments/acceptance" "transport" "rest" "write" true}
})
