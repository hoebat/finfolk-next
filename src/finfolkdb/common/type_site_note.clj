(ns finfolkdb.common.type-site-note
  "Public site observations and account-scoped helpful votes."
  (:require [lang.core :as l] [postgres.entity :as et]
            [finfolkdb.common.type-system-site :as sites]
            [finfolkdb.common.type-user :as users]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-user :as users]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk"]}}})

(defenum.pg EnumSiteNoteTopic [:access :facilities :wildlife :conditions])

;; Notes have their own explicit timestamps/revision. Votes are relationships,
;; not a cached counter, so account removal cannot leave an inflated score.
(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  SiteNote
  [:id          {:type :uuid :primary true}
   :beach       {:type :ref :required true :ref {:ns finfolkdb.common.type-system-site/Beach} :sql {:cascade true :index true}}
   :author      {:type :ref :required true :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :topic       {:type :enum :required true :enum {:ns -/EnumSiteNoteTopic}}
   :body        {:type :text :required true}
   :observed-on {:type :date}
   :withdrawn   {:type :boolean :required true :sql {:default false}}
   :hidden      {:type :boolean :required true :sql {:default false}}
   :revision    {:type :integer :required true :sql {:default 1}}
   :created-at  {:type :timestamptz :required true :sql {:default (pg/now)}}
   :updated-at  {:type :timestamptz :required true :sql {:default (pg/now)}}]
  {:constraints {:bounded-body (and (>= (pg/length (pg/btrim #{"body"})) 10)
                                   (<= (pg/length #{"body"}) 1000))
                 :observation-required (or (not= #{"topic"} "conditions") [#{"observed_on"} :is-not-null])
                 :finite-observation (or [#{"observed_on"} :is-null] (#{"isfinite"} #{"observed_on"}))
                 :positive-revision (> #{"revision"} 0)}})

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  SiteNoteVote
  [:note       {:type :ref :required true :primary "default" :ref {:ns -/SiteNote} :sql {:cascade true}}
   :voter      {:type :ref :required true :primary "default" :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :created-at {:type :timestamptz :required true :sql {:default (pg/now)}}])

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :id :id/none :track :track/none :access :none})}
  SiteNoteReport
  [:note        {:type :ref :required true :primary "default" :ref {:ns -/SiteNote} :sql {:cascade true}}
   :reporter    {:type :ref :required true :primary "default" :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :reason      {:type :text :required true}
   :created-at  {:type :timestamptz :required true :sql {:default (pg/now)}}
   :resolved-at {:type :timestamptz}]
  {:constraints {:bounded-reason (and (>= (pg/length (pg/btrim #{"reason"})) 1)
                                     (<= (pg/length #{"reason"}) 1000))}})
