(ns finfolkdb.common.type-trip-base-test
  (:use code.test)
  (:require [lang.core :as l]
            [std.json :as json]
            [finfolkbuild.testing.local :as local]
            [finfolkbuild.testing.behavior :as fixture]))
(l/script- :postgres
  {:runtime :jdbc.client
   :config (local/config)
   :require [[finfolkdb.main.scaffold-001-entity :as main]
             [postgres.core :as pg]
             [finfolkdb.common.type-trip-base :as t]
             [finfolkdb.fn.user.user-manage-trips :as trips]]})
(fact:global {:setup [(local/setup!) (fixture/member "5b06da94-2c1c-5009-9fe1-695bfe82855a")
                      (fixture/member "937b8e55-50e6-5d64-ab7c-31e73c425b56")
                      (fixture/beach "8932d946-9ae4-54ba-ba10-2ac92b1059e6")]
              :teardown [(local/teardown!)]})

(defonce imported-trip (atom nil))
(defn insert-trip [arg0 arg1 arg2] (trips/insert-trip arg0 arg1 arg2))
(defn ret-trip-owned [arg0 arg1] (trips/ret-trip-owned arg0 arg1))
(defn update-trip-draft
  [arg0 arg1 arg2 arg3 arg4]
  (trips/update-trip-draft arg0 arg1 arg2 arg3 arg4))
(defn insert-trip-import [arg0 arg1 arg2 arg3] (trips/insert-trip-import arg0 arg1 arg2 arg3))
(defn save-trip-import-batch
  [arg0 arg1 arg2 arg3 arg4 arg5]
  (trips/save-trip-import-batch arg0 arg1 arg2 arg3 arg4 arg5))
(defn complete-trip-import
  [arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7]
  (trips/complete-trip-import arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7))
(defn set-trip-publication
  [arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7]
  (trips/set-trip-publication arg0 arg1 arg2 arg3 arg4 arg5 arg6 arg7))
(defn ret-trip-public [arg0] (trips/ret-trip-public arg0))
(defn review-trip-publication
  [arg0 arg1 arg2 arg3 arg4 arg5]
  (trips/review-trip-publication arg0 arg1 arg2 arg3 arg4 arg5))
(defn withdraw-trip-publication [arg0 arg1 arg2] (trips/withdraw-trip-publication arg0 arg1 arg2))

