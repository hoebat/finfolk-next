(ns finfolk-web.groups.sites
 "Site catalog and review operations; authorization is server-owned.")
(def OPERATIONS
 {"siteImportDetail" {"name" "siteImportDetail" "path" "/v1/admin/sites/imports/:id" "method" "GET" "transport" "rest" "auth" true "admin" true "write" false "domain" "siteAdmin"}
 "siteCatalog" {"name" "siteCatalog"
 "path" "/v1/sites/catalog"
 "method" "GET"
 "transport" "rest"
 "write" false
 "auth" false
 "domain" "sites"}
 "siteDetail" {"name" "siteDetail"
 "path" "/v1/sites/:id"
 "method" "GET"
 "transport" "rest"
 "write" false
 "auth" false
 "domain" "sites"}
 "mySiteSubmissions" {"name" "mySiteSubmissions"
 "path" "/v1/me/site-submissions"
 "method" "GET"
 "transport" "rest"
 "write" false
 "auth" true
 "domain" "siteSubmissions"}
 "siteSubmissionSave" {"name" "siteSubmissionSave"
 "path" "/v1/me/site-submissions"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteSubmissions"}
 "siteSubmissionWithdraw" {"name" "siteSubmissionWithdraw"
 "path" "/v1/me/site-submissions/:id/withdraw"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteSubmissions"}
 "siteAdmin" {"name" "siteAdmin"
 "path" "/v1/admin/sites"
 "method" "GET"
 "transport" "rest"
 "write" false
 "auth" true
 "domain" "siteAdmin"
 "admin" true}
 "siteDraftSave" {"name" "siteDraftSave"
 "path" "/v1/admin/sites/drafts"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteAdmin"
 "admin" true}
 "siteDraftPublish" {"name" "siteDraftPublish"
 "path" "/v1/admin/sites/drafts/:id/publish"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteAdmin"
 "admin" true}
 "siteDraftReject" {"name" "siteDraftReject"
 "path" "/v1/admin/sites/drafts/:id/reject"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteAdmin"
 "admin" true}
 "siteImportStage" {"name" "siteImportStage"
 "path" "/v1/admin/sites/imports"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteAdmin"
 "admin" true}
 "siteImportPublish" {"name" "siteImportPublish"
 "path" "/v1/admin/sites/imports/:id/publish"
 "method" "POST"
 "transport" "rest"
 "write" true
 "auth" true
 "domain" "siteAdmin"
 "admin" true}})
