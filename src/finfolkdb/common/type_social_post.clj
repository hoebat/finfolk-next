(ns finfolkdb.common.type-social-post
  "Member-submitted public post links and their reports."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-social-base :as tsoc]
            [finfolkdb.common.type-domain-enum :as tde]))

;;
;; Namespace relationships
;;
;; [User] --owns--> [SocialPost] --site--> [Beach]
;; [SocialPost] --reports--> [SocialPostReport] --reporter/reviewer--> [User]
;; [SocialPost] --addons--> [Rev / Audit]; public consent remains explicit.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-social-base :as tsoc]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; SocialPost
;;

(deftype.pg ^{:finfolk/legacy-tables ["posts"]
              :final true
              :! (et/E {:class :0d/entry :addons [:rev :audit]})}
  SocialPost
  "A public link requiring both moderation approval and current public consent."
  [:owner            {:type :ref :required true
                      :ref {:ns finfolkdb.common.type-user/User}
                      :sql {:cascade true :index true :unique ["post_owner_url"]}}
   :beach            {:type :ref :required true
                      :ref {:ns finfolkdb.common.type-system-site/Beach}
                      :sql {:index true :unique ["post_owner_url"]}}
   :url              {:type :text :required true :sql {:unique ["post_owner_url"]}}
   :platform         {:type :enum :required true
                      :enum {:ns finfolkdb.common.type-social-base/EnumSocialHandleType}}
   :creator-handle   {:type :text :required true :sql {:default ""}}
   :status           {:type :enum :required true
                      :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialPostStatus}
                      :sql {:default "pending" :index true}}
   :public-consent   {:type :boolean :required true :sql {:default false}}
   :rejection-reason {:type :text :required true :sql {:default ""}}
   :reviewed-by      {:type :ref
                      :ref {:ns finfolkdb.common.type-user/User}
                      :sql {:raw [:on-delete-set-null]}}
   :reviewed-at      {:type :timestamptz}])

;;
;; SocialPostReport
;;

(deftype.pg ^{:finfolk/legacy-tables ["post_reports"]
              :final true
              :! (et/E {:class :0d/entry})}
  SocialPostReport
  [:post        {:type :ref :required true :ref {:ns -/SocialPost}
                 :sql {:cascade true :unique ["post_reporter"]}}
   :reporter    {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-user/User}
                 :sql {:cascade true :unique ["post_reporter"]}}
   :reason      {:type :text :required true}
   :status      {:type :enum :required true
                 :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialPostReportStatus}
                 :sql {:default "open" :index true}}
   :resolved-by {:type :ref
                 :ref {:ns finfolkdb.common.type-user/User}
                 :sql {:raw [:on-delete-set-null]}}
   :resolved-at {:type :timestamptz}]
  {:constraints {:bounded-reason (and (>= (pg/length #{"reason"}) 1)
                                     (<= (pg/length #{"reason"}) 1000))}})

;;
;; SocialReferral
;;

(deftype.pg ^{:finfolk/legacy-tables ["community_referrals"]
              :final true
              :! (et/E {:class :0d/entry :id :id/none :track :track/none})}
  SocialReferral
  [:day      {:type :date :required true :primary "default"
              :sql {:default (:date (#{"timezone"} "Australia/Sydney" (pg/now)))}}
   :platform {:type :enum :required true :primary "default"
              :enum {:ns finfolkdb.common.type-social-base/EnumSocialHandleType}}
   :clicks   {:type :bigint :required true :sql {:default 0}}])
