(ns finfolkdb.common.type-event-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-event :as t]
             [finfolkdb.fn.event.event-manage :as events]
             [finfolkdb.fn.directory.directory-manage :as directory]
             [finfolkdb.common.type-system-base :as system]]})
(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-event/Event :id create-and-rollback}
(fact "events belong to their organiser and invalid dates leave no addon providers"
  (fixture/member "4328ddcd-8e1f-5756-984c-34b62b1cf12a")
  (let
    [listing (directory/insert-directory-listing
              {:name "Ocean School"}
              (fixture/op "create-listing" "4328ddcd-8e1f-5756-984c-34b62b1cf12a"))
     event (events/insert-event (:id listing)
                                {:title "Practice" :capacity 2}
                                "public"
                                1794272400000000 1794276000000000
                                "Australia/Sydney"
                                (fixture/op "create-event" "4328ddcd-8e1f-5756-984c-34b62b1cf12a"))
     revisions (pg/t:count system/Rev)
     audits (pg/t:count system/Audit)]
    (:listing-id event) => (:id listing)
    (:status event) => "draft"
    (events/insert-event (:id listing)
                         {:capacity 0}
                         "public"
                         1794272400000000 1794276000000000
                         "Australia/Sydney" (fixture/op "bad-event"
                                                        "4328ddcd-8e1f-5756-984c-34b62b1cf12a"))
    =>
    (throws)
    (events/insert-event (:id listing)
                         {:capacity 2}
                         "public"
                         1794276000000000 1794272400000000
                         "Australia/Sydney" (fixture/op "bad-event"
                                                        "4328ddcd-8e1f-5756-984c-34b62b1cf12a"))
    =>
    (throws)
    (pg/t:count system/Rev) => revisions
    (pg/t:count system/Audit) => audits))

^{:refer finfolkdb.common.type-event/EventRsvp :id rsvp-update}
(fact "one RSVP per member can be cancelled without creating duplicate attendance"
  (fixture/member "7d5e0147-1a75-5113-9959-dba715b343e5")
  (let
    [listing (directory/insert-directory-listing
              {:name "RSVP school"}
              (fixture/op "create-listing" "7d5e0147-1a75-5113-9959-dba715b343e5"))
     event (events/insert-event (:id listing)
                                {:title "RSVP practice" :capacity 2}
                                "public"
                                1794272400000000 1794276000000000
                                "Australia/Sydney"
                                (fixture/op "create-event" "7d5e0147-1a75-5113-9959-dba715b343e5"))
     rsvp (pg/t:insert t/EventRsvp
            {:event (:id event) :member "7d5e0147-1a75-5113-9959-dba715b343e5" :status "going"}
            {:track {}})]
    (:status rsvp) => "going"
    (pg/t:insert t/EventRsvp
      {:event (:id event) :member "7d5e0147-1a75-5113-9959-dba715b343e5" :status "going"}
      {:track {}})
    =>
    (throws)
    (pg/t:update t/EventRsvp
      {:track {}
       :where {:event (:id event) :member "7d5e0147-1a75-5113-9959-dba715b343e5"}
       :set {:status "cancelled"}})
    (:status (pg/t:get t/EventRsvp
               {:where {:event (:id event) :member "7d5e0147-1a75-5113-9959-dba715b343e5"}}))
    =>
    "cancelled"))
