(ns finfolkdb.fn.site.site-review
  "Typed native site commands; Auth UUID and administrator role are server-owned."
  (:require [lang.core :as l] [clojure.string :as str] [finfolkdb.schema.site-review-contracts :as contracts]))
(l/script :postgres
  {:require [[postgres.core :as pg] [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.common.type-user :as users] [finfolkdb.common.type-site-base :as sites]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} call-native-site-review [:uuid i-user :boolean i-verified :text i-operation :jsonb i-values]
  [:perform (account/ret-account i-user)]
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}}) o-result nil]
    [:perform (#{"set_config"} "finfolk.actor_id" (:text i-user) true)]
    [:perform (#{"set_config"} "finfolk.site_verified" (:text (pg/coalesce i-verified false)) true)]
    [:perform (#{"set_config"} "finfolk.site_admin" (:text v-admin) true)]
    [:execute "SELECT finfolk_rpc.native_site_review_operation($1->>'operation',$1->'values')" :into o-result :using (pg/jsonb-build-object "operation" i-operation "values" i-values)]
    (return o-result)))
(doseq [[_ spec] (sort-by key contracts/OPERATIONS)]
  (eval (list 'defn.pg (with-meta (symbol (str/replace (:rpc spec) "_" "-")) {:- [:jsonb]})
              [:uuid 'i-user :boolean 'i-verified :jsonb 'i-values]
              (list 'return (list '-/call-native-site-review 'i-user 'i-verified (:action spec) 'i-values)))))
