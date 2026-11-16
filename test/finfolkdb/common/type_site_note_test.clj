(ns finfolkdb.common.type-site-note-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.fn.site.site-note-revision :as revision]
             [finfolkdb.fn.user.user-manage :as fixture-user]
             [finfolkdb.fn.user.user-manage-logbook :as fixture-logbook]
             [finfolkdb.fn.social.social-manage :as fixture-social]
             [postgres.core :as pg]
             [finfolkdb.common.type-site-note :as t]]})
(fact:global {:setup [(local/prepare!) (l/rt:restart) (l/rt:teardown :postgres)
                      (l/rt:setup :postgres)]
              :teardown [(l/rt:teardown :postgres) (l/rt:stop) (local/cleanup!)]})

(defn insert-note
  [values]
  (revision/insert-site-note (:id values)
                             (:site values)
                             (:author values)
                             (:topic values)
                             (:body values)
                             (:observed-on values)
                             (fixture/op "note" (:author values))))

^{:refer finfolkdb.common.type-site-note/EnumSiteNoteTopic
  :covers [finfolkdb.common.type-site-note/SiteNote]
  :id note-contracts}
(fact "topics are closed values and conditions need an observation date"
  (fixture/member "93f5dece-9d3b-59ed-a09a-b1225f24145d")
  (fixture/beach "cb2146b1-4e69-5ed7-bbe5-6ab98302b62a")
  (let
    [id (str (java.util.UUID/randomUUID))
     note (insert-note {:id id
                        :author "93f5dece-9d3b-59ed-a09a-b1225f24145d"
                        :site "cb2146b1-4e69-5ed7-bbe5-6ab98302b62a"
                        :topic "access"
                        :body "Meet at an agreed meeting point."})]
    (:revision note) => 1
    (:withdrawn note) => false
    (:hidden note) => false
    (pg/t:update t/SiteNote {:track {} :where {:id id} :set {:topic "unknown"}}) => (throws)
    (pg/t:update t/SiteNote {:track {} :where {:id id} :set {:topic "conditions"}}) => (throws)
    (pg/t:update t/SiteNote {:track {} :where {:id id} :set {:body "short"}}) => (throws)))

^{:refer finfolkdb.common.type-site-note/SiteNoteVote :id unique-votes}
(fact "one vote per member and deleting a note removes its votes"
  (fixture/member "9ee31e9f-973a-5ee2-b265-83102dfbcefd")
  (fixture/beach "d96b10c1-6968-55be-a0a2-6eae9ae884e4")
  (let
    [id (str (java.util.UUID/randomUUID))
     note (insert-note {:id id
                        :author "9ee31e9f-973a-5ee2-b265-83102dfbcefd"
                        :site "d96b10c1-6968-55be-a0a2-6eae9ae884e4"
                        :topic "facilities"
                        :body "Keep the meeting area clear of gear."})]
    (pg/t:insert t/SiteNoteVote
      {:note id :voter "9ee31e9f-973a-5ee2-b265-83102dfbcefd"}
      {:track {}})
    (pg/t:insert t/SiteNoteVote
      {:note id :voter "9ee31e9f-973a-5ee2-b265-83102dfbcefd"}
      {:track {}})
    =>
    (throws)
    (pg/t:delete t/SiteNote {:where {:id id}})
    (pg/t:get t/SiteNoteVote {:where {:note id :voter "9ee31e9f-973a-5ee2-b265-83102dfbcefd"}})
    =>
    nil))

^{:refer finfolkdb.common.type-site-note/SiteNoteReport :id report-contracts}
(fact "report reasons are bounded and each member can report a note once"
  (fixture/member "7058314c-82bc-5704-b220-15b1ff12121d")
  (fixture/beach "c0242001-402a-54b3-9089-54e7f5a5a947")
  (let
    [id (str (java.util.UUID/randomUUID))
     note (insert-note {:id id
                        :author "7058314c-82bc-5704-b220-15b1ff12121d"
                        :site "c0242001-402a-54b3-9089-54e7f5a5a947"
                        :topic "wildlife"
                        :body "Record sightings with their observation date."})]
    (pg/t:insert t/SiteNoteReport
      {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d" :reason ""}
      {:track {}})
    =>
    (throws)
    (pg/t:insert t/SiteNoteReport
      {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d" :reason "Please review this note."}
      {:track {}})
    (pg/t:insert t/SiteNoteReport
      {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d" :reason "Duplicate report."}
      {:track {}})
    =>
    (throws)
    (pg/t:delete t/SiteNote {:where {:id id}})
    (pg/t:get t/SiteNoteReport {:where {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d"}})
    =>
    nil))

(fact "notes use shared revision streams and inherited UUID tracking"
  (let
    [owner (fixture/id "revision-note-owner")
     site-id (fixture/id "revision-note-site")
     _ (fixture/member owner)
     _ (fixture/beach site-id)
     id (str (java.util.UUID/randomUUID))
     note
     (insert-note
      {:id id :site site-id :author owner :topic "access" :body "Initial access instructions."})
     rev-id (:rev-id note)]
    (:revision note) => 1
    (some? rev-id) => true
    (some? (:op-created note)) => true
    (pg/t:update t/SiteNote
      {:where {:id id}
       :set {:body "Updated access instructions."}
       :track (fixture/op "edit-note" owner)})
    (revision/record-site-note-revision id (fixture/op "revision-note" owner)) => {:revision 2}
    (revision/site-note-version rev-id) => {:revision 2}
    (pg/t:update t/SiteNote
      {:where {:id id} :set {:body "short"} :track (fixture/op "invalid-note" owner)})
    =>
    (throws)
    (revision/site-note-version rev-id) => {:revision 2}))
