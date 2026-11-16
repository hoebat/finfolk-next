(ns finfolkdb.common.type-site-note
  "Public site observations and account-scoped helpful votes."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-site :as sites]
            [finfolkdb.common.type-user :as users]
            [finfolkdb.common.type-system-base :as system]
            [finfolkdb.common.type-system-seed :as seed]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-site :as sites]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-system-base :as system]
             [finfolkdb.common.type-system-seed :as seed]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(defenum.pg EnumSiteNoteTopic [:access :facilities :wildlife :conditions])

;; Notes use the shared revision stream. Votes are relationships,
;; not a cached counter, so account removal cannot leave an inflated score.
(deftype.pg ^{:final true
              :! (et/E {:class  :0d/entry
                        :addons [:rev]})}
  SiteNote
  [:site        {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-system-site/Site}
                 :sql {:cascade true :index true}}
   :author      {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true :index true}}
   :topic       {:type :enum :required true
                 :enum {:ns -/EnumSiteNoteTopic}}
   :body        {:type :text :required true
                 :sql {:process [[finfolkdb.common.type-system-seed/as-bounded-text 10 1000]]
                       :constraint
                       (== #{"body"}
                           (finfolkdb.common.type-system-seed/as-bounded-text #{"body"} 10 1000))}}
   :observed-on {:type :date
                 :sql {:process [[finfolkdb.common.type-system-seed/as-finite-date]]
                       :constraint (== #{"observed_on"}
                                       (finfolkdb.common.type-system-seed/as-finite-date
                                        #{"observed_on"}))}}
   :withdrawn   {:type :boolean :required true
                 :sql {:default false}}
   :hidden      {:type :boolean :required true
                 :sql {:default false}}]
  {:constraints {:observation-required (or (not= #{"topic"} "conditions")
                                           [#{"observed_on"} :is-not-null])}})

(deftype.pg ^{:final true :! (et/E {:class :0d/entry})}
  SiteNoteVote
  [:note  {:type :ref :required true
           :ref {:ns -/SiteNote} :sql {:cascade true :unique ["entity_key"]}}
   :voter {:type :ref :required true
           :ref {:ns finfolkdb.common.type-user/User}
           :sql {:cascade true :index true :unique ["entity_key"]}}])

(deftype.pg ^{:final true :! (et/E {:class :0d/entry})}
  SiteNoteReport
  [:note        {:type :ref :required true
                 :ref {:ns -/SiteNote} :sql {:cascade true :unique ["entity_key"]}}
   :reporter    {:type :ref :required true
                 :ref {:ns finfolkdb.common.type-user/User}
                 :sql {:cascade true :index true :unique ["entity_key"]}}
   :reason      {:type :text :required true
                 :sql {:process [[finfolkdb.common.type-system-seed/as-bounded-text 1 1000]]
                       :constraint
                       (== #{"reason"}
                           (finfolkdb.common.type-system-seed/as-bounded-text #{"reason"} 1 1000))}}
   :resolved-at {:type :long}])
