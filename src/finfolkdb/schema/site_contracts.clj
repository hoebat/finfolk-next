(ns finfolkdb.schema.site-contracts
  (:require [finfolkdb.schema.directory-contracts :as d]
            [finfolkdb.schema.site-review-contracts :as review]))
(def POINT (d/array-of {:type "number"}))
(def SITE (d/object (merge (:properties review/DOCUMENT) {:id d/U :name d/S :timezone d/S :state d/S :state_id d/S :area_name d/S :area_id d/S :point POINT
                     :region d/S :waterbody d/S :access_mode d/S :revision d/N :catalog_managed d/B :description d/S
                     :source_url d/S :source_id d/S :reference_label d/S :attribution d/S :licence d/S
                     :facts (d/array-of (assoc-in review/FACT [:properties :category] d/S))
                     :aliases (d/array-of d/S) :features (d/array-of d/S) :activities (d/array-of d/S)})
                    ["id" "name" "timezone" "state" "state_id" "area_name" "area_id" "point" "region" "waterbody" "access_mode" "revision" "catalog_managed" "description" "source_url" "source_id" "reference_label" "attribution" "licence" "aliases" "features" "activities"]))
(def CATALOG (d/object {:revision d/N :beaches (d/array-of SITE)
                        :states (d/array-of (d/object {:id d/S :name d/S} ["id" "name"]))
                        :areas (d/array-of (d/object {:id d/S :name d/S :state_id d/S :center POINT} ["id" "name" "state_id" "center"]))
                        :sources (d/array-of d/S) :location_note d/S}
                       ["revision" "beaches" "states" "areas" "sources" "location_note"]))
(defn op [rpc arguments request result]
  {:rpc rpc :arguments arguments :actor "server" :request request :result result :write false :public true :not-found "Dive site unavailable."})
(def OPERATIONS
  {"siteCatalog" (op "native_public_site_catalog" [] d/E CATALOG)
   "siteDetail" (op "native_public_site_detail" ["id"] d/ID SITE)
   "discoverPopular" (op "native_public_popular" [] d/E (d/object {:places (d/array-of d/U)} ["places"]))})
