(ns finfolkdb.common.type-event
  "Events and attendance with shared access, audit and revision providers."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-user :as tu]
            [finfolkdb.common.type-user-access :as tua]
            [finfolkdb.common.type-directory-base :as tdb]
            [finfolkdb.common.type-domain-enum :as tde]))

;;
;; Namespace relationships
;;
;; [DirectoryListing] --organises--> [Event] --attendance--> [EventRsvp] --> [User]
;; [Event] --addons--> [Access / Rev / Audit]; private email invites use Access.
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-user :as tu]
             [finfolkdb.common.type-user-access :as tua]
             [finfolkdb.common.type-directory-base :as tdb]
             [finfolkdb.common.type-domain-enum :as tde]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Event
;;

(deftype.pg ^{:finfolk/legacy-tables ["events"]
              :final true
              :! (et/E {:class  :0d/entry
                        :addons [:detail :rev :audit :access]})}
  Event
  [:listing    {:type :ref :required true
                :ref {:ns finfolkdb.common.type-directory-base/DirectoryListing}
                :sql {:index true}}
   :status     {:type :enum :required true
                :enum {:ns finfolkdb.common.type-domain-enum/EnumEventStatus}
                :sql {:default "draft" :index true}}
   :visibility {:type :enum :required true
                :enum {:ns finfolkdb.common.type-domain-enum/EnumEventVisibility}
                :sql {:default "public"}}
   :starts-at  {:type :long :required true}
   :ends-at    {:type :long :required true}
   :timezone   {:type :text :required true}
   :capacity   {:type :integer}
   :hidden     {:type :boolean :required true
                :sql {:default false}}]
  {:constraints {:positive-capacity (> #{"capacity"} 0)
                 :ordered-times (> #{"ends_at"} #{"starts_at"})}})

;;
;; EventRsvp
;;

(deftype.pg ^{:finfolk/legacy-tables ["event_rsvps"] :final true :! (et/E {:class :0d/entry})}
  EventRsvp
  [:event  {:type :ref :required true
            :ref {:ns -/Event} :sql {:unique ["entity_key"]}}
   :member {:type :ref :required true
            :ref {:ns finfolkdb.common.type-user/User}
            :sql {:cascade true :index true :unique ["entity_key"]}}
   :status {:type :enum :required true
            :enum {:ns finfolkdb.common.type-domain-enum/EnumEventRsvpStatus}}])

(deftype.pg ^{:final true :! (et/E {:class :0d/entry :track :track/none :access :none})}
  EventInviteDelivery
  "Server-only invitation outbox. Link tokens are encrypted until acknowledged or cancelled."
  [:event {:type :ref :required true :ref {:ns -/Event} :sql {:cascade true}}
   :invite-id {:type :uuid :required true :sql {:unique ["invite"]}}
   :requester {:type :ref :required true :ref {:ns finfolkdb.common.type-user/User} :sql {:cascade true}}
   :state {:type :text :required true :sql {:default "queued"}}
   :sealed-token {:type :text :required true :scope :-/hidden :sql {:default ""}}
   :attempts {:type :integer :required true :sql {:default 0}}
   :lease {:type :uuid :scope :-/hidden}
   :lease-until {:type :long :required true :sql {:default 0}}
   :receipt {:type :text :required true :sql {:default ""}}
   :error {:type :text :required true :sql {:default ""}}
   :time-created {:type :long :required true :sql {:default (pg/time-us)}}
   :time-updated {:type :long :required true :sql {:default (pg/time-us)}}]
  {:constraints {:state-valid (or (== #{"state"} "queued") (== #{"state"} "sending") (== #{"state"} "sent") (== #{"state"} "failed") (== #{"state"} "cancelled"))
                 :attempts-valid (and (>= #{"attempts"} 0) (<= #{"attempts"} 5))}})
