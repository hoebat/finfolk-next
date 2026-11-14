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
                        :track  :track/none
                        :access :none})}
  InstagramSource
  [:key          {:type :text :required true
                  :sql {:unique ["entity_key"]}}
   :kind         {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramSourceType}}
   :data         {:type :jsonb :required true
                  :sql {:default "{}"}}
   :checkpoint   {:type :text}
   :last-success {:type :long}
   :next-at      {:type :long :required true
                  :sql {:default (pg/time-us)}}
   :lease-until  {:type :long}
   :failures     {:type :integer :required true
                  :sql {:default 0}}
   :status       {:type :text :required true
                  :sql {:default "ready"}}])

;;
;; InstagramSuppressedSource
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_suppressed_sources"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramSuppressedSource
  [:author-id    {:type :text :required true
                  :sql {:unique ["entity_key"]}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; InstagramAction
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_actions"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramAction
  [:source-id        {:type :text :required true
                      :sql {:unique ["source_kind"]}}
   :owner            {:type :ref
                      :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :sender-id        {:type :text}
   :kind             {:type :enum :required true
                      :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramActionType}
                      :sql {:unique ["source_kind"]}}
   :state            {:type :text :required true
                      :sql {:default "review"}}
   :data             {:type :jsonb :required true
                      :sql {:default "{}"}}
   :member-confirmed {:type :boolean :required true
                      :sql {:default false}}
   :session          {:type :ref
                      :ref {:ns finfolkdb.common.type-logbook-base/DiveSession}}
   :time-created     {:type :long :required true
                      :sql {:default (pg/time-us)}}
   :time-updated     {:type :long :required true
                      :sql {:default (pg/time-us)}}])

;;
;; InstagramAudit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_audit"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramAudit
  [:action       {:type :ref
                  :ref {:ns finfolkdb.common.type-social-instagram/InstagramAction}
                  :sql {:cascade true}}
   :actor        {:type :text :required true}
   :event        {:type :text :required true}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; InstagramConnection
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connections"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramConnection
  [:user             {:type :ref :required true
                      :ref {:ns finfolkdb.common.type-user/User}
                      :sql {:cascade true :unique ["entity_key"]}}
   :handle           {:type :text :required true}
   :sender-id        {:type :text}
   :status           {:type :text :required true
                      :sql {:default "pending"}}
   :challenge-hash   {:type :text}
   :expires-at       {:type :long}
   :public-points    {:type :boolean :required true
                      :sql {:default false}}
   :time-updated     {:type :long :required true
                      :sql {:default (pg/time-us)}}
   :share-posts      {:type :boolean :required true
                      :sql {:default false}}
   :media-owner-id   {:type :text}
   :provider-scope   {:type :text :required true
                      :sql {:default "facebook-login:legacy"}}
   :identity-version {:type :uuid :required true
                      :sql {:default (pg/gen-random-uuid)}}])

;;
;; InstagramClaim
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_claims"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramClaim
  [:user                {:type :ref :required true
                         :ref {:ns finfolkdb.common.type-user/User}
                         :sql {:cascade true :unique ["entity_key"]}}
   :code-hash           {:type :text
                         :sql {:unique ["code_hash"]}}
   :state               {:type :enum :required true
                         :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramClaimStatus}
                         :sql {:default "waiting"}}
   :sender-id           {:type :text}
   :handle              {:type :text}
   :error               {:type :text :required true
                         :sql {:default ""}}
   :expires-at          {:type :long :required true}
   :follow-checked-at   {:type :long}
   :review-requested-at {:type :long}
   :verified-by         {:type :text}
   :time-created        {:type :long :required true
                         :sql {:default (pg/time-us)}}
   :time-updated        {:type :long :required true
                         :sql {:default (pg/time-us)}}
   :claim-id            {:type :uuid :required true
                         :sql {:default (pg/gen-random-uuid) :unique ["claim"]}}
   :provider-scope      {:type :text :required true
                         :sql {:default "facebook-login:legacy"}}])

;;
;; InstagramCommentIdentity
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_comment_identities"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramCommentIdentity
  [:user               {:type :ref :required true
                        :ref {:ns finfolkdb.common.type-user/User}
                        :sql {:cascade true :unique ["entity_key"]}}
   :namespace          {:type :text :required true
                        :sql {:unique ["namespace_actor"]}}
   :actor-id           {:type :text
                        :sql {:unique ["namespace_actor"]}}
   :sender-id          {:type :text :required true}
   :handle             {:type :text :required true}
   :challenge-hash     {:type :text
                        :sql {:unique ["challenge_hash"]}}
   :expires-at         {:type :long}
   :time-updated       {:type :long :required true
                        :sql {:default (pg/time-us)}}
   :connection-scope   {:type :text :required true
                        :sql {:default "facebook-login:legacy"}}
   :connection-version {:type :uuid}])

