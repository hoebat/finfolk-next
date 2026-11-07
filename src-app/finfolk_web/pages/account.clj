(ns finfolk-web.pages.account
  (:require [finfolk-web.lib.seed :as seed]))
(def AUTH_ACTIONS
  (into {} (for [[key method] {"google" ["google"] "email" ["email"] "sign-up" ["auth" "signUp" "email"]
                               "refresh" ["refresh"] "reset" ["reset"] "reset-password" ["resetPassword"]
                               "verify" ["verify"] "verify-code" ["verifyCode"] "sign-out" ["signOut"]
                               "reauthenticate" ["reauthenticate"] "delete-account" ["deleteAccount"]}]
             [key {"method" method "check-error" (= key "sign-up")}])))
(def CORE_DEFINITIONS
  {"account" {"routes" ["/account"] "area" "member" "order" ["me" "status"]
               "models" {"me" (seed/read-model "me") "status" (seed/read-model "postStatus")}
               "actions" {} "auth-actions" AUTH_ACTIONS}
   "account-privacy" {"routes" ["/account/privacy"] "area" "member" "order" ["connections" "blocks"]
                       "models" {"connections" (seed/read-model "connections") "blocks" (seed/read-model "blocks")}
                       "actions" (into {} (for [op ["preferences" "connection" "block" "unblock"]] [op (seed/action op)]))
                       "auth-actions" AUTH_ACTIONS}
   "account-identity" {"routes" [] "area" "member" "models" {"me" (seed/read-model "me")} "actions" {}}
   "account-checkin" {"routes" ["/account/checkin"] "area" "member"
                       "models" {"checkins" (seed/read-model "myCheckins")}
                       "actions" {"checkin" (seed/action "checkin") "remove" (seed/action "removeCheckin")}}
   "account-settings" {"routes" ["/account/settings"] "area" "member" "models" {} "actions" {}
                        "adapters" ["theme" "offline-storage" "messaging-settings"]}
   "site-submissions" {"routes" ["/account/sites"] "area" "member"
                        "models" {"submissions" (seed/read-model "mySiteSubmissions")}
                        "actions" {"save" (seed/action "siteSubmissionSave") "withdraw" (seed/action "siteSubmissionWithdraw")}}
   "site-review" {"routes" [] "area" "member" "loader" "site-review"
                   "models" {"sites" (seed/read-model "siteAdmin") "batch" (seed/read-model "siteImportDetail")}
                   "actions" {"save" (seed/action "siteDraftSave") "publish" (seed/action "siteDraftPublish")
                              "reject" (seed/action "siteDraftReject") "stage" (seed/action "siteImportStage")
                              "publish-import" (seed/action "siteImportPublish")}}})

(def INTEGRATION_DEFINITIONS
 {"post-manager" {"routes" ["/account/posts"] "area" "member" "loader" "post-manager" "models" (into {} (for [op ["myPosts" "followedPosts"]] [op (seed/read-model op)])) "actions" (into {} (for [op ["post" "removePost"]] [op (seed/action op)]))}
  "trip-manager" {"routes" [] "area" "member" "models" (into {} (for [op ["tripList"]] [op (seed/read-model op)])) "actions" (into {} (for [op ["tripDives" "tripGet" "tripImportBatch" "tripImportBegin" "tripImportConfirm" "tripPreview" "tripPublish" "tripSave" "tripUnpublish"]] [op (seed/action op)]))}
  "instagram-discovery" {"routes" [] "area" "member" "loader" "instagram-discovery" "models" (into {} (for [op ["instagramStatus" "instagramMyPosts" "instagramDiscoveryInbox"]] [op (seed/read-model op)])) "actions" (into {} (for [op ["instagramBindMediaOwner" "instagramChoosePostBeach" "instagramDiscoveryRetry" "instagramHidePost" "instagramRemoveAllPosts" "instagramReviewPost" "instagramSharing" "instagramSuppressSource"]] [op (seed/action op)]))}
  "trip-report" {"routes" [] "area" "member" "models" (into {} (for [op []] [op (seed/read-model op)])) "actions" (into {} (for [op ["tripReport"]] [op (seed/action op)]))}
  "instagram-tools" {"routes" ["/account/instagram"] "area" "member" "models" (into {} (for [op ["instagramStatus" "instagramActions" "invitationStatus" "instagramAdminInbox"]] [op (seed/read-model op)])) "actions" (into {} (for [op ["instagramCancel" "instagramConfirm" "instagramPointsConsent" "instagramReconcile" "instagramRetryEvent" "instagramReversePoints" "instagramReview" "invitationClaim"]] [op (seed/action op)])) "retired-actions" {"instagramVerify" "Use /connect in Instagram, then enter the code on FinFolk."}}
  "instagram-commands" {"routes" [] "area" "member" "models" (into {} (for [op ["instagramCommandStatus"]] [op (assoc (seed/read-model op) "activity" "Instagram comment commands")])) "actions" (into {} (for [op ["instagramCommandConfirm" "instagramCommandResolve" "instagramCommandReview" "instagramCommandVerify"]] [op (seed/action op)]))}
  "post-review" {"routes" [] "area" "member" "models" (into {} (for [op ["reviewPosts" "communityMetrics"]] [op (seed/read-model op (when (= op "reviewPosts") {"url" "url"}))])) "actions" (into {} (for [op ["resolvePostReport" "reviewPost"]] [op (seed/action op)]))}
  "trip-review" {"routes" [] "area" "member" "models" (into {} (for [op ["tripReviewInbox"]] [op (seed/read-model op)])) "actions" (into {} (for [op ["tripReview"]] [op (seed/action op)]))}
  "account-review" {"routes" ["/account/review"] "area" "member" "models" {} "actions" {} "adapters" ["site-review" "post-review" "trip-review"]}
  "account-integration" {"routes" [] "area" "member" "models" {"status" (seed/read-model "instagramDiscoveryStatus")} "actions" {}}
  "messaging-settings" {"routes" [] "area" "member" "loader" "messaging-settings"
    "models" {"state" (seed/read-model "messagingSettings") "events" (assoc (seed/read-model "messagingEvents") "defaults" {"limit" 25})}
    "actions" {"save" (seed/action "messagingSettingsSave") "authorize" (seed/action "messagingAuthorize") "retry" (seed/action "messagingEventRetry")}}})
(def DEFINITIONS (merge CORE_DEFINITIONS INTEGRATION_DEFINITIONS))