^{:refer finfolkdb.common.type-trip-base/Trip :id draft-ownership}
(fact "private drafts are visible only to their owner and stale revisions cannot save"
  (let
    [draft (json/write {:title "Ocean trip"
                        :beachId "8932d946-9ae4-54ba-ba10-2ac92b1059e6"
                        :start "2026-11-01"
                        :end "2026-11-10"
                        :story "PRIVATE_STORY"})
     trip (insert-trip "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                       draft
                       (fixture/op "create-trip" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
     id (:id trip)]
    (:revision trip) => 1
    (:story (:draft (ret-trip-owned id "5b06da94-2c1c-5009-9fe1-695bfe82855a"))) => "PRIVATE_STORY"
    (ret-trip-owned id "937b8e55-50e6-5d64-ab7c-31e73c425b56") => nil
    (update-trip-draft id
                       "937b8e55-50e6-5d64-ab7c-31e73c425b56" draft
                       1 (fixture/op "save-trip" "937b8e55-50e6-5d64-ab7c-31e73c425b56"))
    =>
    nil
    (update-trip-draft id
                       "5b06da94-2c1c-5009-9fe1-695bfe82855a" draft
                       0 (fixture/op "save-trip" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    nil
    (:revision (ret-trip-owned id "5b06da94-2c1c-5009-9fe1-695bfe82855a")) => 1))

^{:refer finfolkdb.common.type-trip-base/TripImport
  :id atomic-import
  :covers [finfolkdb.common.type-trip-base/TripImportBatch
           finfolkdb.common.type-trip-base/TripDive]}
(fact
  "upload retries are idempotent, conflicting batches are rejected and completion replaces raw data atomically"
  (let
    [trip (insert-trip "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                       (json/write {:title "Import"
                                    :beachId "8932d946-9ae4-54ba-ba10-2ac92b1059e6"
                                    :start "2026-11-01"
                                    :end "2026-11-10"})
                       (fixture/op "create-trip" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
     id (:id trip)
     upload (insert-trip-import id
                                "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                                1
                                (fixture/op "begin-import" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
     rows "[{\"day\":\"2026-11-04\",\"sourceId\":\"one\",\"maxDepthMetres\":12}]"
     fingerprint "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]
    (reset! imported-trip trip)
    (save-trip-import-batch id
                            "937b8e55-50e6-5d64-ab7c-31e73c425b56"
                            (:id upload)
                            0
                            rows
                            (fixture/op "upload" "937b8e55-50e6-5d64-ab7c-31e73c425b56"))
    =>
    nil
    (save-trip-import-batch id
                            "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                            (:id upload)
                            0
                            rows
                            (fixture/op "upload" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    {:ok true}
    (save-trip-import-batch id
                            "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                            (:id upload)
                            0
                            rows
                            (fixture/op "upload" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    {:ok true}
    (save-trip-import-batch id
                            "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                            (:id upload)
                            0
                            "[{\"day\":\"2026-11-05\",\"sourceId\":\"changed\"}]"
                            (fixture/op "upload" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    nil
    (complete-trip-import id
                          "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          (:id upload)
                          1
                          fingerprint
                          false
                          false
                          (fixture/op "complete" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    {:revision 2 :rows 1}
    (:active-import (ret-trip-owned id "5b06da94-2c1c-5009-9fe1-695bfe82855a")) => (:id upload)
    (pg/t:count t/TripDive {:where {:import (:id upload)}}) => 1
    (complete-trip-import id
                          "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          (:id upload)
                          1
                          fingerprint
                          false
                          false
                          (fixture/op "complete" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    {:unchanged true :revision 2}
    (save-trip-import-batch id
                            "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                            (:id upload)
                            1
                            rows
                            (fixture/op "upload" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    nil))

(defn publication-fixture
  []
  (let [trip (insert-trip "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          (json/write {:title "Publication"
                                       :beachId "8932d946-9ae4-54ba-ba10-2ac92b1059e6"
                                       :start "2026-11-01"
                                       :end "2026-11-10"})
                          (fixture/op "create-trip" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
        upload (insert-trip-import (:id trip)
                                   "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                                   1
                                   (fixture/op "begin-import"
                                               "5b06da94-2c1c-5009-9fe1-695bfe82855a"))]
    (save-trip-import-batch (:id trip)
                            "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                            (:id upload)
                            0
                            "[{\"day\":\"2026-11-04\",\"sourceId\":\"publication\"}]"
                            (fixture/op "upload" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    (complete-trip-import (:id trip)
                          "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          (:id upload)
                          1
                          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" false
                          false (fixture/op "complete" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    trip))

^{:refer finfolkdb.common.type-trip-base/TripPublication
  :id consent-and-withdrawal
  :covers [finfolkdb.common.type-trip-base/EnumTripPublicationStatus
           finfolkdb.common.type-trip-base/EnumTripReviewDecision]}
(fact "publication requires imported dives, ownership and consent; pending content remains private"
  (let
    [trip (publication-fixture)
     id (:id trip)
     snapshot (json/write {:title "Public trip"
                           :authorName "Alice"
                           :beachId "8932d946-9ae4-54ba-ba10-2ac92b1059e6"
                           :beachName "Beach"
                           :timezone "Australia/Sydney"
                           :start "2026-11-01"
                           :end "2026-11-10"
                           :story "Public story"
                           :links []
                           :summary {}
                           :privateNotes "PRIVATE_SENTINEL"})]
    (set-trip-publication id
                          "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          snapshot
                          2
                          false true
                          false (fixture/op "publish" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    (throws)
    (set-trip-publication id
                          "937b8e55-50e6-5d64-ab7c-31e73c425b56"
                          snapshot
                          2
                          true true
                          false (fixture/op "publish" "937b8e55-50e6-5d64-ab7c-31e73c425b56"))
    =>
    nil
    (set-trip-publication id
                          "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                          snapshot
                          1
                          true true
                          false (fixture/op "publish" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    nil
    (:status (set-trip-publication id
                                   "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                                   snapshot
                                   2
                                   true true
                                   false (fixture/op "publish"
                                                     "5b06da94-2c1c-5009-9fe1-695bfe82855a")))
    =>
    "pending"
    (ret-trip-public id) => nil
    (review-trip-publication id
                             "approve"
                             "stale-token" true
                             true (fixture/op "review" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    nil
    (review-trip-publication id
                             "invalid"
                             "stale-token" true
                             true (fixture/op "review" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    (throws)
    (withdraw-trip-publication id
                               "937b8e55-50e6-5d64-ab7c-31e73c425b56"
                               (fixture/op "withdraw" "937b8e55-50e6-5d64-ab7c-31e73c425b56"))
    =>
    nil
    (withdraw-trip-publication id
                               "5b06da94-2c1c-5009-9fe1-695bfe82855a"
                               (fixture/op "withdraw" "5b06da94-2c1c-5009-9fe1-695bfe82855a"))
    =>
    {:ok true}
    (ret-trip-public id) => nil))