;;
;; InstagramDiscovery
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_discoveries"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramDiscovery
  [:media-id     {:type :text
                  :sql {:unique ["media"]}}
   :url          {:type :text :required true
                  :sql {:unique ["url"]}}
   :owner        {:type :ref
                  :ref {:ns finfolkdb.common.type-user/User} :sql {:raw [:on-delete-set-null]}}
   :author-id    {:type :text}
   :author       {:type :text}
   :beach        {:type :ref
                  :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :candidates   {:type :jsonb :required true
                  :sql {:default "[]"}}
   :caption      {:type :text :required true
                  :sql {:default ""}}
   :posted-at    {:type :long}
   :state        {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramDiscoveryStatus}
                  :sql {:default "pending"}}
   :automatic    {:type :boolean :required true
                  :sql {:default false}}
   :sources      {:type :jsonb :required true
                  :sql {:default "[]"}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}
   :time-updated {:type :long :required true
                  :sql {:default (pg/time-us)}}
   :checked-at   {:type :long}]
  {:constraints {:check-0 (or [#{"media_id"} :is-null]
                              (#{"regexp_like"} #{"media_id"} "^[0-9]{1,40}$"))}})

;;
;; InstagramDiscoveryAudit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_discovery_audit"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramDiscoveryAudit
  [:discovery    {:type :ref
                  :ref {:ns finfolkdb.common.type-social-instagram/InstagramDiscovery}
                  :sql {:cascade true}}
   :actor        {:type :text :required true}
   :event        {:type :text :required true}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; InstagramPostReport
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_post_reports"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramPostReport
  [:discovery    {:type :ref :required true
                  :ref {:ns finfolkdb.common.type-social-instagram/InstagramDiscovery}
                  :sql {:cascade true :unique ["discovery_reason_day"]}}
   :reason       {:type :enum :required true
                  :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramPostReportReason}
                  :sql {:unique ["discovery_reason_day"]}}
   :day          {:type :date :required true
                  :sql {:default (:date (pg/to-timestamp (/ (pg/time-us) 1000000.0)))
                        :unique ["discovery_reason_day"]}}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; InstagramCommand
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_commands"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramCommand
  [:key             {:type :text
                     :sql {:unique ["key"]}}
   :context         {:type :enum :required true
                     :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandContext}}
   :actor-id        {:type :text :required true}
   :namespace       {:type :text :required true}
   :media-id        {:type :text}
   :owner           {:type :ref
                     :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :command         {:type :text :required true}
   :args            {:type :jsonb :required true
                     :sql {:default "{}"}}
   :source-url      {:type :text}
   :comment-at      {:type :long}
   :received-at     {:type :long :required true
                     :sql {:default (pg/time-us)}}
   :state           {:type :enum :required true
                     :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandStatus}
                     :sql {:default "new"}}
   :result          {:type :text}
   :beach           {:type :ref
                     :ref {:ns finfolkdb.common.type-system-site/Beach}}
   :visit-day       {:type :date}
   :reply           {:type :text}
   :send-state      {:type :enum :required true
                     :enum {:ns finfolkdb.common.type-domain-enum/EnumInstagramCommandSendState}
                     :sql {:default "pending"}}
   :reply-id        {:type :text}
   :time-updated    {:type :long :required true
                     :sql {:default (pg/time-us)}}
   :send-started-at {:type :long}])

;;
;; InstagramEvent
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_events"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramEvent
  [:key          {:type :text
                  :sql {:unique ["key"]}}
   :payload      {:type :jsonb :required true}
   :status       {:type :text :required true
                  :sql {:default "queued"}}
   :attempts     {:type :integer :required true
                  :sql {:default 0}}
   :error        {:type :text}
   :time-created {:type :long :required true
                  :sql {:default (pg/time-us)}}
   :time-updated {:type :long :required true
                  :sql {:default (pg/time-us)}}])

;;
;; InstagramDmLimit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_dm_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramDmLimit
  [:sender-id   {:type :text :required true
                 :sql {:unique ["entity_key"]}}
   :minute      {:type :long :required true
                 :sql {:default (* (pg/div (pg/time-us) 60000000) 60000000)}}
   :count       {:type :integer :required true
                 :sql {:default 0}}
   :prompted-at {:type :long}])

;;
;; InstagramConnectCode
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connect_codes"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/v4
                        :track  :track/none
                        :access :none})}
  InstagramConnectCode
  [:code-hash        {:type :text :required true
                      :sql {:unique ["code_hash"]}}
   :sender-id        {:type :text :required true}
   :handle           {:type :text :required true}
   :provider-scope   {:type :text :required true}
   :generation       {:type :integer :required true}
   :event            {:type :ref :required true
                      :ref {:ns finfolkdb.common.type-messaging-base/MessagingReceipt}
                      :sql {:cascade true :unique ["event"]}}
   :expires-at       {:type :long :required true
                      :sql {:default (+ (pg/time-us) 600000000)}}
   :invalidated      {:type :boolean :required true
                      :sql {:default false}}
   :consumed-by      {:type :ref
                      :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :consumed-version {:type :uuid}
   :consumed-at      {:type :long}
   :time-created     {:type :long :required true
                      :sql {:default (pg/time-us)}}])

;;
;; InstagramConnectLimit
;;

(deftype.pg ^{:finfolk/legacy-tables ["instagram_connect_limits"]
              :final true
              :! (et/E {:class  :0d/entry
                        :track  :track/none
                        :access :none})}
  InstagramConnectLimit
  [:bucket    {:type :text :required true
               :sql {:unique ["entity_key"]}}
   :count     {:type :integer :required true}
   :resets-at {:type :long :required true}])
