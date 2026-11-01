(ns finfolk-web.groups.instagram
  "Browser bindings for instagram; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"instagramAccount" {"auth" true
 "domain" "instagram"
 "method" "GET"
 "name" "instagramAccount"
 "path" "/v1/me/instagram"
 "transport" "rest"
 "write" false}
 "instagramActions" {"auth" true
 "domain" "instagram"
 "name" "instagramActions"
 "transport" "action"
 "write" false}
 "instagramAdminInbox" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramAdminInbox"
 "transport" "action"
 "write" false}
 "instagramBindMediaOwner" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramBindMediaOwner"
 "transport" "action"
 "write" true}
 "instagramCancel" {"auth" true
 "domain" "instagram"
 "name" "instagramCancel"
 "transport" "action"
 "write" true}
 "instagramChoosePostBeach" {"auth" true
 "domain" "instagram"
 "name" "instagramChoosePostBeach"
 "transport" "action"
 "write" true}
 "instagramClaimRead" {"auth" true
 "domain" "instagram"
 "method" "GET"
 "name" "instagramClaimRead"
 "path" "/v1/me/instagram/claims/:id"
 "transport" "rest"
 "write" false}
 "instagramClaimReviewInbox" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramClaimReviewInbox"
 "transport" "action"
 "write" false}
 "instagramClaimStatus" {"auth" true
 "domain" "instagram"
 "name" "instagramClaimStatus"
 "transport" "action"
 "write" false}
 "instagramCodeConnect" {"auth" true
 "domain" "instagram"
 "method" "POST"
 "name" "instagramCodeConnect"
 "path" "/v1/me/instagram/connect"
 "transport" "rest"
 "write" true}
 "instagramCommandConfirm" {"auth" true
 "domain" "instagram"
 "name" "instagramCommandConfirm"
 "transport" "action"
 "write" true}
 "instagramCommandResolve" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramCommandResolve"
 "transport" "action"
 "write" true}
 "instagramCommandReview" {"auth" true
 "domain" "instagram"
 "name" "instagramCommandReview"
 "transport" "action"
 "write" true}
 "instagramCommandStatus" {"auth" true
 "domain" "instagram"
 "name" "instagramCommandStatus"
 "transport" "action"
 "write" false}
 "instagramCommandVerify" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramCommandVerify"
 "transport" "action"
 "write" true}
 "instagramConfirm" {"auth" true
 "domain" "instagram"
 "name" "instagramConfirm"
 "transport" "action"
 "write" true}
 "instagramDisconnect" {"auth" true
 "domain" "instagram"
 "name" "instagramDisconnect"
 "transport" "action"
 "write" true}
 "instagramDiscoveryInbox" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramDiscoveryInbox"
 "transport" "action"
 "write" false}
 "instagramDiscoveryRetry" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramDiscoveryRetry"
 "transport" "action"
 "write" true}
 "instagramDiscoveryStatus" {"auth" true
 "domain" "instagram"
 "name" "instagramDiscoveryStatus"
 "transport" "action"
 "write" false}
 "instagramHidePost" {"auth" true
 "domain" "instagram"
 "name" "instagramHidePost"
 "transport" "action"
 "write" true}
 "instagramMyPosts" {"auth" true
 "domain" "instagram"
 "name" "instagramMyPosts"
 "transport" "action"
 "write" false}
 "instagramPointsConsent" {"auth" true
 "domain" "instagram"
 "name" "instagramPointsConsent"
 "transport" "action"
 "write" true}
 "instagramProfile" {"auth" true
 "domain" "instagram"
 "method" "PUT"
 "name" "instagramProfile"
 "path" "/v1/me/instagram/profile"
 "transport" "rest"
 "write" true}
 "instagramProfileLink" {"auth" true
 "domain" "instagram"
 "name" "instagramProfileLink"
 "transport" "action"
 "write" true}
 "instagramReconcile" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramReconcile"
 "transport" "action"
 "write" true}
 "instagramRemoveAllPosts" {"auth" true
 "domain" "instagram"
 "name" "instagramRemoveAllPosts"
 "transport" "action"
 "write" true}
 "instagramRetryEvent" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramRetryEvent"
 "transport" "action"
 "write" true}
 "instagramReversePoints" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramReversePoints"
 "transport" "action"
 "write" true}
 "instagramReview" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramReview"
 "transport" "action"
 "write" true}
 "instagramReviewPost" {"auth" true
 "domain" "instagram"
 "name" "instagramReviewPost"
 "transport" "action"
 "write" true}
 "instagramSharing" {"auth" true
 "domain" "instagram"
 "name" "instagramSharing"
 "transport" "action"
 "write" true}
 "instagramStatus" {"auth" true
 "domain" "instagram"
 "name" "instagramStatus"
 "transport" "action"
 "write" false}
 "instagramSuppressSource" {"admin" true
 "auth" true
 "domain" "instagram"
 "name" "instagramSuppressSource"
 "transport" "action"
 "write" true}
 "instagramUnlink" {"auth" true
 "domain" "instagram"
 "method" "DELETE"
 "name" "instagramUnlink"
 "path" "/v1/me/instagram"
 "transport" "rest"
 "write" true}
 "publicInstagram" {"auth" false
 "domain" "instagram"
 "method" "GET"
 "name" "publicInstagram"
 "path" "/instagram/posts"
 "transport" "rest"
 "write" false}
 "publicInstagramReport" {"auth" false
 "domain" "instagram"
 "method" "POST"
 "name" "publicInstagramReport"
 "path" "/instagram/posts/:id/report"
 "transport" "rest"
 "write" true}})
