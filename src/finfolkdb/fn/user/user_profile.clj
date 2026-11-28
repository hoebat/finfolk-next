(ns finfolkdb.fn.user.user-profile
  "Native profile statistics. Sharing flags and visit/buddy gates are enforced in the DB."
  (:require [lang.core :as l] [clojure.string :as str]
            [finfolkdb.schema.account-contracts :as contracts]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.fn.user.user-logbook :as logbook]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-system-site :as sites]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})

(def STATS-SQL
  (str/replace "WITH p AS (SELECT ($1->>'actor')::uuid actor,($1->>'target')::uuid target,($1->>'site')::uuid site,($1->>'day')::date AS local_day), visits AS (
 SELECT count(*) FILTER(WHERE user_id=p.actor AND visit_day BETWEEN p.local_day-29 AND p.local_day)::int viewer_count,
 count(*) FILTER(WHERE user_id=p.target AND visit_day BETWEEN p.local_day-29 AND p.local_day)::int owner_count,
 count(DISTINCT to_char(visit_day,'YYYY-MM')) FILTER(WHERE user_id=p.target AND visit_day<=p.local_day)::int months
 FROM finfolk.\"UserCheckin\" CROSS JOIN p WHERE site_id=p.site AND user_id IN(p.actor,p.target)
 ), sessions AS (SELECT count(*)::int dives,
 sum(CASE WHEN jsonb_typeof(detail->'durationMinutes')='number' THEN (detail->>'durationMinutes')::numeric END) minutes,
 array_agg((detail->>'maxDepthMetres')::numeric ORDER BY (detail->>'maxDepthMetres')::numeric) FILTER(WHERE jsonb_typeof(detail->'maxDepthMetres')='number') depths
 FROM finfolk.\"DiveSession\" CROSS JOIN p WHERE owner_id=p.target AND site_id=p.site AND coalesce(detail->'plan'->>'state','completed')='completed')
 SELECT jsonb_build_object('viewerCount',viewer_count,'visits',owner_count,'months',months,'dives',dives,'minutes',minutes,'typicalDepth',depths[cardinality(depths)/2+1]) FROM visits CROSS JOIN sessions" \newline \space))

(defn.pg ^{:- [:jsonb]} ret-profile-statistics [:uuid i-user :uuid i-target :uuid i-site]
  (let [o-viewer (account/ret-account i-user)
        o-public (logbook/ret-visible-profile i-user i-target)
        o-target (account/ret-account i-target)
        o-owner (:-> o-target "profile") o-own (:-> o-viewer "profile")
        o-site (pg/t:get sites/Site {:where {:id i-site}})
        (:boolean v-buddy) (pg/t:exists users/UserConnection {:where {:user (least i-user i-target) :target (greatest i-user i-target) :status "accepted"}})
        (:boolean v-connected) (or (== i-user i-target) v-buddy)
        (:boolean v-open) (and (== (:-> o-own "open") (:jsonb "true")) (== (:-> o-owner "open") (:jsonb "true")))
        o-counts nil o-stats (:jsonb "{}") (:int v-level) 0]
    (when [o-site :is-null]
      [:raise :exception :using '[[errcode := "P0002"] [message := "Choose an existing dive site"]]])
    (let [(:date v-day) (:date (#{"timezone"} (:->> o-site "timezone") (pg/now)))]
      [:execute (@! STATS-SQL) :into o-counts :using
       (pg/jsonb-build-object "actor" i-user "target" i-target "site" i-site "day" v-day)])
    ;; Match the established eight-day Regular rule; accepted buddies bypass
    ;; visit and profile-open gates, but never the owner's sharing preferences.
    (when (or v-connected
              (and v-open (>= (:int (:->> o-counts "viewerCount")) (@! contracts/REGULAR-DAYS)) (>= (:int (:->> o-counts "visits")) (@! contracts/REGULAR-DAYS))))
      (:= v-level 2))
    (when (>= v-level 1)
      (when (== (:-> (:-> o-owner "sharing") "visits") (:jsonb "true"))
        (:= o-stats (|| o-stats (pg/jsonb-build-object "visits" (:-> o-counts "visits")))))
      (when (== (:-> (:-> o-owner "sharing") "months") (:jsonb "true"))
        (:= o-stats (|| o-stats (pg/jsonb-build-object "months" (:-> o-counts "months"))))))
    (when (>= v-level 2)
      (when (== (:-> (:-> o-owner "sharing") "dives") (:jsonb "true"))
        (:= o-stats (|| o-stats (pg/jsonb-build-object "dives" (:-> o-counts "dives")))))
      (when (== (:-> (:-> o-owner "sharing") "time") (:jsonb "true"))
        (:= o-stats (|| o-stats (pg/jsonb-build-object "minutes" (:-> o-counts "minutes")))))
      (when (== (:-> (:-> o-owner "sharing") "depth") (:jsonb "true"))
        (:= o-stats (|| o-stats (pg/jsonb-build-object "typicalDepth" (:-> o-counts "typicalDepth"))))))
    (return (pg/jsonb-build-object "profile" o-public "level" v-level "stats" o-stats
              "progress" (least (@! contracts/REGULAR-DAYS) (:int (:->> o-counts "viewerCount"))) "sharingClosed" (not (pg/coalesce v-open false))
              "expiresWithActivity" (not v-connected)))))

(defn.pg ^{:- [:jsonb]} ret-profile-by-handle [:text i-handle]
  (let [(:text v-handle) (pg/lower (pg/btrim (pg/coalesce i-handle "")))
        o-user nil o-profile nil o-sessions (:jsonb "[]")]
    (when (not (#{"regexp_like"} v-handle "^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$")) (return nil))
    (if (#{"regexp_like"} v-handle "^diver-[0-9a-f]{32}$")
      (let [o-default (pg/t:get users/User {:where {:id (:uuid (#{"substring"} v-handle 7)) :deleted false} :returning #{:id :handle}})] (:= o-user o-default))
      (let [o-custom (pg/t:get users/User {:where {:handle v-handle :deleted false} :returning #{:id :handle}})] (:= o-user o-custom)))
    (when (or [o-user :is-null] (not= v-handle (account/profile-handle (:uuid (:->> o-user "id")) (:->> o-user "handle")))) (return nil))
    (:= o-profile (logbook/ret-public-profile (:uuid (:->> o-user "id"))))
    (when (not (pg/coalesce (:boolean (:->> o-profile "restricted")) true))
      (:= o-sessions (:-> (logbook/ret-public-sessions (pg/jsonb-build-object "owner" (:->> o-user "id") "publicOnly" true)) "sessions")))
    (return (|| o-profile (pg/jsonb-build-object "sessions" o-sessions)))))
