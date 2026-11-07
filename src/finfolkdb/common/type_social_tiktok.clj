(ns finfolkdb.common.type-social-tiktok
  "Private TikTok account credentials and import synchronization state."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-domain-enum :as tde]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-domain-enum :as tde]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; TiktokConnection
;;

(deftype.pg ^{:finfolk/legacy-tables ["tiktok_connections"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  TiktokConnection
  [:user {:type :ref :required true
          :ref {:ns finfolkdb.common.type-user/User} :primary true
          :sql {:cascade true}}
   :app-id {:type :text :required true :sql {:unique ["app_open"]}}
   :open-id {:type :text :sql {:unique ["app_open"]}}
   :display-name {:type :text :required true :sql {:default ""}}
   :status {:type :enum :required true
            :enum {:ns finfolkdb.common.type-domain-enum/EnumTiktokConnectionStatus}
            :sql {:default "pending"}}
   :credential-ciphertext {:type :text}
   :access-expires-at {:type :timestamptz}
   :refresh-expires-at {:type :timestamptz}
   :oauth-hash {:type :text}
   :oauth-expires-at {:type :timestamptz}
   :oauth-nonce-hash {:type :text}
   :last-success {:type :timestamptz}
   :next-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :lease-until {:type :timestamptz}
   :cursor {:type :text}
   :failures {:type :integer :required true :sql {:default 0}}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}])
