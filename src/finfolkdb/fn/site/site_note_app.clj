(ns finfolkdb.fn.site.site-note-app
  "Native note entrypoints. Verified UUIDs and administrator roles belong to the server."
  (:require [lang.core :as l] [clojure.string :as str]
            [finfolkdb.schema.note-contracts :as contracts]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.fn.site.site-notes :as notes]
             [finfolkdb.fn.user.user-account :as account]
             [finfolkdb.common.type-user :as users]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} call-native-notes [:uuid i-user :boolean i-verified :text i-operation :jsonb i-values]
  (when (not= i-operation "public-list")
    (when (not (pg/coalesce i-verified false)) [:raise-exception "Verified member required"])
    [:perform (account/ret-account i-user)])
  (let [(:boolean v-admin) (pg/t:exists users/UserRole {:where {:user i-user :role "admin"}})
        (:uuid v-site) (:uuid (:->> i-values "site"))
        (:uuid v-id) (:uuid (:->> i-values "id"))]
    [:perform (#{"set_config"} "finfolk.actor_id" (pg/coalesce (:text i-user) "") true)]
    [:perform (#{"set_config"} "finfolk.directory_admin" (:text v-admin) true)]
    (cond
      (or (== i-operation "public-list") (== i-operation "list"))
      (return (|| (notes/ret-site-notes v-site (pg/coalesce (:->> i-values "sort") "helpful")
                    (pg/coalesce (:->> i-values "topic") "all")
                    (pg/coalesce (:integer (:->> i-values "offset")) 0) (== i-operation "list"))
                   (pg/jsonb-build-object "enabled" true)))
      (== i-operation "save") (return (notes/save-site-note v-site v-id (:->> i-values "topic") (:->> i-values "text") (:date (nullif (:->> i-values "observedOn") "")) (:integer (:->> i-values "revision"))))
      (== i-operation "vote") (return (pg/case [(:->> i-values "vote") :is-not-null]
                                (notes/set-site-note-rating v-site v-id (:integer (:->> i-values "vote"))) true
                                (notes/set-site-note-vote v-site v-id (:boolean (:->> i-values "upvoted")))))
      (== i-operation "withdraw") (return (notes/set-site-note-withdrawn v-site v-id (:integer (:->> i-values "revision")) (:boolean (:->> i-values "withdrawn"))))
      (== i-operation "report") (return (notes/report-site-note v-site v-id (:->> i-values "reason")))
      (== i-operation "moderate") (return (notes/moderate-site-note v-site v-id (:boolean (:->> i-values "hidden"))))
      :else [:raise-exception "Unknown note operation"])))
(doseq [[_ spec] (sort-by key contracts/OPERATIONS)]
  (eval (list 'defn.pg (with-meta (symbol (str/replace (:rpc spec) "_" "-")) {:- [:jsonb]})
              [:uuid 'i-user :boolean 'i-verified :jsonb 'i-values]
              (list 'return (list '-/call-native-notes 'i-user 'i-verified (:action spec) 'i-values)))))
