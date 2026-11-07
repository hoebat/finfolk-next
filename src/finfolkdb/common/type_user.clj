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
;;                                  `--visits--> [UserCheckin] --> [Beach]
;; [User] --social relationships--> [UserConnection]
;;
;; User
;;

(deftype.pg ^{:finfolk/legacy-tables ["members"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none
                        :addons [:rev :audit :activity]})}
  User
  [:id              {:type :text :primary true}
   :profile         {:type :jsonb :required true
                     :sql {:default "{}"}}
   :deleted         {:type :boolean :required true
                     :sql {:default false}}
   :invite-eligible {:type :boolean :required true
                     :sql {:default false}}
   :joined-at       {:type :timestamptz :required true
                     :sql {:default (pg/now)}}
   :updated-at      {:type :timestamptz :required true
                     :sql {:default (pg/now)}}])

;;
;; User Relationships
;;

(deftype.pg ^{:finfolk/legacy-tables ["blocks"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  UserBlock
  [:owner  {:type :ref :required true :primary "default"
            :ref {:ns -/User} :sql {:cascade true}}
   :target {:type :ref :required true :primary "default"
            :ref {:ns -/User} :sql {:cascade true}}]
  {:constraints {:different-users (not= #{"owner_id"} #{"target_id"})}})

(deftype.pg ^{:finfolk/legacy-tables ["checkins"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  UserCheckin
  [:user           {:type :ref :required true :primary "default"
                    :ref {:ns -/User} :sql {:cascade true}}
   :beach          {:type :ref :required true :primary "default"
                    :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :visit-day      {:type :date :required true :primary "default"}
   :created-at     {:type :timestamptz :required true
                    :sql {:default (pg/now)}}
   :checked-in-at  {:type :timestamptz}
   :checked-out-at {:type :timestamptz}]
  {:constraints {:valid-checkout
                 (or [#{"checked_out_at"} :is-null]
                     (and [#{"checked_in_at"} :is-not-null]
                          (>= #{"checked_out_at"} #{"checked_in_at"})))}})


;;
;; UserConnection
;;

(deftype.pg ^{:finfolk/legacy-tables ["connections"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  UserConnection
  [:user         {:type :ref :required true :primary "default"
                  :ref {:ns -/User} :sql {:cascade true}}
   :target       {:type :ref :required true :primary "default"
                  :ref {:ns -/User} :sql {:cascade true}}
   :requested-by {:type :ref :required true
                  :ref {:ns -/User} :sql {:cascade true}}
   :status       {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumUserConnectionStatus}}
   :updated-at   {:type :timestamptz :required true
                  :sql {:default (pg/now)}}]
  {:constraints {:ordered-users (< #{"user_id"} #{"target_id"})
                 :valid-requester (or (== #{"requested_by_id"} #{"user_id"})
                                      (== #{"requested_by_id"} #{"target_id"}))}})
