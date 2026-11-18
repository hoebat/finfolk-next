(ns finfolkdb.fn.directory.directory-app
  "Trusted native Auth binding for the directory's Clojure-authored database lifecycle."
  (:require [lang.core :as l] [clojure.string :as str]
            [finfolkdb.schema.directory-contracts :as contracts]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.fn-system-util :as util]
             [finfolkdb.fn.directory.directory-manage :as directory]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.common.type-user :as users]
             [finfolkdb.common.type-user-access :as access]
             [finfolkdb.common.type-directory-base :as listings]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} call-native-directory [:uuid i-user :boolean i-verified :text i-operation :jsonb i-values]
  (when [i-user :is-not-null] [:perform (account/ret-account i-user)])
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}})
        o-result nil]
    [:perform (#{"set_config"} "finfolk.actor_id" (pg/coalesce (:text i-user) "") true)]
    [:perform (#{"set_config"} "finfolk.directory_verified" (:text (pg/coalesce i-verified false)) true)]
    [:perform (#{"set_config"} "finfolk.directory_admin" (:text v-admin) true)]
    [:execute "SELECT finfolk_rpc.directory_operation($1->>'operation',$1->'values')" :into o-result :using
     (pg/jsonb-build-object "operation" i-operation "values" i-values)]
    (return o-result)))
;; One emitted signature per operation keeps RPC catalog/result types precise.
(doseq [[_ spec] (sort-by key contracts/OPERATIONS)]
  (eval (list 'defn.pg (with-meta (symbol (str/replace (:rpc spec) "_" "-")) {:- [:jsonb]})
              [:uuid 'i-user :boolean 'i-verified :jsonb 'i-values]
              (list 'return (list '-/call-native-directory 'i-user 'i-verified (:action spec) 'i-values)))))

;; Completion accepts only the trusted provider adapter's bounded projection.
(defn.pg ^{:- [:jsonb]} native-directory-discovery-finish [:uuid i-user :boolean i-verified :jsonb i-values]
  (return (-/call-native-directory i-user i-verified "discovery-finish" i-values)))
