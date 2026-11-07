(ns finfolk-web.pages.logbook
  (:require [finfolk-web.lib.seed :as seed]
            [finfolk-web.pages.account :as account]))
(defn sdk-read [operation method args]
  (assoc (seed/read-model operation) "sdk" {"method" [method] "args" args}))
(defn sdk-action [operation method args]
  (assoc (seed/action operation) "sdk" {"method" [method] "args" args}))
(def SDK_ACTIONS
  {"upload" {"method" ["upload"]} "remove-photo" {"method" ["removePhoto"]}
   "photo" {"method" ["photo"]} "social-posts" {"method" ["instagramPosts"]}})
(def DEFINITIONS
  {"logbook" {"routes" ["/logbook"] "area" "mixed" "loader" "logbook"
               "models" {"session" (sdk-read "session" "get" ["id"])
                         "profile" (sdk-read "profile" "profile" ["target"])
                         "ensure" (assoc-in (sdk-read "me" "ensureProfile" []) ["sdk" "optional"] true)}
               "actions" {"assignImportedMedia" (seed/action "assignImportedMedia") "delete" (sdk-action "deleteSession" "deleteSession" ["id"])
                          "visibility" (sdk-action "visibility" "visibility" ["id" "visibility"])}
               "auth-actions" account/AUTH_ACTIONS "sdk-actions" SDK_ACTIONS}
   "logbook-list" {"routes" [] "area" "mixed"
                    "models" {"sessions" (assoc (sdk-read "sessions" "list" ["$values"]) "bindings" {"owner" "owner" "publicOnly" "publicOnly"} "defaults" {"cursor" nil})}
                    "actions" {"more" (sdk-action "sessions" "list" ["$values"])}}
   "logbook-editor" {"routes" [] "area" "member" "models" {}
                      "actions" {"save" (sdk-action "saveSession" "save" ["id" "values"])
                                 "assignImportedMedia" (seed/action "assignImportedMedia")}
                      "sdk-actions" SDK_ACTIONS}
   "logbook-inbox" {"routes" [] "area" "member" "order" ["result" "tiktok"]
                     "models" {"result" (seed/read-model "mediaInbox") "tiktok" (seed/read-model "tiktokStatus")}
                     "actions" (merge {"list" (sdk-action "sessions" "list" ["$values"])}
                                 (into {} (for [operation ["tiktokSync" "tiktokDisconnect" "tiktokConnect" "updateImportedMedia" "assignImportedMedia" "hideImportedMedia"]]
                                            [operation (seed/action operation)])))}
   "logbook-extras" {"routes" [] "area" "mixed" "loader" "logbook-extras"
                      "models" {"trips" (seed/read-model "publicTrips")}
                      "actions" {} "sdk-actions" SDK_ACTIONS}
   "public-report" {"routes" ["/reports/[id]"] "area" "public"
                     "models" {"report" (assoc (seed/read-model "publicTrip" {"id" "id"})
                                          "validate" {"id" {"pattern" "^[a-f0-9-]{36}$" "message" "Choose a valid trip report."}}
                                          "not-found" "Trip report unavailable." "error-body" true)}
                     "actions" {}}})
