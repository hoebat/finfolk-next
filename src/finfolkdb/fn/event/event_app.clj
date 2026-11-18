(ns finfolkdb.fn.event.event-app
  "Native event commands bind verified UUID identity, email and DB roles."
  (:require [lang.core :as l] [clojure.string :as str]
            [finfolkdb.schema.event-contracts :as contracts]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.event.event-manage :as event]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.common.type-user :as users]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} call-native-events [:uuid i-user :boolean i-verified :text i-email :text i-operation :jsonb i-values]
  (when [i-user :is-not-null] [:perform (account/ret-account i-user)])
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}})
        o-result nil]
    [:perform (#{"set_config"} "finfolk.actor_id" (pg/coalesce (:text i-user) "") true)]
    [:perform (#{"set_config"} "finfolk.event_verified" (:text (pg/coalesce i-verified false)) true)]
    [:perform (#{"set_config"} "finfolk.event_email" (pg/coalesce i-email "") true)]
    [:perform (#{"set_config"} "finfolk.directory_admin" (:text v-admin) true)]
    [:execute "SELECT finfolk_rpc.native_event_operation($1->>'operation',$1->'values')" :into o-result :using (pg/jsonb-build-object "operation" i-operation "values" i-values)]
    (return o-result)))
(doseq [[_ spec] (sort-by key contracts/OPERATIONS)]
  (eval (list 'defn.pg (with-meta (symbol (str/replace (:rpc spec) "_" "-")) {:- [:jsonb]})
              [:uuid 'i-user :boolean 'i-verified :text 'i-email :jsonb 'i-values]
              (list 'return (list '-/call-native-events 'i-user 'i-verified 'i-email (:action spec) 'i-values)))))
