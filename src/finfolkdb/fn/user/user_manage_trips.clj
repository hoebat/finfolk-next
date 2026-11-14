(ns finfolkdb.fn.user.user-manage-trips
  "Typed private trip drafts and independent publication snapshots."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-trip-base :as ttb]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.helper.helper-entity :as he]
             [finfolkdb.fn.helper.helper-access :as ha]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; Trip Creation
;;

(defn.pg insert-trip
  [:uuid i-owner :jsonb i-draft :jsonb o-op]
  (let [(:uuid v-id) (pg/uuid-generate-v4)
        o-draft (tss/as-jsonb i-draft)
        o-base (he/insert-base-addons "Trip" v-id o-draft o-op)
        o-trip (pg/t:insert ttb/Trip
                 {:id v-id
                  :owner i-owner
                  :beach (:uuid (:->> o-draft "beachId"))
                  :start-date (:date (:->> o-draft "start"))
                  :end-date (:date (:->> o-draft "end"))
                  :detail (- (- (- o-draft "beachId") "start") "end")
                  :rev (:uuid (:->> o-base "rev"))
                  :audit (:uuid (:->> o-base "audit"))}
                 {:track o-op :returning #{:*/standard :detail}})]
    (return (pg/jsonb-build-object "id" (pg/id o-trip) "revision" 1))))

;;
;; Owned Trip Read
;;

(defn.pg ret-trip-owned
  "Restores API draft fields from typed relationships and dates."
  [:uuid i-trip-id :uuid i-owner]
  (let [o-trip (pg/t:get ttb/Trip
                 {:where {:id i-trip-id :owner i-owner}
                  :returning #{:id :owner :beach :start-date :end-date :detail :rev}})
        o-active (pg/t:get ttb/TripImport {:where {:trip i-trip-id :is-active true}})
        o-rev (pg/t:get tsb/Rev
                {:where
                 {:class-table "Trip" :class-context "Global" :id (:uuid (:->> o-trip "rev_id"))}})
        (:boolean v-published) (pg/t:exists ttb/TripPublication
                                 {:where {:trip i-trip-id :status "published"}})
        (:boolean v-pending) (pg/t:exists ttb/TripPublication
                               {:where {:trip i-trip-id :status "pending"}})]
    (when (or [o-trip :is-null] (not (ha/is-user-active i-owner)))
      (return nil))
    (return (pg/jsonb-build-object "id" (:uuid (:->> o-trip "id"))
                                   "draft" (|| (:-> o-trip "detail")
                                               (pg/jsonb-build-object
                                                "beachId" (:uuid (:->> o-trip "beach_id"))
                                                "start" (:->> o-trip "start_date")
                                                "end" (:->> o-trip "end_date")))
                                   "revision" (:integer (:->> o-rev "index"))
                                   "activeImport" (:-> o-active "id")
                                   "published" v-published
                                   "pending" v-pending))))

;;
;; Import Start
;;

(defn.pg insert-trip-import
  [:uuid i-trip-id :uuid i-owner :integer i-expected-rows :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip {:where {:id i-trip-id :owner i-owner} :for [:update]})]
    (when [o-trip :is-null]
      (return nil))
    (let [o-expired (pg/t:delete ttb/TripImport
                      {:where {:trip i-trip-id
                               :status "uploading"
                               :time-created [:lt (- (pg/time-us) 86400000000)]}})
          o-import (pg/t:insert ttb/TripImport
                     {:trip i-trip-id :expected-rows i-expected-rows}
                     {:track o-op})]
      (return o-import))))

;;
;; Idempotent Batch Upload
;;

(defn.pg save-trip-import-batch
  [:uuid i-trip-id :uuid i-owner :uuid i-import-id :integer i-index :jsonb i-rows :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip {:where {:id i-trip-id :owner i-owner} :for [:update]})
        o-import (pg/t:get ttb/TripImport
                   {:where {:id i-import-id :trip i-trip-id :status "uploading"} :for [:update]})
        o-rows (tss/as-jsonb-array i-rows)]
    (when (or [o-trip :is-null] [o-import :is-null])
      (return nil))
    (when (or (< (pg/jsonb-array-length o-rows) 1) (> (pg/jsonb-array-length o-rows) 200))
      [:raise-exception "Import a batch of 1 to 200 rows"])
    (let [o-existing (pg/t:get ttb/TripImportBatch {:where {:import i-import-id :index i-index}})]
      (when [o-existing :is-not-null]
        (when (not= (:-> o-existing "rows") o-rows)
          (return nil))
        (return (pg/jsonb-build-object "ok" true)))
      (let [o-batch (pg/t:insert ttb/TripImportBatch
                      {:import i-import-id :index i-index :rows o-rows}
                      {:track o-op})]
        (return (pg/jsonb-build-object "ok" true))))))

;;
;; Atomic Import Confirmation
;;

(defn.pg complete-trip-import
  "Locks the trip before reading its revision and swaps the active child atomically."
  [:uuid i-trip-id :uuid i-owner :uuid i-import-id :integer i-revision :text i-fingerprint :boolean
   i-replace :boolean i-duplicates-confirmed :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip
                 {:where {:id i-trip-id :owner i-owner}
                  :for [:update]
                  :returning #{:id :rev :audit :start-date :end-date}})]
    (when [o-trip :is-null]
      (return nil))
    (let [o-import (pg/t:get ttb/TripImport
                     {:where {:id i-import-id :trip i-trip-id} :for [:update]})
          o-rev (pg/t:get tsb/Rev
                  {:where
                   {:class-table "Trip" :class-context "Global" :id (:uuid (:->> o-trip "rev_id"))}
                   :for [:update]})
          (:integer v-revision) (:integer (:->> o-rev "index"))
          o-active (pg/t:get ttb/TripImport {:where {:trip i-trip-id :is-active true}})]
      (when [o-import :is-null]
        (return nil))
      (when (== (:->> o-import "status") "complete")
        (when (== (:boolean (:->> o-import "is_active")) true)
          (return (pg/jsonb-build-object "unchanged" true "revision" v-revision)))
        (return nil))
      (when (or [i-fingerprint :is-null] (not= (pg/length i-fingerprint) 64))
        [:raise-exception "Choose a valid import fingerprint"])
      (let [o-batches (pg/t:select ttb/TripImportBatch
                        {:where {:import i-import-id}
                         :returning #{:index :rows}
                         :order-by [:index]
                         :order-sort :asc})
            o-rows (:jsonb "[]")
            v-batch nil
            (:integer v-index) 0]
        [:for v-batch :in :select (pg/jsonb-array-elements (pg/coalesce o-batches (:jsonb "[]")))
         (loop []
           (when (not= (:integer (:->> v-batch "index")) v-index)
             [:raise-exception "Some import batches are missing"])
           (:= o-rows (|| o-rows (:-> v-batch "rows")))
           (:= v-index (+ v-index 1)))]
        (when (not= (pg/jsonb-array-length o-rows) (:integer (:->> o-import "expected_rows")))
          [:raise-exception "Import row count does not match"])
        (when (and [o-active :is-not-null] (== (:->> o-active "fingerprint") i-fingerprint))
          (let [o-discarded (pg/t:delete ttb/TripImport {:where {:id i-import-id}})]
            (return (pg/jsonb-build-object "unchanged" true "revision" v-revision))))
        (when (or (not= i-revision v-revision)
                  (and [o-active :is-not-null] (not (pg/coalesce i-replace false))))
          (return nil))
        (let [o-deactivated
              (pg/t:update ttb/TripImport
                {:where {:trip i-trip-id :is-active true} :set {:is-active false} :track o-op})
              v-row nil
              o-seen (:jsonb "{}")
              (:integer v-ordinal) 0
              (:text v-identity) nil]
          [:for v-row :in :select (pg/jsonb-array-elements o-rows)
           (loop []
             (let [(:date v-day) (:date (:->> v-row "day"))]
               (when (or [v-day :is-null]
                         (< v-day (:date (:->> o-trip "start_date")))
                         (> v-day (:date (:->> o-trip "end_date"))))
                 [:raise-exception "Imported rows fall outside the trip"])
               (if [(nullif (:->> v-row "sourceId") "") :is-not-null]
                 (:= v-identity (|| (:text v-day) "|" (:->> v-row "sourceId")))
                 (:= v-identity (nullif (:->> v-row "timestamp") "")))
               (when [v-identity :is-not-null]
                 (when (and (pg/jsonb-exists o-seen v-identity)
                            (not (pg/coalesce i-duplicates-confirmed false)))
                   [:raise-exception "Review repeated dive identifiers before confirming"])
                 (:= o-seen (|| o-seen (pg/jsonb-build-object v-identity true))))
               (let [o-dive
                     (pg/t:insert ttb/TripDive
                       {:import i-import-id :ordinal (+ v-ordinal 1) :day v-day :detail v-row}
                       {:track o-op})]
                 (:= v-ordinal (+ v-ordinal 1)))))]
          (let [o-complete (pg/t:update ttb/TripImport
                             {:where {:id i-import-id :trip i-trip-id}
                              :set {:status "complete" :is-active true :fingerprint i-fingerprint}
                              :track o-op})
                o-updated (pg/t:update tsb/Rev
                            {:where {:id (:uuid (:->> o-trip "rev_id"))
                                     :class-table "Trip"
                                     :class-context "Global"}
                             :set {:index (+ v-revision 1)}
                             :track o-op})
                o-version (pg/t:insert tsb/RevLog
                            {:class-table "Trip"
                             :class-context "Global"
                             :rev (:uuid (:->> o-trip "rev_id"))
                             :version (+ v-revision 1)
                             :deltas (pg/jsonb-build-object "importedRows" v-ordinal)}
                            {:track o-op})
                o-audit (pg/t:insert tsb/AuditLog
                          {:class-table "Trip"
                           :class-context "Global"
                           :audit (:uuid (:->> o-trip "audit_id"))
                           :entry (pg/jsonb-build-object "event" "import" "rows" v-ordinal)}
                          {:track o-op})
                o-superseded (pg/t:delete ttb/TripImport
                               {:where {:trip i-trip-id :is-active false :status "complete"}})]
            (return (pg/jsonb-build-object "revision" (+ v-revision 1) "rows" v-ordinal))))))))

;;
;; Publication Snapshots
;;

(defn.pg ret-trip-publication-snapshot
  "Internal review projection; callers need explicit permissions."
  [:uuid i-trip-id :text i-status]
  (let [o-publication (pg/t:get ttb/TripPublication
                        {:where {:trip i-trip-id :status i-status} :returning #{:detail :beach}})]
    (when [o-publication :is-null]
      (return nil))
    (return (|| (:-> o-publication "detail")
                (pg/jsonb-build-object "beachId" (:uuid (:->> o-publication "beach_id")))))))

(defn.pg set-trip-publication
  "The trusted API supplies the server's moderation result, never a client flag."
  [:uuid i-trip-id :uuid i-owner :jsonb i-snapshot :integer i-revision :boolean i-consent :boolean
   i-own-posts :boolean i-approved :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip
                 {:where {:id i-trip-id :owner i-owner}
                  :for [:update]
                  :returning #{:id :owner :beach :start-date :end-date :rev :audit}})
        o-snapshot (tss/as-jsonb i-snapshot)]
    (when (or [o-trip :is-null] (not (ha/is-user-active i-owner)))
      (return nil))
    (when (or (not (pg/coalesce i-consent false)) (not (pg/coalesce i-own-posts false)))
      [:raise-exception "Confirm public consent and ownership of the linked posts"])
    (let [o-rev (pg/t:get tsb/Rev
                  {:where
                   {:class-table "Trip" :class-context "Global" :id (:uuid (:->> o-trip "rev_id"))}
                   :for [:update]})
          o-active (pg/t:get ttb/TripImport
                     {:where {:trip i-trip-id :is-active true :status "complete"}})]
      (when (or (not= i-revision (:integer (:->> o-rev "index")))
                [(:uuid (:->> o-snapshot "beachId")) :is-null]
                (not= (:uuid (:->> o-snapshot "beachId")) (:uuid (:->> o-trip "beach_id"))))
        (return nil))
      (when [o-active :is-null]
        [:raise-exception "Import dives before publishing"])
      (let [o-pending (pg/t:delete ttb/TripPublication
                        {:where {:trip i-trip-id :status "pending"}})]
        (when (pg/coalesce i-approved false)
          (let [o-previous (pg/t:delete ttb/TripPublication
                             {:where {:trip i-trip-id :status "published"}})]
            (:= o-previous nil)))
        (let [(:text v-status) "pending"
              (:bigint v-time) nil]
          (when (pg/coalesce i-approved false)
            (:= v-status "published")
            (:= v-time (pg/time-us)))
          (let [o-publication (pg/t:insert ttb/TripPublication
                                {:trip i-trip-id
                                 :beach (:uuid (:->> o-snapshot "beachId"))
                                 :detail (- o-snapshot "beachId")
                                 :status v-status
                                 :public-consent true
                                 :published-at v-time}
                                {:track o-op})
                o-log (pg/t:insert tsb/AuditLog
                        {:class-table "Trip"
                         :class-context "Global"
                         :audit (:uuid (:->> o-trip "audit_id"))
                         :entry (pg/jsonb-build-object "event" "publication" "status" v-status)}
                        {:track o-op})]
            (return (pg/jsonb-build-object "id" i-trip-id "status" v-status))))))))

(defn.pg ret-trip-public
  "Only a consented published snapshot of an active member is publicly returned."
  [:uuid i-trip-id]
  (let [o-trip (pg/t:get ttb/Trip {:where {:id i-trip-id} :returning #{:id :owner}})
        o-publication (pg/t:get ttb/TripPublication
                        {:where {:trip i-trip-id :status "published" :public-consent true}
                         :returning #{:detail :beach :published-at}})
        o-data (:-> o-publication "detail")]
    (when (or [o-trip :is-null]
              [o-publication :is-null]
              (not (ha/is-user-active (:uuid (:->> o-trip "owner_id")))))
      (return nil))
    (return (pg/jsonb-build-object "id" i-trip-id
                                   "title" (:->> o-data "title")
                                   "authorName" (:->> o-data "authorName")
                                   "story" (:->> o-data "story")
                                   "beachId" (:uuid (:->> o-publication "beach_id"))
                                   "beachName" (:->> o-data "beachName")
                                   "timezone" (:->> o-data "timezone")
                                   "start" (:->> o-data "start")
                                   "end" (:->> o-data "end")
                                   "links" (:-> o-data "links")
                                   "summary" (:-> o-data "summary")
                                   "selfReported" true
                                   "publishedAt" (util/as-iso-time
                                                  (:bigint (:->> o-publication "published_at")))))))

;;
;; Moderation and Withdrawal
;;

(defn.pg review-trip-publication
  "Review tokens fence replaced snapshots; trusted callers validate admin/proofs first."
  [:uuid i-trip-id :text i-decision :text i-review-token :boolean i-ownership-checked :boolean
   i-beach-checked :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip
                 {:where {:id i-trip-id} :for [:update] :returning #{:id :owner :audit}})
        (:text v-decision) (:text (++ i-decision ttb/EnumTripReviewDecision))
        o-pending (-/ret-trip-publication-snapshot i-trip-id "pending")
        o-published (-/ret-trip-publication-snapshot i-trip-id "published")]
    (when (or [o-trip :is-null]
              [i-review-token :is-null]
              [v-decision :is-null]
              (not (ha/is-user-active (:uuid (:->> o-trip "owner_id")))))
      (return nil))
    (if (== v-decision "remove")
      (when (and (or [o-pending :is-null] (not= i-review-token (pg/md5 (:text o-pending))))
                 (or [o-published :is-null] (not= i-review-token (pg/md5 (:text o-published)))))
        (return nil))
      (when (or [o-pending :is-null] (not= i-review-token (pg/md5 (:text o-pending))))
        (return nil)))
    (when (== v-decision "approve")
      (when (or (not (pg/coalesce i-ownership-checked false))
                (not (pg/coalesce i-beach-checked false)))
        [:raise-exception "Check ownership and beach location before approving"])
      (let [o-old (pg/t:delete ttb/TripPublication {:where {:trip i-trip-id :status "published"}})
            o-approved (pg/t:update ttb/TripPublication
                         {:where {:trip i-trip-id :status "pending" :public-consent true}
                          :set {:status "published" :published-at (pg/time-us)}
                          :track o-op})]
        (when [o-approved :is-null]
          [:raise-exception "The publication no longer has public consent"])))
    (when (== v-decision "reject")
      (let [o-removed (pg/t:delete ttb/TripPublication
                        {:where {:trip i-trip-id :status "pending"}})]
        (:= o-removed nil)))
    (when (== v-decision "remove")
      (let [o-removed (pg/t:delete ttb/TripPublication {:where {:trip i-trip-id}})]
        (:= o-removed nil)))
    (let [o-log (pg/t:insert tsb/AuditLog
                  {:class-table "Trip"
                   :class-context "Global"
                   :audit (:uuid (:->> o-trip "audit_id"))
                   :entry (pg/jsonb-build-object "event" "review" "decision" v-decision)}
                  {:track o-op})]
      (return (pg/jsonb-build-object "ok" true)))))

(defn.pg withdraw-trip-publication
  [:uuid i-trip-id :uuid i-owner :jsonb o-op]
  (let [o-trip (pg/t:get ttb/Trip
                 {:where {:id i-trip-id :owner i-owner} :for [:update] :returning #{:id :audit}})]
    (when [o-trip :is-null]
      (return nil))
    (let [o-publications (pg/t:delete ttb/TripPublication {:where {:trip i-trip-id}})
          o-log (pg/t:insert tsb/AuditLog
                  {:class-table "Trip"
                   :class-context "Global"
                   :audit (:uuid (:->> o-trip "audit_id"))
                   :entry (pg/jsonb-build-object "event" "unpublish")}
                  {:track o-op})]
      (return (pg/jsonb-build-object "ok" true)))))

;;
;; Revisioned Draft Save
;;

(defn.pg update-trip-draft
  "Fences stale saves and prevents narrowing the trip past its active raw dives."
  [:uuid i-trip-id :uuid i-owner :jsonb i-draft :integer i-revision :jsonb o-op]
  (let [o-trip
        (pg/t:get ttb/Trip
          {:where {:id i-trip-id :owner i-owner} :for [:update] :returning #{:id :rev :audit}})
        o-draft (tss/as-jsonb i-draft)]
    (when (or [o-trip :is-null] (not (ha/is-user-active i-owner)))
      (return nil))
    (let [o-rev (pg/t:get tsb/Rev
                  {:where
                   {:class-table "Trip" :class-context "Global" :id (:uuid (:->> o-trip "rev_id"))}
                   :for [:update]})
          o-active (pg/t:get ttb/TripImport {:where {:trip i-trip-id :is-active true}})
          (:date v-start) (:date (:->> o-draft "start"))
          (:date v-end) (:date (:->> o-draft "end"))
          (:boolean v-before) (pg/t:exists ttb/TripDive
                                {:where {:import (:uuid (:->> o-active "id")) :day [:lt v-start]}})
          (:boolean v-after) (pg/t:exists ttb/TripDive
                               {:where {:import (:uuid (:->> o-active "id")) :day [:gt v-end]}})]
      (when (not= i-revision (:integer (:->> o-rev "index")))
        (return nil))
      (when (or v-before v-after)
        [:raise-exception "The date range must include all imported dives"])
      (let [o-updated (pg/t:update ttb/Trip
                        {:where {:id i-trip-id :owner i-owner}
                         :set {:detail (- (- (- o-draft "beachId") "start") "end")
                               :beach (:uuid (:->> o-draft "beachId"))
                               :start-date v-start
                               :end-date v-end}
                         :track o-op})
            o-version (pg/t:update tsb/Rev
                        {:where {:class-table "Trip"
                                 :class-context "Global"
                                 :id (:uuid (:->> o-trip "rev_id"))}
                         :set {:index (+ i-revision 1) :current o-draft}
                         :track o-op})
            o-history (pg/t:insert tsb/RevLog
                        {:class-table "Trip"
                         :class-context "Global"
                         :rev (:uuid (:->> o-trip "rev_id"))
                         :version (+ i-revision 1)
                         :deltas o-draft}
                        {:track o-op})
            o-log (pg/t:insert tsb/AuditLog
                    {:class-table "Trip"
                     :class-context "Global"
                     :audit (:uuid (:->> o-trip "audit_id"))
                     :entry (pg/jsonb-build-object "event" "save")}
                    {:track o-op})]
        (return (pg/jsonb-build-object "id" i-trip-id "revision" (+ i-revision 1)))))))
