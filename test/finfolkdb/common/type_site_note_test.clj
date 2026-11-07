(ns finfolkdb.common.type-site-note-test
  (:use code.test)
  (:require [lang.core :as l] [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main] [postgres.core :as pg]
             [finfolkdb.common.type-site-note :as t]]})
(fact:global {:setup [(neon/setup!)] :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-site-note/EnumSiteNoteTopic :covers [finfolkdb.common.type-site-note/SiteNote] :id note-contracts}
(fact "topics are closed values and conditions need an observation date"
  (fixture/member "note-author") (fixture/beach "note-beach")
  (let [id (str (java.util.UUID/randomUUID))
        note (pg/t:insert t/SiteNote {:id id :author "note-author" :beach "note-beach"
                                     :topic "access" :body "Meet at an agreed meeting point."})]
    (:revision note) => 1
    (:withdrawn note) => false
    (:hidden note) => false
    (pg/t:update t/SiteNote {:where {:id id} :set {:topic "unknown"}}) => (throws)
    (pg/t:update t/SiteNote {:where {:id id} :set {:topic "conditions"}}) => (throws)
    (pg/t:update t/SiteNote {:where {:id id} :set {:body "short"}}) => (throws)))

^{:refer finfolkdb.common.type-site-note/SiteNoteVote :id unique-votes}
(fact "one vote per member and deleting a note removes its votes"
  (fixture/member "note-voter") (fixture/beach "vote-beach")
  (let [id (str (java.util.UUID/randomUUID))
        note (pg/t:insert t/SiteNote {:id id :author "note-voter" :beach "vote-beach"
                                     :topic "facilities" :body "Keep the meeting area clear of gear."})]
    (pg/t:insert t/SiteNoteVote {:note id :voter "note-voter"})
    (pg/t:insert t/SiteNoteVote {:note id :voter "note-voter"}) => (throws)
    (pg/t:delete t/SiteNote {:where {:id id}})
    (pg/t:get t/SiteNoteVote {:where {:note id :voter "note-voter"}}) => nil))

^{:refer finfolkdb.common.type-site-note/SiteNoteReport :id report-contracts}
(fact "report reasons are bounded and each member can report a note once"
  (fixture/member "note-reporter") (fixture/beach "report-note-beach")
  (let [id (str (java.util.UUID/randomUUID))
        note (pg/t:insert t/SiteNote {:id id :author "note-reporter" :beach "report-note-beach"
                                     :topic "wildlife" :body "Record sightings with their observation date."})]
    (pg/t:insert t/SiteNoteReport {:note id :reporter "note-reporter" :reason ""}) => (throws)
    (pg/t:insert t/SiteNoteReport {:note id :reporter "note-reporter" :reason "Please review this note."})
    (pg/t:insert t/SiteNoteReport {:note id :reporter "note-reporter" :reason "Duplicate report."}) => (throws)
    (pg/t:delete t/SiteNote {:where {:id id}})
    (pg/t:get t/SiteNoteReport {:where {:note id :reporter "note-reporter"}}) => nil))
