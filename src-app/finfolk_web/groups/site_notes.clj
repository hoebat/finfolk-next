(ns finfolk-web.groups.site-notes "Native community-note reads and member mutations.")
(def OPERATIONS
  (merge
    {"publicSiteNotes" {"name" "publicSiteNotes" "path" "/v1/sites/:site/notes" "method" "GET" "transport" "rest" "auth" false "write" false "cache" false "domain" "siteNotesPublic"}
     "siteNotes" {"name" "siteNotes" "path" "/v1/me/sites/:site/notes" "method" "GET" "transport" "rest" "auth" true "write" false "cache" false "domain" "siteNotes"}}
    (into {} (for [[key suffix] {"siteNoteSave" "save" "siteNoteVote" "vote" "siteNoteWithdraw" "withdraw" "siteNoteReport" "report"}]
               [key {"name" key "path" (str "/v1/me/sites/:site/notes/" suffix) "method" "POST" "transport" "rest" "auth" true "write" true "domain" "siteNotes"}]))
    {"siteNoteModerate" {"name" "siteNoteModerate" "path" "/v1/admin/sites/:site/notes/moderate" "method" "POST" "transport" "rest" "auth" true "admin" true "write" true "domain" "siteNotes"}}))
