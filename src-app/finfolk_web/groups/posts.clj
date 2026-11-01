(ns finfolk-web.groups.posts
  "Browser bindings for posts; HTTP permissions remain server-owned.")

(def OPERATIONS
 {"communityMetrics" {"admin" true
 "auth" true
 "domain" "posts"
 "name" "communityMetrics"
 "transport" "action"
 "write" false}
 "followedPosts" {"auth" true
 "domain" "posts"
 "name" "followedPosts"
 "transport" "action"
 "write" false}
 "myPosts" {"auth" true
 "domain" "posts"
 "name" "myPosts"
 "transport" "action"
 "write" false}
 "post" {"auth" true
 "domain" "posts"
 "name" "post"
 "transport" "action"
 "write" true}
 "postStatus" {"auth" true
 "domain" "posts"
 "name" "postStatus"
 "transport" "action"
 "write" false}
 "posts" {"auth" true
 "domain" "posts"
 "name" "posts"
 "transport" "action"
 "write" false}
 "publicPosts" {"auth" false
 "domain" "posts"
 "method" "GET"
 "name" "publicPosts"
 "path" "/community/posts"
 "transport" "rest"
 "write" false}
 "publicReferral" {"auth" false
 "domain" "posts"
 "method" "POST"
 "name" "publicReferral"
 "path" "/community/referral"
 "transport" "rest"
 "write" true}
 "removePost" {"auth" true
 "domain" "posts"
 "name" "removePost"
 "transport" "action"
 "write" true}
 "reportPost" {"auth" true
 "domain" "posts"
 "name" "reportPost"
 "transport" "action"
 "write" true}
 "resolvePostReport" {"admin" true
 "auth" true
 "domain" "posts"
 "name" "resolvePostReport"
 "transport" "action"
 "write" true}
 "reviewPost" {"admin" true
 "auth" true
 "domain" "posts"
 "name" "reviewPost"
 "transport" "action"
 "write" true}
 "reviewPosts" {"admin" true
 "auth" true
 "domain" "posts"
 "name" "reviewPosts"
 "transport" "action"
 "write" false}})
