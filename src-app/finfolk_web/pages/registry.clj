(ns finfolk-web.pages.registry
  "Explicit page reads and actions. Model instances reuse the application backbone."
  (:require [finfolk-web.lib.seed :as seed]
            [finfolk-web.pages.account :as account]
            [finfolk-web.pages.logbook :as logbook]
            [finfolk-web.pages.atlas :as atlas]))
(def PILOT_DEFINITIONS
  {"directory" {"routes" ["/directory"] "area" "public"
                 "models" {"listings" (seed/read-model "publicDirectory" {"*" "query"})} "actions" {}}
   "listing" {"routes" ["/directory/[id]"] "area" "public"
               "models" {"listing" (seed/read-model "publicDirectoryDetail" {"id" "id"})
                         "events" (seed/read-model "publicEvents" {"page" "id"})
                         "mine" (seed/read-model "directoryMine")}
               "actions" {"claim" (seed/action "directoryClaim" {"id" "id"})
                          "report" (seed/action "directoryReport" {"id" "id"})}}
   "pages" {"routes" ["/pages"] "area" "member"
             "models" {"mine" (seed/read-model "directoryMine")}
             "actions" {"create" (seed/action "directoryCreate")}}
   "page-owner" {"routes" [] "area" "member"
                  "models" {"access" (seed/read-model "pageAccess" {"id" "id"})}
                  "actions" {"save" (seed/action "directoryOwnerSave" {"id" "id"})
                             "invite" (seed/action "pageInvite" {"id" "id"})
                             "revoke" (seed/action "pageInviteRevoke" {"id" "id"})
                             "remove-admin" (seed/action "pageAdminRemove" {"id" "id"})}}})
(def EVENT_ACTIONS
  (into {} (for [[action operation] {"save" "eventSave" "cancel" "eventCancel" "invite" "eventInvite"
                                     "revoke" "eventRevoke" "accept" "eventAccept" "rsvp" "eventRsvp" "moderate" "eventModerate"}]
             [action (seed/action operation)])))
(def EVENT_DEFINITIONS
  (merge PILOT_DEFINITIONS
    {"events" {"routes" ["/events"] "area" "public"
               "models" {"events" (seed/read-model "publicEvents" {"*" "query"})} "actions" {}}
     "event-public" {"routes" [] "area" "public"
                     "models" {"event" (seed/read-model "publicEvent" {"id" "id"})} "actions" {}}
     "event" {"routes" ["/events/[id]"] "area" "member" "order" ["event" "roster"]
              "models" {"event" (seed/read-model "eventDetail" {"id" "id"})
                        "roster" (assoc (seed/read-model "eventRoster" {"id" "id"}) "when" [["models" "event" "canManage"]])}
              "actions" (into {} (for [[key action] (dissoc EVENT_ACTIONS "save" "accept")]
                                    [key (assoc action "bindings" {"id" "id"})]))}
     "event-editor" {"routes" ["/events/new"] "area" "member" "order" ["eligible" "event"]
                     "models" {"eligible" (assoc (seed/read-model "directoryMine") "select" "eligible-pages")
                               "event" (assoc (seed/read-model "eventDetail" {"id" "id"}) "when" [["inputs" "id"] ["models" "eligible" "length"]])}
                     "actions" {"save" (get EVENT_ACTIONS "save")}}
     "my-events" {"routes" ["/events/my"] "area" "member" "models" {"events" (seed/read-model "eventMine")} "actions" {}}
     "event-invitation" {"routes" ["/events/invitation"] "area" "member" "models" {}
                         "actions" {"accept" (seed/action "eventAccept" {"token" "token"})}}
     "page-invitation" {"routes" ["/pages/invitation"] "area" "member" "models" {}
                        "actions" {"accept" (seed/action "pageInviteRedeem" {"token" "token"})}}
     "directory-review" {"routes" ["/pages/review"] "area" "member" "order" ["mine" "review"]
                         "models" {"mine" (seed/read-model "directoryMine")
                                   "review" (assoc (seed/read-model "directoryAdmin")
                                              "require" [["models" "mine" "admin"]]
                                              "denied" "Administrator access required.")}
                         "actions" (into {} (for [[key operation] {"save" "directoryAdminSave" "discover" "directoryDiscover"
                                                                   "merge" "directoryMerge" "claim-review" "directoryClaimReview"
                                                                   "report-resolve" "directoryReportResolve"}]
                                              [key (seed/action operation)]))}}))
