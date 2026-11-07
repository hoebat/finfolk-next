(ns finfolkdb.common.type-social-instagram
  "Instagram account proofs, provider inbox records, discoveries and moderation."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-messaging-base :as tmb]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-logbook-base :as tlb]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-system-site :as tss]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-messaging-base :as tmb]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-logbook-base :as tlb]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-system-site :as tss]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; InstagramSource
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramSource
  [:key {:type :text :required true :primary true}
   :kind {:type :enum :required true
          :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramSourceType}}
   :data {:type :jsonb :required true :sql {:default "{}"}}
   :checkpoint {:type :text}
   :last-success {:type :timestamptz}
   :next-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :lease-until {:type :timestamptz}
   :failures {:type :integer :required true :sql {:default 0}}
   :status {:type :text :required true :sql {:default "ready"}}])

;;
;; InstagramSuppressedSource
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_suppressed_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramSuppressedSource
  [:author-id {:type :text :required true :primary true}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramAction
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_actions"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramAction
  [:id {:type :uuid :required true :primary true :sql {:default (pg/gen-random-uuid)}}
   :source-id {:type :text :required true :sql {:unique ["source_kind"]}}
   :owner {:type :ref :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :sender-id {:type :text}
   :kind {:type :enum :required true
          :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramActionType}
          :sql {:unique ["source_kind"]}}
   :state {:type :text :required true :sql {:default "review"}}
   :data {:type :jsonb :required true :sql {:default "{}"}}
   :member-confirmed {:type :boolean :required true :sql {:default false}}
   :session {:type :ref :ref {:ns finfolkdb.common.type-logbook-base/DiveSession}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramAudit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_audit"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramAudit
  [:id {:type :bigint :required true :primary true
        :sql {:raw [:generated :always :as :identity]}}
   :action {:type :ref
            :ref {:ns finfolkdb.common.type-social-instagram/InstagramAction}
            :sql {:cascade true}}
   :actor {:type :text :required true}
   :event {:type :text :required true}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramConnection
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connections"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramConnection
  [:user {:type :ref :required true
          :ref {:ns finfolkdb.common.type-user/User} :primary true
          :sql {:cascade true}}
   :handle {:type :text :required true}
   :sender-id {:type :text}
   :status {:type :text :required true :sql {:default "pending"}}
   :challenge-hash {:type :text}
   :expires-at {:type :timestamptz}
   :public-points {:type :boolean :required true :sql {:default false}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :share-posts {:type :boolean :required true :sql {:default false}}
   :media-owner-id {:type :text}
   :provider-scope {:type :text :required true :sql {:default "facebook-login:legacy"}}
   :identity-version {:type :uuid :required true :sql {:default (pg/gen-random-uuid)}}])

;;
;; InstagramClaim
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_claims"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramClaim
  [:user {:type :ref :required true
          :ref {:ns finfolkdb.common.type-user/User} :primary true
          :sql {:cascade true}}
   :code-hash {:type :text :sql {:unique ["code_hash"]}}
   :state {:type :enum :required true
           :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus}
           :sql {:default "waiting"}}
   :sender-id {:type :text}
   :handle {:type :text}
   :error {:type :text :required true :sql {:default ""}}
   :expires-at {:type :timestamptz :required true}
   :follow-checked-at {:type :timestamptz}
   :review-requested-at {:type :timestamptz}
   :verified-by {:type :text}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :claim-id {:type :uuid :required true :sql {:default (pg/gen-random-uuid) :unique ["claim"]}}
   :provider-scope {:type :text :required true :sql {:default "facebook-login:legacy"}}])

;;
;; InstagramCommentIdentity
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_comment_identities"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramCommentIdentity
  [:user {:type :ref :required true
          :ref {:ns finfolkdb.common.type-user/User} :primary true
          :sql {:cascade true}}
   :namespace {:type :text :required true :sql {:unique ["namespace_actor"]}}
   :actor-id {:type :text :sql {:unique ["namespace_actor"]}}
   :sender-id {:type :text :required true}
   :handle {:type :text :required true}
   :challenge-hash {:type :text :sql {:unique ["challenge_hash"]}}
   :expires-at {:type :timestamptz}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :connection-scope {:type :text :required true :sql {:default "facebook-login:legacy"}}
   :connection-version {:type :uuid}])

;;
;; InstagramDiscovery
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_discoveries"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramDiscovery
  [:id {:type :uuid :required true :primary true :sql {:default (pg/gen-random-uuid)}}
   :media-id {:type :text :sql {:unique ["media"]}}
   :url {:type :text :required true :sql {:unique ["url"]}}
   :owner {:type :ref
           :ref {:ns finfolkdb.common.type-user/User}
           :sql {:raw [:on-delete-set-null]}}
   :author-id {:type :text}
   :author {:type :text}
   :beach {:type :ref :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :candidates {:type :jsonb :required true :sql {:default "[]"}}
   :caption {:type :text :required true :sql {:default ""}}
   :posted-at {:type :timestamptz}
   :state {:type :enum :required true
           :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus}
           :sql {:default "pending"}}
   :automatic {:type :boolean :required true :sql {:default false}}
   :sources {:type :jsonb :required true :sql {:default "[]"}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :checked-at {:type :timestamptz}]
  {:constraints {:check-0 (or [#{"media_id"} :is-null] (#{"regexp_like"} #{"media_id"} "^[0-9]{1,40}$"))}})

;;
;; InstagramDiscoveryAudit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_discovery_audit"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramDiscoveryAudit
  [:id {:type :bigint :required true :primary true
        :sql {:raw [:generated :always :as :identity]}}
   :discovery {:type :ref
               :ref {:ns finfolkdb.common.type-social-instagram/InstagramDiscovery}
               :sql {:cascade true}}
   :actor {:type :text :required true}
   :event {:type :text :required true}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramPostReport
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_post_reports"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramPostReport
  [:id {:type :bigint :required true :primary true
        :sql {:raw [:generated :always :as :identity]}}
   :discovery {:type :ref :required true
               :ref {:ns finfolkdb.common.type-social-instagram/InstagramDiscovery}
               :sql {:cascade true :unique ["discovery_reason_day"]}}
   :reason {:type :enum :required true
            :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason}
            :sql {:unique ["discovery_reason_day"]}}
   :day {:type :date :required true :sql {:default (:date (pg/now)) :unique ["discovery_reason_day"]}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramCommand
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_commands"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramCommand
  [:id {:type :text :required true :primary true}
   :context {:type :enum :required true
             :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandContext}}
   :actor-id {:type :text :required true}
   :namespace {:type :text :required true}
   :media-id {:type :text}
   :owner {:type :ref :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :command {:type :text :required true}
   :args {:type :jsonb :required true :sql {:default "{}"}}
   :source-url {:type :text}
   :comment-at {:type :timestamptz}
   :received-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :state {:type :enum :required true
           :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus}
           :sql {:default "new"}}
   :result {:type :text}
   :beach {:type :ref :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :visit-day {:type :date}
   :reply {:type :text}
   :send-state {:type :enum :required true
                :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState}
                :sql {:default "pending"}}
   :reply-id {:type :text}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :send-started-at {:type :timestamptz}])

;;
;; InstagramEvent
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_events"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramEvent
  [:id {:type :text :required true :primary true}
   :payload {:type :jsonb :required true}
   :status {:type :text :required true :sql {:default "queued"}}
   :attempts {:type :integer :required true :sql {:default 0}}
   :error {:type :text}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramDmLimit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_dm_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramDmLimit
  [:sender-id {:type :text :required true :primary true}
   :minute {:type :timestamptz :required true
            :sql {:default (#{"date_trunc"} "minute" (pg/now))}}
   :count {:type :integer :required true :sql {:default 0}}
   :prompted-at {:type :timestamptz}])

;;
;; InstagramConnectCode
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connect_codes"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramConnectCode
  [:id {:type :uuid :required true :primary true :sql {:default (pg/gen-random-uuid)}}
   :code-hash {:type :text :required true :sql {:unique ["code_hash"]}}
   :sender-id {:type :text :required true}
   :handle {:type :text :required true}
   :provider-scope {:type :text :required true}
   :generation {:type :integer :required true}
   :event {:type :ref :required true
           :ref {:ns finfolkdb.common.type-messaging-base/MessagingReceipt}
           :sql {:cascade true :unique ["event"]}}
   :expires-at {:type :timestamptz :required true
                :sql {:default (+ (pg/now) (:interval "10 minutes"))}}
   :invalidated {:type :boolean :required true :sql {:default false}}
   :consumed-by {:type :ref :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :consumed-version {:type :uuid}
   :consumed-at {:type :timestamptz}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

;;
;; InstagramConnectLimit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connect_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  InstagramConnectLimit
  [:bucket {:type :text :required true :primary true}
   :count {:type :integer :required true}
   :resets-at {:type :timestamptz :required true}])
