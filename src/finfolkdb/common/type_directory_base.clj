(ns finfolkdb.common.type-directory-base
  "Directory entities with shared access, audit, revision and social addons."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-user-access :as tua]
            [finfolkdb.common.type-social-base :as tsoc]
            [finfolkdb.common.type-domain-enum :as tde]))

;;
;; Namespace relationships
;;
;; [DirectoryListing] --addons--> [Access / Audit / Rev / Social]
;;     |--reports--> [DirectoryReport] --author--> [User]
;;     `--claims / admins / invitations--> [AccessRequest / AccessRole / Invites]
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-user-access :as tua]
             [finfolkdb.common.type-social-base :as tsoc]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; DirectoryListing
;;

(deftype.pg ^{:finfolk/legacy-tables ["directory_listings"]
              :final true
              :! (et/E {:class  :0d/entry
                        :addons [:detail :rev :audit :access :social]})}
  DirectoryListing
  "A claimable directory page. Ownership and admins are access roles."
  [:status      {:type :enum :required true
                 :enum {:ns finfolkdb.common.type-domain-enum/EnumDirectoryListingStatus}
                 :sql {:default "candidate" :index true}}
   :reviewed-at {:type :long}
   :outreach    {:type :text :required true
                 :sql {:default "Not contacted"}}
   :notes       {:type :text :required true
                 :sql {:default ""}}])

;;
;; DirectoryReport
;;

(deftype.pg ^{:finfolk/legacy-tables ["directory_reports"] :final true :! (et/E {:class :0d/entry})}
  DirectoryReport
  [:listing  {:type :ref :required true
              :ref {:ns -/DirectoryListing} :sql {:index true}}
   :author   {:type :ref
              :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :message  {:type :text :required true}
   :resolved {:type :boolean :required true
              :sql {:default false}}])

;;
;; DirectoryRun
;;

(deftype.pg ^{:finfolk/legacy-tables ["directory_runs"]
              :final true
              :! (et/E {:class  :0d/entry
                        :addons [:log]})}
  DirectoryRun
  "A discovery run. Its worker-defined status remains open-ended."
  [:query  {:type :text :required true}
   :status {:type :text :required true
            :sql {:default "running"}}
   :error  {:type :text :required true
            :sql {:default ""}}])
