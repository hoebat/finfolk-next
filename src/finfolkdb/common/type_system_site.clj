(ns finfolkdb.common.type-system-site
  (:require [lang.core :as l]
            [postgres.entity :as et]))

(l/script :postgres
  {:require [[postgres.core :as pg]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Beach
;;

(deftype.pg ^{:finfolk/legacy-tables ["beaches"]
              :final true
              :! (et/E {:class  :0d/entry
                        :id     :id/none
                        :track  :track/none
                        :access :none})}
  Beach
  [:id        {:type :text :primary true}
   :name      {:type :text :required true}
   :timezone  {:type :text :required true}
   :area-name {:type :text :required true :sql {:default ""}}
   :state     {:type :text :required true :sql {:default ""}}])

