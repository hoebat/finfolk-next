(ns finfolkdb.common.type-event-test
  (:use code.test)
  (:require [lang.core :as l] [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main] [postgres.core :as pg]
             [finfolkdb.common.type-event :as t]
             [finfolkdb.fn.event.event-manage :as events]
             [finfolkdb.fn.directory.directory-manage :as directory]
             [finfolkdb.common.type-system-base :as system]]})
(fact:global {:setup [(neon/setup!)] :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-event/Event :id create-and-rollback}
(fact "events belong to their organiser and invalid dates leave no addon providers"
  (fixture/member "event-owner")
  (let [listing (directory/insert-directory-listing {:name "Ocean School"} (fixture/op "create-listing" "event-owner"))
        event (events/insert-event (:id listing) {:title "Practice" :capacity 2} "public"
                    "2026-11-10T01:00:00Z" "2026-11-10T02:00:00Z" "Australia/Sydney" (fixture/op "create-event" "event-owner"))
        revisions (pg/t:count system/Rev)
        audits (pg/t:count system/Audit)]
    (:listing-id event) => (:id listing)
    (:status event) => "draft"
    (events/insert-event (:id listing) {:capacity 0} "public" "2026-11-10T01:00:00Z"
                        "2026-11-10T02:00:00Z" "Australia/Sydney" (fixture/op "bad-event" "event-owner")) => (throws)
    (events/insert-event (:id listing) {:capacity 2} "public" "2026-11-10T02:00:00Z"
                        "2026-11-10T01:00:00Z" "Australia/Sydney" (fixture/op "bad-event" "event-owner")) => (throws)
    (pg/t:count system/Rev) => revisions
    (pg/t:count system/Audit) => audits))

^{:refer finfolkdb.common.type-event/EventRsvp :id rsvp-update}
(fact "one RSVP per member can be cancelled without creating duplicate attendance"
  (fixture/member "rsvp-owner")
  (let [listing (directory/insert-directory-listing {:name "RSVP school"} (fixture/op "create-listing" "rsvp-owner"))
        event (events/insert-event (:id listing) {:title "RSVP practice" :capacity 2} "public"
                                  "2026-11-10T01:00:00Z" "2026-11-10T02:00:00Z" "Australia/Sydney" (fixture/op "create-event" "rsvp-owner"))
        rsvp (pg/t:insert t/EventRsvp {:event (:id event) :member "rsvp-owner" :status "going"} {:track {}})]
    (:status rsvp) => "going"
    (pg/t:insert t/EventRsvp {:event (:id event) :member "rsvp-owner" :status "going"} {:track {}}) => (throws)
    (pg/t:update t/EventRsvp {:track {} :where {:event (:id event) :member "rsvp-owner"} :set {:status "cancelled"}})
    (:status (pg/t:get t/EventRsvp {:where {:event (:id event) :member "rsvp-owner"}})) => "cancelled"))

