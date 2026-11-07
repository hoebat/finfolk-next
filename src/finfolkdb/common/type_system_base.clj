(ns finfolkdb.common.type-system-base
  "Shared operation, revision and audit elements."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-seed :as tss]))

;;
;; Namespace relationships
;;
;; [domain entities] --2D addons--> [Rev / Audit] --owner--> [RevLog / AuditLog]
;; [Op] records authenticated operation context; addons retain scoped identities.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

(defonce +run+
  [(et/init-addons)])

;;
;; Op
;;

(deftype.pg ^{:final true
              :! (et/E {:id     :id/v4
                        :access :access/system})}
  Op
  "Mutation context. user-id is the external authenticated identity."
  [:time    {:type :time :required true
             :sql {:default (pg/time-us)}}
   :tag     {:type :text :required true}
   :data    {:type :jsonb :required true :sql {:default "{}"}}
   :user-id {:type :text}])

;;
;; Rev
;;

(deftype.pg ^{:final true
              :! (et/E {:class    :2d/base
                        :access   :access/system
                        :provides {:priority 99 :key :rev}
                        :columns  {:class-ref {:type :text}}})}
  Rev
  "A revision stream scoped by table and context."
  [:index   {:type :integer :required true :sql {:default 0}}
   :current {:type :jsonb :required true :sql {:default "{}"}}])

(deftype.pg ^{:final true
              :! (et/E {:class  :2d/log
                        :id     :id/none
                        :owner  -/Rev
                        :access :access/system})}
  RevLog
  "Immutable revision deltas belonging to a revision stream."
  [:version {:type :integer :required true :primary "default"}
   :deltas  {:type :jsonb :required true :sql {:default "{}"}}])

;;
;; Audit
;;

(deftype.pg ^{:final true
              :! (et/E {:class    :2d/base
                        :access   :access/system
                        :provides {:priority 67 :key :audit}
                        :columns  {:class-ref {:type :text}}})}
  Audit
  "Audit stream scoped by owning entity and context."
  [])

(deftype.pg ^{:finfolk/legacy-tables ["directory_audit" "event_audit" "post_reviews" "trip_reviews"]
              :final true
              :! (et/E {:class   :2d/log
                        :id      :id/none
                        :owner   -/Audit
                        :access  :access/system
                        :columns {:op-created {:primary "default"}}
                        :addons  [:entry]})}
  AuditLog
  "Operation entries belonging to an audit stream."
  [])

;;
;; Revision Queries
;;

(pg/defsel.pg ^{:- [-/Rev]
                :args [:text i-class-table :text i-class-context]}
  sel-rev-all
  {:class-table i-class-table :class-context i-class-context})

(defn.pg ^{:%% :sql}
  ret-rev-default
  [:text i-class-table :text i-class-context :text i-class-ref]
  (pg/t:get -/Rev
    {:where {:class-table i-class-table
             :class-context i-class-context
             :class-ref i-class-ref}}))

;;
;; Activity
;;

(deftype.pg ^{:final true
              :! (et/E {:class    :1d/base
                        :basis    #{:table}
                        :access   :access/system
                        :provides {:priority 61 :key :activity}
                        :columns  {:class-ref {:type :text}}})}
  Activity
  "Activity provider scoped by its owning table and entity identity."
  [])

;;
;; Operation Queries
;;

(defn.pg ^{:%% :sql}
  op-fn
  [:text i-tag :text i-user-id :jsonb i-data]
  (pg/t:insert -/Op
    {:tag i-tag :user-id i-user-id :data (tss/as-jsonb i-data)}))
