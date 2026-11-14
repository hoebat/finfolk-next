(ns finfolkdb.common.type-logbook-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-logbook-base :as t]
             [finfolkdb.fn.user.user-manage-logbook :as logbook]]})
(fact:global {:setup [(local/setup!)] :teardown [(local/teardown!)]})

^{:refer finfolkdb.common.type-logbook-base/DiveSession :id private-owned-session}
(fact "saving a dive strips public media and only its owner can read private notes"
  (fixture/member "09570c0c-614e-53b5-bd57-a9cfcbc528c6")
  (fixture/member "15e333ed-934b-5848-8760-24d57060ebd7")
  (fixture/beach "a7c464d2-0eb7-59a2-9ca2-e48364cab6f2")
  (let
    [session
     (logbook/insert-dive-session
      "09570c0c-614e-53b5-bd57-a9cfcbc528c6"
      "a7c464d2-0eb7-59a2-9ca2-e48364cab6f2"
      {:date "2026-11-04" :visibility "public" :photos ["PRIVATE_PHOTO"] :notes "PRIVATE_NOTE"}
      (fixture/op "create-session" "09570c0c-614e-53b5-bd57-a9cfcbc528c6"))
     id (:id session)]
    (:visibility (:detail session)) => "private"
    (:photos (:detail session)) => []
    (:notes (logbook/ret-dive-session-owned id "09570c0c-614e-53b5-bd57-a9cfcbc528c6"))
    =>
    "PRIVATE_NOTE"
    (logbook/ret-dive-session-owned id "15e333ed-934b-5848-8760-24d57060ebd7") => nil
    (pg/t:delete t/DiveSession {:where {:id id}})
    (logbook/ret-dive-session-owned id "09570c0c-614e-53b5-bd57-a9cfcbc528c6") => nil))
