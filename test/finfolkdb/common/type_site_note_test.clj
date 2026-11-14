(ns finfolkdb.common.type-site-note-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-site-note :as t]]})
(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-site-note/EnumSiteNoteTopic
  :covers [finfolkdb.common.type-site-note/SiteNote]
  :id note-contracts}
(fact "topics are closed values and conditions need an observation date"
  (fixture/member "93f5dece-9d3b-59ed-a09a-b1225f24145d")
  (fixture/beach "cb2146b1-4e69-5ed7-bbe5-6ab98302b62a")
  (let
    [id (str (java.util.UUID/randomUUID))
     note (pg/t:insert t/SiteNote
            {:id id
             :author "93f5dece-9d3b-59ed-a09a-b1225f24145d"
             :beach "cb2146b1-4e69-5ed7-bbe5-6ab98302b62a"
             :topic "access"
             :body "Meet at an agreed meeting point."})]
    (:revision note) => 1
    (:withdrawn note) => false
    (:hidden note) => false
    (pg/t:update t/SiteNote {:where {:id id} :set {:topic "unknown"}}) => (throws)
    (pg/t:update t/SiteNote {:where {:id id} :set {:topic "conditions"}}) => (throws)
    (pg/t:update t/SiteNote {:where {:id id} :set {:body "short"}}) => (throws)))

^{:refer finfolkdb.common.type-site-note/SiteNoteVote :id unique-votes}
(fact "one vote per member and deleting a note removes its votes"
  (fixture/member "9ee31e9f-973a-5ee2-b265-83102dfbcefd")
  (fixture/beach "d96b10c1-6968-55be-a0a2-6eae9ae884e4")
  (let
    [id (str (java.util.UUID/randomUUID))
     note (pg/t:insert t/SiteNote
            {:id id
             :author "9ee31e9f-973a-5ee2-b265-83102dfbcefd"
             :beach "d96b10c1-6968-55be-a0a2-6eae9ae884e4"
             :topic "facilities"
             :body "Keep the meeting area clear of gear."})]
    (pg/t:insert t/SiteNoteVote {:note id :voter "9ee31e9f-973a-5ee2-b265-83102dfbcefd"})
    (pg/t:insert t/SiteNoteVote {:note id :voter "9ee31e9f-973a-5ee2-b265-83102dfbcefd"})
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
     note (pg/t:insert t/SiteNote
            {:id id
             :author "7058314c-82bc-5704-b220-15b1ff12121d"
             :beach "c0242001-402a-54b3-9089-54e7f5a5a947"
             :topic "wildlife"
             :body "Record sightings with their observation date."})]
    (pg/t:insert t/SiteNoteReport
      {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d" :reason ""})
    =>
    (throws)
    (pg/t:insert t/SiteNoteReport
      {:note id
       :reporter "7058314c-82bc-5704-b220-15b1ff12121d"
       :reason "Please review this note."})
    (pg/t:insert t/SiteNoteReport
      {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d" :reason "Duplicate report."})
    =>
    (throws)
    (pg/t:delete t/SiteNote {:where {:id id}})
    (pg/t:get t/SiteNoteReport {:where {:note id :reporter "7058314c-82bc-5704-b220-15b1ff12121d"}})
    =>
    nil))