(def PROFILE_MODELS
  (into {} (for [[key operation] {"me" "me" "profile" "profile" "connections" "connections" "posts" "myPosts"
                                  "sessions" "sessions" "session" "session" "blocks" "blocks" "stats" "stats"}]
             [key (seed/read-model operation)])))
(def PROFILE_ACTIONS
  (into {} (for [operation ["connection" "block" "unblock"]] [operation (seed/action operation)])))
(def SCREEN_DEFINITIONS
  (merge EVENT_DEFINITIONS account/DEFINITIONS logbook/DEFINITIONS atlas/DEFINITIONS
    {"finnies-shop" {"routes" ["/shop"] "area" "public" "models" {"wallet" (seed/read-model "finniesWallet")} "actions" {"redeem" (seed/action "finniesRedeem")}}
     "finnies-admin" {"routes" ["/shop/manage"] "area" "member" "models" {"items" (seed/read-model "finniesAdmin")} "actions" {"save" (seed/action "finniesSave") "grant" (seed/action "finniesGrant") "complete" (seed/action "finniesComplete")}}
     "community-catalog" {"routes" [] "area" "public" "models" {"catalog" (seed/read-model "siteCatalog")} "actions" {}}
     "people" {"routes" ["/people"] "area" "member" "loader" "people"
               "models" {"people" (seed/read-model "community") "me" (seed/read-model "me")}
               "actions" {"connect" (seed/action "connection")}}
     "profile" {"routes" ["/profile" "/members/[id]"] "area" "member" "loader" "profile"
                "models" PROFILE_MODELS "actions" PROFILE_ACTIONS}
     "profile-editor" {"routes" ["/profile/edit"] "area" "member" "loader" "profile-editor"
                       "models" (select-keys PROFILE_MODELS ["me" "sessions" "session" "posts"])
                       "actions" {"save" (seed/action "preferences")}}
     "member-chooser" {"routes" ["/members"] "area" "public" "models" {} "actions" {}}
     "instagram-link" {"routes" [] "area" "member" "models" {"status" (seed/read-model "instagramClaimStatus")}
                       "actions" {"disconnect" (seed/action "instagramDisconnect")
                                  "link" (seed/action "instagramProfileLink")
                                  "connect" (seed/action "instagramCodeConnect")}}}))
(def DEFINITIONS
 (merge SCREEN_DEFINITIONS
   {"profiles-compatibility" {"routes" ["/profiles"] "kind" "compatibility" "area" "public" "models" {} "actions" {} "adapters" ["profileDestination"]}
    "legacy-app" {"routes" ["/app"] "kind" "compatibility" "area" "public" "models" {} "actions" {} "adapters" ["legacyDestination"]}
    "location-resource" {"routes" ["/api/location"] "kind" "resource" "area" "public" "models" {} "actions" {} "reason" "IP hint resource; never an offline document."}
    "offline-templates" {"routes" ["/offline-app/[screen]"] "kind" "internal" "area" "public" "models" {} "actions" {} "reason" "Build-only public shell templates, rendered at canonical application routes."}}))
(defn validate! []
  (let [routes (mapcat #(get % "routes") (vals DEFINITIONS))]
    (when (not= (count routes) (count (distinct routes)))
      (throw (ex-info "Duplicate page routes" {})))
    (doseq [[_ page] DEFINITIONS
            [kind entries] (select-keys page ["models" "actions"])
            [_ entry] entries]
      (let [op (seed/operation (get entry "operation"))]
        (when (and (= kind "models") (get op "write"))
          (throw (ex-info "Mutation attached as a read" {:entry entry}))))))
  DEFINITIONS)
