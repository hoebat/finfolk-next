(ns finfolkdb.common.type-logbook-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.neon :as neon]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client :config (neon/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-logbook-base :as t]
             [finfolkdb.fn.user.user-manage-logbook :as logbook]]})
(fact:global {:setup [(neon/setup!)] :teardown [(neon/teardown!)]})

^{:refer finfolkdb.common.type-logbook-base/DiveSession :id private-owned-session}
(fact "saving a dive strips public media and only its owner can read private notes"
  (fixture/member "logbook-alice")
  (fixture/member "logbook-bob")
  (fixture/beach "logbook-beach")
  (let [session (logbook/insert-dive-session "logbook-alice" "logbook-beach"
                    {:date "2026-11-04" :visibility "public" :photos ["PRIVATE_PHOTO"] :notes "PRIVATE_NOTE"}
                    (fixture/op "create-session" "logbook-alice"))
        id (:id session)]
    (:visibility (:detail session)) => "private"
    (:photos (:detail session)) => []
    (:notes (logbook/ret-dive-session-owned id "logbook-alice")) => "PRIVATE_NOTE"
    (logbook/ret-dive-session-owned id "logbook-bob") => nil
    (pg/t:delete t/DiveSession {:where {:id id}})
    (logbook/ret-dive-session-owned id "logbook-alice") => nil))

