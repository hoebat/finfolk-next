(ns finfolkdb.fn.site.site-catalog
  "Typed public atlas entrypoints over the canonical native entity projection."
  (:require [lang.core :as l]))
(l/script :postgres
  {:require [[postgres.core :as pg]
             [finfolkdb.common.type-site-base :as sites]
             [finfolkdb.common.type-user :as users]]
   :static {:application ["finfolk-entity"] :all {:schema ["finfolk_rpc"]}}})
(defn.pg ^{:- [:jsonb]} native-public-site-catalog []
  (let [o-result nil]
    [:execute "SELECT finfolk_rpc.native_site_catalog()" :into o-result]
    (return o-result)))
(defn.pg ^{:- [:jsonb]} native-public-site-detail [:uuid i-site]
  (let [o-result nil]
    [:execute "SELECT finfolk_rpc.native_site_detail($1)" :into o-result :using i-site]
    (return o-result)))
(defn.pg ^{:- [:jsonb]} native-public-popular []
  (let [o-result nil]
    [:execute "SELECT finfolk_rpc.native_discover_popular()" :into o-result]
    (return o-result)))
