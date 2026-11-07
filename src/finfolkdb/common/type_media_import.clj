(ns finfolkdb.common.type-media-import
  "Owned provider media, optionally assigned to a dive session."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-logbook-base :as tlb]
            [finfolkdb.common.type-domain-enum :as tde]))

;;
;; Namespace relationships
;;
;; [User] --owns--> [MediaImport] --site--> [Beach]
;; [MediaImport] --assignment--> [DiveSession]; the owner must match the session owner.
;; provider-id and assignment-key are external identity/idempotency values.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-logbook-base :as tlb]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(deftype.pg ^{:finfolk/legacy-tables ["media_imports"]
              :final true
              :! (et/E {:class :0d/entry})}
  MediaImport
  [:owner          {:type :ref :required true
                    :ref {:ns finfolkdb.common.type-user/User}
                    :foreign {:session-owner {:ns finfolkdb.common.type-logbook-base/DiveSession
                                              :column :owner-id}}
                    :sql {:raw [:on-delete-cascade] :index true :unique ["provider_media"]}}
   :platform       {:type :enum :required true
                    :enum {:ns finfolkdb.common.type-domain-enum/EnumMediaImportPlatform}
                    :sql {:unique ["provider_media"]}}
   :provider-id    {:type :text :required true :sql {:unique ["provider_media"]}}
   :url            {:type :text :required true}
   :kind           {:type :text :required true :sql {:default "post"}}
   :posted-at      {:type :timestamptz}
   :day            {:type :date}
   :beach          {:type :ref :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :location-name  {:type :text :required true :sql {:default ""}}
   :candidates     {:type :jsonb :required true :sql {:default "[]"}}
   :notes          {:type :text :required true :sql {:default ""}}
   :session        {:type :ref
                    :ref {:ns finfolkdb.common.type-logbook-base/DiveSession}
                    :foreign {:session-owner {:ns finfolkdb.common.type-logbook-base/DiveSession
                                              :column :id}}
                    :sql {:raw [:on-delete-set-null]}}
   :status         {:type :enum :required true
                    :enum {:ns finfolkdb.common.type-domain-enum/EnumMediaImportStatus}
                    :sql {:default "active"}}
   :edited         {:type :boolean :required true :sql {:default false}}
   :assignment-key {:type :uuid}]
  {:constraints {:array-candidates (== (pg/jsonb-typeof #{"candidates"}) "array")}})
