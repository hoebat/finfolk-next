(ns finfolk-web.pages.atlas
  (:require [finfolk-web.lib.seed :as seed]))
(def DEFINITIONS
 {"community-hub" {"routes" ["/community"] "area" "public" "models" {} "actions" {}}
  "practice-hub" {"routes" ["/practice"] "area" "public" "models" {} "actions" {}}
  "you-hub" {"routes" ["/you"] "area" "public" "models" {} "actions" {}}
  "home" {"routes" ["/"] "area" "public" "models" {} "actions" {}
           "styles" ["landing" "identity" "landing-identity" "coastal-conditions" "feature-demos" "landing-theme"]
           "effects" ["landing"] "adapters" ["homeDestination" "landing-effects"]}
  "discover" {"routes" ["/discover"] "area" "public" "models" {} "actions" {} "uses" ["atlas"]
               "resources" {"location" {"path" "/api/location"}}}
  "map" {"routes" ["/map"] "area" "public"
          "models" {"listings" (seed/read-model "publicDirectory" {"*" "query"})
                    "events" (seed/read-model "publicEvents" {"*" "query"})
                    "listing" (seed/read-model "publicDirectoryDetail" {"id" "id"})
                    "event" (seed/read-model "publicEvent" {"id" "id"})
                    "popular" (seed/read-model "discoverPopular")}
          "actions" {} "uses" ["atlas"]}
  "atlas" {"routes" [] "area" "public" "lifetime" "atlas-layout"
            "adapter" {"snapshot" "snapshot" "subscribe" "subscribe" "attach" "attach" "destroy" "destroy"}
            "models" {"siteCatalog" (seed/read-model "siteCatalog") "discoverPopular" (seed/read-model "discoverPopular")}
            "actions" {} "adapters" ["map-engine" "datasets" "offline-packages" "navigation"]}
  "site-notes" {"routes" [] "area" "mixed" "loader" "site-notes"
                 "topics" {"access" "Entry & access" "facilities" "Facilities" "wildlife" "Marine life" "conditions" "Conditions"}
                 "models" {"public" (seed/read-model "publicSiteNotes" {"site" "site" "*" "query"})
                           "member" (seed/read-model "siteNotes" {"site" "site" "*" "query"})}
                 "actions" (into {} (for [[key op] {"save" "siteNoteSave" "vote" "siteNoteVote" "withdraw" "siteNoteWithdraw" "report" "siteNoteReport" "moderate" "siteNoteModerate"}]
                                     [key (seed/action op {"site" "site"})]))}
  "place-public" {"routes" [] "area" "public"
                   "models" (into {} (for [operation ["publicInstagram" "publicTrips" "publicPosts"]] [operation (seed/read-model operation)]))
                   "actions" {"referral" (seed/action "publicReferral") "report" (seed/action "publicInstagramReport")}}
  "place-media" {"routes" [] "area" "mixed" "loader" "place-media"
                  "models" {"feed" (seed/read-model "publicInstagram") "trips" (seed/read-model "publicTrips")}
                  "actions" {} "sdk-actions" {"shared" {"method" ["instagramPosts"] "optional" true}}}
  "place-trips" {"routes" [] "area" "public" "loader" "place-trips"
                  "models" {"trips" (seed/read-model "publicTrips")} "actions" {}}
  "place-feed" {"routes" [] "area" "mixed" "loader" "place-feed"
                 "models" {"member" (seed/read-model "posts") "public" (seed/read-model "publicPosts")} "actions" {}}
  "place-community" {"routes" [] "area" "member"
                      "models" {"community" (assoc (seed/read-model "community" {"beachId" "beachId"}) "defaults" {"cursor" nil})}
                      "actions" (into {} (for [operation ["checkin" "community" "stats" "connection" "block" "report" "reportPost"]]
                                           [operation (seed/action operation (when (contains? #{"checkin" "community" "stats"} operation) {"beachId" "beachId"}))]))}})
