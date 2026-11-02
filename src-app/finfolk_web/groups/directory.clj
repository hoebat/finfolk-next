(ns finfolk-web.groups.directory)
(def OPERATIONS
 {"pageAccess" {"name" "pageAccess" "path" "/v1/me/directory/access" "method" "POST" "transport" "rest" "auth" true "write" false "domain" "directoryOwner"}
"pageInvite" {"name" "pageInvite" "path" "/v1/me/directory/invite" "method" "POST" "transport" "rest" "auth" true "write" true "domain" "directoryOwner"}
"pageInviteRedeem" {"name" "pageInviteRedeem" "path" "/v1/me/directory/invite-redeem" "method" "POST" "transport" "rest" "auth" true "write" true "domain" "directoryOwner"}
"pageInviteRevoke" {"name" "pageInviteRevoke" "path" "/v1/me/directory/invite-revoke" "method" "POST" "transport" "rest" "auth" true "write" true "domain" "directoryOwner"}
"pageAdminRemove" {"name" "pageAdminRemove" "path" "/v1/me/directory/admin-remove" "method" "POST" "transport" "rest" "auth" true "write" true "domain" "directoryOwner"}
 "publicDirectory" {"name" "publicDirectory" "path" "/v1/directory" "method" "GET" "transport" "rest" "auth" false "write" false "domain" "directoryPublic"}
 "publicDirectoryDetail" {"name" "publicDirectoryDetail" "path" "/v1/directory/:id" "method" "GET" "transport" "rest" "auth" false "write" false "domain" "directoryPublic"}
 "directoryMerge" {"name" "directoryMerge" "path" "/v1/admin/directory/merge" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "directoryAdmin"}
 "directoryMine" {"name" "directoryMine" "path" "/v1/me/directory" "method" "GET" "transport" "rest" "auth" true "admin" false "write" false "domain" "directoryOwner"}
"directoryOwnerSave" {"name" "directoryOwnerSave" "path" "/v1/me/directory/save" "method" "POST" "transport" "rest" "auth" true "admin" false "write" true "domain" "directoryOwner"}
"directoryClaim" {"name" "directoryClaim" "path" "/v1/me/directory/claim" "method" "POST" "transport" "rest" "auth" true "admin" false "write" true "domain" "directoryOwner"}
"directoryReport" {"name" "directoryReport" "path" "/v1/me/directory/report" "method" "POST" "transport" "rest" "auth" true "admin" false "write" true "domain" "directoryOwner"}
"directoryAdmin" {"name" "directoryAdmin" "path" "/v1/admin/directory" "method" "GET" "transport" "rest" "auth" true "admin" true "write" false "domain" "directoryAdmin"}
"directoryAdminSave" {"name" "directoryAdminSave" "path" "/v1/admin/directory/save" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "directoryAdmin"}
"directoryClaimReview" {"name" "directoryClaimReview" "path" "/v1/admin/directory/claim-review" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "directoryAdmin"}
"directoryDiscover" {"name" "directoryDiscover" "path" "/v1/admin/directory/discover" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "directoryAdmin"}
"directoryReportResolve" {"name" "directoryReportResolve" "path" "/v1/admin/directory/report-resolve" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "directoryAdmin"}})
