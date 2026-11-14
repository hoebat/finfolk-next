(ns finfolkdb.fn.site.site-notes
  "Native site-note reads, idempotent mutations and moderation. Server-only RPCs."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-site-note :as notes]
             [finfolkdb.common.type-site-base :as sites]
             [finfolkdb.common.type-system-site :as beaches]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:boolean]} is-site-note-member
  [:uuid i-user]
  (return (and (access/is-user-active i-user)
               (exists [:select 1 :from (:- "neon_auth.\"user\"") :where
                        (and (== (:text #{"id"}) (:text i-user))
                             (pg/coalesce #{"emailVerified"} false)
                             (not (pg/coalesce #{"banned"} false)))]))))

(defn.pg ^{:- [:uuid]} require-site-note-member
  []
  (let [(:uuid v-user) (util/auth-uid)]
    (when (not (-/is-site-note-member v-user))
      [:raise-exception "Verified member access required"])
    (return v-user)))

(defn.pg ^{:- [:boolean]} is-site-note-site
  [:uuid i-site]
  (let [(:boolean v-site) (pg/t:exists beaches/Beach {:where {:id i-site}})
        (:boolean v-private) (pg/t:exists sites/SiteProfile
                               {:where {:beach i-site :status [:neq "published"]}})]
    (return (and v-site (not v-private)))))

(defn.pg ^{:%% :sql :- [:bigint]} site-note-score
  [:uuid i-note]
  [:select (count *) :from notes/SiteNoteVote :as #{"v"} :inner-join users/User :as #{"u"} :on
   (== (. #{"v"} #{"voter_id"}) (. #{"u"} #{"id"})) :inner-join (:- "neon_auth.\"user\"") :as #{"a"}
   :on (== (:text (. #{"a"} #{"id"})) (:text (. #{"u"} #{"id"}))) :where
   (and (== (. #{"v"} #{"note_id"}) i-note)
        (not (. #{"u"} #{"deleted"}))
        (pg/coalesce (. #{"a"} #{"emailVerified"}) false)
        (not (pg/coalesce (. #{"a"} #{"banned"}) false)))])

(defn.pg ret-site-note
  [:uuid i-note :uuid i-viewer]
  (let [o-note (pg/t:get notes/SiteNote {:where {:id i-note :hidden false :withdrawn false}})
        (:uuid v-author) (:uuid (:->> o-note "author_id"))
        o-user (pg/t:get users/User {:where {:id v-author :deleted false} :returning #{:profile}})
        (:boolean v-upvoted) (pg/t:exists notes/SiteNoteVote
                               {:where {:note i-note :voter i-viewer}})]
    (when (or [o-note :is-null]
              (not (-/is-site-note-site (:uuid (:->> o-note "beach_id"))))
              (not (-/is-site-note-member v-author))
              (access/is-user-blocked i-viewer v-author))
      (return nil))
    (return (pg/jsonb-build-object
             "id" i-note
             "site" (:uuid (:->> o-note "beach_id"))
             "topic" (:->> o-note "topic")
             "text" (:->> o-note "body")
             "author" (pg/coalesce (:->> (:-> o-user "profile") "displayName") "Diver")
             "createdAt" (util/as-iso-time (:bigint (:->> o-note "time_created")))
             "observedOn" (:->> o-note "observed_on")
             "revision" (:integer (:->> o-note "revision"))
             "score" (-/site-note-score i-note)
             "own" (== v-author i-viewer)
             "upvoted" v-upvoted))))

(defn.pg ret-site-notes
  "Bounded site feed. Viewer identity comes from the authenticated transaction, never query input."
  [:uuid i-site :text i-sort :text i-topic :integer i-offset :boolean i-member]
  (let [(:uuid v-viewer) (pg/case i-member
                           (-/require-site-note-member) true
                           nil)
        o-rows nil]
    (when (or [i-offset :is-null]
              (< i-offset 0)
              (> i-offset 10000)
              [i-sort :is-null]
              (not (or (== i-sort "helpful") (== i-sort "newest")))
              [i-topic :is-null]
              (not (or (== i-topic "all")
                       (== i-topic "access")
                       (== i-topic "facilities")
                       (== i-topic "wildlife")
                       (== i-topic "conditions"))))
      [:raise-exception "Invalid notes filter"])
    [:select (pg/coalesce (pg/jsonb-agg #{"value"}) (:jsonb "[]")) :from
     [[:select [(-/ret-site-note #{"id"} v-viewer) :as #{"value"}] :from notes/SiteNote :where
       (and (== #{"beach_id"} i-site)
            (not #{"withdrawn"})
            (not #{"hidden"})
            (or (== i-topic "all") (== (:text #{"topic"}) i-topic))
            [(-/ret-site-note #{"id"} v-viewer) :is-not-null]) :order-by
       (quote [(- 0
                  (pg/case (== i-sort "helpful")
                    (-/site-note-score #{"id"}) true
                    0)) (- 0 #{"time_created"}) #{"id"}]) :limit 21 :offset i-offset] :as
      #{"selected_notes"}] :into o-rows]
    (return (pg/jsonb-build-object "notes" (pg/case (> (pg/jsonb-array-length o-rows) 20)
                                             (- o-rows 20) true
                                             o-rows)
                                   "next" (pg/case (> (pg/jsonb-array-length o-rows) 20)
                                            (+ i-offset 20) true
                                            nil)))))

(defn.pg save-site-note
  [:uuid i-site :uuid i-id :text i-topic :text i-body :date i-observed]
  (let [(:uuid v-user) (-/require-site-note-member)]
    [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (:text i-id) 0))]
    (let [o-site (pg/t:get beaches/Beach {:where {:id i-site}})
          (:text v-body) (pg/btrim (pg/coalesce i-body ""))
          o-existing (pg/t:get notes/SiteNote {:where {:id i-id}})]
      (when (or [i-id :is-null]
                (not (-/is-site-note-site i-site))
                (< (pg/length v-body) 10)
                (> (pg/length v-body) 1000)
                [i-topic :is-null]
                (not (or (== i-topic "access")
                         (== i-topic "facilities")
                         (== i-topic "wildlife")
                         (== i-topic "conditions")))
                (and (== i-topic "conditions") [i-observed :is-null])
                (and [i-observed :is-not-null]
                     (or (not (#{"isfinite"} i-observed))
                         (> i-observed
                            (:date (#{"timezone"}
                                    (:->> o-site "timezone")
                                    (pg/to-timestamp (/ (pg/time-us) 1000000.0))))))))
        [:raise-exception "Check the site, topic, note length and observation date"])
      (when [o-existing :is-not-null]
        (when (or (not= (:uuid (:->> o-existing "author_id")) v-user)
                  (not= (:uuid (:->> o-existing "beach_id")) i-site)
                  (not= (:->> o-existing "topic") i-topic)
                  (not= (:->> o-existing "body") v-body)
                  (not= (pg/coalesce (:->> o-existing "observed_on") "")
                        (pg/coalesce (:text i-observed) "")))
          [:raise-exception "This note identifier was already used"])
        (return (pg/jsonb-build-object "id" i-id
                                       "revision" (:integer (:->> o-existing "revision")))))
      (let [o-note (pg/t:insert notes/SiteNote
                     {:id i-id
                      :beach i-site
                      :author v-user
                      :topic i-topic
                      :body v-body
                      :observed-on i-observed})]
        (return (pg/jsonb-build-object "id" i-id "revision" 1))))))

(defn.pg set-site-note-vote
  [:uuid i-site :uuid i-note :boolean i-upvoted]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-note (pg/t:get notes/SiteNote {:where {:id i-note :beach i-site} :for [:update]})
        (:boolean v-voted) (pg/t:exists notes/SiteNoteVote {:where {:note i-note :voter v-user}})]
    (when (or [i-upvoted :is-null] [o-note :is-null] [(-/ret-site-note i-note v-user) :is-null])
      [:raise-exception "That note is unavailable"])
    (if i-upvoted
      (when (not v-voted)
        (let [o-write (pg/t:insert notes/SiteNoteVote {:note i-note :voter v-user})] nil))
      (let [o-write (pg/t:delete notes/SiteNoteVote {:where {:note i-note :voter v-user}})] nil))
    (return (-/ret-site-note i-note v-user))))

(defn.pg set-site-note-withdrawn
  [:uuid i-site :uuid i-note :integer i-revision :boolean i-withdrawn]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-note (pg/t:get notes/SiteNote
                 {:where {:id i-note :beach i-site :author v-user} :for [:update]})]
    (when (or [o-note :is-null] [i-withdrawn :is-null])
      [:raise-exception "That note is unavailable"])
    (when (not= (:boolean (:->> o-note "withdrawn")) i-withdrawn)
      (when (or [i-revision :is-null] (not= (:integer (:->> o-note "revision")) i-revision))
        [:raise-exception "This note changed; reload it before trying again"])
      (let [o-saved
            (pg/t:update notes/SiteNote
              {:set {:withdrawn i-withdrawn :revision (+ i-revision 1) :time-updated (pg/time-us)}
               :single true
               :where {:id i-note}})]
        (:= o-note o-saved)))
    (return (pg/jsonb-build-object "id" i-note
                                   "revision" (:integer (:->> o-note "revision"))
                                   "withdrawn" i-withdrawn))))

(defn.pg report-site-note
  [:uuid i-site :uuid i-note :text i-reason]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-note (pg/t:get notes/SiteNote {:where {:id i-note :beach i-site} :for [:update]})
        (:text v-reason) (pg/btrim (pg/coalesce i-reason ""))
        (:boolean v-reported) (pg/t:exists notes/SiteNoteReport
                                {:where {:note i-note :reporter v-user}})]
    (when (or [o-note :is-null]
              [(-/ret-site-note i-note v-user) :is-null]
              (< (pg/length v-reason) 1)
              (> (pg/length v-reason) 1000))
      [:raise-exception "Choose a note and provide a report reason"])
    (when (not v-reported)
      (let [o-write (pg/t:insert notes/SiteNoteReport
                      {:note i-note :reporter v-user :reason v-reason})]
        nil))
    (return (pg/jsonb-build-object "reported" true))))

(defn.pg moderate-site-note
  [:uuid i-site :uuid i-note :boolean i-hidden]
  (let [(:uuid v-user) (-/require-site-note-member)]
    (when (not= (pg/coalesce (pg/current-setting "finfolk.directory_admin" true) "false") "true")
      [:raise-exception "Administrator access required"])
    (let [o-note (pg/t:get notes/SiteNote {:where {:id i-note :beach i-site} :for [:update]})]
      (when (or [o-note :is-null] [i-hidden :is-null])
        [:raise-exception "That note is unavailable"])
      (when (not= (:boolean (:->> o-note "hidden")) i-hidden)
        (let [o-write (pg/t:update notes/SiteNote
                        {:set {:hidden i-hidden
                               :time-updated (pg/time-us)
                               :revision (+ (:integer (:->> o-note "revision")) 1)}
                         :where {:id i-note}})]
          nil))
      (let [o-write (pg/t:update notes/SiteNoteReport
                      {:set {:resolved-at (pg/time-us)}
                       :where {:note i-note :resolved-at [:is-null]}})]
        nil)
      (return (pg/jsonb-build-object "id" i-note "hidden" i-hidden)))))
