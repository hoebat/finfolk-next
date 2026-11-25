(ns finfolkdb.fn.site.site-notes
  "Native site-note reads, idempotent mutations and moderation. Server-only RPCs."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-site-note :as notes]
             [finfolkdb.fn.site.site-note-revision :as revision]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-site-base :as sites]
             [finfolkdb.common.type-system-site :as beaches]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.helper.helper-access :as access]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

(defn.pg ^{:- [:boolean]}
  is-site-note-member
  [:uuid i-user]
  (let [(:boolean v-verified) (pg/t:exists users/User {:where {:id i-user :email-verified true :deleted false}})]
    (return (and (access/is-user-active i-user) v-verified))))

(defn.pg ^{:- [:uuid]}
  require-site-note-member
  []
  (let [(:uuid v-user) (util/auth-uid)]
    (when (not (-/is-site-note-member v-user))
      [:raise-exception "Verified member access required"])
    (return v-user)))

(defn.pg ^{:- [:boolean]}
  is-site-note-site
  [:uuid i-site]
  (let [(:boolean v-site) (pg/t:exists beaches/Site {:where {:id i-site}})
        (:boolean v-private) (pg/t:exists sites/SiteProfile
                               {:where {:site i-site :status [:neq "published"]}})]
    (return (and v-site (not v-private)))))

