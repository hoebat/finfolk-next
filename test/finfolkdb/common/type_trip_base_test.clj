(ns finfolkdb.common.type-trip-base-test
  (:use code.test)
  (:require [lang.core :as l] [std.json :as json] [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main] [postgres.core :as pg]
             [finfolkdb.common.type-trip-base :as t]
             [finfolkdb.fn.user.user-manage-trips :as trips]]})
(fact:global {:setup [(local/setup!) (fixture/member "trip-alice") (fixture/member "trip-bob") (fixture/beach "trip-beach")] :teardown [(local/teardown!)]})

(defonce imported-trip (atom nil))
(defn insert-trip [arg0 arg1 arg2] (trips/insert-trip arg0 arg1 arg2))
(defn ret-trip-owned [arg0 arg1] (trips/ret-trip-owned arg0 arg1))
(defn update-trip-draft [arg0 arg1 arg2 arg3 arg4] (trips/update-trip-draft arg0 arg1 arg2 arg3 arg4))
(defn insert-trip-import [arg0 arg1 arg2 arg3] (trips/insert-trip-import arg0 arg1 arg2 arg3))
(defn save-trip-import-batch [arg0 arg1 arg2 arg3 arg4 arg5] (trips/save-trip-import-batch arg0 arg1 arg2 arg3 arg4 arg5))
(defn complete-trip-import [arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7] (trips/complete-trip-import arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7))
(defn set-trip-publication [arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7] (trips/set-trip-publication arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7))
(defn ret-trip-public [arg0] (trips/ret-trip-public arg0))
(defn review-trip-publication [arg0 arg1 arg2 arg3 arg4 arg5] (trips/review-trip-publication arg0 arg1 arg2 arg3 arg4 arg5))
(defn withdraw-trip-publication [arg0 arg1 arg2] (trips/withdraw-trip-publication arg0 arg1 arg2))

^{:refer finfolkdb.common.type-trip-base/Trip :id draft-ownership}
(fact "private drafts are visible only to their owner and stale revisions cannot save"
  (let [draft (json/write {:title "Ocean trip" :beachId "trip-beach" :start "2026-11-01" :end "2026-11-10" :story "PRIVATE_STORY"})
        trip (insert-trip "trip-alice" draft (fixture/op "create-trip" "trip-alice"))
        id (:id trip)]
    (:revision trip) => 1
    (:story (:draft (ret-trip-owned id "trip-alice"))) => "PRIVATE_STORY"
    (ret-trip-owned id "trip-bob") => nil
    (update-trip-draft id "trip-bob" draft 1 (fixture/op "save-trip" "trip-bob")) => nil
    (update-trip-draft id "trip-alice" draft 0 (fixture/op "save-trip" "trip-alice")) => nil
    (:revision (ret-trip-owned id "trip-alice")) => 1))

^{:refer finfolkdb.common.type-trip-base/TripImport :id atomic-import
  :covers [finfolkdb.common.type-trip-base/TripImportBatch finfolkdb.common.type-trip-base/TripDive]}
(fact "upload retries are idempotent, conflicting batches are rejected and completion replaces raw data atomically"
  (let [trip (insert-trip "trip-alice" (json/write {:title "Import" :beachId "trip-beach" :start "2026-11-01" :end "2026-11-10"})
                                (fixture/op "create-trip" "trip-alice"))
        id (:id trip)
        upload (insert-trip-import id "trip-alice" 1 (fixture/op "begin-import" "trip-alice"))
        rows "[{\"day\":\"2026-11-04\",\"sourceId\":\"one\",\"maxDepthMetres\":12}]"
        fingerprint "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    (reset! imported-trip trip)
    (save-trip-import-batch id "trip-bob" (:id upload) 0 rows (fixture/op "upload" "trip-bob")) => nil
    (save-trip-import-batch id "trip-alice" (:id upload) 0 rows (fixture/op "upload" "trip-alice")) => {:ok true}
    (save-trip-import-batch id "trip-alice" (:id upload) 0 rows (fixture/op "upload" "trip-alice")) => {:ok true}
    (save-trip-import-batch id "trip-alice" (:id upload) 0 "[{\"day\":\"2026-11-05\",\"sourceId\":\"changed\"}]"
                                  (fixture/op "upload" "trip-alice")) => nil
    (complete-trip-import id "trip-alice" (:id upload) 1 fingerprint false false (fixture/op "complete" "trip-alice"))
    => {:revision 2 :rows 1}
    (:active-import (ret-trip-owned id "trip-alice")) => (:id upload)
    (pg/t:count t/TripDive {:where {:import (:id upload)}}) => 1
    (complete-trip-import id "trip-alice" (:id upload) 1 fingerprint false false (fixture/op "complete" "trip-alice"))
    => {:unchanged true :revision 2}
    (save-trip-import-batch id "trip-alice" (:id upload) 1 rows (fixture/op "upload" "trip-alice")) => nil))

(defn publication-fixture []
  (let [trip (insert-trip "trip-alice" (json/write {:title "Publication" :beachId "trip-beach" :start "2026-11-01" :end "2026-11-10"})
                          (fixture/op "create-trip" "trip-alice"))
        upload (insert-trip-import (:id trip) "trip-alice" 1 (fixture/op "begin-import" "trip-alice"))]
    (save-trip-import-batch (:id trip) "trip-alice" (:id upload) 0 "[{\"day\":\"2026-11-04\",\"sourceId\":\"publication\"}]" (fixture/op "upload" "trip-alice"))
    (complete-trip-import (:id trip) "trip-alice" (:id upload) 1 "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" false false (fixture/op "complete" "trip-alice"))
    trip))

^{:refer finfolkdb.common.type-trip-base/TripPublication :id consent-and-withdrawal
  :covers [finfolkdb.common.type-trip-base/EnumTripPublicationStatus finfolkdb.common.type-trip-base/EnumTripReviewDecision]}
(fact "publication requires imported dives, ownership and consent; pending content remains private"
  (let [trip (publication-fixture)
        id (:id trip)
        snapshot (json/write {:title "Public trip" :authorName "Alice" :beachId "trip-beach" :beachName "Beach"
                  :timezone "Australia/Sydney" :start "2026-11-01" :end "2026-11-10"
                  :story "Public story" :links [] :summary {} :privateNotes "PRIVATE_SENTINEL"})]
    (set-trip-publication id "trip-alice" snapshot 2 false true false (fixture/op "publish" "trip-alice")) => (throws)
    (set-trip-publication id "trip-bob" snapshot 2 true true false (fixture/op "publish" "trip-bob")) => nil
    (set-trip-publication id "trip-alice" snapshot 1 true true false (fixture/op "publish" "trip-alice")) => nil
    (:status (set-trip-publication id "trip-alice" snapshot 2 true true false (fixture/op "publish" "trip-alice"))) => "pending"
    (ret-trip-public id) => nil
    (review-trip-publication id "approve" "stale-token" true true (fixture/op "review" "trip-alice")) => nil
    (review-trip-publication id "invalid" "stale-token" true true (fixture/op "review" "trip-alice")) => (throws)
    (withdraw-trip-publication id "trip-bob" (fixture/op "withdraw" "trip-bob")) => nil
    (withdraw-trip-publication id "trip-alice" (fixture/op "withdraw" "trip-alice")) => {:ok true}
    (ret-trip-public id) => nil))

