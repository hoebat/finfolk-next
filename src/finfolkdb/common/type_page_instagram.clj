(ns finfolkdb.common.type-page-instagram
  "Page-owned Instagram collection, independent of member messaging and logbooks."
  (:require [lang.core :as l] [postgres.entity :as et]
            [finfolkdb.common.type-directory-base :as page]
            [finfolkdb.common.type-user :as user]))
(l/script :postgres
 {:require [[postgres.core :as pg] [finfolkdb.common.type-directory-base :as page]
            [finfolkdb.common.type-user :as user]]
  :static {:application ["finfolk-entity"] :all {:schema ["finfolk"]}}})
(deftype.pg ^{:final true :! (et/E {:class :0d/entry :access :access/system :track :track/none})}
 PageInstagramConnection
 "Separate encrypted Facebook User grant for @finfolk.com.au Business Discovery."
 [:key {:type :text :required true :sql {:unique true}}
  :app-id {:type :text :required true}
  :caller-id {:type :text :required true}
  :credential-ciphertext {:type :text}
  :expires-at {:type :long}
  :generation {:type :integer :required true :sql {:default 1}}
  :enabled {:type :boolean :required true :sql {:default false}}
  :status {:type :text :required true :sql {:default "not_connected"}}
  :last-error {:type :text :required true :sql {:default ""}}
  :checked-at {:type :long}])
(deftype.pg ^{:final true :! (et/E {:class :0d/entry :access :access/system :track :track/none})}
 PageInstagramSource
 "A reviewed page handle, current manager authority and explicit public-display choice."
 [:listing {:type :ref :required true :ref {:ns finfolkdb.common.type-directory-base/DirectoryListing} :sql {:cascade true :unique ["page_handle"]}}
  :handle {:type :text :required true :sql {:unique ["page_handle"]}}
  :instagram-id {:type :text}
  :authorised-by {:type :ref :required true :ref {:ns finfolkdb.common.type-user/User}}
  :enabled {:type :boolean :required true :sql {:default false}}
  :public-enabled {:type :boolean :required true :sql {:default false}}
  :status {:type :text :required true :sql {:default "pending"}}
  :revision {:type :integer :required true :sql {:default 1}}
  :last-error {:type :text :required true :sql {:default ""}}
  :last-checked {:type :long}
  :last-success {:type :long}
  :next-at {:type :long :required true :sql {:default (pg/time-us)}}
  :cursor {:type :text}
  :seen {:type :integer :required true :sql {:default 0}}
  :lease {:type :uuid}
  :lease-until {:type :long}])
(deftype.pg ^{:final true :! (et/E {:class :0d/entry :access :access/system :track :track/none :addons [:detail]})}
 PageInstagramPost
 "Attributed source material; visibility requires a current published page and explicit consent."
 [:source {:type :ref :required true :ref {:ns -/PageInstagramSource} :sql {:cascade true :unique ["source_media"]}}
  :media-id {:type :text :required true :sql {:unique ["source_media"]}}
  :caption {:type :text :required true :sql {:default ""}}
  :permalink {:type :text :required true}
  :media-type {:type :text :required true}
  :published-at {:type :long :required true :sql {:index true}}
  :captured-at {:type :long :required true :sql {:default (pg/time-us)}}
  :state {:type :text :required true :sql {:default "pending"}}])