(defn.pg ^{:%% :sql :- [:bigint]}
  site-note-score
  [:uuid i-note]
  [:select (pg/coalesce (sum (pg/case (. #{"v"} #{"downvoted"}) -1 true 1)) 0) :from notes/SiteNoteVote :as #{"v"} :inner-join users/User :as #{"u"} :on
   (== (. #{"v"} #{"voter_id"}) (. #{"u"} #{"id"})) :where
   (and (== (. #{"v"} #{"note_id"}) i-note)
        (not (. #{"u"} #{"deleted"}))
        (. #{"u"} #{"email_verified"}))])

(defn.pg ret-site-note
  [:uuid i-note :uuid i-viewer]
  (let [o-raw (pg/t:get notes/SiteNote {:where {:id i-note :hidden false :withdrawn false}})
        o-note (|| o-raw (revision/site-note-version (:uuid (:->> o-raw "rev_id"))))
        (:uuid v-author) (:uuid (:->> o-note "author_id"))
        o-user (pg/t:get users/User {:where {:id v-author :deleted false} :returning #{:profile}})
        (:boolean v-upvoted) (pg/t:exists notes/SiteNoteVote
                               {:where {:note i-note :voter i-viewer :downvoted false}})
        (:boolean v-downvoted) (pg/t:exists notes/SiteNoteVote
                                 {:where {:note i-note :voter i-viewer :downvoted true}})]
    (when (or [o-note :is-null]
              (not (-/is-site-note-site (:uuid (:->> o-note "site_id"))))
              (not (-/is-site-note-member v-author))
              (access/is-user-blocked i-viewer v-author))
      (return nil))
    (return (pg/jsonb-build-object
             "id" i-note
             "site" (:uuid (:->> o-note "site_id"))
             "topic" (:->> o-note "topic")
             "text" (:->> o-note "body")
             "author" (pg/coalesce (:->> (:-> o-user "profile") "displayName") "Diver")
             "createdAt" (util/as-iso-time (:bigint (:->> o-note "time_created")))
             "observedOn" (:->> o-note "observed_on")
             "revision" (:integer (:->> o-note "revision"))
             "score" (-/site-note-score i-note)
             "own" (pg/coalesce (== v-author i-viewer) false)
             "upvoted" v-upvoted
             "downvoted" v-downvoted))))

(defn.pg ret-owned-site-note
  "The owner's note is independent of feed filters, pagination and withdrawal."
  [:uuid i-site :uuid i-viewer]
  (let [o-note (pg/t:get notes/SiteNote {:where {:site i-site :author i-viewer}})]
    (when (or [o-note :is-null] (not (-/is-site-note-site i-site))) (return nil))
    (return (pg/jsonb-build-object
              "id" (:->> o-note "id") "topic" (:->> o-note "topic")
              "text" (:->> o-note "body") "observedOn" (:->> o-note "observed_on")
              "revision" (:-> (revision/site-note-version (:uuid (:->> o-note "rev_id"))) "revision")
              "withdrawn" (:-> o-note "withdrawn") "hidden" (:-> o-note "hidden")))))

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
       (and (== #{"site_id"} i-site)
            (not #{"withdrawn"})
            (not #{"hidden"})
            (or (== i-topic "all") (== (:text #{"topic"}) i-topic))
            [(-/ret-site-note #{"id"} v-viewer) :is-not-null]) :order-by
       (quote [(- 0
                  (pg/case (== i-sort "helpful")
                    (-/site-note-score #{"id"}) true
                    0)) (- 0 #{"time_created"}) #{"id"}]) :limit 21 :offset i-offset] :as
      #{"selected_notes"}] :into o-rows]
    (return (pg/jsonb-build-object "ownNote" (-/ret-owned-site-note i-site v-viewer)
                                   "notes" (pg/case (> (pg/jsonb-array-length o-rows) 20)
                                             (- o-rows 20) true
                                             o-rows)
                                   "next" (pg/case (> (pg/jsonb-array-length o-rows) 20)
                                            (+ i-offset 20) true
                                            nil)))))

(defn.pg save-site-note
  "One note per site/member. Edits require the version the owner opened."
  [:uuid i-site :uuid i-id :text i-topic :text i-body :date i-observed :integer i-revision]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-op (system/op-fn "save-site-note" v-user (:jsonb "{}"))]
    [:perform (#{"pg_advisory_xact_lock"} (#{"hashtextextended"} (#{"concat"} (:text i-site) ":" (:text v-user)) 0))]
    (let [o-site (pg/t:get beaches/Site {:where {:id i-site}})
          (:text v-body) (pg/btrim (pg/coalesce i-body ""))
          o-existing (pg/t:get notes/SiteNote {:where {:id i-id} :for [:update]})
          o-own (pg/t:get notes/SiteNote {:where {:site i-site :author v-user}})]
      (when (or [i-id :is-null]
                (not (-/is-site-note-site i-site))
                (< (pg/length v-body) 10) (> (pg/length v-body) 1000)
                [i-topic :is-null]
                (not (or (== i-topic "access") (== i-topic "facilities")
                         (== i-topic "wildlife") (== i-topic "conditions")))
                (and (== i-topic "conditions") [i-observed :is-null])
                (and [i-observed :is-not-null]
                     (or (not (#{"isfinite"} i-observed))
                         (> i-observed (:date (#{"timezone"} (:->> o-site "timezone")
                                                 (pg/to-timestamp (/ (pg/time-us) 1000000.0))))))))
        [:raise-exception "Check the site, topic, note length and observation date"])
      (when [o-existing :is-not-null]
        (when (or (not= (:uuid (:->> o-existing "author_id")) v-user)
                  (not= (:uuid (:->> o-existing "site_id")) i-site))
          [:raise-exception "That note is unavailable"])
        (let [(:integer v-version) (:integer (:->> (revision/site-note-version (:uuid (:->> o-existing "rev_id"))) "revision"))
              (:boolean v-same) (and (== (:->> o-existing "topic") i-topic)
                                     (== (:->> o-existing "body") v-body)
                                     (== (pg/coalesce (:->> o-existing "observed_on") "")
                                         (pg/coalesce (:text i-observed) "")))]
          ;; Retry the exact completed save without creating another version.
          (when (and v-same (not (:boolean (:->> o-existing "withdrawn")))
                     (or [i-revision :is-null] (== i-revision v-version) (== (+ i-revision 1) v-version)))
            (return (pg/jsonb-build-object "id" i-id "revision" v-version)))
          (when (or [i-revision :is-null] (not= i-revision v-version))
            [:raise :exception :using '[[errcode := "40001"] [message := "This note changed; reload it before trying again"]]])
          (let [o-saved (pg/t:update notes/SiteNote
                          {:set {:topic i-topic :body v-body :observed-on i-observed :withdrawn false}
                           :where {:id i-id} :track o-op})
                o-version (revision/record-site-note-revision i-id o-op)]
            (return (pg/jsonb-build-object "id" i-id "revision" (:-> o-version "revision"))))))
      (when [o-own :is-not-null]
        [:raise :exception :using '[[errcode := "40001"] [message := "You already have a note for this site; edit it instead"]]])
      (when [i-revision :is-not-null]
        [:raise :exception :using '[[errcode := "40001"] [message := "This note changed; reload it before trying again"]]])
      (let [o-note (revision/insert-site-note i-id i-site v-user i-topic v-body i-observed o-op)]
        (return (pg/jsonb-build-object "id" i-id "revision" 1))))))

(defn.pg set-site-note-rating
  "Desired vote: -1 unhelpful, 0 clear, 1 helpful. The note lock serializes retries and switches."
  [:uuid i-site :uuid i-note :integer i-vote]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-op (system/op-fn "set-site-note-rating" v-user (:jsonb "{}"))
        o-note (pg/t:get notes/SiteNote {:where {:id i-note :site i-site} :for [:update]})
        (:boolean v-voted) (pg/t:exists notes/SiteNoteVote {:where {:note i-note :voter v-user}})]
    (when (or [o-note :is-null] [(-/ret-site-note i-note v-user) :is-null])
      [:raise-exception "That note is unavailable"])
    (when (or [i-vote :is-null] (< i-vote -1) (> i-vote 1))
      [:raise-exception "Choose a valid note vote"])
    (cond
      (== i-vote 0)
      (let [o-write (pg/t:delete notes/SiteNoteVote {:where {:note i-note :voter v-user}})] nil)
      v-voted
      (let [o-write (pg/t:update notes/SiteNoteVote
                      {:set {:downvoted (== i-vote -1)}
                       :where {:note i-note :voter v-user} :track o-op})] nil)
      :else
      (let [o-write (pg/t:insert notes/SiteNoteVote
                      {:note i-note :voter v-user :downvoted (== i-vote -1)} {:track o-op})] nil))
    (return (-/ret-site-note i-note v-user))))

(defn.pg set-site-note-vote
  "Compatibility for existing helpful-only clients."
  [:uuid i-site :uuid i-note :boolean i-upvoted]
  (when [i-upvoted :is-null] [:raise-exception "Choose a valid note vote"])
  (return (-/set-site-note-rating i-site i-note (pg/case i-upvoted 1 true 0))))

(defn.pg set-site-note-withdrawn
  [:uuid i-site :uuid i-note :integer i-revision :boolean i-withdrawn]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-op (system/op-fn "set-site-note-withdrawn" v-user (:jsonb "{}"))
        o-raw (pg/t:get notes/SiteNote
                {:where {:id i-note :site i-site :author v-user} :for [:update]})
        o-note (|| o-raw (revision/site-note-version (:uuid (:->> o-raw "rev_id"))))]
    (when (or [o-note :is-null] [i-withdrawn :is-null])
      [:raise-exception "That note is unavailable"])
    (when (not= (:boolean (:->> o-note "withdrawn")) i-withdrawn)
      (when (or [i-revision :is-null] (not= (:integer (:->> o-note "revision")) i-revision))
        [:raise-exception "This note changed; reload it before trying again"])
      (let [o-saved (pg/t:update notes/SiteNote
                      {:set {:withdrawn i-withdrawn} :track o-op :single true :where {:id i-note}})]
        (:= o-note (|| o-saved (revision/record-site-note-revision i-note o-op)))))
    (return (pg/jsonb-build-object "id" i-note
                                   "revision" (:integer (:->> o-note "revision"))
                                   "withdrawn" i-withdrawn))))

(defn.pg report-site-note
  [:uuid i-site :uuid i-note :text i-reason]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-op (system/op-fn "report-site-note" v-user (:jsonb "{}"))
        o-note (pg/t:get notes/SiteNote {:where {:id i-note :site i-site} :for [:update]})
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
                      {:note i-note :reporter v-user :reason v-reason}
                      {:track o-op})]
        nil))
    (return (pg/jsonb-build-object "reported" true))))

(defn.pg moderate-site-note
  [:uuid i-site :uuid i-note :boolean i-hidden]
  (let [(:uuid v-user) (-/require-site-note-member)
        o-op (system/op-fn "moderate-site-note" v-user (:jsonb "{}"))]
    (when (not= (pg/coalesce (pg/current-setting "finfolk.directory_admin" true) "false") "true")
      [:raise-exception "Administrator access required"])
    (let [o-note (pg/t:get notes/SiteNote {:where {:id i-note :site i-site} :for [:update]})]
      (when (or [o-note :is-null] [i-hidden :is-null])
        [:raise-exception "That note is unavailable"])
      (when (not= (:boolean (:->> o-note "hidden")) i-hidden)
        (let [o-write (pg/t:update notes/SiteNote
                        {:set {:hidden i-hidden} :where {:id i-note} :track o-op})
              o-version (revision/record-site-note-revision i-note o-op)]
          nil))
      (let [o-write (pg/t:update notes/SiteNoteReport
                      {:set {:resolved-at (pg/time-us)}
                       :where {:note i-note :resolved-at [:is-null]}
                       :track o-op})]
        nil)
      (return (pg/jsonb-build-object "id" i-note "hidden" i-hidden)))))
