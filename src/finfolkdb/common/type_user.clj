(ns finfolkdb.common.type-user
  "Capitalized, linked entities for the fresh database."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-domain-enum :as tde]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Namespace relationships
;;
;; [managed auth] --identity--> [User] --relationships--> [UserBlock]
;;                                  `--visits--> [UserCheckin] --> [Site]
;; [User] --social relationships--> [UserConnection]
;;
;; User
;;

(deftype.pg ^{:finfolk/legacy-tables ["members"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none
                        :addons [:rev :audit :activity]})}
  User
  [:handle          {:type :text :sql {:unique ["public_handle"]}}
   :profile         {:type :jsonb :required true
                     :sql {:default "{}"}}
   :deleted         {:type :boolean :required true
                     :sql {:default false}}
   :email-verified {:type :boolean :required true :sql {:default false}}
   :deletion-state  {:type :text :required true :sql {:default "active"}}
   :invite-eligible {:type :boolean :required true
                     :sql {:default false}}
   :joined-at       {:type :long :required true
                     :sql {:default (pg/time-us)}}
   :time-updated    {:type :long :required true
                     :sql {:default (pg/time-us)}}]
  {:constraints {:canonical-public-handle
    (or [#{"handle"} :is-null]
        (and (== #{"handle"} (pg/lower #{"handle"}))
             (#{"regexp_like"} #{"handle"} "^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$")))}})

;;
;; User Relationships
;;

(deftype.pg ^{:finfolk/legacy-tables ["blocks"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserBlock
  [:owner  {:type :ref :required true
            :ref {:ns -/User} :sql {:cascade true :unique ["entity_key"]}}
   :target {:type :ref :required true
            :ref {:ns -/User} :sql {:cascade true :unique ["entity_key"]}}]
  {:constraints {:different-users (not= #{"owner_id"} #{"target_id"})}})

(deftype.pg ^{:finfolk/legacy-tables ["checkins"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserCheckin
  [:user           {:type :ref :required true
                    :ref {:ns -/User} :sql {:cascade true :unique ["entity_key"]}}
   :site          {:type :ref :required true
                    :ref {:ns finfolkdb.common.type-system-site/Site}
                    :sql {:unique ["entity_key"]}}
   :visit-day      {:type :date :required true
                    :sql {:unique ["entity_key"]}}
   :time-created   {:type :long :required true
                    :sql {:default (pg/time-us)}}
   :checked-in-at  {:type :long}
   :checked-out-at {:type :long}]
  {:constraints {:valid-checkout (or [#{"checked_out_at"} :is-null]
                                     (and [#{"checked_in_at"} :is-not-null]
                                          (>= #{"checked_out_at"} #{"checked_in_at"})))}})


;;
;; UserConnection
;;


(deftype.pg ^{:finfolk/legacy-tables ["connections"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserConnection
  [:user         {:type :ref :required true
                  :ref {:ns -/User} :sql {:cascade true :unique ["entity_key"]}}
   :target       {:type :ref :required true
                  :ref {:ns -/User} :sql {:cascade true :unique ["entity_key"]}}
   :requested-by {:type :ref :required true
                  :ref {:ns -/User} :sql {:cascade true}}
   :status       {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumUserConnectionStatus}}
   :time-updated {:type :long :required true
                  :sql {:default (pg/time-us)}}]
  {:constraints {:ordered-users (< #{"user_id"} #{"target_id"})
                 :valid-requester (or (== #{"requested_by_id"} #{"user_id"})
                                      (== #{"requested_by_id"} #{"target_id"}))}})

;; Granted by trusted administration, never derived from user-editable profiles.
(deftype.pg ^{:final true
              :! (et/E {:class :0d/entry :track :track/none :access :none})}
  UserRole
  [:user {:type :ref :required true :ref {:ns -/User} :sql {:cascade true :unique ["user_role"]}}
   :role {:type :text :required true :sql {:unique ["user_role"]}}]
  {:constraints {:known-role (or (== #{"role"} "admin") (== #{"role"} "moderator"))}})

;; Feature switches are domain policy; provider credentials stay outside the DB.
(deftype.pg ^{:final true
              :! (et/E {:class :0d/entry :track :track/none :access :none})}
  ApplicationFeature
  [:key {:type :text :required true :sql {:unique ["key"]}}
   :enabled {:type :boolean :required true :sql {:default false}}])
