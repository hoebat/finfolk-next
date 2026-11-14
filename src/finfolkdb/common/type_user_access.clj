(ns finfolkdb.common.type-user-access
  "Shared access providers, roles, requests and invitations."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]))

;;
;; Namespace relationships
;;
;; [addon owner] --2D addon--> [Access] --owner--> [AccessRole / AccessRequest]
;;                                    `-------> [AccessInviteExternal / Email]
;; [roles / requests / invitations] --member/from/reply--> [User]
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Access
;;

(defenum.pg EnumAccessSetting [:public :open :closed])

(deftype.pg ^{:final true
              :! (et/E {:class    :2d/base
                        :access   :access/system
                        :provides {:priority 63
                                   :key      :access}
                        :columns  {:class-ref {:type :uuid}}})}
  Access
  "Access policy scoped by owning entity and context."
  [:setting {:type :enum :required true
             :enum {:ns -/EnumAccessSetting} :sql {:default "closed"}}])

;;
;; AccessRole
;;

(defenum.pg EnumAccessRoleLevel [:owner :admin :deleted :member])

(deftype.pg ^{:finfolk/legacy-tables ["directory_page_admins"]
              :final true
              :! (et/E {:class   :2d/entry
                        :owner   -/Access
                        :addons  [:is-active :is-public]
                        :columns {:class-table   {:sql {:unique ["entity_key"]}}
                                  :class-context {:sql {:unique ["entity_key"]}}
                                  :access        {:sql {:unique ["entity_key"]}}}})}
  AccessRole
  [:member {:type :ref :required true
            :ref {:ns finfolkdb.common.type-user/User}
            :sql {:cascade true :index true :unique ["entity_key"]}}
   :from   {:type :ref
            :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :level  {:type :enum :required true
            :enum {:ns -/EnumAccessRoleLevel} :sql {:default "member"}}
   :scope  {:type :jsonb :required true
            :sql {:default "{}"}}])

;;
;; AccessRequest
;;

(defenum.pg EnumAccessRequestStatus [:pending :cancelled :rejected :accepted])

(deftype.pg ^{:finfolk/legacy-tables ["directory_claims"]
              :final true
              :! (et/E {:class  :2d/entry
                        :owner  -/Access
                        :addons [:detail :log]})}
  AccessRequest
  "A request to own or administer an entity. Proof belongs to its detail payload."
  [:from       {:type :ref :required true
                :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :reply      {:type :ref
                :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :status     {:type :enum :required true
                :enum {:ns -/EnumAccessRequestStatus} :sql {:default "pending"}}
   :expires-at {:type :long :required true
                :sql {:default (+ (pg/time-us) 604800000000)}}])

;;
;; AccessInviteExternal
;;

(defenum.pg EnumAccessInviteExternalStatus [:pending :expired :rejected :accepted])

(deftype.pg ^{:finfolk/legacy-tables ["directory_page_invites"]
              :final true
              :! (et/E {:class  :2d/entry
                        :owner  -/Access
                        :addons [:detail :log]})}
  AccessInviteExternal
  "A single-use invitation. secret stores only the token hash."
  [:secret      {:type :text :required true :unique true :scope :-/hidden}
   :from        {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :reply       {:type :ref
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :status      {:type :enum :required true
                 :enum {:ns -/EnumAccessInviteExternalStatus} :sql {:default "pending"}}
   :expires-at  {:type :long :required true
                 :sql {:default (+ (pg/time-us) 604800000000)}}
   :accepted-at {:type :long}])

;;
;; AccessInviteEmail
;;

(defenum.pg EnumAccessInviteEmailStatus [:pending :expired :rejected :accepted])

(deftype.pg ^{:finfolk/legacy-tables ["event_invites"]
              :final true
              :! (et/E {:class  :2d/entry
                        :owner  -/Access
                        :addons [:detail :log]})}
  AccessInviteEmail
  "An email-bound invitation. secret stores only the token hash."
  [:email       {:type :text :required true}
   :secret      {:type :text :required true :unique true :scope :-/hidden}
   :from        {:type :ref
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :reply       {:type :ref
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :status      {:type :enum :required true
                 :enum {:ns -/EnumAccessInviteEmailStatus} :sql {:default "pending"}}
   :expires-at  {:type :long :required true}
   :accepted-at {:type :long}])

;;
;; Access Indexes
;;

(defrun.pg __access_indexes__
  [:create-unique-index :if-not-exists #{"AccessRoleOwner"} :on -/AccessRole
   (>-< [#{"class_table"} #{"class_context"} #{"access_id"}]) :where
   (and (== #{"level"} "owner") (== #{"is_active"} true))]
  [:create-unique-index :if-not-exists #{"AccessRequestPending"} :on -/AccessRequest
   (>-< [#{"class_table"} #{"class_context"} #{"access_id"} #{"from_id"}]) :where
   (== #{"status"} "pending")])
