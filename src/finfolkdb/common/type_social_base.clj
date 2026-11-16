(ns finfolkdb.common.type-social-base
  "Reusable social provider identities and handles."
  (:require [lang.core :as l]
            [postgres.entity :as et]
            [finfolkdb.common.type-system-base :as tsb]
            [finfolkdb.common.type-domain-enum :as domain]
            [finfolkdb.common.type-social-account :as account]))

;;
;; Namespace relationships
;;
;; [User / DirectoryListing] --1D addon--> [Social] --owner--> [SocialHandle]
;;

(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-system-base :as tsb]
             [finfolkdb.common.type-domain-enum :as domain]
             [finfolkdb.common.type-social-account :as account]]
   :static {:application ["finfolk-entity"]
            :all         {:schema ["finfolk"]}}})

;;
;; Social
;;

(deftype.pg ^{:final true
              :! (et/E {:class    :1d/base
                        :basis    #{:table}
                        :provides {:priority 63
                                   :key      :social}
                        :columns  {:class-ref {:type :uuid}}})}
  Social
  "Social identities scoped to an owning entity."
  [])

;;
;; SocialHandle
;;



(deftype.pg ^{:finfolk/legacy-tables ["directory_socials"]
              :final true
              :! (et/E {:class   :1d/log
                        :id      :id/v4
                        :track   :track/data
                        :owner   -/Social
                        :columns {:class-table {:sql {:unique ["handle"]}}}})}
  SocialHandle
  "A provider handle; uniqueness is scoped to the owning entity class."
  [:account     {:type :ref
                 :ref {:ns finfolkdb.common.type-social-account/SocialAccount}}
   :type        {:type :enum :required true
                 :enum {:ns finfolkdb.common.type-domain-enum/EnumSocialProvider}
                 :sql {:unique ["handle"]}}
   :handle      {:type :text :required true
                 :sql {:unique ["handle"]}}
   :is-verified {:type :boolean :required true
                 :sql {:default false}}
   :verified-at {:type :long}])

;;
;; Public Social Links
;;

(defn.pg ^{:%% :sql :- [:text] :props [:immutable :parallel-safe]}
  ret-social-url
  [:text i-identity]
  (case (pg/split-part i-identity ":" 1)
    "instagram" (|| "https://www.instagram.com/" (pg/split-part i-identity ":" 2) "/")
    "tiktok" (|| "https://www.tiktok.com/@" (pg/split-part i-identity ":" 2))
    nil))

(defn.pg ^{:%% :sql :- [:jsonb] :props [:immutable :parallel-safe]}
  ret-social-urls
  [:jsonb i-identities]
  [:select (pg/coalesce (pg/jsonb-agg (-/ret-social-url #{"value"})) (:jsonb "[]")) :from
   (pg/jsonb-array-elements-text (pg/coalesce i-identities (:jsonb "[]"))) :where
   [(-/ret-social-url #{"value"}) :is-not-null]])
