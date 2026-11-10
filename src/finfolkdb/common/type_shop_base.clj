(ns finfolkdb.common.type-shop-base
  "Native Finnies wallet, catalogue and immutable redemption records."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-user :as tu]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as tu]]
   :static {:application ["finfolk-entity"]
            :all {:schema ["finfolk"]}}})

(defenum.pg EnumFinnieRedemptionStatus [:claimed :fulfilled :refunded])

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  FinnieAccount
  [:id {:type :uuid :primary true :required true :sql {:default (pg/gen-random-uuid)}}
   :user {:type :ref :required true
          :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :unique ["user"]}}
   :imported-points {:type :bigint :required true :sql {:default 0}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  FinnieItem
  [:id {:type :uuid :primary true :required true :sql {:default (pg/gen-random-uuid)}}
   :title {:type :text :required true}
   :outlet {:type :text :required true}
   :description {:type :text :required true :sql {:default ""}}
   :instructions {:type :text :required true :sql {:default ""}}
   :cost {:type :integer :required true}
   :stock {:type :integer}
   :revision {:type :integer :required true :sql {:default 1}}
   :active {:type :boolean :required true :sql {:default false}}
   :expires-at {:type :timestamptz}
   :updated-at {:type :timestamptz :required true :sql {:default (pg/now)}}]
  {:constraints {:positive-cost (> #{"cost"} 0)
                 :positive-revision (> #{"revision"} 0)
                 :valid-stock (or [#{"stock"} :is-null] (>= #{"stock"} 0))
                 :valid-title (and (>= (pg/length #{"title"}) 1) (<= (pg/length #{"title"}) 160))
                 :valid-outlet (and (>= (pg/length #{"outlet"}) 1) (<= (pg/length #{"outlet"}) 160))}})

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  FinnieRedemption
  [:id {:type :uuid :primary true :required true :sql {:default (pg/gen-random-uuid)}}
   :account {:type :ref :required true :ref {:ns -/FinnieAccount}
          :sql {:unique ["request"]}}
   :item {:type :ref :required true :ref {:ns -/FinnieItem}}
   :request-key {:type :uuid :required true :sql {:unique ["request"]}}
   :code {:type :uuid :required true :sql {:default (pg/gen-random-uuid) :unique ["code"]}}
   :cost {:type :integer :required true}
   :item-snapshot {:type :jsonb :required true}
   :status {:type :enum :required true :enum {:ns -/EnumFinnieRedemptionStatus}
            :sql {:default "claimed"}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}
   :completed-at {:type :timestamptz}]
  {:constraints {:positive-cost (> #{"cost"} 0)}})

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  FinnieEntry
  [:id {:type :uuid :primary true :required true :sql {:default (pg/gen-random-uuid)}}
   :account {:type :ref :required true :ref {:ns -/FinnieAccount}
          :sql {:unique ["reference"]}}
   :amount {:type :bigint :required true}
   :reference {:type :text :required true :sql {:unique ["reference"]}}
   :reason {:type :text :required true}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}]
  {:constraints {:nonzero-amount (not= #{"amount"} 0)}})
