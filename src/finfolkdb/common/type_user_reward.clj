(ns finfolkdb.common.type-user-reward
  "Member invitations, anti-abuse rate limits and the reversible points ledger."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-social-instagram :as tsi]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-social-instagram :as tsi]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; UserInvitation
;;

(deftype.pg ^{:finfolk/legacy-tables ["invitations"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserInvitation
  [:code         {:type :text :required true
                  :sql {:unique ["entity_key"]}}
   :inviter      {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-user/User}
                  :sql {:cascade true :unique ["inviter"]}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; UserInvitationJoin
;;

(deftype.pg ^{:finfolk/legacy-tables ["invitation_joins"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserInvitationJoin
  [:invitee            {:type :ref :required true
                        :ref {:ns finfolkdb.common.type-user/User}
                        :sql {:cascade true :unique ["entity_key"]}}
   :inviter            {:type :ref :required true
                        :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :verified-sender-id {:type :text
                        :sql {:unique ["verified_sender"]}}
   :rewarded-at        {:type :long}
   :time-created       {:type :long :required true
                        :sql {:default (pg/time-us)}}]
  {:constraints {:check-0 (not= #{"invitee_id"} #{"inviter_id"})}})

;;
;; UserPointsEntry
;;

(deftype.pg ^{:finfolk/legacy-tables ["points_ledger"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  UserPointsEntry
  [:user         {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-user/User}
                  :sql {:cascade true :unique ["user_day"]}}
   :action       {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-social-instagram/InstagramAction}
                  :sql {:unique ["action"]}}
   :day          {:type :date :required true
                  :sql {:unique ["user_day"]}}
   :points       {:type :integer :required true
                  :sql {:default 1}}
   :reversed     {:type :boolean :required true
                  :sql {:default false}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}]
  {:constraints {:check-0 (== #{"points"} 1)}})

;;
;; UserRequestLimit
;;

(deftype.pg ^{:finfolk/legacy-tables ["request_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  UserRequestLimit
  [:user   {:type :ref :required true
            :ref {:ns finfolkdb.common.type-user/User}
            :sql {:cascade true :unique ["entity_key"]}}
   :minute {:type :long :required true}
   :count  {:type :integer :required true}])
