(ns finfolkdb.fn.event.event-manage
  "Typed event lifecycle with atomic addon initialization."
  (:require [lang.core :as l]))

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-seed :as tss]
             [finfolkdb.common.type-user-access :as tua]
             [finfolkdb.common.type-event :as te]
             [finfolkdb.fn.helper.helper-entity :as he]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk_rpc"]}}})

;;
;; Event Creation
;;

(defn.pg insert-event
  "Creates a draft event and its private addon streams in one transaction."
  [:uuid i-listing-id :jsonb i-document :text i-visibility
   :timestamptz i-starts-at :timestamptz i-ends-at :text i-timezone :jsonb o-op]
  (let [(:uuid v-id) (pg/uuid-generate-v4)
        o-document (tss/as-jsonb i-document)
        o-base (he/insert-base-addons "Event" (:text v-id) o-document o-op)
        o-access (pg/t:insert tua/Access
                   {:class-table "Event" :class-context "Global" :class-ref (:text v-id)
                    :setting "closed"}
                   {:track o-op})
        o-event (pg/t:insert te/Event
                  {:id v-id :listing i-listing-id :detail o-document
                   :visibility i-visibility :starts-at i-starts-at :ends-at i-ends-at
                   :timezone i-timezone :capacity (:integer (:->> o-document "capacity"))
                   :rev (:uuid (:->> o-base "rev")) :audit (:uuid (:->> o-base "audit")) :access (pg/id o-access)}
                  {:track o-op :returning #{:*/standard :detail}})]
    (return o-event)))
