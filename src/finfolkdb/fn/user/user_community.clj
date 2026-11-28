(ns finfolkdb.fn.user.user-community
  "Native community visits. Actor identity and verification come from the trusted transport."
  (:require [lang.core :as l] [clojure.string :as str]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-system-site :as sites]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} record-community-checkin [:uuid i-user :uuid i-site :boolean i-verified]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  [:perform (account/ret-account i-user)]
  (when (not (pg/coalesce i-verified false))
    [:raise :exception :using '[[errcode := "42501"] [message := "Verify your email before checking in"]]])
  (let [o-site (pg/t:get sites/Site {:where {:id i-site}})]
    (when [o-site :is-null]
      [:raise :exception :using '[[errcode := "P0002"] [message := "Choose an existing dive site"]]])
    (let [(:date v-day) (:date (#{"timezone"} (:->> o-site "timezone") (pg/now)))
          (:boolean v-exists) (pg/t:exists users/UserCheckin {:where {:user i-user :site i-site :visit-day v-day}})
          (:int v-count) 0 o-row nil]
      (when (not v-exists)
        (let [o-created (pg/t:insert users/UserCheckin {:user i-user :site i-site :visit-day v-day})]))
      ;; One row per site/day; the first 31 rows after the window start cover
      ;; all 30 possible visit days even if trusted imports contain future rows.
      (let [o-visits (pg/t:select users/UserCheckin
                       {:where {:user i-user :site i-site :visit-day [:gte (- v-day 29)]}
                        :returning #{:visit-day} :order-by [:visit-day] :order-sort :asc :limit 31})]
        [:for o-row :in :select (pg/jsonb-array-elements (pg/coalesce o-visits (:jsonb "[]")))
         (loop [] (when (<= (:date (:->> o-row "visit_day")) v-day) (:= v-count (+ v-count 1))))])
      (return (pg/jsonb-build-object "day" (:text v-day) "count" v-count "selfReported" true)))))
(defn.pg ^{:- [:jsonb]} remove-community-checkin [:uuid i-user :uuid i-site :date i-day]
  [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-user) 0))]
  [:perform (account/ret-account i-user)]
  (when [i-day :is-null]
    [:raise :exception :using '[[errcode := "22023"] [message := "Choose a visit day"]]])
  (let [o-removed (pg/t:delete users/UserCheckin {:where {:user i-user :site i-site :visit-day i-day}})]
    (return (pg/jsonb-build-object "removed" true))))
(defn.pg ^{:- [:jsonb]} ret-community-checkins [:uuid i-user]
  [:perform (account/ret-account i-user)]
  (let [o-visits (pg/t:select users/UserCheckin {:where {:user i-user}
                    :order-by [:visit-day :site] :order-sort :desc :limit 100})
        o-row nil o-result (:jsonb "[]")]
    [:for o-row :in :select (pg/jsonb-array-elements (pg/coalesce o-visits (:jsonb "[]")))
     (loop []
       (let [o-site (pg/t:get sites/Site {:where {:id (:uuid (:->> o-row "site_id"))}})]
         (:= o-result (|| o-result (pg/jsonb-build-array
           (pg/jsonb-build-object "beach_id" (:-> o-row "site_id") "day" (:-> o-row "visit_day") "name" (:-> o-site "name")))))))]
    (return o-result)))

(def DISCOVERY-ROWS-SQL
  (str/replace "WITH p AS (SELECT ($1->>'actor')::uuid AS actor,$1->>'seed' AS seed,nullif($1->>'site','')::uuid AS site,($1->>'day')::date AS day,$1->>'availability' AS availability,$1->>'experience' AS experience,$1->>'q' AS q,$1->>'rank' AS rank,($1->>'after')::uuid AS after), eligible AS (
 SELECT m.id,m.profile,m.handle,md5(p.actor::text||':'||p.seed||':'||m.id::text) AS mix_rank,
 (SELECT CASE WHEN c.status IN ('pending','accepted') THEN c.status::text ELSE NULL END FROM finfolk.\"UserConnection\" c WHERE c.user_id=least(p.actor,m.id) AND c.target_id=greatest(p.actor,m.id)) AS connection,
 CASE WHEN p.site IS NULL THEN 0 ELSE (SELECT count(*) FROM finfolk.\"UserCheckin\" v WHERE v.user_id=m.id AND v.site_id=p.site AND v.visit_day BETWEEN p.day-29 AND p.day) END AS visits
 FROM finfolk.\"User\" m CROSS JOIN p WHERE m.id<>p.actor AND NOT m.deleted AND m.profile->'open'='true'::jsonb
 AND (p.availability='' OR coalesce(m.profile->'availability','[]'::jsonb)?p.availability)
 AND (p.experience='' OR m.profile->>'experience'=p.experience)
 AND (p.q='' OR strpos(lower(coalesce(m.profile->>'displayName','')),lower(p.q))>0 OR strpos(coalesce(m.handle,'diver-'||replace(m.id::text,'-','')),lower(ltrim(p.q,'@')))>0)
 AND NOT EXISTS(SELECT 1 FROM finfolk.\"UserBlock\" b WHERE (b.owner_id=p.actor AND b.target_id=m.id) OR (b.owner_id=m.id AND b.target_id=p.actor))
 AND NOT EXISTS(SELECT 1 FROM finfolk.\"UserConnection\" c WHERE c.user_id=least(p.actor,m.id) AND c.target_id=greatest(p.actor,m.id) AND c.status='declined')
 ), page AS (SELECT e.* FROM eligible e CROSS JOIN p WHERE (p.site IS NULL OR e.visits>0 OR coalesce(e.profile->'beaches','[]'::jsonb)?p.site::text) AND (e.mix_rank,e.id)>(p.rank,p.after) ORDER BY e.mix_rank,e.id LIMIT 7)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'handle',coalesce(handle,'diver-'||replace(id::text,'-','')),'displayName',coalesce(profile->>'displayName','Diver'),'open',true,'bio',coalesce(profile->>'bio',''),'instagram',coalesce(profile->>'instagram',''),'tiktok',coalesce(profile->>'tiktok',''),'portrait',coalesce(profile->>'portrait',''),'availability',coalesce(profile->'availability','[]'::jsonb),'experience',coalesce(profile->>'experience',''),'beaches',coalesce(profile->'beaches','[]'::jsonb),'regular',visits>=8,'recent',visits>0,'connection',connection,'mix_rank',mix_rank) ORDER BY mix_rank,id),'[]'::jsonb) FROM page" \newline \space))
(defn.pg ^{:- [:jsonb]} discover-community-people [:uuid i-user :jsonb i-query]
  [:perform (account/ret-account i-user)]
  (let [(:text v-seed) (:->> i-query "seed")
        (:text v-search) (pg/btrim (pg/coalesce (:->> i-query "q") ""))
        (:text v-availability) (pg/coalesce (:->> i-query "availability") "")
        (:text v-experience) (pg/coalesce (:->> i-query "experience") "")
        (:text v-site) (pg/coalesce (:->> i-query "beachId") "")
        (:text v-cursor) (pg/coalesce (:->> i-query "cursor") "")
        (:text v-rank) "" (:text v-after) "00000000-0000-0000-0000-000000000000"
        (:text v-zone) "UTC" o-rows nil o-row nil o-result (:jsonb "[]") (:text v-next) nil
        (:int v-index) 0]
    (when (> (pg/length v-search) 80)
      [:raise :exception :using '[[errcode := "22023"] [message := "Search names up to 80 characters"]]])
    (when (or [v-seed :is-null] (not (#{"regexp_like"} v-seed "^[A-Za-z0-9_-]{8,64}$")))
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose a new people mix"]]])
    (when (or (not (pg/jsonb-exists (:jsonb "[\"\",\"weekday mornings\",\"weekday afternoons\",\"weekend mornings\",\"weekend afternoons\"]") v-availability))
              (not (pg/jsonb-exists (:jsonb "[\"\",\"new\",\"comfortable\",\"experienced\"]") v-experience)))
      [:raise :exception :using '[[errcode := "22023"] [message := "Choose listed people filters"]]])
    (when (not= v-site "")
      (let [o-site (pg/t:get sites/Site {:where {:id (:uuid v-site)}})]
        (when [o-site :is-null] [:raise :exception :using '[[errcode := "P0002"] [message := "Choose an existing dive site"]]])
        (:= v-zone (:->> o-site "timezone"))))
    (let [(:text v-context) (#{"md5"} (|| (:text i-user) ":" v-seed ":" (:text (pg/jsonb-build-array v-site v-availability v-experience)) (pg/case (== v-search "") "" true (|| ":" v-search))))
          (:date v-day) (:date (#{"timezone"} v-zone (pg/now)))]
      (when (not= v-cursor "")
        (when (or (not (#{"regexp_like"} v-cursor "^[0-9a-f]{32}[.][0-9a-f]{32}[.][0-9a-f-]{36}$"))
                  (not= (#{"split_part"} v-cursor "." 1) v-context))
          [:raise :exception :using '[[errcode := "22023"] [message := "This people mix changed; start a new mix"]]])
        (:= v-rank (#{"split_part"} v-cursor "." 2))
        (:= v-after (#{"split_part"} v-cursor "." 3)))
      [:execute (@! DISCOVERY-ROWS-SQL) :into o-rows :using
       (pg/jsonb-build-object "actor" i-user "seed" v-seed "site" v-site "day" v-day
                             "availability" v-availability "experience" v-experience "q" v-search "rank" v-rank "after" v-after)]
      [:for o-row :in :select (pg/jsonb-array-elements o-rows)
       (loop []
         (when (< v-index 6)
           (:= o-result (|| o-result (pg/jsonb-build-array (- o-row "mix_rank"))))
           (when (== v-index 5)
             (:= v-next (|| v-context "." (:->> o-row "mix_rank") "." (:->> o-row "id")))))
         (:= v-index (+ v-index 1)))]
      (when (<= (pg/jsonb-array-length o-rows) 6) (:= v-next nil))
      (return (pg/jsonb-build-object "people" o-result "cursor" v-next)))))
